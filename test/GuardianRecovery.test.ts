import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GuardianRecovery, DIDRegistry, TimeBoundAccessControl } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * GuardianRecovery tests — TESTING.md §1 "GuardianRecovery.test.ts"
 * Covers: registration bounds (3–5 guardians); controller-only auth on registerGuardians;
 *         M-of-N threshold enforcement; timelock window respected; finalize reverts before
 *         threshold met; notAGuardian reverts; duplicate signature reverts.
 */
describe("GuardianRecovery", function () {
  let didRegistry: DIDRegistry;
  let guardianRecovery: GuardianRecovery;
  let accessControl: TimeBoundAccessControl;

  let controller: SignerWithAddress;
  let guardian1: SignerWithAddress;
  let guardian2: SignerWithAddress;
  let guardian3: SignerWithAddress;
  let guardian4: SignerWithAddress;
  let guardian5: SignerWithAddress;
  let stranger: SignerWithAddress;
  let newController: SignerWithAddress;
  let mockRecovery: SignerWithAddress;
  let superAdmin2: SignerWithAddress;

  let subjectDid: string;

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));

  beforeEach(async () => {
    [controller, guardian1, guardian2, guardian3, guardian4, guardian5, stranger, newController, mockRecovery, superAdmin2] =
      await ethers.getSigners();

    // DIDRegistry's constructor now takes a TimeBoundAccessControl address (T-3.2, audit §2.3) —
    // deploy that first, controller acts as the bootstrap SUPER_ADMIN/DEFAULT_ADMIN.
    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    accessControl = (await upgrades.deployProxy(ACFactory, [controller.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await accessControl.waitForDeployment();
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await accessControl.connect(controller).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);

    const DIDRegistryFactory = await ethers.getContractFactory("DIDRegistry");
    didRegistry = (await DIDRegistryFactory.deploy(await accessControl.getAddress())) as DIDRegistry;
    await didRegistry.waitForDeployment();

    const GRFactory = await ethers.getContractFactory("GuardianRecovery");
    guardianRecovery = (await GRFactory.deploy(await didRegistry.getAddress())) as GuardianRecovery;
    await guardianRecovery.waitForDeployment();

    // wire GuardianRecovery into DIDRegistry — now requires 2-of-N SUPER_ADMIN_ROLE approval
    // (actionType 6) instead of a single-signer `onlyOwner` call.
    const grAddr = await guardianRecovery.getAddress();
    const authTx = await accessControl.connect(controller).proposePlatformAction(6, ethers.ZeroHash, grAddr);
    const authReceipt = await authTx.wait();
    const authEvent = authReceipt!.logs
      .map((l) => { try { return accessControl.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "ActionProposed");
    await accessControl.connect(superAdmin2).coSignPlatformAction(authEvent!.args.actionId);
    await didRegistry.setGuardianRecoveryContract(grAddr);

    // controller creates a DID
    const pubKey = ethers.randomBytes(64);
    const tx = await didRegistry.connect(controller).createDID(pubKey, "ipfs://test");
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => { try { return didRegistry.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "DIDCreated");
    subjectDid = event!.args.did;
  });

  // ── registerGuardians — bounds ────────────────────────────────────────

  describe("registerGuardians — bounds", () => {
    it("accepts exactly 3 guardians (minimum)", async () => {
      await expect(
        guardianRecovery.connect(controller).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address, guardian3.address],
          2
        )
      ).to.emit(guardianRecovery, "GuardiansRegistered");
    });

    it("accepts exactly 5 guardians (maximum)", async () => {
      await expect(
        guardianRecovery.connect(controller).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address, guardian3.address, guardian4.address, guardian5.address],
          3
        )
      ).to.emit(guardianRecovery, "GuardiansRegistered");
    });

    it("rejects fewer than 3 guardians (InvalidGuardianCount)", async () => {
      await expect(
        guardianRecovery.connect(controller).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address],
          2
        )
      ).to.be.revertedWithCustomError(guardianRecovery, "InvalidGuardianCount");
    });

    it("rejects more than 5 guardians (InvalidGuardianCount)", async () => {
      const extras = await ethers.getSigners();
      const sixGuardians = extras.slice(0, 6).map((s) => s.address);
      await expect(
        guardianRecovery.connect(controller).registerGuardians(subjectDid, sixGuardians, 3)
      ).to.be.revertedWithCustomError(guardianRecovery, "InvalidGuardianCount");
    });

    it("rejects threshold = 0 (InvalidThreshold)", async () => {
      await expect(
        guardianRecovery.connect(controller).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address, guardian3.address],
          0
        )
      ).to.be.revertedWithCustomError(guardianRecovery, "InvalidThreshold");
    });

    it("rejects threshold > guardians.length (InvalidThreshold)", async () => {
      await expect(
        guardianRecovery.connect(controller).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address, guardian3.address],
          4
        )
      ).to.be.revertedWithCustomError(guardianRecovery, "InvalidThreshold");
    });

    it("non-controller cannot register guardians (NotController)", async () => {
      // Phase 2.1 fix: only the DID controller may set their guardian list
      await expect(
        guardianRecovery.connect(stranger).registerGuardians(
          subjectDid,
          [guardian1.address, guardian2.address, guardian3.address],
          2
        )
      ).to.be.revertedWithCustomError(guardianRecovery, "NotController");
    });
  });

  // ── M-of-N recovery flow ──────────────────────────────────────────────

  describe("full recovery flow", () => {
    beforeEach(async () => {
      await guardianRecovery.connect(controller).registerGuardians(
        subjectDid,
        [guardian1.address, guardian2.address, guardian3.address],
        2 // 2-of-3
      );
    });

    it("reverts initiateRecovery from non-guardian (NotAGuardian)", async () => {
      await expect(
        guardianRecovery.connect(stranger).initiateRecovery(subjectDid, newController.address, ethers.randomBytes(64))
      ).to.be.revertedWithCustomError(guardianRecovery, "NotAGuardian");
    });

    it("guardian1 can initiate recovery", async () => {
      await expect(
        guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, ethers.randomBytes(64))
      ).to.emit(guardianRecovery, "RecoveryInitiated");
    });

    it("finalizeRecovery reverts before threshold met", async () => {
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, ethers.randomBytes(64));
      // Only 1 signer (guardian1, from initiateRecovery). Threshold = 2 → not met.
      // Even if timelock elapsed, should revert ThresholdNotMet.
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        guardianRecovery.connect(guardian1).finalizeRecovery(subjectDid)
      ).to.be.revertedWithCustomError(guardianRecovery, "ThresholdNotMet");
    });

    it("finalizeRecovery reverts before timelock elapsed (TimelockNotElapsed)", async () => {
      const newKey = ethers.randomBytes(64);
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, newKey);
      await guardianRecovery.connect(guardian2).signRecovery(subjectDid);
      // threshold met but timelock not elapsed
      await expect(
        guardianRecovery.finalizeRecovery(subjectDid)
      ).to.be.revertedWithCustomError(guardianRecovery, "TimelockNotElapsed");
    });

    it("rejects duplicate signer on signRecovery (DuplicateSignature)", async () => {
      const newKey = ethers.randomBytes(64);
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, newKey);
      await expect(
        guardianRecovery.connect(guardian1).signRecovery(subjectDid)
      ).to.be.revertedWithCustomError(guardianRecovery, "DuplicateSignature");
    });

    it("non-guardian cannot sign recovery (NotAGuardian)", async () => {
      const newKey = ethers.randomBytes(64);
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, newKey);
      await expect(
        guardianRecovery.connect(stranger).signRecovery(subjectDid)
      ).to.be.revertedWithCustomError(guardianRecovery, "NotAGuardian");
    });

    it("successful M-of-N + timelock → finalizeRecovery rotates key in DIDRegistry", async () => {
      const newKey = ethers.randomBytes(64);
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, newKey);
      await guardianRecovery.connect(guardian2).signRecovery(subjectDid);

      // advance past RECOVERY_TIMELOCK (24 hours)
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        guardianRecovery.finalizeRecovery(subjectDid)
      ).to.emit(guardianRecovery, "RecoveryFinalized").withArgs(subjectDid, newController.address);

      // DIDRegistry should now show newController
      const doc = await didRegistry.resolveDID(subjectDid);
      expect(doc.controller).to.equal(newController.address);

      // reverse lookup updated
      expect(await didRegistry.didOf(newController.address)).to.equal(subjectDid);
      expect(await didRegistry.didOf(controller.address)).to.equal(ethers.ZeroHash);
    });

    it("finalizeRecovery reverts if already finalized (AlreadyFinalized)", async () => {
      const newKey = ethers.randomBytes(64);
      await guardianRecovery.connect(guardian1).initiateRecovery(subjectDid, newController.address, newKey);
      await guardianRecovery.connect(guardian2).signRecovery(subjectDid);
      await ethers.provider.send("evm_increaseTime", [86401]);
      await ethers.provider.send("evm_mine", []);
      await guardianRecovery.finalizeRecovery(subjectDid);

      await expect(
        guardianRecovery.finalizeRecovery(subjectDid)
      ).to.be.revertedWithCustomError(guardianRecovery, "AlreadyFinalized");
    });
  });
});
