// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock immutable audit-trail fixtures — every EventType the contracts emit, spanning ~60 days,
 * newest last (pages sort descending). 30+ entries per the brief.
 */

import { identities, DAY, HOUR } from "./identities";

const now = Date.now();
const id = (i: number) => identities[i].did;
const short = (did: string) => did.slice(0, 14) + "…";

export type EventType =
  | "DIDCreated"
  | "KeyRotated"
  | "CredentialIssued"
  | "CredentialRevoked"
  | "RoleGranted"
  | "RoleRevoked"
  | "RoleExpired"
  | "AssetMinted"
  | "AssetTransferred"
  | "EmergencyPaused"
  | "DisputeRaised"
  | "GovernanceExecuted"
  | "GuardianRegistered"
  | "RecoveryInitiated"
  | "RecoveryFinalized"
  | "OracleFactSubmitted"
  | "OracleFactAttested"
  | "OracleFactDisputed"
  | "OracleFactFinalized"
  | "OracleFactRejected";

export interface AuditEvent {
  id: string;
  type: EventType;
  // Genuinely nullable on real onchain events — the subgraph's AuditEvent.actorDid is `null`
  // whenever the actor address has no registered DID (many handlers, including the one behind
  // EmergencyPaused, never set it — see lib/server/anomalyDetection.ts's comment on the same
  // gap). Mock fixtures never set it null, but real onchain data does; every real-data consumer
  // must handle both. actorAddress is the always-present onchain fallback (undefined in mock
  // mode fixtures, which have no equivalent field).
  actorDid: string | null;
  actorAddress?: string;
  summary: string;
  timestamp: number;
  txHash: string;
  riskScore?: number;
}

function tx(seed: number): string {
  const h = (seed * 2654435761) >>> 0;
  return "0x" + h.toString(16).padStart(8, "0") + "…" + ((h * 7) >>> 0).toString(16).slice(0, 4);
}

export const auditEvents: AuditEvent[] = [
  { id: "evt-1000", type: "DIDCreated", actorDid: id(0), summary: "Genesis DID registered for platform bootstrap — Super Admin", timestamp: now - 340 * DAY, txHash: tx(1000) },
  { id: "evt-1001", type: "DIDCreated", actorDid: id(1), summary: "DID registered — Systems Security", timestamp: now - 300 * DAY, txHash: tx(1001) },
  { id: "evt-1002", type: "GuardianRegistered", actorDid: id(1), summary: "Registered 5 guardians, threshold 3-of-5", timestamp: now - 298 * DAY, txHash: tx(1002) },
  { id: "evt-1003", type: "CredentialIssued", actorDid: id(0), summary: `Issued SUPER_ADMIN credential to ${short(id(1))}`, timestamp: now - 297 * DAY, txHash: tx(1003) },
  { id: "evt-1004", type: "DIDCreated", actorDid: id(3), summary: "DID registered — HR & Compliance", timestamp: now - 260 * DAY, txHash: tx(1004) },
  { id: "evt-1005", type: "RoleGranted", actorDid: id(0), summary: `Granted ADMIN_ROLE to ${short(id(3))} (permanent)`, timestamp: now - 259 * DAY, txHash: tx(1005) },
  { id: "evt-1006", type: "AssetMinted", actorDid: id(0), summary: "Minted “Systems Security Root-of-Trust Cert.” — token #52", timestamp: now - 250 * DAY, txHash: tx(1006) },
  { id: "evt-1007", type: "GovernanceExecuted", actorDid: id(0), summary: "Platform action executed — 2-of-2 Super Admin co-sign (routine key rotation policy update)", timestamp: now - 230 * DAY, txHash: tx(1007) },
  { id: "evt-1008", type: "DIDCreated", actorDid: id(9), summary: "DID registered — Internal Audit", timestamp: now - 220 * DAY, txHash: tx(1008) },
  { id: "evt-1009", type: "GuardianRegistered", actorDid: id(9), summary: "Registered 3 guardians, threshold 2-of-3", timestamp: now - 218 * DAY, txHash: tx(1009) },
  { id: "evt-1010", type: "RoleGranted", actorDid: id(0), summary: `Granted AUDITOR_ROLE to ${short(id(9))} (200d)`, timestamp: now - 217 * DAY, txHash: tx(1010) },
  { id: "evt-1011", type: "DIDCreated", actorDid: id(5), summary: "DID registered — Naval Systems", timestamp: now - 200 * DAY, txHash: tx(1011) },
  { id: "evt-1012", type: "RoleGranted", actorDid: id(3), summary: `Granted MANAGER_ROLE to ${short(id(5))} (renewed)`, timestamp: now - 199 * DAY, txHash: tx(1012) },
  { id: "evt-1013", type: "AssetMinted", actorDid: id(5), summary: "Minted “Network Systems Root Cert Bundle” — token #51", timestamp: now - 200 * DAY, txHash: tx(1013) },
  { id: "evt-1014", type: "AssetTransferred", actorDid: id(15), summary: "Token #51 transferred to current owner", timestamp: now - 195 * DAY, txHash: tx(1014) },
  { id: "evt-1015", type: "DisputeRaised", actorDid: id(10), summary: "Dispute raised on token #51 transfer — recipient credential re-verification requested", timestamp: now - 20 * HOUR, txHash: tx(1015), riskScore: 46 },
  { id: "evt-1016", type: "DIDCreated", actorDid: id(4), summary: "DID registered — Procurement", timestamp: now - 90 * DAY, txHash: tx(1016) },
  { id: "evt-1017", type: "RoleGranted", actorDid: id(0), summary: `Granted ADMIN_ROLE to ${short(id(4))} (40h)`, timestamp: now - 88 * DAY, txHash: tx(1017) },
  { id: "evt-1018", type: "AssetMinted", actorDid: id(4), summary: "Minted “Procurement Vendor Attestation” — token #49", timestamp: now - 110 * DAY, txHash: tx(1018) },
  { id: "evt-1019", type: "AssetTransferred", actorDid: id(19), summary: "Token #49 transferred to current owner", timestamp: now - 70 * DAY, txHash: tx(1019) },
  { id: "evt-1020", type: "DIDCreated", actorDid: id(6), summary: "DID registered — Radar & EW Systems", timestamp: now - 140 * DAY, txHash: tx(1020) },
  { id: "evt-1021", type: "GuardianRegistered", actorDid: id(6), summary: "Registered 3 guardians, threshold 2-of-3", timestamp: now - 138 * DAY, txHash: tx(1021) },
  { id: "evt-1022", type: "AssetMinted", actorDid: id(3), summary: "Minted “Radar Subsystem Calibration Cert.” — token #42", timestamp: now - 30 * DAY, txHash: tx(1022) },
  { id: "evt-1023", type: "DIDCreated", actorDid: id(7), summary: "DID registered — Naval Systems", timestamp: now - 75 * DAY, txHash: tx(1023) },
  { id: "evt-1024", type: "AssetMinted", actorDid: id(3), summary: "Minted “Facility Access Badge — Bay 4” — token #43", timestamp: now - 18 * DAY, txHash: tx(1024) },
  { id: "evt-1025", type: "CredentialIssued", actorDid: id(3), summary: `Issued MANAGER credential to ${short(id(6))} valid 40h`, timestamp: now - 40 * HOUR, txHash: tx(1025) },
  { id: "evt-1026", type: "AssetMinted", actorDid: id(0), summary: "Minted “Firmware Signing Authorization” — token #44", timestamp: now - 4 * DAY, txHash: tx(1026) },
  { id: "evt-1027", type: "DIDCreated", actorDid: id(16), summary: "New DID registered — credential issuance pending", timestamp: now - 12 * DAY, txHash: tx(1027) },
  { id: "evt-1028", type: "DIDCreated", actorDid: id(17), summary: "New DID registered — credential issuance pending", timestamp: now - 5 * DAY, txHash: tx(1028) },
  { id: "evt-1029", type: "RoleExpired", actorDid: id(11), summary: "USER_ROLE expired automatically — no revocation transaction required", timestamp: now - 2 * DAY, txHash: tx(1029) },
  { id: "evt-1030", type: "CredentialRevoked", actorDid: id(3), summary: `Revoked credential for ${short(id(11))} following role expiry`, timestamp: now - 2 * DAY + 10 * 60_000, txHash: tx(1030) },
  { id: "evt-1031", type: "RoleRevoked", actorDid: id(0), summary: `Emergency-revoked ADMIN_ROLE from ${short(id(4))} — 2-of-2 Super Admin co-sign`, timestamp: now - 9 * DAY, txHash: tx(1031), riskScore: 62 },
  { id: "evt-1032", type: "DisputeRaised", actorDid: id(9), summary: "Dispute raised on token #50 transfer — external contractor access grant", timestamp: now - 6 * HOUR, txHash: tx(1032), riskScore: 58 },
  { id: "evt-1033", type: "RecoveryInitiated", actorDid: id(13), summary: `Guardian recovery initiated for ${short(id(7))} — device lost`, timestamp: now - 5 * HOUR, txHash: tx(1033), riskScore: 35 },
  { id: "evt-1034", type: "GovernanceExecuted", actorDid: id(0), summary: "UUPS upgrade executed — TimeBoundAccessControl v1.1", timestamp: now - 60 * DAY, txHash: tx(1034) },
  { id: "evt-1035", type: "EmergencyPaused", actorDid: id(1), summary: "Platform paused — 2-of-2 Super Admin co-sign, anomalous mint velocity under review", timestamp: now - 45 * DAY, txHash: tx(1035), riskScore: 81 },
  { id: "evt-1036", type: "GovernanceExecuted", actorDid: id(0), summary: "Platform unpaused — investigation closed, no compromise found", timestamp: now - 45 * DAY + 3 * HOUR, txHash: tx(1036) },
  { id: "evt-1037", type: "RecoveryFinalized", actorDid: id(14), summary: `Guardian recovery finalized for a prior device-loss case — key rotated, roles intact`, timestamp: now - 100 * DAY, txHash: tx(1037) },
  { id: "evt-1038", type: "RoleGranted", actorDid: id(4), summary: `Granted USER_ROLE to ${short(id(18))} (355d)`, timestamp: now - 8 * DAY, txHash: tx(1038) },
];
