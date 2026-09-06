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
  let adminUser: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

  beforeEach(async () => {
    [superAdmin, adminUser, stranger] = await ethers.getSigners();
  });

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
    });

    it("upgrade preserves existing role state", async () => {
      const expiryBefore = await ac.roleExpiry(ADMIN_ROLE, adminUser.address);
      expect(expiryBefore).to.be.gt(0);

      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      const upgraded = (await upgrades.upgradeProxy(
        await ac.getAddress(),
        Factory.connect(superAdmin)
      )) as unknown as TimeBoundAccessControl;
      await upgraded.waitForDeployment();

      // State preserved: same proxy address, same role expiry
      expect(await upgraded.getAddress()).to.equal(await ac.getAddress());
      expect(await upgraded.roleExpiry(ADMIN_ROLE, adminUser.address)).to.equal(expiryBefore);
    });

    it("non-SUPER_ADMIN cannot upgrade", async () => {
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      await expect(
        upgrades.upgradeProxy(await ac.getAddress(), Factory.connect(stranger))
      ).to.be.reverted;
    });

    it("upgrade is storage-layout safe (no reordering detection)", async () => {
      // upgradeProxy would revert with a storage layout violation if we changed
      // variable order. This test ensures the unchanged contract compiles and upgrades cleanly.
      const Factory = await ethers.getContractFactory("TimeBoundAccessControl");
      await expect(
        upgrades.upgradeProxy(await ac.getAddress(), Factory.connect(superAdmin))
      ).to.not.be.reverted;
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

      const ARFactory = await ethers.getContractFactory("AssetRegistry");
      const upgraded = (await upgrades.upgradeProxy(
        await ar.getAddress(),
        ARFactory.connect(superAdmin)
      )) as unknown as AssetRegistry;
      await upgraded.waitForDeployment();

      // Token still owned by recipient post-upgrade
      expect(await upgraded.ownerOf(0)).to.equal(recipient.address);
      expect(await upgraded.tokenURI(0)).to.equal("ipfs://bafybeigtest123");
    });

    it("non-SUPER_ADMIN cannot upgrade AssetRegistry", async () => {
      const ARFactory = await ethers.getContractFactory("AssetRegistry");
      await expect(
        upgrades.upgradeProxy(await ar.getAddress(), ARFactory.connect(stranger))
      ).to.be.reverted;
    });
  });
});
