// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock identity fixtures — mirrors docs/DATABASE_SCHEMA.md's Identity entity 1:1 so this is a
 * drop-in stand-in for a real subgraph query once wired through lib/services/didService.ts.
 */

const now = Date.now();
export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "AUDITOR" | "USER";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  AUDITOR: "Auditor",
  USER: "User",
};

export interface Identity {
  did: string;
  controller: string;
  keyType: "ES256K";
  name: string;
  department: string;
  createdAt: number;
  role: Role;
  credentialStatus: "verified" | "pending" | "revoked";
  guardianCount: number;
  roleExpiresAt: number;
}

export const identities: Identity[] = [
  // ── Super Admin (2) — multisig signers, BEL security leadership ─────────────
  {
    did: "did:ethr:0xA11CE7f3e9b2d4c8a6f1e0d9c8b7a6f5e4d3c2b1",
    controller: "0xA11CE7f3e9b2d4c8a6f1e0d9c8b7a6f5e4d3c2b1",
    keyType: "ES256K",
    name: "Aarav Iyer",
    department: "Systems Security",
    createdAt: now - 340 * DAY,
    role: "SUPER_ADMIN",
    credentialStatus: "verified",
    guardianCount: 5,
    roleExpiresAt: now + 300 * DAY,
  },
  {
    did: "did:ethr:0x2F4b8c1a9d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
    controller: "0x2F4b8c1a9d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
    keyType: "ES256K",
    name: "Meera Krishnan",
    department: "Systems Security",
    createdAt: now - 300 * DAY,
    role: "SUPER_ADMIN",
    credentialStatus: "verified",
    guardianCount: 5,
    roleExpiresAt: now + 300 * DAY,
  },

  // ── Admin (3) — IT/HR admins, mint/issue/grant ───────────────────────────────
  {
    did: "did:ethr:0xB0B2c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2",
    controller: "0xB0B2c9e8d7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2",
    keyType: "ES256K",
    name: "Rohan Deshmukh",
    department: "IT Infrastructure",
    createdAt: now - 180 * DAY,
    role: "ADMIN",
    credentialStatus: "verified",
    guardianCount: 4,
    roleExpiresAt: now + 6 * DAY,
  },
  {
    did: "did:ethr:0x3a7c1e9f0b2d4c6a8f1e3d5c7b9a0f2e4d6c8b1a",
    controller: "0x3a7c1e9f0b2d4c6a8f1e3d5c7b9a0f2e4d6c8b1a",
    keyType: "ES256K",
    name: "Priya Nair",
    department: "HR & Compliance",
    createdAt: now - 260 * DAY,
    role: "ADMIN",
    credentialStatus: "verified",
    guardianCount: 4,
    roleExpiresAt: now + 84 * DAY,
  },
  {
    did: "did:ethr:0x9b3d5f7a1c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d",
    controller: "0x9b3d5f7a1c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d",
    keyType: "ES256K",
    name: "Karan Malhotra",
    department: "Procurement",
    createdAt: now - 90 * DAY,
    role: "ADMIN",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 40 * HOUR,
  },

  // ── Manager (4) — dept heads, co-sign dual-attestation mints ─────────────────
  {
    did: "did:ethr:0xC4A21f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a",
    controller: "0xC4A21f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a",
    keyType: "ES256K",
    name: "Divya Rao",
    department: "Radar & EW Systems",
    createdAt: now - 140 * DAY,
    role: "MANAGER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 40 * HOUR,
  },
  {
    did: "did:ethr:0x5e7f9b1d3a5c7e9f1b3d5a7c9e1f3b5d7a9c1e3f",
    controller: "0x5e7f9b1d3a5c7e9f1b3d5a7c9e1f3b5d7a9c1e3f",
    keyType: "ES256K",
    name: "Vikram Sethi",
    department: "Naval Systems",
    createdAt: now - 200 * DAY,
    role: "MANAGER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 12 * DAY,
  },
  {
    did: "did:ethr:0x8c0e2f4a6b8d0e2f4a6c8e0b2d4f6a8c0e2b4d6f",
    controller: "0x8c0e2f4a6b8d0e2f4a6c8e0b2d4f6a8c0e2b4d6f",
    keyType: "ES256K",
    name: "Ananya Bhatt",
    department: "Avionics",
    createdAt: now - 75 * DAY,
    role: "MANAGER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 5 * DAY,
  },
  {
    did: "did:ethr:0x1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f",
    controller: "0x1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f",
    keyType: "ES256K",
    name: "Siddharth Kapoor",
    department: "Missile Systems",
    createdAt: now - 30 * DAY,
    role: "MANAGER",
    credentialStatus: "pending",
    guardianCount: 3,
    roleExpiresAt: now + 20 * HOUR,
  },

  // ── Auditor (3) — internal audit/compliance, read-only + dispute veto ───────
  {
    did: "did:ethr:0xD5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    controller: "0xD5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
    keyType: "ES256K",
    name: "Neha Choudhary",
    department: "Internal Audit",
    createdAt: now - 95 * DAY,
    role: "AUDITOR",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 120 * DAY,
  },
  {
    did: "did:ethr:0x4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d",
    controller: "0x4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8e0b2d",
    keyType: "ES256K",
    name: "Arjun Varma",
    department: "Internal Audit",
    createdAt: now - 220 * DAY,
    role: "AUDITOR",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 200 * DAY,
  },
  {
    did: "did:ethr:0x7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c",
    controller: "0x7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c",
    keyType: "ES256K",
    name: "Ishaan Bose",
    department: "Compliance",
    createdAt: now - 50 * DAY,
    role: "AUDITOR",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 45 * DAY,
  },

  // ── User (8) — employees, own DID/assets/transfer requests ──────────────────
  {
    did: "did:ethr:0xE1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    controller: "0xE1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    keyType: "ES256K",
    name: "Tanvi Joshi",
    department: "Communication Systems",
    createdAt: now - 12 * DAY,
    role: "USER",
    credentialStatus: "pending",
    guardianCount: 0,
    roleExpiresAt: now + 355 * DAY,
  },
  {
    did: "did:ethr:0xF9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c",
    controller: "0xF9e8d7c6b5a4938271605f4e3d2c1b0a9f8e7d6c",
    keyType: "ES256K",
    name: "Yash Trivedi",
    department: "Network Systems",
    createdAt: now - 60 * DAY,
    role: "USER",
    credentialStatus: "revoked",
    guardianCount: 3,
    roleExpiresAt: now - 2 * DAY,
  },
  {
    did: "did:ethr:0x0e2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f",
    controller: "0x0e2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f",
    keyType: "ES256K",
    name: "Sanya Kulkarni",
    department: "Missile Systems",
    createdAt: now - 400 * DAY,
    role: "USER",
    credentialStatus: "verified",
    guardianCount: 4,
    roleExpiresAt: now + 190 * DAY,
  },
  {
    did: "did:ethr:0x6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e",
    controller: "0x6c8e0b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e",
    keyType: "ES256K",
    name: "Devika Menon",
    department: "Avionics",
    createdAt: now - 150 * DAY,
    role: "USER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 70 * DAY,
  },
  {
    did: "did:ethr:0xa0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8",
    controller: "0xa0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6c8",
    keyType: "ES256K",
    name: "Rahul Bajaj",
    department: "Radar & EW Systems",
    createdAt: now - 20 * DAY,
    role: "USER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 345 * DAY,
  },
  {
    did: "did:ethr:0xe6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4",
    controller: "0xe6b8d0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4",
    keyType: "ES256K",
    name: "Aditi Pillai",
    department: "Naval Systems",
    createdAt: now - 5 * DAY,
    role: "USER",
    credentialStatus: "pending",
    guardianCount: 0,
    roleExpiresAt: now + 360 * DAY,
  },
  {
    did: "did:ethr:0xc6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4",
    controller: "0xc6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8a0c2e4",
    keyType: "ES256K",
    name: "Nikhil Ghosh",
    department: "Procurement",
    createdAt: now - 500 * DAY,
    role: "USER",
    credentialStatus: "verified",
    guardianCount: 5,
    roleExpiresAt: now + 15 * DAY,
  },
  {
    did: "did:ethr:0xd0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8",
    controller: "0xd0f2a4c6e8b0d2f4a6c8e0b2d4f6a8c0e2b4d6f8",
    keyType: "ES256K",
    name: "Fatima Sheikh",
    department: "Systems Security",
    createdAt: now - 8 * DAY,
    role: "USER",
    credentialStatus: "verified",
    guardianCount: 3,
    roleExpiresAt: now + 30 * HOUR,
  },
];

/** One well-formed identity per role, for the demo role-switcher (brief §5). */
export const identityByRole: Record<Role, Identity> = {
  SUPER_ADMIN: identities[0],
  ADMIN: identities[3],
  MANAGER: identities[6],
  AUDITOR: identities[9],
  USER: identities[16],
};

export function findIdentity(did: string): Identity | undefined {
  return identities.find((i) => i.did === did);
}
