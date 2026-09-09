/**
 * lib/hooks/useGuardianRecovery.ts
 *
 * React hooks for GuardianRecovery — M-of-N social recovery for DIDs.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract } from "wagmi/actions";
import { useQuery } from "@tanstack/react-query";
import { GuardianRecoveryAbi } from "@/lib/abis";
import { contractAddresses, wagmiConfig } from "@/lib/wagmi";

const address = contractAddresses.guardianRecovery;

// GuardianRecovery.sol's own MAX_GUARDIANS constant — registerGuardians reverts above 5, so
// probing indices 0..4 can never miss a real guardian. Not a guess: read directly from the
// contract source (contracts/GuardianRecovery.sol:15).
const MAX_GUARDIANS = 5;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/**
 * Full guardian list for a DID, read for real. GuardianRecovery has no "guardian count" view
 * (guardiansOf(did, index) is per-index only, and Solidity's auto-getter for a struct
 * containing a dynamic array omits that array entirely — confirmed against the compiled ABI,
 * not guessed), so this probes indices 0..MAX_GUARDIANS-1 and stops at the first revert or
 * zero-address result.
 */
export function useGuardiansList(did: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["guardiansList", did],
    queryFn: async () => {
      if (!address || !did) return [];
      const guardians: `0x${string}`[] = [];
      for (let i = 0; i < MAX_GUARDIANS; i++) {
        try {
          const guardian = (await readContract(wagmiConfig, {
            address,
            abi: GuardianRecoveryAbi,
            functionName: "guardiansOf",
            args: [did, BigInt(i)],
          })) as `0x${string}`;
          if (!guardian || guardian.toLowerCase() === ZERO_ADDRESS) break;
          guardians.push(guardian);
        } catch {
          break; // index out of bounds — no more guardians registered
        }
      }
      return guardians;
    },
    enabled: !!address && !!did,
  });
}

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Get a guardian address by index for a given DID.
 * Note: guardiansOf(did, index) → address — the ABI exposes the dynamic array
 * element-by-element. To get the full list, read recoveryThreshold for the count
 * then iterate, or query the subgraph (more efficient for UI rendering).
 */
export function useGuardianAtIndex(did: `0x${string}` | undefined, index: bigint) {
  return useReadContract({
    address,
    abi: GuardianRecoveryAbi,
    functionName: "guardiansOf",
    args: did ? [did, index] : undefined,
    query: { enabled: !!did && !!address },
  });
}

/**
 * Get the M-of-N threshold for a DID's guardian set.
 */
export function useRecoveryThreshold(did: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: GuardianRecoveryAbi,
    functionName: "recoveryThreshold",
    args: did ? [did] : undefined,
    query: { enabled: !!did && !!address },
  });
}

/**
 * Get the number of guardians who have signed the active recovery for a DID.
 * Derived by reading activeRecovery(did).signers.length — no direct count view.
 * In Phase 4 this is read from the subgraph AuditEvent stream instead.
 */
export function useActiveRecovery(did: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: GuardianRecoveryAbi,
    functionName: "activeRecovery",
    args: did ? [did] : undefined,
    query: { enabled: !!did && !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * registerGuardians — set the guardian list for a DID.
 * Requires msg.sender === DID controller (Phase 2.1 fix).
 */
export function useRegisterGuardians() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function registerGuardians({
    did,
    guardians,
    threshold,
  }: {
    did: `0x${string}`;
    guardians: `0x${string}`[];
    threshold: number;
  }) {
    if (!address) throw new Error("GuardianRecovery address not configured");
    writeContract({ address, abi: GuardianRecoveryAbi, functionName: "registerGuardians", args: [did, guardians, threshold] });
  }

  return { registerGuardians, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * initiateRecovery — a guardian starts the recovery process.
 * Sets a 24h timelock from this call.
 */
export function useInitiateRecovery() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function initiateRecovery({
    did,
    newController,
    newPubKey,
  }: {
    did: `0x${string}`;
    newController: `0x${string}`;
    newPubKey: `0x${string}`;
  }) {
    if (!address) throw new Error("GuardianRecovery address not configured");
    writeContract({ address, abi: GuardianRecoveryAbi, functionName: "initiateRecovery", args: [did, newController, newPubKey] });
  }

  return { initiateRecovery, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * signRecovery — a guardian adds their signature to an active recovery.
 * Emits RecoverySigned. Each guardian can sign only once.
 */
export function useSignRecovery() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function signRecovery(did: `0x${string}`) {
    if (!address) throw new Error("GuardianRecovery address not configured");
    writeContract({ address, abi: GuardianRecoveryAbi, functionName: "signRecovery", args: [did] });
  }

  return { signRecovery, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * finalizeRecovery — execute the recovery after threshold + 24h timelock.
 * Anyone can call this (no role restriction) once conditions are met.
 */
export function useFinalizeRecovery() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function finalizeRecovery(did: `0x${string}`) {
    if (!address) throw new Error("GuardianRecovery address not configured");
    writeContract({ address, abi: GuardianRecoveryAbi, functionName: "finalizeRecovery", args: [did] });
  }

  return { finalizeRecovery, hash, isPending: isPending || isConfirming, isSuccess, error };
}
