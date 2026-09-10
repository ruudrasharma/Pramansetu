// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock oracle-attestation fixtures — mirrors contracts/OracleAttestation.sol's fact lifecycle
 * (2-of-N ORACLE_ATTESTOR_ROLE co-sign, 15-minute DISPUTE_WINDOW, Status
 * Submitted|Attested|Disputed|Finalized|Rejected). T-016, gap analysis §2.2.5.
 */

import { identities, MIN, HOUR } from "./identities";
import { assets } from "./assets";

const now = Date.now();
const id = (i: number) => identities[i].did;

export type OracleFactStatus = "submitted" | "attested" | "disputed" | "finalized" | "rejected";

/** Opaque to the contract itself -- interpreted here for the mock/frontend only. */
export const FACT_TYPE_LABELS: Record<number, string> = {
  1: "Delivered",
  2: "Damaged",
  3: "Decommissioned",
};

export interface OracleFact {
  factId: number;
  tokenId: number;
  factType: number;
  dataHash: string;
  proposer: string;
  coSigner?: string;
  status: OracleFactStatus;
  submittedAt: number;
  disputeWindowEnd?: number;
  disputedBy?: string;
  disputeReason?: string;
  resolvedProceed?: boolean;
  finalizedAt?: number;
}

export const oracleFacts: OracleFact[] = [
  {
    factId: 1,
    tokenId: assets[0].tokenId,
    factType: 1,
    dataHash: "0x" + "a1".repeat(32),
    proposer: id(3),
    coSigner: id(4),
    status: "finalized",
    submittedAt: now - 3 * HOUR,
    disputeWindowEnd: now - 3 * HOUR + 15 * MIN,
    finalizedAt: now - 3 * HOUR + 15 * MIN,
  },
  {
    factId: 2,
    tokenId: assets[1].tokenId,
    factType: 1,
    dataHash: "0x" + "b2".repeat(32),
    proposer: id(3),
    coSigner: id(5),
    status: "attested",
    submittedAt: now - 5 * MIN,
    disputeWindowEnd: now + 10 * MIN,
  },
  {
    factId: 3,
    tokenId: assets[2].tokenId,
    factType: 2,
    dataHash: "0x" + "c3".repeat(32),
    proposer: id(4),
    coSigner: id(5),
    status: "disputed",
    submittedAt: now - 40 * MIN,
    disputeWindowEnd: now - 25 * MIN,
    disputedBy: id(9),
    disputeReason: "Damage report photo doesn't match the asset's known serial plate.",
  },
  {
    factId: 4,
    tokenId: assets[3].tokenId,
    factType: 1,
    dataHash: "0x" + "d4".repeat(32),
    proposer: id(3),
    status: "submitted",
    submittedAt: now - 2 * MIN,
  },
];

export function oracleFactsForToken(tokenId: number): OracleFact[] {
  return oracleFacts.filter((f) => f.tokenId === tokenId);
}

export function oracleFactById(factId: number): OracleFact | undefined {
  return oracleFacts.find((f) => f.factId === factId);
}
