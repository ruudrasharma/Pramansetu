/**
 * lib/hooks/useOracleAttestation.ts
 *
 * React hooks for OracleAttestation (T-016, gap analysis §2.2.5) — submitting, attesting,
 * disputing, resolving, and finalizing real-world facts about a minted asset.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { OracleAttestationAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.oracleAttestation;

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Get a fact by its ID via the facts mapping. Note the auto-generated getter drops the dynamic
 * `attestors` array member — use useFactAttestors for that.
 */
export function useOracleFact(factId: bigint | undefined) {
  return useReadContract({
    address,
    abi: OracleAttestationAbi,
    functionName: "facts",
    args: factId !== undefined ? [factId] : undefined,
    query: { enabled: factId !== undefined && !!address },
  });
}

export function useFactAttestors(factId: bigint | undefined) {
  return useReadContract({
    address,
    abi: OracleAttestationAbi,
    functionName: "getAttestors",
    args: factId !== undefined ? [factId] : undefined,
    query: { enabled: factId !== undefined && !!address },
  });
}

/**
 * Get the next fact ID (useful for predicting the ID of a soon-to-submit fact).
 */
export function useNextFactId() {
  return useReadContract({
    address,
    abi: OracleAttestationAbi,
    functionName: "nextFactId",
    query: { enabled: !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * submitFact — an ORACLE_ATTESTOR_ROLE address proposes a real-world fact about a minted asset.
 * Auto-signs as the first attestor.
 */
export function useSubmitFact() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function submitFact({
    tokenId,
    factType,
    dataHash,
  }: {
    tokenId: bigint;
    factType: number;
    dataHash: `0x${string}`;
  }) {
    if (!address) throw new Error("OracleAttestation address not configured");
    writeContract({ address, abi: OracleAttestationAbi, functionName: "submitFact", args: [tokenId, factType, dataHash] });
  }

  return { submitFact, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * attestFact — a second, distinct ORACLE_ATTESTOR_ROLE address co-signs. Once ATTESTATION_THRESHOLD
 * (2) is met, the fact enters its dispute window.
 */
export function useAttestFact() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function attestFact(factId: bigint) {
    if (!address) throw new Error("OracleAttestation address not configured");
    writeContract({ address, abi: OracleAttestationAbi, functionName: "attestFact", args: [factId] });
  }

  return { attestFact, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * raiseFactDispute — Auditor-role action to freeze an Attested fact during its dispute window.
 * Named distinctly from useGovernanceTimelock's useRaiseDispute to avoid a collision when both
 * are imported together.
 */
export function useRaiseFactDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function raiseFactDispute({ factId, reason }: { factId: bigint; reason: string }) {
    if (!address) throw new Error("OracleAttestation address not configured");
    writeContract({ address, abi: OracleAttestationAbi, functionName: "raiseDispute", args: [factId, reason] });
  }

  return { raiseFactDispute, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * resolveFactDispute — Super Admin adjudicates a disputed fact. `proceed: true` finalizes
 * immediately (records the fact on AssetRegistry); `proceed: false` rejects it permanently.
 */
export function useResolveFactDispute() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function resolveFactDispute({ factId, proceed }: { factId: bigint; proceed: boolean }) {
    if (!address) throw new Error("OracleAttestation address not configured");
    writeContract({ address, abi: OracleAttestationAbi, functionName: "resolveDispute", args: [factId, proceed] });
  }

  return { resolveFactDispute, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * finalizeFact — permissionless once the dispute window has elapsed undisputed.
 */
export function useFinalizeFact() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function finalizeFact(factId: bigint) {
    if (!address) throw new Error("OracleAttestation address not configured");
    writeContract({ address, abi: OracleAttestationAbi, functionName: "finalize", args: [factId] });
  }

  return { finalizeFact, hash, isPending: isPending || isConfirming, isSuccess, error };
}
