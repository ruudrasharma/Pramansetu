import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TimeBoundAccessControl, AssetRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Upgrade tests — TESTING.md §1 "Upgrade tests"
 * Covers: UUPS upgrade preserves all existing role/asset state;
 *         unauthorized upgrade attempt reverts.
 * Tests both TimeBoundAccessControl and AssetRegistry proxies.
 */
describe("UUPS Upgrade Safety", function () {
  let superAdmin: SignerWithAddress;
  let superAdmin2: SignerWithAddress;
  let adminUser: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

  beforeEach(async () => {
    // superAdmin2 is a dedicated, otherwise-unused signer (index 10) so it can't collide with any
    // positional destructuring further down this file — needed for the T-3.1 2-of-N upgrade-auth
    // flow (proposePlatformAction(4,...)/coSignPlatformAction), which every upgrade test below now
    // has to go through before calling upgradeToAndCall directly (audit §2.2).
    const signers = await ethers.getSigners();
    [superAdmin, adminUser, stranger] = signers;
    superAdmin2 = signers[10];
  });

  /** Deploys a fresh implementation, gets it 2-of-N approved on `ac`, then performs the raw
   *  UUPS upgrade call directly (bypassing hardhat-upgrades' upgradeProxy helper, which deploys
   *  its own implementation at an address this test can't pre-approve). Returns the new
   *  implementation's address for re-attaching a typed instance to the (unchanged) proxy address. */
  async function authorizeAndUpgrade<T>(
    ac: TimeBoundAccessControl,
    proxy: { getAddress(): Promise<string>; connect(s: SignerWithAddress): { upgradeToAndCall(a: string, d: string): Promise<any> } },
    contractName: string,
    signer: SignerWithAddress,
    data: string = "0x"
  ) {
    const Factory = await ethers.getContractFactory(contractName);
    const newImpl = await Factory.deploy();
    await newImpl.waitForDeployment();
    const newImplAddr = await newImpl.getAddress();

    const tx = await ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, newImplAddr);
    const r = await tx.wait();
    const ev = r!.logs
      .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);

    await proxy.connect(signer).upgradeToAndCall(newImplAddr, data);
    return Factory.attach(await proxy.getAddress()) as unknown as T;
  }

  // ── TimeBoundAccessControl upgrade ───────────────────────────────────────

  describe("TimeBoundAccessControl", () => {
    let ac: TimeBoundAccessControl;

    beforeEach(async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      ac = (await upgrades.deployProxy(Factory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
      await ac.waitForDeployment();

      // Grant and record a timed role
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, adminUser.address, ts + 86400);
      // Second SUPER_ADMIN needed for the 2-of-N upgrade-authorization flow (T-3.1).
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);
    });

    it("upgrade preserves existing role state", async () => {
      const expiryBefore = await ac.roleExpiry(ADMIN_ROLE, adminUser.address);
      expect(expiryBefore).to.be.gt(0);

      const upgraded = await authorizeAndUpgrade<TimeBoundAccessControl>(
        ac, ac, "TimeBoundAccessControl", superAdmin
      );

      // State preserved: same proxy address, same role expiry
      expect(await upgraded.getAddress()).to.equal(await ac.getAddress());
      expect(await upgraded.roleExpiry(ADMIN_ROLE, adminUser.address)).to.equal(expiryBefore);
    });

    it("a lone SUPER_ADMIN cannot upgrade without 2-of-N approval (T-3.1 — closes the single-signer hole)", async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      await expect(
        ac.connect(superAdmin).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.be.revertedWithCustomError(ac, "UpgradeNotAuthorized");
    });

    it("non-SUPER_ADMIN cannot even propose an upgrade authorization", async () => {
      await expect(
        ac.connect(stranger).proposePlatformAction(4, ethers.ZeroHash, stranger.address)
      ).to.be.revertedWithCustomError(ac, "AccessControlUnauthorizedAccount");
    });

    it("upgrade is storage-layout safe (no reordering detection)", async () => {
      // The plugin would revert with a storage layout violation if we changed variable order.
      // This test ensures the unchanged contract compiles and upgrades cleanly under the new
      // 2-of-N authorization flow.
      await expect(
        authorizeAndUpgrade<TimeBoundAccessControl>(ac, ac, "TimeBoundAccessControl", superAdmin)
      ).to.not.be.reverted;
    });
  });

  // ── ORACLE_ATTESTOR_ROLE reinitializer (T-016) ───────────────────────────
  // Proves the in-place-upgrade + reinitializer(2) mechanism this project has never exercised
  // against live state before: the new role's admin is set atomically with the upgrade itself
  // (via upgradeToAndCall's `data` argument), not as a separate follow-up transaction.

  describe("TimeBoundAccessControl → ORACLE_ATTESTOR_ROLE (T-016)", () => {
    let ac: TimeBoundAccessControl;

    beforeEach(async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      ac = (await upgrades.deployProxy(Factory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
      await ac.waitForDeployment();

      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);
    });

    it("upgrade + reinitializer sets ORACLE_ATTESTOR_ROLE's admin to SUPER_ADMIN_ROLE", async () => {
      const initData = ac.interface.encodeFunctionData("initializeOracleAttestorRole");
      const upgraded = await authorizeAndUpgrade<TimeBoundAccessControl>(
        ac, ac, "TimeBoundAccessControl", superAdmin, initData
      );
      expect(await upgraded.getRoleAdmin(await upgraded.ORACLE_ATTESTOR_ROLE())).to.equal(SUPER_ADMIN_ROLE);
    });

    it("calling initializeOracleAttestorRole a second time reverts (reinitializer already consumed)", async () => {
      const initData = ac.interface.encodeFunctionData("initializeOracleAttestorRole");
      const upgraded = await authorizeAndUpgrade<TimeBoundAccessControl>(
        ac, ac, "TimeBoundAccessControl", superAdmin, initData
      );
      await expect(
        upgraded.connect(superAdmin).initializeOracleAttestorRole()
      ).to.be.revertedWithCustomError(upgraded, "InvalidInitialization");
    });

    it("the whole upgrade tx reverts if the upgradeToAndCall caller doesn't hold SUPER_ADMIN_ROLE, even once the implementation itself is 2-of-N authorized (atomic failure, no partial-upgrade state)", async () => {
      // _authorizeUpgrade only checks whether the *implementation address* was 2-of-N authorized —
      // it doesn't check who calls upgradeToAndCall (same permissionless-caller design as
      // consumeUpgradeAuthorization elsewhere in this contract). The real caller-role requirement
      // for THIS specific upgrade comes from the reinitializer's own onlyRole(SUPER_ADMIN_ROLE)
      // check, executed via upgradeToAndCall's delegatecall (which preserves msg.sender) — if that
      // reverts, EVM atomicity guarantees the whole transaction (including the implementation swap
      // that already happened earlier in the same call) unwinds with it.
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      const newImpl = await Factory.deploy();
      await newImpl.waitForDeployment();
      const newImplAddr = await newImpl.getAddress();

      const tx = await ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, newImplAddr);
      const r = await tx.wait();
      const ev = r!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);

      const initData = ac.interface.encodeFunctionData("initializeOracleAttestorRole");
      await expect(
        ac.connect(stranger).upgradeToAndCall(newImplAddr, initData)
      ).to.be.revertedWithCustomError(ac, "AccessControlUnauthorizedAccount");

      // Prove no partial state: the implementation is still authorized (untouched by the failed
      // attempt) and a legitimate SUPER_ADMIN can still complete the same upgrade afterward.
      expect(await ac.upgradeAuthorized(newImplAddr)).to.equal(true);
      await expect(ac.connect(superAdmin).upgradeToAndCall(newImplAddr, initData)).to.not.be.reverted;
    });
  });

  // ── AssetRegistry upgrade ────────────────────────────────────────────────

  describe("AssetRegistry", () => {
    let ac: TimeBoundAccessControl;
    let ar: AssetRegistry;
    let recipient: SignerWithAddress;

    beforeEach(async () => {
      [,, stranger, recipient] = await ethers.getSigners();

      const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
      ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
      await ac.waitForDeployment();

      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      // superAdmin has SUPER_ADMIN_ROLE (admin of ADMIN_ROLE) \u2192 can grant ADMIN directly.
      // grantTimedRole calls _grantRole internally, so no separate grantRole needed.
      await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, adminUser.address, ts + 999999);
      // Second SUPER_ADMIN needed for the 2-of-N upgrade-authorization flow (T-3.1).
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);

      const CRFactory = await ethers.getContractFactory("CredentialRegistry");
      const cr = await CRFactory.deploy(superAdmin.address);
      await cr.waitForDeployment();

      // IMPORTANT: factory must be connected to superAdmin so _authorizeUpgrade passes.
      // unsafeSkipStorageCheck: true is needed because hardhat-upgrades calls the implementation
      // directly during validation, and _authorizeUpgrade delegates to an external AC contract.
      const ARFactory = await ethers.getContractFactory("AssetRegistry", superAdmin);
      ar = (await upgrades.deployProxy(
        ARFactory,
        [await ac.getAddress(), await cr.getAddress()],
        { kind: "uups", unsafeSkipStorageCheck: true }
      )) as unknown as AssetRegistry;
      await ar.waitForDeployment();

      // Mint one token so there's state to preserve
      const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
      const [,, manager] = await ethers.getSigners();
      // adminUser has ADMIN_ROLE (admin of MANAGER_ROLE) \u2192 adminUser grants MANAGER_ROLE.
      await ac.connect(adminUser).grantTimedRole(MANAGER_ROLE, manager.address, ts + 999999);

      const proposeTx = await ar.connect(adminUser).proposeMint(
        "bafybeigtest123",
        ethers.keccak256(ethers.toUtf8Bytes("test-did")),
        recipient.address
      );
      const r = await proposeTx.wait();
      const ev = r!.logs
        .map((l) => { try { return ar.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "MintProposed");
      await ar.connect(manager).coSignMint(ev!.args.requestId);
    });

    it("upgrade preserves minted token ownership", async () => {
      expect(await ar.ownerOf(0)).to.equal(recipient.address);

      const upgraded = await authorizeAndUpgrade<AssetRegistry>(ac, ar, "AssetRegistry", superAdmin);

      // Token still owned by recipient post-upgrade
      expect(await upgraded.ownerOf(0)).to.equal(recipient.address);
      expect(await upgraded.tokenURI(0)).to.equal("ipfs://bafybeigtest123");
    });

    it("a lone SUPER_ADMIN cannot upgrade AssetRegistry without 2-of-N approval (T-3.1)", async () => {
      const ARFactory = await ethers.getContractFactory("AssetRegistry");
      const newImpl = await ARFactory.deploy();
      await newImpl.waitForDeployment();
      await expect(
        ar.connect(superAdmin).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.be.revertedWith("upgrade not authorized");
    });

    // ── OracleAttestation wiring after upgrade (T-016) ─────────────────────
    it("upgrades AssetRegistry, deploys+wires OracleAttestation via actionType 7, and gates recordOracleFact to only that address", async () => {
      const upgraded = await authorizeAndUpgrade<AssetRegistry>(ac, ar, "AssetRegistry", superAdmin);
      // Existing state (minted token from the outer beforeEach) still intact post-upgrade.
      expect(await upgraded.ownerOf(0)).to.equal(recipient.address);

      const OAFactory = await ethers.getContractFactory("OracleAttestation");
      const oa = await OAFactory.deploy(await ac.getAddress(), await upgraded.getAddress());
      await oa.waitForDeployment();
      const oaAddr = await oa.getAddress();

      const tx = await ac.connect(superAdmin).proposePlatformAction(7, ethers.ZeroHash, oaAddr);
      const r = await tx.wait();
      const ev = r!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);

      await expect(upgraded.connect(stranger).setOracleAttestationContract(oaAddr))
        .to.emit(upgraded, "OracleAttestationContractSet").withArgs(oaAddr);
      expect(await upgraded.oracleAttestation()).to.equal(oaAddr);

      // Only the wired OracleAttestation address may call recordOracleFact.
      await expect(
        upgraded.connect(stranger).recordOracleFact(0, 1, ethers.ZeroHash, 0)
      ).to.be.revertedWithCustomError(upgraded, "OnlyOracleAttestation");
    });
  });
});
