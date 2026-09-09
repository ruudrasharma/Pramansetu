// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock digital-asset fixtures — mirrors contracts/AssetRegistry.sol (proposeMint → coSignMint
 * dual-attestation, assetMeta.legalReference, vcIdOf). Covers every lifecycle state the brief
 * asks for: pending co-sign, finalized, transferred, disputed.
 */

import { identities, DAY, HOUR } from "./identities";
import { credentials } from "./credentials";

const now = Date.now();

export type AssetStatus = "pending_cosign" | "finalized" | "transferred" | "disputed";

export interface ProvenanceEvent {
  label: string;
  actorDid: string;
  timestamp: number;
}

export interface Asset {
  tokenId: number;
  cid: string;
  name: string;
  category: string;
  ownerDid: string;
  /** Real owner wallet address — only ever set by assetService's onchain branch (the owner's
   * DID may not exist, so this is the reliable way to resolve a real transferFrom `from`
   * argument without indirecting through ownerDid). Undefined in mock mode. */
  ownerAddress?: string;
  vcId: string;
  legalReference: string | null;
  mintedAt: number | null;
  proposer: string;
  coSigner: string | null;
  status: AssetStatus;
  provenance: ProvenanceEvent[];
}

function vcFor(did: string): string {
  return credentials.find((c) => c.subjectDid === did)?.vcId ?? "vc-0000";
}

const admin = identities[3].did; // Priya Nair, ADMIN — HR & Compliance
const admin2 = identities[5].did; // Karan Malhotra, ADMIN — Procurement
const manager1 = identities[6].did; // Divya Rao, MANAGER — Radar & EW
const manager2 = identities[7].did; // Vikram Sethi, MANAGER — Naval
const manager3 = identities[8].did; // Ananya Bhatt, MANAGER — Avionics
const superAdmin = identities[0].did;

export const assets: Asset[] = [
  {
    tokenId: 42,
    cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    name: "Radar Subsystem Calibration Cert.",
    category: "Certification",
    ownerDid: identities[6].did,
    vcId: vcFor(identities[6].did),
    legalReference: "0x9f2a3b4c5d6e7f8091a2b3c4d5e6f70819a2b3c4",
    mintedAt: now - 30 * DAY,
    proposer: admin,
    coSigner: manager1,
    status: "finalized",
    provenance: [
      { label: "Mint proposed", actorDid: admin, timestamp: now - 30 * DAY - 2 * HOUR },
      { label: "Co-signed by Manager", actorDid: manager1, timestamp: now - 30 * DAY },
    ],
  },
  {
    tokenId: 43,
    cid: "bafybeih6y3c5p3a3vlfstruq7wxlqcttz3ok2quyayoxzcaj4vy3zzz5r4",
    name: "Facility Access Badge — Bay 4",
    category: "Access Badge",
    ownerDid: identities[9].did,
    vcId: vcFor(identities[9].did),
    legalReference: null,
    mintedAt: now - 18 * DAY,
    proposer: admin,
    coSigner: superAdmin,
    status: "finalized",
    provenance: [
      { label: "Mint proposed", actorDid: admin, timestamp: now - 18 * DAY - 1 * HOUR },
      { label: "Co-signed by Super Admin", actorDid: superAdmin, timestamp: now - 18 * DAY },
    ],
  },
  {
    tokenId: 44,
    cid: "bafybeicn7svlxwlk2rn3mnkrpb4zujjaawn2j4jimyz4hxq5trjbo4wq6q",
    name: "Firmware Signing Authorization",
    category: "Authorization",
    ownerDid: identities[3].did,
    vcId: vcFor(identities[3].did),
    legalReference: "0x71ab2c3d4e5f60718293a4b5c6d7e8f091a2b3c",
    mintedAt: now - 4 * DAY,
    proposer: superAdmin,
    coSigner: manager1,
    status: "finalized",
    provenance: [
      { label: "Mint proposed", actorDid: superAdmin, timestamp: now - 4 * DAY - 3 * HOUR },
      { label: "Co-signed by Manager", actorDid: manager1, timestamp: now - 4 * DAY },
    ],
  },
  {
    tokenId: 45,
    cid: "bafybeib3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5",
    name: "Sonar Array Component Provenance",
    category: "Component Provenance",
    ownerDid: identities[7].did,
    vcId: vcFor(identities[7].did),
    legalReference: null,
    mintedAt: null,
    proposer: admin2,
    coSigner: null,
    status: "pending_cosign",
    provenance: [{ label: "Mint proposed — awaiting Manager co-sign", actorDid: admin2, timestamp: now - 3 * HOUR }],
  },
  {
    tokenId: 46,
    cid: "bafybeic7e9f1a3c5b7d9f1a3c5e7b9d1f3a5c7e9",
    name: "Avionics Test Rig Calibration Cert.",
    category: "Certification",
    ownerDid: identities[8].did,
    vcId: vcFor(identities[8].did),
    legalReference: null,
    mintedAt: null,
    proposer: admin,
    coSigner: null,
    status: "pending_cosign",
    provenance: [{ label: "Mint proposed — awaiting Manager co-sign", actorDid: admin, timestamp: now - 45 * 60_000 }],
  },
  {
    tokenId: 47,
    cid: "bafybeid1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3",
    name: "Missile Guidance Module Provenance",
    category: "Component Provenance",
    ownerDid: identities[10].did,
    vcId: vcFor(identities[10].did),
    legalReference: null,
    mintedAt: null,
    proposer: admin2,
    coSigner: null,
    status: "pending_cosign",
    provenance: [{ label: "Mint proposed — awaiting Manager co-sign", actorDid: admin2, timestamp: now - 10 * 60_000 }],
  },
  {
    tokenId: 48,
    cid: "bafybeie3d5f7a9c1b3d5f7a9c1e3b5d7f9a1c3e5",
    name: "Naval Comms Encryption Module Cert.",
    category: "Certification",
    ownerDid: identities[14].did,
    vcId: vcFor(identities[14].did),
    legalReference: "0x88bc2d3e4f5061728394a5b6c7d8e9f001a2b3c",
    mintedAt: now - 60 * DAY,
    proposer: admin,
    coSigner: manager2,
    status: "transferred",
    provenance: [
      { label: "Mint proposed", actorDid: admin, timestamp: now - 60 * DAY - 2 * HOUR },
      { label: "Co-signed by Manager", actorDid: manager2, timestamp: now - 60 * DAY },
      { label: "Transferred to current owner", actorDid: identities[13].did, timestamp: now - 25 * DAY },
    ],
  },
  {
    tokenId: 49,
    cid: "bafybeif5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7",
    name: "Procurement Vendor Attestation",
    category: "Authorization",
    ownerDid: identities[19].did,
    vcId: vcFor(identities[19].did),
    legalReference: "0x33cd4e5f60718293a4b5c6d7e8f091a2b3c4d5e",
    mintedAt: now - 110 * DAY,
    proposer: admin2,
    coSigner: superAdmin,
    status: "transferred",
    provenance: [
      { label: "Mint proposed", actorDid: admin2, timestamp: now - 110 * DAY - 4 * HOUR },
      { label: "Co-signed by Super Admin", actorDid: superAdmin, timestamp: now - 110 * DAY },
      { label: "Transferred to current owner", actorDid: identities[16].did, timestamp: now - 70 * DAY },
    ],
  },
  {
    tokenId: 50,
    cid: "bafybeig7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9",
    name: "External Contractor Access Grant",
    category: "Access Badge",
    ownerDid: identities[17].did,
    vcId: vcFor(identities[17].did),
    legalReference: null,
    mintedAt: now - 40 * DAY,
    proposer: admin,
    coSigner: manager3,
    status: "disputed",
    provenance: [
      { label: "Mint proposed", actorDid: admin, timestamp: now - 40 * DAY - 1 * HOUR },
      { label: "Co-signed by Manager", actorDid: manager3, timestamp: now - 40 * DAY },
      { label: "Transfer disputed by Auditor", actorDid: identities[9].did, timestamp: now - 6 * HOUR },
    ],
  },
  {
    tokenId: 51,
    cid: "bafybeih9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1",
    name: "Network Systems Root Cert Bundle",
    category: "Certification",
    ownerDid: identities[15].did,
    vcId: vcFor(identities[15].did),
    legalReference: "0x55de6f7081920a3b4c5d6e7f8091a2b3c4d5e6f",
    mintedAt: now - 200 * DAY,
    proposer: admin2,
    coSigner: manager2,
    status: "disputed",
    provenance: [
      { label: "Mint proposed", actorDid: admin2, timestamp: now - 200 * DAY - 2 * HOUR },
      { label: "Co-signed by Manager", actorDid: manager2, timestamp: now - 200 * DAY },
      { label: "Transfer disputed by Auditor", actorDid: identities[10].did, timestamp: now - 20 * HOUR },
    ],
  },
  {
    tokenId: 52,
    cid: "bafybeij1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3",
    name: "Systems Security Root-of-Trust Cert.",
    category: "Certification",
    ownerDid: identities[1].did,
    vcId: vcFor(identities[1].did),
    legalReference: "0x66ef708192a3b4c5d6e7f8091a2b3c4d5e6f708",
    mintedAt: now - 250 * DAY,
    proposer: superAdmin,
    coSigner: identities[1].did,
    status: "finalized",
    provenance: [
      { label: "Mint proposed", actorDid: superAdmin, timestamp: now - 250 * DAY - 3 * HOUR },
      { label: "Co-signed by Super Admin", actorDid: identities[1].did, timestamp: now - 250 * DAY },
    ],
  },
  {
    tokenId: 53,
    cid: "bafybeik3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5",
    name: "HR Onboarding Verification Record",
    category: "Authorization",
    ownerDid: identities[12].did,
    vcId: vcFor(identities[12].did),
    legalReference: null,
    mintedAt: now - 15 * DAY,
    proposer: admin,
    coSigner: manager1,
    status: "finalized",
    provenance: [
      { label: "Mint proposed", actorDid: admin, timestamp: now - 15 * DAY - 30 * 60_000 },
      { label: "Co-signed by Manager", actorDid: manager1, timestamp: now - 15 * DAY },
    ],
  },
];

export function assetById(tokenId: number): Asset | undefined {
  return assets.find((a) => a.tokenId === tokenId);
}
