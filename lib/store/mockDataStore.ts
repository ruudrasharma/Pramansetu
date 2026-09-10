"use client";

/**
 * lib/store/mockDataStore.ts
 *
 * Shared, mutable copy of the Section 3 fixtures, seeded once and mutated by mock service
 * write actions (grant role, propose/co-sign mint, raise dispute, pause...). A Zustand store
 * rather than per-component useState because a write on one page (e.g. Roles) must be visible
 * on another (e.g. Dashboard) without a real chain to re-query — this is what "the demo feels
 * alive" (brief §6) requires in mock mode.
 */

import { create } from "zustand";
import {
  identities as seedIdentities,
  credentials as seedCredentials,
  guardianSets as seedGuardianSets,
  assets as seedAssets,
  auditEvents as seedAuditEvents,
  anomalyAlerts as seedAnomalyAlerts,
  governanceProposals as seedGovernanceProposals,
  timelockTransactions as seedTimelockTransactions,
  type Identity,
  type Credential,
  type GuardianSet,
  type Asset,
  type AuditEvent,
  type EventType,
  type AnomalyAlert,
  type GovernanceProposal,
  type TimelockTransaction,
  type Role,
} from "@/lib/mock/fixtures";

let seq = 9000;
function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

function txHash(): string {
  const h = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return "0x" + h + "…" + h.slice(0, 4);
}

interface MockDataState {
  identities: Identity[];
  credentials: Credential[];
  guardianSets: GuardianSet[];
  assets: Asset[];
  auditEvents: AuditEvent[];
  anomalyAlerts: AnomalyAlert[];
  governanceProposals: GovernanceProposal[];
  timelockTransactions: TimelockTransaction[];
  platformPaused: boolean;

  logEvent: (type: EventType, actorDid: string, summary: string) => void;

  grantTimedRole: (did: string, role: Role, validUntil: number, grantedBy: string) => void;
  revokeRole: (did: string, revokedBy: string) => void;

  proposeMint: (input: { name: string; category: string; ownerDid: string; cid: string; proposer: string }) => Asset;
  coSignMint: (tokenId: number, coSigner: string) => void;
  transferAsset: (tokenId: number, newOwnerDid: string, actorDid: string) => void;

  raiseDispute: (txId: number, reason: string, raisedBy: string) => void;
  resolveDispute: (txId: number, proceed: boolean, resolvedBy: string) => void;
  executeTransaction: (txId: number, executedBy: string) => void;

  proposePlatformAction: (kind: "addAdmin" | "removeAdmin" | "upgrade" | "pause" | "unpause", title: string, proposedBy: string) => void;
  coSignPlatformAction: (proposalId: string, signer: string) => void;

  initiateRecovery: (did: string, initiatedBy: string) => void;
  signRecovery: (did: string, guardianDid: string) => void;
  finalizeRecovery: (did: string) => void;

  issueCredential: (input: { subjectDid: string; issuerDid: string; role: Role; validUntil: number }) => Credential;

  dismissAlert: (alertId: string, reason: string) => void;
}

export const useMockDataStore = create<MockDataState>()((set, get) => ({
  identities: seedIdentities,
  credentials: seedCredentials,
  guardianSets: seedGuardianSets,
  assets: seedAssets,
  auditEvents: seedAuditEvents,
  anomalyAlerts: seedAnomalyAlerts,
  governanceProposals: seedGovernanceProposals,
  timelockTransactions: seedTimelockTransactions,
  platformPaused: false,

  logEvent: (type, actorDid, summary) =>
    set((s) => ({
      auditEvents: [
        { id: nextId("evt"), type, actorDid, summary, timestamp: Date.now(), txHash: txHash() },
        ...s.auditEvents,
      ],
    })),

  grantTimedRole: (did, role, validUntil, grantedBy) => {
    set((s) => ({
      identities: s.identities.map((i) => (i.did === did ? { ...i, role, roleExpiresAt: validUntil } : i)),
    }));
    const label = get().identities.find((i) => i.did === did)?.name ?? did.slice(0, 14) + "…";
    get().logEvent("RoleGranted", grantedBy, `Granted ${role}_ROLE to ${label}`);
  },

  revokeRole: (did, revokedBy) => {
    set((s) => ({
      identities: s.identities.map((i) => (i.did === did ? { ...i, roleExpiresAt: Date.now() } : i)),
      credentials: s.credentials.map((c) => (c.subjectDid === did ? { ...c, revoked: true } : c)),
    }));
    const label = get().identities.find((i) => i.did === did)?.name ?? did.slice(0, 14) + "…";
    get().logEvent("RoleRevoked", revokedBy, `Emergency-revoked role from ${label}`);
  },

  issueCredential: ({ subjectDid, issuerDid, role, validUntil }) => {
    const credential: Credential = {
      vcId: nextId("vc"),
      subjectDid,
      issuerDid,
      vcHash: "0x" + Math.random().toString(16).slice(2).padEnd(56, "0") + "00",
      role,
      validUntil,
      revoked: false,
    };
    // Prepended (not appended) so credentialForDid's .find() surfaces the newly-issued
    // credential immediately — real chain semantics allow multiple credentials per DID over
    // time (FEATURES.md F1.2's edge case), the mock model's single-lookup helper just always
    // reads the first match.
    set((s) => ({ credentials: [credential, ...s.credentials] }));
    const label = get().identities.find((i) => i.did === subjectDid)?.name ?? subjectDid.slice(0, 14) + "…";
    get().logEvent("CredentialIssued", issuerDid, `Issued ${role}_ROLE credential to ${label}`);
    return credential;
  },

  proposeMint: ({ name, category, ownerDid, cid, proposer }) => {
    const tokenId = Math.max(0, ...get().assets.map((a) => a.tokenId)) + 1;
    const asset: Asset = {
      tokenId,
      cid,
      name,
      category,
      ownerDid,
      vcId: get().credentials.find((c) => c.subjectDid === ownerDid)?.vcId ?? "vc-0000",
      legalReference: null,
      mintedAt: null,
      proposer,
      coSigner: null,
      status: "pending_cosign",
      provenance: [{ label: "Mint proposed — awaiting Manager co-sign", actorDid: proposer, timestamp: Date.now() }],
    };
    set((s) => ({ assets: [asset, ...s.assets] }));
    get().logEvent("AssetMinted", proposer, `Proposed mint — "${name}" (token #${tokenId}, awaiting co-sign)`);
    return asset;
  },

  coSignMint: (tokenId, coSigner) => {
    set((s) => ({
      assets: s.assets.map((a) =>
        a.tokenId === tokenId
          ? {
              ...a,
              status: "finalized",
              mintedAt: Date.now(),
              coSigner,
              provenance: [...a.provenance, { label: "Co-signed by Manager — finalized", actorDid: coSigner, timestamp: Date.now() }],
            }
          : a
      ),
    }));
    const asset = get().assets.find((a) => a.tokenId === tokenId);
    get().logEvent("AssetMinted", coSigner, `Finalized mint — "${asset?.name ?? "asset"}" (token #${tokenId})`);
  },

  transferAsset: (tokenId, newOwnerDid, actorDid) => {
    set((s) => ({
      assets: s.assets.map((a) =>
        a.tokenId === tokenId
          ? {
              ...a,
              ownerDid: newOwnerDid,
              status: "transferred",
              provenance: [...a.provenance, { label: "Transferred to new owner", actorDid, timestamp: Date.now() }],
            }
          : a
      ),
    }));
    get().logEvent("AssetTransferred", actorDid, `Token #${tokenId} transferred`);
  },

  raiseDispute: (txId, reason, raisedBy) => {
    set((s) => ({
      timelockTransactions: s.timelockTransactions.map((t) =>
        t.txId === txId ? { ...t, status: "disputed", raisedBy, disputeReason: reason } : t
      ),
    }));
    get().logEvent("DisputeRaised", raisedBy, `Dispute raised on tx #${txId} — ${reason}`);
  },

  resolveDispute: (txId, proceed, resolvedBy) => {
    set((s) => ({
      timelockTransactions: s.timelockTransactions.map((t) =>
        t.txId === txId
          ? { ...t, status: proceed ? "executed" : "cancelled", resolution: { proceeded: proceed, resolvedBy, resolvedAt: Date.now() } }
          : t
      ),
    }));
    get().logEvent("GovernanceExecuted", resolvedBy, `Dispute on tx #${txId} resolved — ${proceed ? "proceeded" : "cancelled"}`);
  },

  // Mirrors GovernanceTimelock.executeTransaction's real preconditions (queued, eta passed, no
  // active dispute) — T-053. A never-disputed "queued" tx had no way to become "executed" in the
  // mock model either until this existed, same gap as the onchain side.
  executeTransaction: (txId, executedBy) => {
    const tx = get().timelockTransactions.find((t) => t.txId === txId);
    if (!tx || tx.status !== "queued" || Date.now() < tx.eta) return;
    set((s) => ({
      timelockTransactions: s.timelockTransactions.map((t) =>
        t.txId === txId ? { ...t, status: "executed", resolution: { proceeded: true, resolvedBy: executedBy, resolvedAt: Date.now() } } : t
      ),
    }));
    get().logEvent("GovernanceExecuted", executedBy, `Governance tx #${txId} executed`);
  },

  proposePlatformAction: (kind, title, proposedBy) => {
    const proposal: GovernanceProposal = {
      id: nextId("gov"),
      kind,
      title,
      description: "Proposed via the Governance console.",
      proposedBy,
      proposedAt: Date.now(),
      status: "queued",
      signers: [{ did: proposedBy, signed: true }],
      requiredSignatures: 2,
    };
    set((s) => ({ governanceProposals: [proposal, ...s.governanceProposals] }));
    if (kind === "pause") get().logEvent("EmergencyPaused", proposedBy, "Platform pause proposed — awaiting 2nd Super Admin co-sign");
  },

  coSignPlatformAction: (proposalId, signer) => {
    let justExecuted: GovernanceProposal | undefined;
    set((s) => ({
      governanceProposals: s.governanceProposals.map((p) => {
        if (p.id !== proposalId) return p;
        const signers = p.signers.some((sg) => sg.did === signer)
          ? p.signers
          : [...p.signers, { did: signer, signed: true }];
        const signedCount = signers.filter((sg) => sg.signed).length;
        const status = signedCount >= p.requiredSignatures ? "executed" : p.status;
        if (status === "executed" && p.status !== "executed") justExecuted = { ...p, signers, status };
        return { ...p, signers, status };
      }),
    }));
    if (justExecuted) {
      get().logEvent("GovernanceExecuted", signer, `${justExecuted.title} — threshold met, executed`);
      if (justExecuted.kind === "pause") set({ platformPaused: true });
      if (justExecuted.kind === "unpause") set({ platformPaused: false });
    }
  },

  initiateRecovery: (did, initiatedBy) => {
    const now = Date.now();
    set((s) => ({
      guardianSets: s.guardianSets.map((g) =>
        g.did === did
          ? {
              ...g,
              activeRecovery: {
                newController: "0x0000000000000000000000000000000000000000",
                initiatedAt: now,
                initiatedBy,
                signatures: [initiatedBy],
                timelockEndsAt: now + 24 * 3_600_000,
              },
            }
          : g
      ),
    }));
    get().logEvent("RecoveryInitiated", initiatedBy, `Guardian recovery initiated for ${did.slice(0, 14)}…`);
  },

  signRecovery: (did, guardianDid) => {
    set((s) => ({
      guardianSets: s.guardianSets.map((g) =>
        g.did === did && g.activeRecovery
          ? { ...g, activeRecovery: { ...g.activeRecovery, signatures: [...new Set([...g.activeRecovery.signatures, guardianDid])] } }
          : g
      ),
    }));
  },

  finalizeRecovery: (did) => {
    set((s) => ({
      guardianSets: s.guardianSets.map((g) => (g.did === did ? { ...g, activeRecovery: undefined } : g)),
    }));
    get().logEvent("RecoveryFinalized", did, `Guardian recovery finalized for ${did.slice(0, 14)}… — key rotated`);
  },

  dismissAlert: (alertId, reason) => {
    set((s) => ({
      anomalyAlerts: s.anomalyAlerts.map((a) => (a.id === alertId ? { ...a, status: "dismissed", dismissReason: reason } : a)),
    }));
  },
}));
