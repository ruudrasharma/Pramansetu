"use client";

/**
 * lib/services/governanceService.ts — Multi-Sig Governance & Dispute Resolution (M5):
 * Super Admin multisig queue + GovernanceTimelock cooling-off + dispute veto.
 *
 * Onchain proposal ids are prefixed by which pending-item mapping they live in on
 * TimeBoundAccessControl — `action-<actionId>` (pendingActions, via proposePlatformAction) or
 * `grant-<grantId>` (pendingGrants, via proposePrivilegedGrant) — since they're two distinct
 * ID spaces on the contract requiring two different co-sign functions. approveProposal branches
 * on this prefix (T-034).
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { type GovernanceProposal, type TimelockTransaction, type ProposalKind } from "@/lib/mock/fixtures";
import {
  useProposePlatformAction as useProposePlatformActionOnchain,
  useCoSignPlatformAction as useCoSignPlatformActionOnchain,
  useProposePrivilegedGrant as useProposePrivilegedGrantOnchain,
  useCoSignGrant as useCoSignGrantOnchain,
  usePlatformPaused as usePlatformPausedOnchain,
  ROLE,
} from "@/lib/hooks/useAccessControl";
import {
  useRaiseDispute as useRaiseDisputeOnchain,
  useResolveDispute as useResolveDisputeOnchain,
  useExecuteTransaction as useExecuteTransactionOnchain,
} from "@/lib/hooks/useGovernanceTimelock";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_PLATFORM_ACTIONS, GET_PENDING_GRANTS, GET_GOVERNANCE } from "@/lib/queries";

const ZERO_ROLE = ("0x" + "0".repeat(64)) as `0x${string}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export interface GovernanceService {
  getProposals: () => GovernanceProposal[];
  /**
   * `target` is required for "addAdmin" (account + validUntil) and "removeAdmin" (account) —
   * optional only because "pause"/"unpause"/"upgrade" don't need one. Callers resolving a target
   * DID to an address should use `resolveControllerAddress` (lib/hooks/useDIDRegistry.ts), same
   * as rbacService's write paths.
   */
  proposeAction: (kind: ProposalKind, title: string, proposedBy: string, target?: { account: string; validUntil?: number }) => void;
  approveProposal: (proposalId: string, signer: string) => void;
  getDisputes: () => TimelockTransaction[];
  raiseDispute: (txId: number, reason: string, raisedBy: string) => void;
  resolveDispute: (txId: number, proceed: boolean, resolvedBy: string) => void;
  /**
   * Finalizes a queued, non-disputed transaction once its `eta` has passed
   * (`GovernanceTimelock.executeTransaction` — permissionless onchain, "Anyone, after eta and no
   * active dispute" per docs/API_SPEC.md; `executedBy` is only used for the mock store's audit
   * log, ignored onchain since the real caller doesn't need any particular role). T-053.
   */
  executeTransaction: (txId: number, executedBy: string) => void;
  pause: (proposedBy: string) => void;
  unpause: (proposedBy: string) => void;
  isPlatformPaused: boolean;
  isPending: boolean;
}

function useMockGovernanceService(): GovernanceService {
  const store = useMockDataStore();

  return {
    getProposals: () => store.governanceProposals,
    proposeAction: store.proposePlatformAction,
    approveProposal: store.coSignPlatformAction,
    getDisputes: () => store.timelockTransactions,
    raiseDispute: store.raiseDispute,
    resolveDispute: store.resolveDispute,
    executeTransaction: store.executeTransaction,
    pause: (by) => store.proposePlatformAction("pause", "Emergency pause — freeze all state-changing functions", by),
    unpause: (by) => store.proposePlatformAction("unpause", "Unpause platform", by),
    isPlatformPaused: store.platformPaused,
    isPending: false,
  };
}

interface RawPlatformAction {
  actionId: string;
  actionType: number;
  proposer: string;
  coSigner: string | null;
  executed: boolean;
  proposedAt: string;
  executedAt: string | null;
}

interface RawPendingGrant {
  grantId: string;
  role: string;
  account: string;
  proposer: string;
  coSigner: string | null;
  executed: boolean;
  proposedAt: string;
  executedAt: string | null;
}

interface RawDispute {
  id: string;
  raisedBy: string;
  reason: string;
  resolved: boolean;
  proceeded: boolean | null;
  resolvedBy: string | null;
  raisedAt: string;
  resolvedAt: string | null;
}

interface RawGovernanceTx {
  txId: string;
  target: string;
  calldata: string;
  eta: string;
  executed: boolean;
  queuedAt: string;
  dispute: RawDispute | null;
}

function useOnchainGovernanceService(): GovernanceService {
  const { proposePlatformAction, isPending: isProposingAction } = useProposePlatformActionOnchain();
  const { coSignPlatformAction, isPending: isCoSigningAction } = useCoSignPlatformActionOnchain();
  const { proposePrivilegedGrant, isPending: isProposingGrant } = useProposePrivilegedGrantOnchain();
  const { coSignGrant, isPending: isCoSigningGrant } = useCoSignGrantOnchain();
  const { data: isPaused } = usePlatformPausedOnchain();
  const { raiseDispute, isPending: isDisputing } = useRaiseDisputeOnchain();
  const { resolveDispute: resolveDisputeOnchain, isPending: isResolving } = useResolveDisputeOnchain();
  const { executeTransaction: executeTransactionOnchain, isPending: isExecuting } = useExecuteTransactionOnchain();

  const actionsQuery = useQuery({
    queryKey: ["platformActions"],
    queryFn: async () => getGraphQLClient().request<{ platformActions: RawPlatformAction[] }>(GET_PLATFORM_ACTIONS),
    refetchInterval: 10000,
  });

  const grantsQuery = useQuery({
    queryKey: ["pendingGrants"],
    queryFn: async () => getGraphQLClient().request<{ pendingGrants: RawPendingGrant[] }>(GET_PENDING_GRANTS),
    refetchInterval: 10000,
  });

  const governanceQuery = useQuery({
    queryKey: ["governanceTxs"],
    queryFn: async () => getGraphQLClient().request<{ governanceTxs: RawGovernanceTx[] }>(GET_GOVERNANCE),
    refetchInterval: 10000,
  });

  // actionType: 1 = emergencyRevoke (any role, not necessarily Admin — the UI's ProposalKind
  // union only distinguishes "removeAdmin" as a label, the contract doesn't), 2 = pause, 3 =
  // unpause. `role`/`account` are always empty here — ActionProposed genuinely doesn't emit them
  // (contracts/TimeBoundAccessControl.sol:60), so there's nothing honest to show beyond the
  // action type itself; this is a contract-level limitation, not a subgraph gap.
  const platformActionProposals: GovernanceProposal[] = (actionsQuery.data?.platformActions ?? []).map((a) => {
    const kind: ProposalKind = a.actionType === 1 ? "removeAdmin" : a.actionType === 2 ? "pause" : "unpause";
    const title = a.actionType === 1 ? "Emergency revoke role" : a.actionType === 2 ? "Emergency pause" : "Unpause platform";
    return {
      id: `action-${a.actionId}`,
      kind,
      title,
      description: `Platform action #${a.actionId} via TimeBoundAccessControl.proposePlatformAction.`,
      proposedBy: a.proposer,
      proposedAt: Number(a.proposedAt) * 1000,
      status: a.executed ? "executed" : "queued",
      // Signer identity here is the real controlling ADDRESS, not a DID — multisig co-signing on
      // this contract is by address (msg.sender), and resolving each address back to a DID would
      // need a per-signer subgraph/Identity lookup this pass didn't build. currentSignerDid
      // comparisons against this list only work correctly once callers pass an address too.
      signers: [
        { did: a.proposer, signed: true },
        ...(a.coSigner ? [{ did: a.coSigner, signed: true }] : []),
      ],
      requiredSignatures: 2, // ACTION_THRESHOLD (contracts/TimeBoundAccessControl.sol:28)
    };
  });

  // Privileged grants (addAdmin) live in a completely separate pendingGrants mapping/threshold on
  // the contract, so they need their own subgraph entity/query (T-054) — merged into one list here
  // so the UI doesn't need to know these are two different contract mechanisms under one queue.
  const grantProposals: GovernanceProposal[] = (grantsQuery.data?.pendingGrants ?? []).map((g) => ({
    id: `grant-${g.grantId}`,
    kind: "addAdmin",
    title: "Add Admin",
    description: `Privileged grant #${g.grantId} for ${g.account} via TimeBoundAccessControl.proposePrivilegedGrant.`,
    proposedBy: g.proposer,
    proposedAt: Number(g.proposedAt) * 1000,
    status: g.executed ? "executed" : "queued",
    signers: [
      { did: g.proposer, signed: true },
      ...(g.coSigner ? [{ did: g.coSigner, signed: true }] : []),
    ],
    requiredSignatures: 2, // GRANT_THRESHOLD (contracts/TimeBoundAccessControl.sol:27)
  }));

  const proposals: GovernanceProposal[] = [...platformActionProposals, ...grantProposals].sort(
    (a, b) => b.proposedAt - a.proposedAt
  );

  const disputes: TimelockTransaction[] = (governanceQuery.data?.governanceTxs ?? []).map((tx) => {
    const d = tx.dispute;
    const status: TimelockTransaction["status"] =
      d && !d.resolved ? "disputed" : d?.resolved && d.proceeded === false ? "cancelled" : tx.executed ? "executed" : "queued";
    return {
      txId: Number(tx.txId),
      title: `Governance tx #${tx.txId}`,
      description: `Queued transaction to ${tx.target}`,
      target: tx.target,
      queuedAt: Number(tx.queuedAt) * 1000,
      eta: Number(tx.eta) * 1000,
      status,
      raisedBy: d?.raisedBy,
      disputeReason: d?.reason,
      resolution:
        d?.resolved
          ? { proceeded: !!d.proceeded, resolvedBy: d.resolvedBy ?? "", resolvedAt: d.resolvedAt ? Number(d.resolvedAt) * 1000 : 0 }
          : undefined,
    };
  });

  return {
    getProposals: () => proposals,
    proposeAction: (kind, _title, _proposedBy, target) => {
      if (kind === "pause") {
        proposePlatformAction({ actionType: 2, role: ZERO_ROLE, account: ZERO_ADDRESS });
        return;
      }
      if (kind === "unpause") {
        proposePlatformAction({ actionType: 3, role: ZERO_ROLE, account: ZERO_ADDRESS });
        return;
      }
      if (kind === "removeAdmin") {
        if (!target?.account) throw new Error('proposeAction("removeAdmin", ...) requires target.account (the address to revoke).');
        proposePlatformAction({ actionType: 1, role: ROLE.ADMIN_ROLE, account: target.account as `0x${string}` });
        return;
      }
      if (kind === "addAdmin") {
        if (!target?.account || !target?.validUntil) {
          throw new Error('proposeAction("addAdmin", ...) requires target.account and target.validUntil.');
        }
        proposePrivilegedGrant({
          role: ROLE.ADMIN_ROLE,
          account: target.account as `0x${string}`,
          validUntil: BigInt(Math.floor(target.validUntil / 1000)),
        });
        return;
      }
      // kind === "upgrade": no on-chain path exists yet — _authorizeUpgrade on both upgradeable
      // contracts is single-signer only (TODO.md §3.2 / gap audit §2.2), gated behind
      // AI_DEVELOPMENT_RULES.md §9 sign-off since fixing it means a contract change. An honest
      // failure here, not a transaction that would revert or silently do nothing.
      throw new Error('proposeAction("upgrade", ...) is not yet supported on-chain — see TODO.md §3.2.');
    },
    approveProposal: (proposalId) => {
      if (proposalId.startsWith("action-")) {
        coSignPlatformAction(BigInt(proposalId.slice("action-".length)));
      } else if (proposalId.startsWith("grant-")) {
        coSignGrant(BigInt(proposalId.slice("grant-".length)));
      } else {
        throw new Error(`approveProposal: unrecognized onchain proposal id "${proposalId}" — expected "action-<id>" or "grant-<id>".`);
      }
    },
    getDisputes: () => disputes,
    raiseDispute: (txId, reason) => raiseDispute({ txId: BigInt(txId), reason }),
    resolveDispute: (txId, proceed) => resolveDisputeOnchain({ txId: BigInt(txId), proceed }),
    executeTransaction: (txId) => executeTransactionOnchain(BigInt(txId)),
    pause: () => proposePlatformAction({ actionType: 2, role: ZERO_ROLE, account: ZERO_ADDRESS }),
    unpause: () => proposePlatformAction({ actionType: 3, role: ZERO_ROLE, account: ZERO_ADDRESS }),
    isPlatformPaused: !!isPaused,
    isPending: isProposingAction || isCoSigningAction || isProposingGrant || isCoSigningGrant || isDisputing || isResolving || isExecuting,
  };
}

export function useGovernanceService(): GovernanceService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockGovernanceService();
  const onchain = useOnchainGovernanceService();
  return dataMode === "onchain" ? onchain : mock;
}
