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
  let superAdmin2: SignerWithAddress;
  let auditor: SignerWithAddress;
  let stranger: SignerWithAddress;
  let target: SignerWithAddress; // address to call

  const SUPER_ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SUPER_ADMIN_ROLE"));
  const AUDITOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUDITOR_ROLE"));

  const MIN_DELAY = 24 * 3600; // 24h in seconds
  const MAX_DELAY = 48 * 3600;

  beforeEach(async () => {
    [superAdmin, superAdmin2, auditor, stranger, target] = await ethers.getSigners();

    const ACFactory = await ethers.getContractFactory("TimeBoundAccessControl");
    ac = (await upgrades.deployProxy(ACFactory, [superAdmin.address], { kind: "uups" })) as unknown as TimeBoundAccessControl;
    await ac.waitForDeployment();

    // set expiry for superAdmin + auditor so hasRole override works
    const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
    await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, superAdmin2.address, ts + 999999);
    await ac.connect(superAdmin).grantTimedRole(AUDITOR_ROLE, auditor.address, ts + 999999);

    const TLFactory = await ethers.getContractFactory("GovernanceTimelock");
    timelock = (await TLFactory.deploy(await ac.getAddress())) as GovernanceTimelock;
    await timelock.waitForDeployment();
  });

  /** Proposes + co-signs (2-of-N SUPER_ADMIN_ROLE, T-3.3 / audit §2.5) a no-op queue entry and
   *  returns the resulting real txId — replaces the old single-signer queueTransaction() helper. */
  async function queueNoOp(delay = MIN_DELAY): Promise<bigint> {
    const proposeTx = await timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", delay);
    const proposeReceipt = await proposeTx.wait();
    const proposeEvent = proposeReceipt!.logs
      .map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "QueueProposed");
    const pendingId = proposeEvent!.args.pendingId;

    const coSignTx = await timelock.connect(superAdmin2).coSignQueueTransaction(pendingId);
    const coSignReceipt = await coSignTx.wait();
    const queuedEvent = coSignReceipt!.logs
      .map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
      .find((e) => e?.name === "TransactionQueued");
    return queuedEvent!.args.txId;
  }

  // ── proposeQueueTransaction / coSignQueueTransaction (2-of-N, T-3.3) ───────
  // Audit §2.5 / TODO.md §3.3: queueTransaction used to be onlySuperAdmin — one signer, despite
  // its own docstring claiming multisig approval upstream. These cover the fix and the failure
  // mode it closes: a single SUPER_ADMIN alone can no longer queue a transaction.

  describe("proposeQueueTransaction / coSignQueueTransaction", () => {
    it("closes the single-signer hole: a lone SUPER_ADMIN proposing alone never queues anything", async () => {
      await timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MIN_DELAY);
      // Old behavior: this alone would have populated `queue` and emitted TransactionQueued.
      // New behavior: nothing is queued yet — nextTxId stays 0 until a second signer co-signs.
      expect(await timelock.nextTxId()).to.equal(0);
    });

    it("emits QueueProposed on step 1, TransactionQueued only once QUEUE_THRESHOLD co-signs on step 2", async () => {
      const tx = await timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MIN_DELAY);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "QueueProposed");

      await expect(
        timelock.connect(superAdmin2).coSignQueueTransaction(ev!.args.pendingId)
      ).to.emit(timelock, "TransactionQueued");
      expect(await timelock.nextTxId()).to.equal(1);
    });

    it("non-SUPER_ADMIN cannot propose (not SUPER_ADMIN_ROLE)", async () => {
      await expect(
        timelock.connect(stranger).proposeQueueTransaction(target.address, "0x", MIN_DELAY)
      ).to.be.revertedWith("not SUPER_ADMIN_ROLE");
    });

    it("rejects duplicate signer on coSign", async () => {
      const tx = await timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MIN_DELAY);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "QueueProposed");
      await expect(
        timelock.connect(superAdmin).coSignQueueTransaction(ev!.args.pendingId)
      ).to.be.revertedWithCustomError(timelock, "DuplicateSigner");
    });

    it("rejects a third co-sign after threshold already met (PendingAlreadyExecuted)", async () => {
      const tx = await timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MIN_DELAY);
      const r = await tx.wait();
      const ev = r!.logs.map((l) => { try { return timelock.interface.parseLog(l as any); } catch { return null; } })
        .find((e) => e?.name === "QueueProposed");
      await timelock.connect(superAdmin2).coSignQueueTransaction(ev!.args.pendingId);

      const ts = (await ethers.provider.getBlock("latest"))!.timestamp;
      const [,,,,,extra] = await ethers.getSigners();
      await ac.connect(superAdmin).grantTimedRole(SUPER_ADMIN_ROLE, extra.address, ts + 999999);
      await expect(
        timelock.connect(extra).coSignQueueTransaction(ev!.args.pendingId)
      ).to.be.revertedWithCustomError(timelock, "PendingAlreadyExecuted");
    });

    it("delay < MIN_DELAY reverts DelayOutOfRange on propose", async () => {
      await expect(
        timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MIN_DELAY - 1)
      ).to.be.revertedWithCustomError(timelock, "DelayOutOfRange");
    });

    it("delay > MAX_DELAY reverts DelayOutOfRange on propose", async () => {
      await expect(
        timelock.connect(superAdmin).proposeQueueTransaction(target.address, "0x", MAX_DELAY + 1)
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
