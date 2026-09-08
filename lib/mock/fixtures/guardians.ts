// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock guardian-recovery fixtures — mirrors contracts/GuardianRecovery.sol (guardiansOf,
 * recoveryThreshold, activeRecovery: 24h RECOVERY_TIMELOCK, 3-5 guardians per identity).
 */

import { identities, HOUR, type Identity } from "./identities";

export interface ActiveRecovery {
  newController: string;
  initiatedAt: number;
  initiatedBy: string;
  signatures: string[]; // guardian DIDs who have signed so far
  timelockEndsAt: number;
}

export interface GuardianSet {
  did: string;
  guardians: string[];
  threshold: number;
  activeRecovery?: ActiveRecovery;
}

const now = Date.now();

function pickGuardians(subject: Identity, count: number): string[] {
  const pool = identities.filter((i) => i.did !== subject.did);
  const startIdx = identities.indexOf(subject);
  const picked: string[] = [];
  for (let offset = 1; picked.length < count; offset++) {
    picked.push(pool[(startIdx + offset) % pool.length].did);
  }
  return picked;
}

export const guardianSets: GuardianSet[] = identities
  .filter((i) => i.guardianCount > 0)
  .map((subject) => ({
    did: subject.did,
    guardians: pickGuardians(subject, subject.guardianCount),
    threshold: Math.max(2, Math.ceil(subject.guardianCount / 2) + (subject.guardianCount >= 5 ? 1 : 0)),
  }));

// One in-progress recovery — Vikram Sethi (Manager, Naval Systems) lost his device;
// 2 of 3 guardians have signed, timelock hasn't elapsed yet.
const recoveringSubject = identities[6];
const recoveringSet = guardianSets.find((g) => g.did === recoveringSubject.did);
if (recoveringSet) {
  recoveringSet.activeRecovery = {
    newController: "0x77aa66bb55cc44dd33ee22ff11009988aabbccdd",
    initiatedAt: now - 5 * HOUR,
    initiatedBy: recoveringSet.guardians[0],
    signatures: recoveringSet.guardians.slice(0, 2),
    timelockEndsAt: now - 5 * HOUR + 24 * HOUR,
  };
}

export function guardianSetFor(did: string): GuardianSet | undefined {
  return guardianSets.find((g) => g.did === did);
}
