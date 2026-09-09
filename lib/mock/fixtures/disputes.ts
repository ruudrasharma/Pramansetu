// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock timelock/dispute fixtures — mirrors contracts/GovernanceTimelock.sol's queue (24-48h
 * MIN_DELAY/MAX_DELAY, Status enum Queued|Executed|Disputed|Cancelled, raiseDispute/resolveDispute).
 */

import { identities, HOUR } from "./identities";
import { assets } from "./assets";

const now = Date.now();
const id = (i: number) => identities[i].did;

export type TimelockStatus = "queued" | "executed" | "disputed" | "cancelled";

export interface TimelockTransaction {
  txId: number;
  title: string;
  description: string;
  target: string;
  queuedAt: number;
  eta: number;
  status: TimelockStatus;
  raisedBy?: string;
  disputeReason?: string;
  resolution?: { proceeded: boolean; resolvedBy: string; resolvedAt: number };
}

export const timelockTransactions: TimelockTransaction[] = [
  {
    txId: 212,
    title: `High-value transfer — token #${assets[9].tokenId} to external contractor DID`,
    description: "Cooling-off transfer of “External Contractor Access Grant” pending Auditor review window.",
    target: "AssetRegistry.transferFrom",
    queuedAt: now - 18 * HOUR,
    eta: now + 6 * HOUR,
    status: "disputed",
    raisedBy: id(9),
    disputeReason: "Recipient credential not yet HR-verified — flagged before execution.",
  },
  {
    txId: 213,
    title: "High-value transfer — token #51 to Network Systems archive DID",
    description: "Routine department reassignment of “Network Systems Root Cert Bundle”.",
    target: "AssetRegistry.transferFrom",
    queuedAt: now - 4 * HOUR,
    eta: now + 20 * HOUR,
    status: "queued",
  },
  {
    txId: 198,
    title: "High-value transfer — token #48 to Naval Systems custody DID",
    description: "Reassignment following department restructure.",
    target: "AssetRegistry.transferFrom",
    queuedAt: now - 27 * HOUR,
    eta: now - 3 * HOUR,
    status: "executed",
  },
  {
    txId: 187,
    title: "High-value transfer — token #39 (decommissioned)",
    description: "Transfer attempt for a since-decommissioned asset.",
    target: "AssetRegistry.transferFrom",
    queuedAt: now - 12 * 24 * HOUR,
    eta: now - 11 * 24 * HOUR,
    status: "cancelled",
    raisedBy: id(10),
    disputeReason: "Asset flagged for retirement mid-transfer — Super Admins cancelled rather than execute.",
    resolution: { proceeded: false, resolvedBy: id(0), resolvedAt: now - 11 * 24 * HOUR },
  },
];

export function timelockTx(txId: number): TimelockTransaction | undefined {
  return timelockTransactions.find((t) => t.txId === txId);
}
