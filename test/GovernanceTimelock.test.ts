import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { GovernanceTimelock, TimeBoundAccessControl } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * GovernanceTimelock tests — TESTING.md §1 "GovernanceTimelock.test.ts"
 * Covers: queue/execute happy path; dispute freezes execution even after eta;
 *         only AUDITOR_ROLE can dispute; only SUPER_ADMIN can queue;
 *         resolveDispute proceed/cancel; ExecutionFailed revert.
 */
describe("GovernanceTimelock", function () {
  let timelock: GovernanceTimelock;
  let ac: TimeBoundAccessControl;

  let superAdmin: SignerWithAddress;
  let auditor: SignerWithAddress;
  let stranger: SignerWithAddress;
  let target: SignerWithAddress; // address to call

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));

  const MIN_DELAY = 24 * 3600; // 24h in seconds
  const MAX_DELAY = 48 * 3600;

  beforeEach(async () => {
    [superAdmin, auditor, stranger, target] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    // set expiry for superAdmin + auditor so hasRole override works
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, auditor.address, ts + 999999);

    const TLFactory = await ethers.getContractFactory("GovernanceTimelock");
    timelock = (await TLFactory.deploy(await ac.getAddress())) as GovernanceTimelock;
    await timelock.waitForDeployment();
  });

  // helper: queue a no-op tx
  async function queueNoOp(delay = MIN_DELAY): Promise<bigint> {
    const tx = await timelock.connect(superAdmin).queueTransaction(
      target.address,
      "0x", // no-op calldata — target ignores it
      delay
    );
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "TransactionQueued");
    return event!.args.txId;
  }

  // ── queueTransaction ──────────────────────────────────────────────────────

  describe("queueTransaction", () => {
    it("SUPER_ADMIN can queue a transaction and emits TransactionQueued", async () => {
      await expect(
        timelock.connect(superAdmin).queueTransaction(target.address, "0x", MIN_DELAY)
      ).to.emit(timelock, "TransactionQueued");
    });

    it("non-SUPER_ADMIN cannot queue (not SUPER_ADMIN_ROLE)", async () => {
      await expect(
        timelock.connect(stranger).queueTransaction(target.address, "0x", MIN_DELAY)
      ).to.be.revertedWith("not SUPER_ADMIN_ROLE");
    });

    it("delay < MIN_DELAY reverts DelayOutOfRange", async () => {
      await expect(
        timelock.connect(superAdmin).queueTransaction(target.address, "0x", MIN_DELAY - 1)
      ).to.be.revertedWithCustomError(timelock, "DelayOutOfRange");
    });

    it("delay > MAX_DELAY reverts DelayOutOfRange", async () => {
      await expect(
        timelock.connect(superAdmin).queueTransaction(target.address, "0x", MAX_DELAY + 1)
      ).to.be.revertedWithCustomError(timelock, "DelayOutOfRange");
    });
  });

  // ── executeTransaction — happy path ──────────────────────────────────────

  describe("executeTransaction — happy path", () => {
    it("executes successfully after eta and emits TransactionExecuted", async () => {
      const txId = await queueNoOp();

      // advance past MIN_DELAY
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        timelock.executeTransaction(txId)
      ).to.emit(timelock, "TransactionExecuted").withArgs(txId);
    });

    it("reverts NotYetExecutable before eta", async () => {
      const txId = await queueNoOp();
      await expect(
        timelock.executeTransaction(txId)
      ).to.be.revertedWithCustomError(timelock, "NotYetExecutable");
    });

    it("reverts AlreadyFinalized on double-execute", async () => {
      const txId = await queueNoOp();
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);
      await timelock.executeTransaction(txId);
      await expect(
        timelock.executeTransaction(txId)
      ).to.be.revertedWithCustomError(timelock, "AlreadyFinalized");
    });
  });

  // ── raiseDispute ─────────────────────────────────────────────────────────

  describe("raiseDispute", () => {
    it("AUDITOR_ROLE can raise a dispute and emits DisputeRaised", async () => {
      const txId = await queueNoOp();
      await expect(
        timelock.connect(auditor).raiseDispute(txId, "Suspicious recipient credential")
      ).to.emit(timelock, "DisputeRaised").withArgs(txId, auditor.address, "Suspicious recipient credential");
    });

    it("non-AUDITOR_ROLE cannot raise a dispute", async () => {
      const txId = await queueNoOp();
      await expect(
        timelock.connect(stranger).raiseDispute(txId, "reason")
      ).to.be.revertedWith("not AUDITOR_ROLE");
    });

    it("disputed tx cannot be executed even after eta", async () => {
      const txId = await queueNoOp();
      await timelock.connect(auditor).raiseDispute(txId, "reason");

      // advance past eta
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        timelock.executeTransaction(txId)
      ).to.be.revertedWithCustomError(timelock, "TransactionDisputed");
    });

    it("cannot dispute an already-finalized tx (AlreadyFinalized)", async () => {
      const txId = await queueNoOp();
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);
      await timelock.executeTransaction(txId);

      await expect(
        timelock.connect(auditor).raiseDispute(txId, "too late")
      ).to.be.revertedWithCustomError(timelock, "AlreadyFinalized");
    });
  });

  // ── resolveDispute ────────────────────────────────────────────────────────

  describe("resolveDispute", () => {
    let disputedTxId: bigint;

    beforeEach(async () => {
      disputedTxId = await queueNoOp();
      await timelock.connect(auditor).raiseDispute(disputedTxId, "reason");
    });

    it("SUPER_ADMIN can resolve dispute (proceed=true) and tx becomes executable again", async () => {
      await expect(
        timelock.connect(superAdmin).resolveDispute(disputedTxId, true)
      ).to.emit(timelock, "DisputeResolved").withArgs(disputedTxId, true);

      // advance past eta and execute
      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(timelock.executeTransaction(disputedTxId)).to.emit(timelock, "TransactionExecuted");
    });

    it("SUPER_ADMIN can cancel a disputed tx (proceed=false)", async () => {
      await timelock.connect(superAdmin).resolveDispute(disputedTxId, false);

      await ethers.provider.send("evm_increaseTime", [MIN_DELAY + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(
        timelock.executeTransaction(disputedTxId)
      ).to.be.revertedWithCustomError(timelock, "AlreadyFinalized");
    });

    it("non-SUPER_ADMIN cannot resolve dispute", async () => {
      await expect(
        timelock.connect(stranger).resolveDispute(disputedTxId, true)
      ).to.be.revertedWith("not SUPER_ADMIN_ROLE");
    });

    it("reverts NotDisputed if trying to resolve a non-disputed tx", async () => {
      const notDisputed = await queueNoOp();
      await expect(
        timelock.connect(superAdmin).resolveDispute(notDisputed, true)
      ).to.be.revertedWithCustomError(timelock, "NotDisputed");
    });
  });
});
