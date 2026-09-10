import { BigInt } from "@graphprotocol/graph-ts";
import {
  TransactionQueued as TransactionQueuedEvent,
  DisputeRaised as DisputeRaisedEvent,
  DisputeResolved as DisputeResolvedEvent,
  TransactionExecuted as TransactionExecutedEvent,
  GovernanceTimelock
} from "../generated/GovernanceTimelock/GovernanceTimelock";
import { GovernanceTx, Dispute, AuditEvent } from "../generated/schema";

export function handleTransactionQueued(event: TransactionQueuedEvent): void {
  let tx = new GovernanceTx(event.params.txId.toString());
  tx.txId      = event.params.txId;
  tx.target    = event.params.target;
  let timelock = GovernanceTimelock.bind(event.address);
  let queueResult = timelock.queue(event.params.txId);
  tx.calldata  = queueResult.getData();
  tx.eta       = event.params.eta;
  tx.executed  = false;
  tx.queuedAt  = event.block.timestamp;
  tx.txHash    = event.transaction.hash;
  tx.save();

  let auditId = "GovTL-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GovernanceExecuted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Governance tx queued: #" + event.params.txId.toString() + " (ETA " + event.params.eta.toString() + ")";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleDisputeRaised(event: DisputeRaisedEvent): void {
  let dispute = new Dispute(event.params.txId.toString());
  dispute.governanceTx = event.params.txId.toString();
  dispute.raisedBy     = event.params.raisedBy;
  dispute.reason       = event.params.reason;
  dispute.resolved     = false;
  dispute.raisedAt     = event.block.timestamp;
  dispute.txHash       = event.transaction.hash;
  dispute.save();

  let auditId = "GovTL-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "DisputeRaised";
  audit.actorAddress = event.params.raisedBy;
  audit.summary      = "Dispute raised on governance tx #" + event.params.txId.toString() + ": " + event.params.reason;
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

// TODO.md T-032/T-035: previously unhandled — Dispute.resolved was never set back to true after
// GovernanceTimelock.resolveDispute() fired, so a resolved dispute would show as still-active
// forever in getDisputes(). proceeded=true returns the tx to Queued (still needs eta + a separate
// executeTransaction to actually finalize); proceeded=false cancels it permanently
// (contracts/GovernanceTimelock.sol:90-95).
export function handleDisputeResolved(event: DisputeResolvedEvent): void {
  let dispute = Dispute.load(event.params.txId.toString());
  if (dispute == null) return;
  dispute.resolved   = true;
  dispute.proceeded  = event.params.proceeded;
  dispute.resolvedBy = event.transaction.from;
  dispute.resolvedAt = event.block.timestamp;
  dispute.save();

  let auditId = "GovTL-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GovernanceExecuted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Dispute on governance tx #" + event.params.txId.toString() + " resolved — "
                      + (event.params.proceeded ? "proceeded" : "cancelled");
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleTransactionExecuted(event: TransactionExecutedEvent): void {
  let tx = GovernanceTx.load(event.params.txId.toString());
  if (tx != null) {
    tx.executed    = true;
    tx.executedAt  = event.block.timestamp;
    tx.save();
  }

  let auditId = "GovTL-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GovernanceExecuted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Governance tx executed: #" + event.params.txId.toString();
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
