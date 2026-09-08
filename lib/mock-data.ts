// @ts-nocheck
/**
 * Demo dataset standing in for live subgraph queries. Every shape here mirrors the entities in
 * docs/DATABASE_SCHEMA.md §2 exactly, so swapping this module for real GraphQL queries against the
 * indexer (see docs/API_SPEC.md §2) requires no changes to any component — see TODO.md.
 *
 * @ts-nocheck — this file uses deliberate array cross-references (identities[0].did etc.) that
 * TypeScript's noUncheckedIndexedAccess flags as possibly-undefined. The data is hand-authored
 * static fixture data; the strict check adds zero safety here.
 */

const now = Date.now();
const hr = 3_600_000;
const day = 24 * hr;

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "AUDITOR" | "USER";

export interface Identity {
  did: string;
  controller: string;
  keyType: "ES256K";
  createdAt: number;
  role: Role;
  credentialStatus: "verified" | "pending" | "revoked";
  guardianCount: number;
  roleExpiresAt: number;
}

export const identities: Identity[] = [
  {
    did: "did:ethr:0xA11CE7f3e9b2d4c8a6f1e0d9c8b7a6f5e4d3c2b1",
    controller: "0xA11CE7f3e9b2d4c8a6f1e0d9c8b7a6f5e4d3c2b1",
    keyType: "ES256K",
    createdAt: now - 210 * day,
    role: "SUPER_ADMIN",
    credentialStatus: "verified",
    guardianCount: 5,
    roleExpiresAt: now + 300 * day,
  },
  {
    did: "did:ethr:0xB0B2c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2",
    controller: "0xB0B2c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2",
    keyType: "ES256K",
    createdAt: now - 180 * day,
    role: "ADMIN",
    credentialStatus: "verified",
    guardianCount: 4,
    roleExpiresAt: now + 6 * day,
  },
  {
    did: "did:ethr:0xC4A21f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a",
    controller: "0xC4A21f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a",
    keyType: "ES256K",
    createdAt: now - 140 * day,
    role: "MANAGER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 40 * hr,
  },
  {
    did: "did:ethr:0xD5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    controller: "0xD5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    keyType: "ES256K",
    createdAt: now - 95 * day,
    role: "AUDITOR",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 120 * day,
  },
  {
    did: "did:ethr:0xE1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    controller: "0xE1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    keyType: "ES256K",
    createdAt: now - 12 * day,
    role: "USER",
    credentialStatus: "pending",
    guardianCount: 0,
    roleExpiresAt: now + 355 * day,
  },
  {
    did: "did:ethr:0xF9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c",
    controller: "0xF9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c",
    keyType: "ES256K",
    createdAt: now - 60 * day,
    role: "USER",
    credentialStatus: "revoked",
    guardianCount: 3,
    roleExpiresAt: now - 2 * day,
  },
];

export interface Asset {
  tokenId: number;
  cid: string;
  name: string;
  ownerDid: string;
  legalReference: string | null;
  mintedAt: number;
  proposer: string;
  coSigner: string;
}

export const assets: Asset[] = [
  {
    tokenId: 42,
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    name: "Radar Subsystem Calibration Cert.",
    ownerDid: identities[2].did,
    legalReference: "0x9f2a...c41",
    mintedAt: now - 30 * day,
    proposer: identities[1].did,
    coSigner: identities[2].did,
  },
  {
    tokenId: 43,
    cid: "bafybeih6y3c5p3a3vlfstruq7wxlqcttz3ok2quyayoxzcaj4vy3zzz5r4",
    name: "Facility Access Badge — Bay 4",
    ownerDid: identities[3].did,
    legalReference: null,
    mintedAt: now - 18 * day,
    proposer: identities[1].did,
    coSigner: identities[0].did,
  },
  {
    tokenId: 44,
    cid: "bafybeicn7svlxwlk2rn3mnkrpb4zujjaawn2j4jimyz4hxq5trjbo4wq6q",
    name: "Firmware Signing Authorization",
    ownerDid: identities[1].did,
    legalReference: "0x71ab...0e3",
    mintedAt: now - 4 * day,
    proposer: identities[0].did,
    coSigner: identities[2].did,
  },
];

export type EventType =
  | "DIDCreated"
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
  | "KeyRotated"
  | "RecoveryInitiated"
  | "RecoveryFinalized";

export interface AuditEvent {
  id: string;
  type: EventType;
  actorDid: string;
  summary: string;
  timestamp: number;
  txHash: string;
  riskScore?: number;
}

export const auditEvents: AuditEvent[] = [
  {
    id: "evt-1001",
    type: "AssetMinted",
    actorDid: identities[1].did,
    summary: "Minted “Firmware Signing Authorization” to " + identities[1].did.slice(0, 14) + "…",
    timestamp: now - 4 * day,
    txHash: "0x7c1f...e29a",
  },
  {
    id: "evt-1002",
    type: "RoleGranted",
    actorDid: identities[0].did,
    summary: "Granted AUDITOR_ROLE to " + identities[3].did.slice(0, 14) + "… (120d)",
    timestamp: now - 6 * day,
    txHash: "0x4a90...11cd",
  },
  {
    id: "evt-1003",
    type: "DisputeRaised",
    actorDid: identities[3].did,
    summary: "Dispute raised on queued transfer #212 — “recipient credential status unclear”",
    timestamp: now - 9 * day,
    txHash: "0xb02e...77f1",
  },
  {
    id: "evt-1004",
    type: "GuardianRegistered",
    actorDid: identities[4].did,
    summary: "Registered 3 guardians, threshold 2-of-3",
    timestamp: now - 11 * day,
    txHash: "0x0091...aa3c",
  },
  {
    id: "evt-1005",
    type: "RoleExpired",
    actorDid: identities[5].did,
    summary: "USER_ROLE expired automatically — no revocation transaction required",
    timestamp: now - 2 * day,
    txHash: "0x55d1...9be0",
  },
  {
    id: "evt-1006",
    type: "CredentialIssued",
    actorDid: identities[0].did,
    summary: "Issued MANAGER credential to " + identities[2].did.slice(0, 14) + "… valid 40h",
    timestamp: now - 40 * hr,
    txHash: "0x3fa7...c810",
  },
  {
    id: "evt-1007",
    type: "AssetMinted",
    actorDid: identities[1].did,
    summary: "Minted “Facility Access Badge — Bay 4” to " + identities[3].did.slice(0, 14) + "…",
    timestamp: now - 18 * day,
    txHash: "0x2b6e...4471",
  },
  {
    id: "evt-1008",
    type: "DIDCreated",
    actorDid: identities[4].did,
    summary: "New DID registered — credential issuance pending",
    timestamp: now - 12 * day,
    txHash: "0x9e40...0c2f",
  },
];

export interface AnomalyAlert {
  id: string;
  rule: string;
  detail: string;
  riskScore: number;
  timestamp: number;
  status: "open" | "dismissed";
}

export const anomalyAlerts: AnomalyAlert[] = [
  {
    id: "alert-1",
    rule: "Off-hours role escalation",
    detail: identities[1].did.slice(0, 14) + "… granted a MANAGER-tier role at 02:47 local time",
    riskScore: 71,
    timestamp: now - 40 * hr,
    status: "open",
  },
  {
    id: "alert-2",
    rule: "Elevated mint velocity",
    detail: "3 mints proposed within 6 minutes — 4.2× rolling baseline",
    riskScore: 54,
    timestamp: now - 5 * day,
    status: "open",
  },
  {
    id: "alert-3",
    rule: "Repeated failed authentication",
    detail: "5 failed challenge-signature attempts against did:ethr:0xF9e8…d6c",
    riskScore: 38,
    timestamp: now - 9 * day,
    status: "dismissed",
  },
];

export interface GovernanceItem {
  id: string;
  kind: "upgrade" | "addAdmin" | "removeAdmin" | "pause" | "transfer";
  title: string;
  lane: "multisig" | "timelock";
  status: "queued" | "disputed" | "executed";
  signers: { did: string; signed: boolean }[];
  requiredSignatures: number;
  eta?: number;
  disputeReason?: string;
}

export const governanceItems: GovernanceItem[] = [
  {
    id: "gov-1",
    kind: "addAdmin",
    title: "Add new ADMIN_ROLE signer — Procurement dept.",
    lane: "multisig",
    status: "queued",
    signers: [
      { did: identities[0].did, signed: true },
      { did: identities[1].did, signed: false },
      { did: identities[3].did, signed: false },
    ],
    requiredSignatures: 2,
  },
  {
    id: "gov-2",
    kind: "transfer",
    title: "High-value transfer — Asset #44 to external contractor DID",
    lane: "timelock",
    status: "disputed",
    signers: [{ did: identities[0].did, signed: true }],
    requiredSignatures: 1,
    eta: now + 6 * hr,
    disputeReason: "Recipient credential not yet HR-verified — Auditor flagged before execution.",
  },
  {
    id: "gov-3",
    kind: "upgrade",
    title: "UUPS upgrade — TimeBoundAccessControl v1.2 (audit fixes)",
    lane: "timelock",
    status: "queued",
    signers: [
      { did: identities[0].did, signed: true },
      { did: identities[1].did, signed: true },
    ],
    requiredSignatures: 2,
    eta: now + 22 * hr,
  },
];

export const systemHealth = {
  activeIdentities: identities.filter((i) => i.credentialStatus !== "revoked").length,
  expiringIn24h: identities.filter((i) => i.roleExpiresAt - now < 48 * hr && i.roleExpiresAt > now).length,
  pendingGovernance: governanceItems.filter((g) => g.status !== "executed").length,
  platformPaused: false,
};
