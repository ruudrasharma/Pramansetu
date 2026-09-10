import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TimedRoleGranted as TimedRoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  ActionProposed as ActionProposedEvent,
  ActionCoSigned as ActionCoSignedEvent,
  ActionExecuted as ActionExecutedEvent,
  GrantProposed as GrantProposedEvent,
  GrantCoSigned as GrantCoSignedEvent,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
  TimeBoundAccessControl,
} from "../generated/TimeBoundAccessControl/TimeBoundAccessControl";
import { RoleGrant, PlatformAction, PendingGrant, AuditEvent } from "../generated/schema";

// Human-readable role label lookup (keccak256 of the name, as stored in the contract)
function roleLabel(roleHash: Bytes): string {
  let hex = roleHash.toHexString();
  // These are the keccak256("ROLE_NAME") values from the contract
  if (hex == "0x0000000000000000000000000000000000000000000000000000000000000000") return "DEFAULT_ADMIN_ROLE";
  // For all other roles, we store the raw hex — the frontend can decode these
  return hex.slice(0, 10) + "…";
}

export function handleTimedRoleGranted(event: TimedRoleGrantedEvent): void {
  let id = event.params.role.toHexString() + "-" + event.params.account.toHexString() + "-" + event.transaction.hash.toHexString();
  let grant = new RoleGrant(id);
  grant.role           = event.params.role;
  grant.roleLabel      = roleLabel(event.params.role);
  grant.accountAddress = event.params.account;
  grant.grantedBy      = event.transaction.from; // TimedRoleGranted doesn't have sender param, so use tx.from
  grant.validUntil     = event.params.validUntil;
  grant.revoked        = false;
  grant.grantedAt      = event.block.timestamp;
  grant.txHash         = event.transaction.hash;
  grant.save();

  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RoleGranted";
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Role granted: " + roleLabel(event.params.role) + " → " + event.params.account.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleRoleRevoked(event: RoleRevokedEvent): void {
  // Find the most recent grant for this role+account and mark revoked
  // (In production, use an ID scheme that lets you find the active grant directly)
  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RoleRevoked";
  audit.actorAddress = event.params.sender;
  audit.summary      = "Role revoked: " + roleLabel(event.params.role) + " from " + event.params.account.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleActionProposed(event: ActionProposedEvent): void {
  let action = new PlatformAction(event.params.actionId.toString());
  action.actionId    = event.params.actionId;
  action.actionType  = event.params.actionType;
  // ActionProposed itself doesn't emit role/account (contracts/TimeBoundAccessControl.sol:74) —
  // previously left permanently Bytes.empty() as a result (T-032). Both are real, queryable public
  // storage (pendingActions(actionId)) regardless of what the event carries, so read them via a
  // bound call instead — same pattern asset-registry.ts already uses for pendingMints. Needed for
  // real reasons, not just completeness: actionType 4/5/6/7 (T-3.1/T-3.2/T-016) store their target
  // address (implementation/verifier/guardian-recovery/oracle-attestation contract) in this same
  // `account` field, and handleActionExecuted below needs it for a real, descriptive audit summary.
  let accessControl = TimeBoundAccessControl.bind(event.address);
  let pending = accessControl.try_pendingActions(event.params.actionId);
  action.role        = pending.reverted ? Bytes.empty() : pending.value.getRole();
  action.account     = pending.reverted ? Bytes.empty() : pending.value.getAccount();
  action.proposer    = event.params.proposer;
  action.executed    = false;
  action.proposedAt  = event.block.timestamp;
  action.save();
}

// TODO.md T-032/T-034: previously unhandled — PlatformAction.coSigner (declared in schema.graphql)
// was never populated by any mapping, so getProposals()'s "1/2 signed, needs 1 more" state was
// unobservable from indexed data; an action just jumped straight from "no coSigner" to executed.
export function handleActionCoSigned(event: ActionCoSignedEvent): void {
  let action = PlatformAction.load(event.params.actionId.toString());
  if (action == null) return;
  action.coSigner = event.params.signer;
  action.save();
}

export function handleActionExecuted(event: ActionExecutedEvent): void {
  let action = PlatformAction.load(event.params.actionId.toString());
  if (action == null) return;
  action.executed    = true;
  action.executedAt  = event.block.timestamp;
  action.save();

  // actionType: 1 = emergencyRevoke, 2 = pause, 3 = unpause, 4 = authorizeUpgrade,
  // 5 = authorizeDIDSignatureVerifier, 6 = authorizeDIDGuardianRecovery,
  // 7 = authorizeOracleAttestationContract (T-016)
  // (contracts/TimeBoundAccessControl.sol). Previously every actionType collapsed to
  // "EmergencyPaused", so a real role revocation (1) showed on the ledger/audit table identically
  // to an actual platform pause (2) — indistinguishable and misleading. Label each actionType with
  // what it actually is; "GovernanceExecuted" for 3/4/5/6 matches the label already used by
  // handleUnpaused() below for the direct Unpaused event, and the mock fixture's own convention
  // (lib/mock/fixtures/auditEvents.ts already models a UUPS upgrade as a GovernanceExecuted-typed
  // row) — the specific action is conveyed in `summary`, not a dedicated `type` per actionType.
  let typeStr = event.params.actionType == 1 ? "RoleRevoked"
              : event.params.actionType == 2 ? "EmergencyPaused"
              : "GovernanceExecuted"; // 3 = unpause, 4/5/6 = authorization actions (T-3.1/T-3.2)

  // action.account was populated in handleActionProposed above via a bound pendingActions() call
  // (ActionExecuted itself carries no account param either) — real target address for 4/5/6, not
  // guessed or omitted.
  let accountStr = action.account.toHexString().slice(0, 10) + "…";
  let summary =
    event.params.actionType == 1 ? "Emergency role revocation executed"
    : event.params.actionType == 2 ? "Platform pause executed"
    : event.params.actionType == 3 ? "Platform unpause executed"
    : event.params.actionType == 4 ? "UUPS upgrade authorized: implementation " + accountStr
    : event.params.actionType == 5 ? "DIDRegistry signature verifier authorized: " + accountStr
    : event.params.actionType == 6 ? "DIDRegistry guardian recovery contract authorized: " + accountStr
    : event.params.actionType == 7 ? "AssetRegistry oracle attestation contract authorized: " + accountStr
    : "Platform action executed: type=" + event.params.actionType.toString();

  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = typeStr;
  audit.actorAddress = event.transaction.from;
  audit.summary      = summary;
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

// T-054: 2-of-N staging for privileged grants (e.g. addAdmin via proposePrivilegedGrant) — a
// separate pendingGrants mapping/threshold from pendingActions, previously entirely unindexed.
// Unlike ActionProposed, GrantProposed does carry role/account, so both are real here.
export function handleGrantProposed(event: GrantProposedEvent): void {
  let grant = new PendingGrant(event.params.grantId.toString());
  grant.grantId    = event.params.grantId;
  grant.role       = event.params.role;
  grant.account    = event.params.account;
  grant.proposer   = event.params.proposer;
  grant.executed   = false;
  grant.proposedAt = event.block.timestamp;
  grant.save();
}

// GRANT_THRESHOLD is a hardcoded constant = 2 on the deployed contract
// (contracts/TimeBoundAccessControl.sol) — proposePrivilegedGrant auto-signs the proposer as
// signer 1, so the one and only coSignGrant call that ever succeeds is necessarily the co-sign
// that reaches threshold and executes the grant. If that constant ever changes, this handler
// needs a real signer-count check instead of assuming every GrantCoSigned means "executed."
export function handleGrantCoSigned(event: GrantCoSignedEvent): void {
  let grant = PendingGrant.load(event.params.grantId.toString());
  if (grant == null) return;
  grant.coSigner   = event.params.signer;
  grant.executed   = true;
  grant.executedAt = event.block.timestamp;
  grant.save();

  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "RoleGranted";
  audit.actorAddress = event.params.signer;
  audit.summary      = "Privileged grant #" + event.params.grantId.toString() + " co-signed — role granted to "
                      + grant.account.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handlePaused(event: PausedEvent): void {
  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "EmergencyPaused";
  audit.actorAddress = event.params.account;
  audit.summary      = "Platform paused by " + event.params.account.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}

export function handleUnpaused(event: UnpausedEvent): void {
  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = "GovernanceExecuted";
  audit.actorAddress = event.params.account;
  audit.summary      = "Platform unpaused by " + event.params.account.toHexString().slice(0, 10) + "…";
  audit.timestamp    = event.block.timestamp;
  audit.blockNumber  = event.block.number;
  audit.txHash       = event.transaction.hash;
  audit.save();
}
