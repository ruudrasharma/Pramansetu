import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  TimedRoleGranted as TimedRoleGrantedEvent,
  RoleRevoked as RoleRevokedEvent,
  ActionProposed as ActionProposedEvent,
  ActionExecuted as ActionExecutedEvent,
  Paused as PausedEvent,
  Unpaused as UnpausedEvent,
} from "../generated/TimeBoundAccessControl/TimeBoundAccessControl";
import { RoleGrant, PlatformAction, AuditEvent } from "../generated/schema";

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
  action.role        = Bytes.empty();
  action.account     = Bytes.empty();
  action.proposer    = event.params.proposer;
  action.executed    = false;
  action.proposedAt  = event.block.timestamp;
  action.save();
}

export function handleActionExecuted(event: ActionExecutedEvent): void {
  let action = PlatformAction.load(event.params.actionId.toString());
  if (action == null) return;
  action.executed    = true;
  action.executedAt  = event.block.timestamp;
  action.save();

  // actionType: 1 = emergencyRevoke, 2 = pause, 3 = unpause (contracts/TimeBoundAccessControl.sol).
  // Previously every actionType collapsed to "EmergencyPaused", so a real role revocation (1)
  // showed on the ledger/audit table identically to an actual platform pause (2) — indistinguishable
  // and misleading. Label each actionType with what it actually is; "GovernanceExecuted" for
  // unpause (3) matches the label already used by handleUnpaused() below for the direct Unpaused event.
  let typeStr = event.params.actionType == 1 ? "RoleRevoked"
              : event.params.actionType == 2 ? "EmergencyPaused"
              : "GovernanceExecuted"; // 3 = unpause

  let auditId = "AC-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let audit = new AuditEvent(auditId);
  audit.type         = typeStr;
  audit.actorAddress = event.transaction.from;
  audit.summary      = "Platform action executed: type=" + event.params.actionType.toString();
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
