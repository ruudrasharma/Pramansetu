import { expect } from "chai";
import { ethers } from "hardhat";
import { CredentialRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * CredentialRegistry tests — TESTING.md §1 "CredentialRegistry.test.ts"
 * Covers: issue/revoke; isValid respects expiry AND revocation; only ISSUER_ROLE can issue;
 *         Super Admin path for revokeCredential (inconsistency A11 — tested so the fix in Phase 2
 *         gets verified automatically once merged).
 */
describe("CredentialRegistry", function () {
  let registry: CredentialRegistry;
  let admin: SignerWithAddress;
  let issuer: SignerWithAddress;
  let subject: SignerWithAddress;
  let stranger: SignerWithAddress;

  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  const randomDid = () => ethers.keccak256(ethers.randomBytes(32));

  beforeEach(async () => {
    [admin, issuer, subject, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CredentialRegistry");
    registry = (await Factory.deploy(admin.address)) as CredentialRegistry;
    await registry.waitForDeployment();
    await registry.connect(admin).grantRole(ISSUER_ROLE, issuer.address);
  });

  // ── issueCredential ──────────────────────────────────────────────────────

  describe("issueCredential", () => {
    it("ISSUER_ROLE can issue a credential and emits CredentialIssued", async () => {
      const subjectDid = randomDid();
      const issuerDid = randomDid();
      const vcHash = ethers.keccak256(ethers.toUtf8Bytes("payload"));
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;

      await expect(
        registry.connect(issuer).issueCredential(subjectDid, issuerDid, vcHash, "Manager", validUntil)
      ).to.emit(registry, "CredentialIssued");
    });

    it("non-ISSUER_ROLE cannot issue", async () => {
      const subjectDid = randomDid();
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;
      await expect(
        registry.connect(stranger).issueCredential(subjectDid, randomDid(), ethers.randomBytes(32), "User", validUntil)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("returns a non-zero vcId", async () => {
      const subjectDid = randomDid();
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;
      const tx = await registry.connect(issuer).issueCredential(
        subjectDid, randomDid(), ethers.randomBytes(32), "Admin", validUntil
      );
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return registry.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "CredentialIssued");
      expect(event!.args.vcId).to.not.equal(ethers.ZeroHash);
    });
  });

  // ── isValid ──────────────────────────────────────────────────────────────

  describe("isValid", () => {
    let vcId: string;

    beforeEach(async () => {
      const subjectDid = randomDid();
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;
      const tx = await registry.connect(issuer).issueCredential(
        subjectDid, randomDid(), ethers.randomBytes(32), "Auditor", validUntil
      );
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return registry.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "CredentialIssued");
      vcId = event!.args.vcId;
    });

    it("returns true for a valid non-expired credential", async () => {
      expect(await registry.isValid(vcId)).to.be.true;
    });

    it("returns false for unknown vcId", async () => {
      expect(await registry.isValid(ethers.randomBytes(32))).to.be.false;
    });

    it("returns false once revoked", async () => {
      await registry.connect(issuer).revokeCredential(vcId);
      expect(await registry.isValid(vcId)).to.be.false;
    });

    it("returns false once past validUntil", async () => {
      // Issue a credential expiring in 1 second
      const subjectDid = randomDid();
      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const tx2 = await registry.connect(issuer).issueCredential(
        subjectDid, randomDid(), ethers.randomBytes(32), "User", ts + 1
      );
      const r2 = await tx2.wait();
      const ev2 = r2!.logs
        .map((l) => { try { return registry.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "CredentialIssued");
      const shortVcId = ev2!.args.vcId;

      // advance time past expiry
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      expect(await registry.isValid(shortVcId)).to.be.false;
    });
  });

  // ── revokeCredential ─────────────────────────────────────────────────────

  describe("revokeCredential", () => {
    let vcId: string;

    beforeEach(async () => {
      const subjectDid = randomDid();
      const validUntil = (await ethers.provider.getBlock("latest"))!.timestamp + 86400;
      const tx = await registry.connect(issuer).issueCredential(
        subjectDid, randomDid(), ethers.randomBytes(32), "Manager", validUntil
      );
      const receipt = await tx.wait();
      const event = receipt!.logs
        .map((l) => { try { return registry.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "CredentialIssued");
      vcId = event!.args.vcId;
    });

    it("ISSUER_ROLE can revoke and emits CredentialRevoked", async () => {
      await expect(
        registry.connect(issuer).revokeCredential(vcId)
      ).to.emit(registry, "CredentialRevoked").withArgs(vcId, (v: any) => true);
    });

    it("DEFAULT_ADMIN_ROLE (super admin) can emergency-revoke (Phase 2.2)", async () => {
      // admin = the deployer who got DEFAULT_ADMIN_ROLE in the constructor
      await expect(
        registry.connect(admin).revokeCredential(vcId)
      ).to.emit(registry, "CredentialRevoked");
      expect(await registry.isValid(vcId)).to.be.false;
    });

    it("non-issuer non-admin cannot revoke", async () => {
      // Phase 2.2: revokeCredential now uses a require() string, not a custom error
      await expect(
        registry.connect(stranger).revokeCredential(vcId)
      ).to.be.revertedWith("CredentialRegistry: caller must be ISSUER_ROLE or DEFAULT_ADMIN_ROLE");
    });

    it("reverts on unknown vcId with CredentialNotFound", async () => {
      await expect(
        registry.connect(issuer).revokeCredential(ethers.randomBytes(32))
      ).to.be.revertedWithCustomError(registry, "CredentialNotFound");
    });
  });
});
