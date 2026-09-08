// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock multisig-governance fixtures — mirrors TimeBoundAccessControl's proposePlatformAction/
 * coSignPlatformAction 2-of-N queue (pendingActions) and the multisig lane of docs/UI_UX_SPEC.md.
 */

import { identities, HOUR } from "./identities";

const now = Date.now();
const id = (i: number) => identities[i].did;

export type ProposalKind = "addAdmin" | "removeAdmin" | "upgrade" | "pause" | "unpause";
export type ProposalStatus = "queued" | "executed";

export interface Signer {
  did: string;
  signed: boolean;
}

export interface GovernanceProposal {
  id: string;
  kind: ProposalKind;
  title: string;
  description: string;
  proposedBy: string;
  proposedAt: number;
  status: ProposalStatus;
  signers: Signer[];
  requiredSignatures: number;
}

export const governanceProposals: GovernanceProposal[] = [
  {
    id: "gov-1",
    kind: "addAdmin",
    title: "Add new ADMIN_ROLE signer — Procurement dept.",
    description: "Onboards a second Procurement admin so mint proposals aren't bottlenecked on one signer.",
    proposedBy: id(0),
    proposedAt: now - 6 * HOUR,
    status: "queued",
    signers: [
      { did: id(0), signed: true },
      { did: id(1), signed: false },
    ],
    requiredSignatures: 2,
  },
  {
    id: "gov-2",
    kind: "upgrade",
    title: "UUPS upgrade — TimeBoundAccessControl v1.2 (audit fixes)",
    description: "Applies the Phase 2 audit fixes: controller-only guardian registration, emergency revoke via co-signed platform action.",
    proposedBy: id(0),
    proposedAt: now - 22 * HOUR,
    status: "queued",
    signers: [
      { did: id(0), signed: true },
      { did: id(1), signed: true },
    ],
    requiredSignatures: 2,
  },
  {
    id: "gov-3",
    kind: "removeAdmin",
    title: "Remove ADMIN_ROLE — departing Procurement admin",
    description: "Offboarding action ahead of the employee's last working day; role also carries a natural expiry as a backstop.",
    proposedBy: id(1),
    proposedAt: now - 3 * 24 * HOUR,
    status: "executed",
    signers: [
      { did: id(0), signed: true },
      { did: id(1), signed: true },
    ],
    requiredSignatures: 2,
  },
];

export const systemHealth = {
  get activeIdentities() {
    return identities.filter((i) => i.credentialStatus !== "revoked").length;
  },
  get expiringIn24h() {
    return identities.filter((i) => i.roleExpiresAt - now < 24 * HOUR && i.roleExpiresAt > now).length;
  },
  get pendingGovernance() {
    return governanceProposals.filter((g) => g.status === "queued").length;
  },
  platformPaused: false,
};
