/**
 * lib/hooks/useGovernanceTimelock.ts
 *
 * React hooks for GovernanceTimelock — queuing, disputing, and executing
 * high-value governance transactions.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { GovernanceTimelockAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.governanceTimelock;

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Get a queued transaction by its ID via the queue mapping.
 * Returns the raw bytes for the queued calldata.
 */
export function useQueuedTx(txId: bigint | undefined) {
  return useReadContract({
    address,
    abi: GovernanceTimelockAbi,
    functionName: "queue",
    args: txId !== undefined ? [txId] : undefined,
    query: { enabled: txId !== undefined && !!address },
  });
}

/**
 * Get the next transaction ID (useful for predicting the ID of a soon-to-queue tx).
 */
export function useNextTxId() {
  return useReadContract({
    address,
    abi: GovernanceTimelockAbi,
    functionName: "nextTxId",
    query: { enabled: !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * queueTransaction — enqueue a governance action with an ETA timelock.
 * Requires Super Admin multisig (called after proposePlatformAction).
 */
export function useQueueTransaction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function queueTransaction({
    target,
    data,
    eta,
  }: {
    target: `0x${string}`;
    data: `0x${string}`;
    eta: bigint;
  }) {
    if (!address) throw new Error("GovernanceTimelock address not configured");
    writeContract({ address, abi: GovernanceTimelockAbi, functionName: "queueTransaction", args: [target, data, eta] });
  }

  return { queueTransaction, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * raiseDispute — Auditor-role action to freeze a queued transaction.
 * Emits DisputeRaised. Prevents executeTransaction until resolved.
 */
export function useRaiseDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function raiseDispute({ txId, reason }: { txId: bigint; reason: string }) {
    if (!address) throw new Error("GovernanceTimelock address not configured");
    writeContract({ address, abi: GovernanceTimelockAbi, functionName: "raiseDispute", args: [txId, reason] });
  }

  return { raiseDispute, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * resolveDispute — Super Admin resolves a disputed transaction (T-035).
 * `proceed: true` returns the tx to Queued (still needs executeTransaction once eta passes);
 * `proceed: false` cancels it permanently (contracts/GovernanceTimelock.sol:90-95).
 */
export function useResolveDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function resolveDispute({ txId, proceed }: { txId: bigint; proceed: boolean }) {
    if (!address) throw new Error("GovernanceTimelock address not configured");
    writeContract({ address, abi: GovernanceTimelockAbi, functionName: "resolveDispute", args: [txId, proceed] });
  }

  return { resolveDispute, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * executeTransaction — execute a queued transaction after ETA + no active dispute.
 * Permissionless — anyone can call once conditions are met.
 */
export function useExecuteTransaction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function executeTransaction(txId: bigint) {
    if (!address) throw new Error("GovernanceTimelock address not configured");
    writeContract({ address, abi: GovernanceTimelockAbi, functionName: "executeTransaction", args: [txId] });
  }

  return { executeTransaction, hash, isPending: isPending || isConfirming, isSuccess, error };
}
