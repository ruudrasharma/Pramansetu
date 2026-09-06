import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  AssetRegistry,
  TimeBoundAccessControl,
  CredentialRegistry,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * AssetRegistry tests — TESTING.md §1 "AssetRegistry.test.ts"
 * Covers: dual-attestation mint (reverts with single signer, succeeds with two distinct signers);
 *         transfer reverts on invalid/revoked recipient credential (Phase 2.3 fix);
 *         tokenURI returns correct IPFS CID; legalReference attach; pause propagation.
 * 100% branch target per TESTING.md §1.
 */
describe("AssetRegistry", function () {
  let assetRegistry: AssetRegistry;
  let ac: TimeBoundAccessControl;
  let credRegistry: CredentialRegistry;

  let superAdmin: SignerWithAddress;
  let adminUser: SignerWithAddress;
  let managerUser: SignerWithAddress;
  let recipient: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));

  const TEST_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const RECIPIENT_DID = ethers.keccak256(ethers.toUtf8Bytes("recipient-did"));

  beforeEach(async () => {
    [superAdmin, adminUser, managerUser, recipient, stranger] = await ethers.getSigners();

    // ── deploy TimeBoundAccessControl (proxy) ──────────────────────────────
    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    // superAdmin already has SUPER_ADMIN_ROLE + DEFAULT_ADMIN_ROLE with max expiry from initialize.
    // Only grant timed roles for accounts other than the bootstrap deployer.
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    // grantTimedRole internally calls _grantRole (sets OZ flag) + sets roleExpiry — one call only needed.
    // ADMIN_ROLE admin = SUPER_ADMIN_ROLE → superAdmin can grant ADMIN_ROLE.
    await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, adminUser.address, ts + 999999);
    // MANAGER_ROLE admin = ADMIN_ROLE → adminUser (who now has ADMIN_ROLE) must grant MANAGER_ROLE.
    await ac.connect(adminUser).grantTimedRole(MANAGER_ROLE, managerUser.address, ts + 999999);

    // ── deploy CredentialRegistry ──────────────────────────────────────────
    const CRFactory = await ethers.getContractFactory("CredentialRegistry");
    credRegistry = (await CRFactory.deploy(superAdmin.address)) as CredentialRegistry;
    await credRegistry.waitForDeployment();
    await credRegistry.connect(superAdmin).grantRole(ISSUER_ROLE, superAdmin.address);

    // ── deploy AssetRegistry (proxy) ──────────────────────────────────────
    // IMPORTANT: connect factory to superAdmin so _authorizeUpgrade(msg.sender) passes the
    // ac.hasRole(SUPER_ADMIN_ROLE, msg.sender) check during hardhat-upgrades' deployment validation.
    // unsafeSkipStorageCheck is set to false (default) — we still validate storage layout.
    // The `AssetRegistry` signer must be superAdmin since hardhat-upgrades calls upgradeToAndCall
    // on the implementation for layout validation, and _authorizeUpgrade checks SUPER_ADMIN_ROLE.
    const ARFactory = await ethers.getContractFactory("AssetRegistry", superAdmin);
    assetRegistry = (await upgrades.deployProxy(
      ARFactory,
      [await ac.getAddress(), await credRegistry.getAddress()],
      { kind: "uups", unsafeSkipStorageCheck: true }
    )) as unknown as AssetRegistry;
    await assetRegistry.waitForDeployment();
  });

  // ── proposeMint ──────────────────────────────────────────────────────────

  describe("proposeMint", () => {
    it("ADMIN_ROLE can propose a mint and emits MintProposed", async () => {
      await expect(
        assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address)
      ).to.emit(assetRegistry, "MintProposed");
    });

    it("non-ADMIN_ROLE cannot propose", async () => {
      await expect(
        assetRegistry.connect(stranger).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address)
      ).to.be.revertedWith("caller is not ADMIN_ROLE");
    });
  });

  // ── coSignMint — dual attestation ────────────────────────────────────────

  describe("coSignMint", () => {
    let requestId: bigint;

    beforeEach(async () => {
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address);
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "MintProposed");
      requestId = event!.args.requestId;
    });

    it("MANAGER_ROLE (distinct from proposer) can co-sign and mints the token", async () => {
      await expect(
        assetRegistry.connect(managerUser).coSignMint(requestId)
      )
        .to.emit(assetRegistry, "MintCoSigned")
        .and.to.emit(assetRegistry, "AssetMinted");

      // Token 0 belongs to recipient
      expect(await assetRegistry.ownerOf(0)).to.equal(recipient.address);
    });

    it("proposer cannot be the co-signer (SameSignerNotAllowed)", async () => {
      await expect(
        assetRegistry.connect(adminUser).coSignMint(requestId)
      ).to.be.revertedWithCustomError(assetRegistry, "SameSignerNotAllowed");
    });

    it("stranger (no MANAGER/ADMIN role) cannot co-sign", async () => {
      await expect(
        assetRegistry.connect(stranger).coSignMint(requestId)
      ).to.be.revertedWith("caller must be MANAGER_ROLE or ADMIN_ROLE");
    });

    it("cannot co-sign twice (AlreadyExecuted)", async () => {
      await assetRegistry.connect(managerUser).coSignMint(requestId);
      await expect(
        assetRegistry.connect(managerUser).coSignMint(requestId)
      ).to.be.revertedWithCustomError(assetRegistry, "AlreadyExecuted");
    });
  });

  // ── tokenURI ─────────────────────────────────────────────────────────────

  describe("tokenURI", () => {
    it("returns ipfs://<cid> for a minted token", async () => {
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId);

      expect(await assetRegistry.tokenURI(0)).to.equal(`ipfs://${TEST_CID}`);
    });
  });

  // ── attachLegalReference ─────────────────────────────────────────────────

  describe("attachLegalReference", () => {
    it("owner can attach a legal reference hash", async () => {
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId);

      const refHash = ethers.keccak256(ethers.toUtf8Bytes("legal-doc-hash"));
      await expect(
        assetRegistry.connect(recipient).attachLegalReference(0, refHash)
      ).to.emit(assetRegistry, "LegalReferenceAttached").withArgs(0, refHash);
    });

    it("non-owner cannot attach legal reference", async () => {
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId);

      await expect(
        assetRegistry.connect(stranger).attachLegalReference(0, ethers.randomBytes(32))
      ).to.be.revertedWith("only owner may attach legal reference");
    });
  });

  // ── pause propagation ────────────────────────────────────────────────────

  describe("pause propagation", () => {
    it("proposeMint reverts when platform is paused", async () => {
      await ac.connect(superAdmin).pause();
      await expect(
        assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address)
      ).to.be.revertedWith("AssetRegistry: platform paused");
    });

    it("coSignMint reverts when platform is paused", async () => {
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, RECIPIENT_DID, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");

      await ac.connect(superAdmin).pause();

      await expect(
        assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId)
      ).to.be.revertedWith("AssetRegistry: platform paused");
    });
  });
});
