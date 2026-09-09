"use client";

/**
 * lib/services/governanceService.ts — Multi-Sig Governance & Dispute Resolution (M5):
 * Super Admin multisig queue + GovernanceTimelock cooling-off + dispute veto.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import {
  governanceProposals,
  timelockTransactions,
  type GovernanceProposal,
  type TimelockTransaction,
  type ProposalKind,
} from "@/lib/mock/fixtures";
import {
  useProposePlatformAction as useProposePlatformActionOnchain,
  useCoSignPlatformAction as useCoSignPlatformActionOnchain,
  usePlatformPaused as usePlatformPausedOnchain,
} from "@/lib/hooks/useAccessControl";
import { useRaiseDispute as useRaiseDisputeOnchain, useExecuteTransaction as useExecuteTransactionOnchain } from "@/lib/hooks/useGovernanceTimelock";

export interface GovernanceService {
  getProposals: () => GovernanceProposal[];
  proposeAction: (kind: ProposalKind, title: string, proposedBy: string) => void;
  approveProposal: (proposalId: string, signer: string) => void;
  getDisputes: () => TimelockTransaction[];
  raiseDispute: (txId: number, reason: string, raisedBy: string) => void;
  resolveDispute: (txId: number, proceed: boolean, resolvedBy: string) => void;
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
    pause: (by) => store.proposePlatformAction("pause", "Emergency pause — freeze all state-changing functions", by),
    unpause: (by) => store.proposePlatformAction("unpause", "Unpause platform", by),
    isPlatformPaused: store.platformPaused,
    isPending: false,
  };
}

function useOnchainGovernanceService(): GovernanceService {
  const { proposePlatformAction, isPending: isProposing } = useProposePlatformActionOnchain();
  const { coSignPlatformAction, isPending: isCoSigning } = useCoSignPlatformActionOnchain();
  const { data: isPaused } = usePlatformPausedOnchain();
  const { raiseDispute, isPending: isDisputing } = useRaiseDisputeOnchain();
  const { executeTransaction, isPending: isExecuting } = useExecuteTransactionOnchain();

  return {
    // TODO(onchain): pendingActions(actionId) is per-ID only — no "list all pending"
    // view. Needs a subgraph query over GovernanceAction entities (docs/DATABASE_SCHEMA.md).
    getProposals: () => governanceProposals,
    proposeAction: (kind) => {
      const actionTypeMap: Record<ProposalKind, number> = { addAdmin: 0, removeAdmin: 1, upgrade: 0, pause: 2, unpause: 3 };
      // TODO(onchain): addAdmin/removeAdmin/upgrade don't map 1:1 onto the contract's
      // actionType enum (1=emergencyRevoke, 2=pause, 3=unpause per
      // contracts/TimeBoundAccessControl.sol:156) — those go through grantRole/
      // _authorizeUpgrade instead. This wiring needs per-kind branching once built.
      proposePlatformAction({ actionType: actionTypeMap[kind], role: "0x0000000000000000000000000000000000000000000000000000000000000000", account: "0x0000000000000000000000000000000000000000" });
    },
    approveProposal: (proposalId) => coSignPlatformAction(BigInt(proposalId)),
    // TODO(onchain): GovernanceTimelock.queue(txId) is per-ID only — subgraph query
    // over queued/disputed transactions needed for a full list.
    getDisputes: () => timelockTransactions,
    raiseDispute: (txId, reason) => raiseDispute({ txId: BigInt(txId), reason }),
    // TODO(onchain): resolveDispute has no wagmi hook yet (lib/hooks/useGovernanceTimelock.ts
    // doesn't wrap it) — executeTransaction below only runs the non-disputed path.
    resolveDispute: (txId) => executeTransaction(BigInt(txId)),
    pause: () => proposePlatformAction({ actionType: 2, role: "0x0000000000000000000000000000000000000000000000000000000000000000", account: "0x0000000000000000000000000000000000000000" }),
    unpause: () => proposePlatformAction({ actionType: 3, role: "0x0000000000000000000000000000000000000000000000000000000000000000", account: "0x0000000000000000000000000000000000000000" }),
    isPlatformPaused: !!isPaused,
    isPending: isProposing || isCoSigning || isDisputing || isExecuting,
  };
}

export function useGovernanceService(): GovernanceService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockGovernanceService();
  const onchain = useOnchainGovernanceService();
  return dataMode === "onchain" ? onchain : mock;
}
