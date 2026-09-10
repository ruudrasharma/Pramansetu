import { Bytes } from "@graphprotocol/graph-ts";
import {
  FactSubmitted as FactSubmittedEvent,
  FactCoSigned as FactCoSignedEvent,
  FactDisputed as FactDisputedEvent,
  FactDisputeResolved as FactDisputeResolvedEvent,
  FactFinalized as FactFinalizedEvent,
  FactRejected as FactRejectedEvent,
} from "../generated/OracleAttestation/OracleAttestation";
import { OracleFact, AuditEvent } from "../generated/schema";

export function handleFactSubmitted(event: FactSubmittedEvent): void {
  let fact = new OracleFact(event.params.factId.toString());
  fact.factId       = event.params.factId;
  fact.tokenId       = event.params.tokenId;
  fact.asset         = event.params.tokenId.toString();
  fact.factType      = event.params.factType;
  fact.dataHash      = event.params.dataHash;
  fact.proposer      = event.params.proposer;
  fact.status        = "submitted";
  fact.submittedAt   = event.block.timestamp;
  fact.txHash        = event.transaction.hash;
  fact.save();

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "OracleFactSubmitted";
  audit.actorAddress = event.params.proposer;
  audit.summary      = "Oracle fact submitted for asset #" + event.params.tokenId.toString()
                      + " (type " + event.params.factType.toString() + ")";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

// ATTESTATION_THRESHOLD is a hardcoded constant = 2 on the deployed contract
// (contracts/OracleAttestation.sol) — submitFact auto-signs the proposer as attestors[0], so the
// one and only attestFact call that ever succeeds while status is still "submitted" is necessarily
// the co-sign that reaches threshold and moves the fact to Attested. Same caveat as
// access-control.ts's handleGrantCoSigned: if that constant ever changes, this handler needs a
// real signer-count check instead of assuming every FactCoSigned means "now attested."
export function handleFactCoSigned(event: FactCoSignedEvent): void {
  let fact = OracleFact.load(event.params.factId.toString());
  if (fact == null) return;
  fact.coSigner = event.params.signer;
  fact.status = "attested";
  fact.save();

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "OracleFactAttested";
  audit.actorAddress = event.params.signer;
  audit.summary      = "Oracle fact #" + event.params.factId.toString() + " reached 2-of-N attestation, dispute window open";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleFactDisputed(event: FactDisputedEvent): void {
  let fact = OracleFact.load(event.params.factId.toString());
  if (fact == null) return;
  fact.status = "disputed";
  fact.disputedBy = event.params.disputedBy;
  fact.disputeReason = event.params.reason;
  fact.save();

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "OracleFactDisputed";
  audit.actorAddress = event.params.disputedBy;
  audit.summary      = "Oracle fact #" + event.params.factId.toString() + " disputed: " + event.params.reason;
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleFactDisputeResolved(event: FactDisputeResolvedEvent): void {
  let fact = OracleFact.load(event.params.factId.toString());
  if (fact == null) return;
  fact.resolvedProceed = event.params.proceeded;
  fact.save();
  // status itself is set to "finalized" by handleFactFinalized or "rejected" by
  // handleFactRejected, which the contract always emits in the same transaction right after this
  // event (OracleAttestation.sol's resolveDispute) — not duplicated here.

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GovernanceExecuted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Oracle fact #" + event.params.factId.toString() + " dispute resolved: "
                      + (event.params.proceeded ? "proceed (finalize)" : "reject");
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleFactFinalized(event: FactFinalizedEvent): void {
  let fact = OracleFact.load(event.params.factId.toString());
  if (fact == null) return;
  fact.status = "finalized";
  fact.finalizedAt = event.block.timestamp;
  fact.save();

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "OracleFactFinalized";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Oracle fact #" + event.params.factId.toString() + " finalized for asset #"
                      + event.params.tokenId.toString() + " (type " + event.params.factType.toString() + ")";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleFactRejected(event: FactRejectedEvent): void {
  let fact = OracleFact.load(event.params.factId.toString());
  if (fact == null) return;
  fact.status = "rejected";
  fact.save();

  let auditId = "Oracle-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "OracleFactRejected";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Oracle fact #" + event.params.factId.toString() + " rejected after dispute";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
