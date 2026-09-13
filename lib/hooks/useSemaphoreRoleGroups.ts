/**
 * lib/hooks/useSemaphoreRoleGroups.ts
 *
 * React hooks for SemaphoreRoleGroups (T-015, gap analysis §2.1.4) — real zero-knowledge
 * proof-of-role, bridging TimeBoundAccessControl's live role state into Semaphore groups.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { SemaphoreRoleGroupsAbi, ISemaphoreAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.semaphoreRoleGroups;

// ── Read hooks ──────────────────────────────────────────────────────────────

export function useCommitmentOf(account: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: SemaphoreRoleGroupsAbi,
    functionName: "commitmentOf",
    args: account ? [account] : undefined,
    query: { enabled: !!account && !!address },
  });
}

export function useGroupIdOf(role: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: SemaphoreRoleGroupsAbi,
    functionName: "groupIdOf",
    args: role ? [role] : undefined,
    query: { enabled: !!role && !!address },
  });
}

export function useIsMember(role: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: SemaphoreRoleGroupsAbi,
    functionName: "isMember",
    args: role && account ? [role, account] : undefined,
    query: { enabled: !!role && !!account && !!address },
  });
}

/**
 * Verifies a Semaphore proof directly against the official Semaphore contract (not
 * SemaphoreRoleGroups) — the "verify on-chain" path, real on-chain settlement with no extra
 * contract of this project's own needed for verification itself.
 */
export function useVerifyProofOnchain(
  groupId: bigint | undefined,
  proof:
    | {
        merkleTreeDepth: bigint;
        merkleTreeRoot: bigint;
        nullifier: bigint;
        message: bigint;
        scope: bigint;
        points: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      }
    | undefined
) {
  return useReadContract({
    address: contractAddresses.semaphore,
    abi: ISemaphoreAbi,
    functionName: "verifyProof",
    args: groupId !== undefined && proof ? [groupId, proof] : undefined,
    query: {
      enabled: groupId !== undefined && !!proof,
      // A revert (stale root, bad proof) shouldn't look identical to "still loading" for
      // 10-30s of default exponential-backoff retries — fail fast and let the caller show why.
      retry: 1,
      retryDelay: 1000,
    },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * registerCommitment — one-time, self-service. Reverts AlreadyRegistered on a second call.
 */
export function useRegisterCommitment() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function registerCommitment(commitment: bigint) {
    if (!address) throw new Error("SemaphoreRoleGroups address not configured");
    writeContract({ address, abi: SemaphoreRoleGroupsAbi, functionName: "registerCommitment", args: [commitment] });
  }

  return { registerCommitment, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * syncMember — permissionless, self-correcting sync of a real role holder into their role's
 * Semaphore group.
 */
export function useSyncMember() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function syncMember({ role, account }: { role: `0x${string}`; account: `0x${string}` }) {
    if (!address) throw new Error("SemaphoreRoleGroups address not configured");
    writeContract({ address, abi: SemaphoreRoleGroupsAbi, functionName: "syncMember", args: [role, account] });
  }

  return { syncMember, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * removeMemberFromRole — permissionless cleanup once a role has lapsed; needs Merkle proof
 * siblings computed off-chain (see lib/services/semaphoreIdentity.ts's reconstructGroup).
 */
export function useRemoveMemberFromRole() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function removeMemberFromRole({
    role,
    account,
    merkleProofSiblings,
  }: {
    role: `0x${string}`;
    account: `0x${string}`;
    merkleProofSiblings: bigint[];
  }) {
    if (!address) throw new Error("SemaphoreRoleGroups address not configured");
    writeContract({
      address,
      abi: SemaphoreRoleGroupsAbi,
      functionName: "removeMemberFromRole",
      args: [role, account, merkleProofSiblings],
    });
  }

  return { removeMemberFromRole, hash, isPending: isPending || isConfirming, isSuccess, error };
}
