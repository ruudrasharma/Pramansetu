import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  OracleAttestation,
  TimeBoundAccessControl,
  AssetRegistry,
  CredentialRegistry,
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OracleAttestation tests — TESTING.md §1 "OracleAttestation.test.ts" (T-016, gap analysis §2.2.5)
 * Covers: submit/attest happy path to Attested; non-attestor/duplicate-signer reverts;
 *         raiseDispute role-gating and window-closed revert; resolveDispute both branches;
 *         finalize before/after window, double-finalize revert; end-to-end oracleFactsOf/
 *         latestOracleFactType match; recordOracleFact reverts OnlyOracleAttestation when called
 *         directly (not through this contract).
 */
describe("OracleAttestation", function () {
  let ac: TimeBoundAccessControl;
  let credRegistry: CredentialRegistry;
  let assetRegistry: AssetRegistry;
  let oracle: OracleAttestation;

  let superAdmin: SignerWithAddress;
  let superAdmin2: SignerWithAddress;
  let adminUser: SignerWithAddress;
  let managerUser: SignerWithAddress;
  let attestor1: SignerWithAddress;
  let attestor2: SignerWithAddress;
  let auditor: SignerWithAddress;
  let recipient: SignerWithAddress;
  let stranger: SignerWithAddress;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));
  const ORACLE_ATTESTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ATTESTOR_ROLE"));

  const TEST_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const DATA_HASH = ethers.keccak256(ethers.toUtf8Bytes("delivery-proof"));
  const FACT_TYPE_DELIVERED = 1;
  const DISPUTE_WINDOW = 15 * 60; // seconds, matches the contract's constant

  let mintedTokenId: bigint;

  beforeEach(async () => {
    [superAdmin, superAdmin2, adminUser, managerUser, attestor1, attestor2, auditor, recipient, stranger] =
      await ethers.getSigners();

    // ── TimeBoundAccessControl, already upgraded with ORACLE_ATTESTOR_ROLE ────────────────────
    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(ADMIN_ROLE, adminUser.address, ts + 999999);
    await ac.connect(adminUser).grantTimedRole(MANAGER_ROLE, managerUser.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, auditor.address, ts + 999999);

    // Real in-place upgrade to introduce ORACLE_ATTESTOR_ROLE, same sequence as
    // Upgrade.test.ts's "ORACLE_ATTESTOR_ROLE (T-016)" block -- 2-of-N authorize, then
    // upgradeToAndCall with the reinitializer as calldata.
    const NewACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    const newAcImpl = await NewACFactory.deploy();
    await newAcImpl.waitForDeployment();
    const newAcImplAddr = await newAcImpl.getAddress();
    let tx = await ac.connect(superAdmin).proposePlatformAction(4, ethers.ZeroHash, newAcImplAddr);
    let r = await tx.wait();
    let ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
    const initData = ac.interface.encodeFunctionData("initializeOracleAttestorRole");
    await ac.connect(superAdmin).upgradeToAndCall(newAcImplAddr, initData);

    await ac.connect(superAdmin).grantTimedRole(ORACLE_ATTESTOR_ROLE, attestor1.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(ORACLE_ATTESTOR_ROLE, attestor2.address, ts + 999999);

    // ── CredentialRegistry + AssetRegistry, mint one token ────────────────────────────────────
    const CRFactory = await ethers.getContractFactory("CredentialRegistry");
    credRegistry = (await CRFactory.deploy(superAdmin.address)) as CredentialRegistry;
    await credRegistry.waitForDeployment();
    const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
    await credRegistry.connect(superAdmin).grantRole(ISSUER_ROLE, superAdmin.address);

    const ARFactory = await ethers.getContractFactory("AssetRegistry", superAdmin);
    assetRegistry = (await upgrades.deployProxy(
      ARFactory,
      [await ac.getAddress(), await credRegistry.getAddress()],
      { kind: "uups", unsafeSkipStorageCheck: true }
    )) as unknown as AssetRegistry;
    await assetRegistry.waitForDeployment();

    const proposeTx = await assetRegistry.connect(adminUser).proposeMint(
      TEST_CID, ethers.keccak256(ethers.toUtf8Bytes("test-did")), recipient.address
    );
    const proposeReceipt = await proposeTx.wait();
    const mintEv = proposeReceipt!.logs
      .map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "MintProposed");
    const mintTx = await assetRegistry.connect(managerUser).coSignMint(mintEv!.args.requestId);
    const mintReceipt = await mintTx.wait();
    const mintedEv = mintReceipt!.logs
      .map((l) => { try { return assetRegistry.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "AssetMinted");
    mintedTokenId = mintedEv!.args.tokenId;

    // ── OracleAttestation, deployed and wired via actionType 7 ────────────────────────────────
    const OAFactory = await ethers.getContractFactory("OracleAttestation");
    oracle = (await OAFactory.deploy(await ac.getAddress(), await assetRegistry.getAddress())) as OracleAttestation;
    await oracle.waitForDeployment();
    const oaAddr = await oracle.getAddress();

    tx = await ac.connect(superAdmin).proposePlatformAction(7, ethers.ZeroHash, oaAddr);
    r = await tx.wait();
    ev = r!.logs.map((l) => { try { return ac.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await ac.connect(superAdmin2).coSignPlatformAction(ev!.args.actionId);
    await assetRegistry.connect(superAdmin).setOracleAttestationContract(oaAddr);
  });

  /** Submits + attests a fact to threshold, returning the real factId. */
  async function submitAndAttest(tokenId = mintedTokenId): Promise<bigint> {
    const tx = await oracle.connect(attestor1).submitFact(tokenId, FACT_TYPE_DELIVERED, DATA_HASH);
    const r = await tx.wait();
    const ev = r!.logs.map((l) => { try { return oracle.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "FactSubmitted");
    const factId = ev!.args.factId;
    await oracle.connect(attestor2).attestFact(factId);
    return factId;
  }

  // ── submitFact / attestFact ─────────────────────────────────────────────

  describe("submitFact / attestFact", () => {
    it("reaches Attested status once ATTESTATION_THRESHOLD (2) distinct attestors sign, and sets disputeWindowEnd", async () => {
      const factId = await submitAndAttest();
      const f = await oracle.facts(factId);
      expect(f.status).to.equal(1n); // Status.Attested
      const block = await ethers.provider.getBlock("latest");
      expect(f.disputeWindowEnd).to.equal(BigInt(block!.timestamp) + BigInt(DISPUTE_WINDOW));
    });

    it("emits FactSubmitted then FactReadyForFinalization at threshold", async () => {
      const tx = await oracle.connect(attestor1).submitFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH);
      await expect(tx).to.emit(oracle, "FactSubmitted");
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return oracle.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "FactSubmitted");
      await expect(oracle.connect(attestor2).attestFact(ev!.args.factId))
        .to.emit(oracle, "FactReadyForFinalization");
    });

    it("non-ORACLE_ATTESTOR_ROLE cannot submit a fact", async () => {
      await expect(
        oracle.connect(stranger).submitFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH)
      ).to.be.revertedWith("not ORACLE_ATTESTOR_ROLE");
    });

    it("reverts on a non-existent tokenId (ERC721 ownerOf check propagates)", async () => {
      await expect(
        oracle.connect(attestor1).submitFact(999, FACT_TYPE_DELIVERED, DATA_HASH)
      ).to.be.reverted;
    });

    it("proposer cannot also be the co-signer (DuplicateSigner)", async () => {
      const tx = await oracle.connect(attestor1).submitFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return oracle.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "FactSubmitted");
      await expect(
        oracle.connect(attestor1).attestFact(ev!.args.factId)
      ).to.be.revertedWithCustomError(oracle, "DuplicateSigner");
    });

    it("non-ORACLE_ATTESTOR_ROLE cannot attest", async () => {
      const tx = await oracle.connect(attestor1).submitFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return oracle.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "FactSubmitted");
      await expect(
        oracle.connect(stranger).attestFact(ev!.args.factId)
      ).to.be.revertedWith("not ORACLE_ATTESTOR_ROLE");
    });
  });

  // ── raiseDispute ─────────────────────────────────────────────────────────

  describe("raiseDispute", () => {
    it("AUDITOR_ROLE can dispute an Attested fact within the window", async () => {
      const factId = await submitAndAttest();
      await expect(
        oracle.connect(auditor).raiseDispute(factId, "Delivery photo looks reused")
      ).to.emit(oracle, "FactDisputed").withArgs(factId, auditor.address, "Delivery photo looks reused");
      expect((await oracle.facts(factId)).status).to.equal(2n); // Status.Disputed
    });

    it("non-AUDITOR_ROLE cannot dispute", async () => {
      const factId = await submitAndAttest();
      await expect(
        oracle.connect(stranger).raiseDispute(factId, "reason")
      ).to.be.revertedWith("not AUDITOR_ROLE");
    });

    it("cannot dispute a fact that hasn't reached Attested yet (InvalidStatus)", async () => {
      const tx = await oracle.connect(attestor1).submitFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return oracle.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "FactSubmitted");
      await expect(
        oracle.connect(auditor).raiseDispute(ev!.args.factId, "too early")
      ).to.be.revertedWithCustomError(oracle, "InvalidStatus");
    });

    it("reverts DisputeWindowClosed once the window has elapsed", async () => {
      const factId = await submitAndAttest();
      await ethers.provider.send("evm_increaseTime", [DISPUTE_WINDOW + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        oracle.connect(auditor).raiseDispute(factId, "too late")
      ).to.be.revertedWithCustomError(oracle, "DisputeWindowClosed");
    });
  });

  // ── resolveDispute ────────────────────────────────────────────────────────

  describe("resolveDispute", () => {
    let disputedFactId: bigint;

    beforeEach(async () => {
      disputedFactId = await submitAndAttest();
      await oracle.connect(auditor).raiseDispute(disputedFactId, "reason");
    });

    it("SUPER_ADMIN resolving proceed=true finalizes immediately and records the fact on AssetRegistry", async () => {
      await expect(oracle.connect(superAdmin).resolveDispute(disputedFactId, true))
        .to.emit(oracle, "FactDisputeResolved").withArgs(disputedFactId, true)
        .and.to.emit(oracle, "FactFinalized");
      expect((await oracle.facts(disputedFactId)).status).to.equal(3n); // Status.Finalized
      const record = await assetRegistry.oracleFactsOf(mintedTokenId, 0);
      expect(record.factType).to.equal(FACT_TYPE_DELIVERED);
      expect(await assetRegistry.latestOracleFactType(mintedTokenId)).to.equal(FACT_TYPE_DELIVERED);
    });

    it("SUPER_ADMIN resolving proceed=false rejects permanently, nothing recorded on AssetRegistry", async () => {
      await expect(oracle.connect(superAdmin).resolveDispute(disputedFactId, false))
        .to.emit(oracle, "FactRejected").withArgs(disputedFactId);
      expect((await oracle.facts(disputedFactId)).status).to.equal(4n); // Status.Rejected
      await expect(assetRegistry.oracleFactsOf(mintedTokenId, 0)).to.be.reverted; // empty array, out of bounds
    });

    it("non-SUPER_ADMIN cannot resolve", async () => {
      await expect(
        oracle.connect(stranger).resolveDispute(disputedFactId, true)
      ).to.be.revertedWith("not SUPER_ADMIN_ROLE");
    });

    it("reverts NotDisputed on a non-disputed fact", async () => {
      const otherFactId = await submitAndAttest();
      await expect(
        oracle.connect(superAdmin).resolveDispute(otherFactId, true)
      ).to.be.revertedWithCustomError(oracle, "NotDisputed");
    });
  });

  // ── finalize ─────────────────────────────────────────────────────────────

  describe("finalize", () => {
    it("reverts DisputeWindowActive before the window elapses", async () => {
      const factId = await submitAndAttest();
      await expect(
        oracle.finalize(factId)
      ).to.be.revertedWithCustomError(oracle, "DisputeWindowActive");
    });

    it("permissionless: any caller can finalize once the window has elapsed undisputed", async () => {
      const factId = await submitAndAttest();
      await ethers.provider.send("evm_increaseTime", [DISPUTE_WINDOW + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(oracle.connect(stranger).finalize(factId))
        .to.emit(oracle, "FactFinalized").withArgs(factId, mintedTokenId, FACT_TYPE_DELIVERED);

      const record = await assetRegistry.oracleFactsOf(mintedTokenId, 0);
      expect(record.dataHash).to.equal(DATA_HASH);
      expect(record.factId).to.equal(factId);
    });

    it("reverts InvalidStatus on double-finalize", async () => {
      const factId = await submitAndAttest();
      await ethers.provider.send("evm_increaseTime", [DISPUTE_WINDOW + 1]);
      await ethers.provider.send("evm_mine", []);
      await oracle.finalize(factId);
      await expect(
        oracle.finalize(factId)
      ).to.be.revertedWithCustomError(oracle, "InvalidStatus");
    });

    it("cannot finalize a disputed fact directly (must go through resolveDispute)", async () => {
      const factId = await submitAndAttest();
      await oracle.connect(auditor).raiseDispute(factId, "reason");
      await ethers.provider.send("evm_increaseTime", [DISPUTE_WINDOW + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        oracle.finalize(factId)
      ).to.be.revertedWithCustomError(oracle, "InvalidStatus");
    });
  });

  // ── AssetRegistry.recordOracleFact gating ────────────────────────────────

  describe("AssetRegistry.recordOracleFact gating", () => {
    it("reverts OnlyOracleAttestation when called by anyone other than the wired OracleAttestation contract", async () => {
      await expect(
        assetRegistry.connect(superAdmin).recordOracleFact(mintedTokenId, FACT_TYPE_DELIVERED, DATA_HASH, 0)
      ).to.be.revertedWithCustomError(assetRegistry, "OnlyOracleAttestation");
    });
  });
});
