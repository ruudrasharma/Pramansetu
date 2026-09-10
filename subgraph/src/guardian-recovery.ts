import {
  GuardiansRegistered as GuardiansRegisteredEvent,
  RecoveryInitiated as RecoveryInitiatedEvent,
  RecoverySigned as RecoverySignedEvent,
  RecoveryFinalized as RecoveryFinalizedEvent,
} from "../generated/GuardianRecovery/GuardianRecovery";
import { Recovery, AuditEvent } from "../generated/schema";

// T-039/T-046: GuardianRecovery had no subgraph mapping at all before this — none of its events
// ever reached the audit trail, and activeRecovery(did)'s auto-generated getter can't expose
// signers/initiatedBy (see schema.graphql's Recovery entity comment), so there was no real way to
// show recovery progress (signer count, who initiated) anywhere in onchain mode.

export function handleGuardiansRegistered(event: GuardiansRegisteredEvent): void {
  let auditId = "GR-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GuardianRegistered";
  audit.actorAddress = event.transaction.from;
  audit.summary      = event.params.threshold.toString() + "-of-" + event.params.guardians.length.toString()
                      + " guardian set registered for " + event.params.did.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

// Overwrites any prior Recovery for this did — matches the contract's own activeRecovery[did]
// mapping, which a fresh initiateRecovery call resets (delete r.signers; r.signers.push(sender)).
export function handleRecoveryInitiated(event: RecoveryInitiatedEvent): void {
  let recovery = new Recovery(event.params.did.toHexString());
  recovery.did            = event.params.did;
  recovery.newController  = event.params.newController;
  recovery.initiatedBy    = event.params.initiatedBy;
  recovery.initiatedAt    = event.block.timestamp;
  recovery.signers        = [event.params.initiatedBy]; // initiateRecovery auto-signs the caller
  recovery.finalized      = false;
  recovery.txHash         = event.transaction.hash;
  recovery.save();

  let auditId = "GR-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RecoveryInitiated";
  audit.actorAddress = event.params.initiatedBy;
  audit.summary      = "Guardian recovery initiated for " + event.params.did.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleRecoverySigned(event: RecoverySignedEvent): void {
  let recovery = Recovery.load(event.params.did.toHexString());
  if (recovery == null) return;
  let signers = recovery.signers;
  signers.push(event.params.guardian);
  recovery.signers = signers;
  recovery.save();

  let auditId = "GR-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RecoveryInitiated"; // no dedicated "RecoverySigned" EventType member exists
  audit.actorAddress = event.params.guardian;
  audit.summary      = "Guardian recovery for " + event.params.did.toHexString().slice(0, 10) + "… signed ("
                      + event.params.signatureCount.toString() + " of threshold)";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleRecoveryFinalized(event: RecoveryFinalizedEvent): void {
  let recovery = Recovery.load(event.params.did.toHexString());
  if (recovery != null) {
    recovery.finalized   = true;
    recovery.finalizedAt = event.block.timestamp;
    recovery.save();
  }

  let auditId = "GR-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RecoveryFinalized";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Guardian recovery finalized for " + event.params.did.toHexString().slice(0, 10)
                      + "… — key rotated to " + event.params.newController.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
