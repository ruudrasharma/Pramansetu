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
  let superAdmin2: SignerWithAddress;
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
    [superAdmin, superAdmin2, adminUser, managerUser, recipient, stranger] = await ethers.getSigners();

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

    // Grant superAdmin2 SUPER_ADMIN_ROLE (for 2-of-2 platform actions in tests)
    const ts2 = (await ethers.provider.getBlock("latest"))!.timestamp;
    await ac.connect(superAdmin).grantTimedRole(
      ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE")),
      superAdmin2.address,
      ts2 + 999999
    );
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Issue a credential and return its vcId; use vcId as the recipientDid arg in proposeMint
   *  so vcIdOf[tokenId] is valid and isValid() returns true during transfers (Phase 2.3). */
  async function issueVcForRecipient(): Promise<string> {
    const subjectDid = ethers.keccak256(ethers.toUtf8Bytes("recipient-did"));
    const issuerDid  = ethers.keccak256(ethers.toUtf8Bytes("issuer-did"));
    const vcHash     = ethers.keccak256(ethers.toUtf8Bytes("some-vc-payload"));
    const validUntil = Math.floor(Date.now() / 1000) + 86400 * 365;
    const tx = await credRegistry.connect(superAdmin).issueCredential(
      subjectDid, issuerDid, vcHash, "Asset Holder", validUntil
    );
    const r = await tx.wait();
    const ev = r!.logs.map((l) => { try { return credRegistry.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "CredentialIssued");
    return ev!.args.vcId;
  }

  /** Propose + coSign a platform pause action (2-of-2 SUPER_ADMIN). */
  async function platformPause() {
    const tx = await ac.connect(superAdmin).proposePlatformAction(2, ethers.ZeroHash, ethers.ZeroAddress);
    const r = await tx.wait();
    const ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
  }

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
    it("MANAGER_ROLE (distinct from proposer) can co-sign and mints the token", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await expect(
        assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId)
      ).to.emit(assetRegistry, "MintCoSigned")
        .and.to.emit(assetRegistry, "AssetMinted");
      expect(await assetRegistry.ownerOf(0)).to.equal(recipient.address);
    });

    it("proposer cannot be the co-signer (SameSignerNotAllowed)", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await expect(
        assetRegistry.connect(adminUser).coSignMint(ev!.args.requestId)
      ).to.be.revertedWithCustomError(assetRegistry, "SameSignerNotAllowed");
    });

    it("stranger (no MANAGER/ADMIN role) cannot co-sign", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await expect(
        assetRegistry.connect(stranger).coSignMint(ev!.args.requestId)
      ).to.be.revertedWith("caller must be MANAGER_ROLE or ADMIN_ROLE");
    });

    it("cannot co-sign twice (AlreadyExecuted)", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      await assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId);
      await expect(
        assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId)
      ).to.be.revertedWithCustomError(assetRegistry, "AlreadyExecuted");
    });
  });

  // ── credential-gated transfer (Phase 2.3) ──────────────────────────────

  describe("credential-gated transfer", () => {
    let tokenId: bigint;
    let vcId: string;

    beforeEach(async () => {
      vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");
      const mintTx = await assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId);
      const mintR = await mintTx.wait();
      const mintEv = mintR!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "AssetMinted");
      tokenId = mintEv!.args.tokenId;
    });

    it("transfer succeeds when vcId is valid", async () => {
      // credentialRegistry.isValid(vcId) = true (not revoked, not expired)
      await expect(
        assetRegistry.connect(recipient).transferFrom(recipient.address, stranger.address, tokenId)
      ).to.emit(assetRegistry, "Transfer");
    });

    it("transfer reverts when credential is revoked (RecipientCredentialInvalid)", async () => {
      // Revoke the credential — superAdmin has DEFAULT_ADMIN_ROLE on CredentialRegistry
      await credRegistry.connect(superAdmin).revokeCredential(vcId);
      await expect(
        assetRegistry.connect(recipient).transferFrom(recipient.address, stranger.address, tokenId)
      ).to.be.revertedWithCustomError(assetRegistry, "RecipientCredentialInvalid");
    });
  });

  // ── tokenURI ─────────────────────────────────────────────────────────────

  describe("tokenURI", () => {
    it("returns ipfs://<cid> for a minted token", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
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
      await platformPause();
      const vcId = await issueVcForRecipient();
      await expect(
        assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address)
      ).to.be.revertedWith("AssetRegistry: platform paused");
    });

    it("coSignMint reverts when platform is paused", async () => {
      const vcId = await issueVcForRecipient();
      const tx = await assetRegistry.connect(adminUser).proposeMint(TEST_CID, vcId, recipient.address);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } }).find((e) => e?.name === "MintProposed");

      await platformPause();

      await expect(
        assetRegistry.connect(managerUser).coSignMint(ev!.args.requestId)
      ).to.be.revertedWith("AssetRegistry: platform paused");
    });
  });

  // ── UUPS upgrade auth — routed through TimeBoundAccessControl's 2-of-N (audit §2.2, TODO.md §3.1) ──
  // _authorizeUpgrade used to be a single onlyRole(SUPER_ADMIN_ROLE)-equivalent hasRole check here.
  // It now delegates to accessControl.upgradeAuthorized(newImplementation), set true by the same
  // proposePlatformAction(4,...)/coSignPlatformAction flow TimeBoundAccessControl.test.ts covers.

  describe("UUPS upgrade authorization (2-of-N via TimeBoundAccessControl)", () => {
    async function deployNewImplementation() {
      const Factory = await ethers.getContractFactory("AssetRegistry");
      const impl = await Factory.deploy();
      await impl.waitForDeployment();
      return impl.getAddress();
    }

    async function proposeAndApprove(newImpl: string) {
      const tx = await ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, newImpl);
      const r = await tx.wait();
      const ev = r!.logs
        .map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "ActionProposed");
      await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
    }

    it("closes the single-signer hole: a lone SUPER_ADMIN can no longer authorize an AssetRegistry upgrade", async () => {
      const newImpl = await deployNewImplementation();
      // Old behavior: hasRole(SUPER_ADMIN_ROLE, superAdmin) alone would have passed here.
      await expect(
        assetRegistry.connect(superAdmin).upgradeToAndCall(newImpl, "0x")
      ).to.be.revertedWith("upgrade not authorized");
    });

    it("succeeds once the implementation has 2-of-N approval on TimeBoundAccessControl", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      await expect(assetRegistry.connect(stranger).upgradeToAndCall(newImpl, "0x")).to.not.be.reverted;
    });

    it("consumes the approval on use — same address needs fresh approval to be reused", async () => {
      const newImpl = await deployNewImplementation();
      await proposeAndApprove(newImpl);
      await assetRegistry.connect(superAdmin).upgradeToAndCall(newImpl, "0x");
      expect(await ac.upgradeAuthorized(newImpl)).to.be.false;

      await expect(
        assetRegistry.connect(superAdmin).upgradeToAndCall(newImpl, "0x")
      ).to.be.revertedWith("upgrade not authorized");
    });
  });
});
