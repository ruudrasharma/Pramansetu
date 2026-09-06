/**
 * lib/hooks/useCredentialRegistry.ts
 *
 * React hooks for CredentialRegistry — issuing, checking, and revoking VCs.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CredentialRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.credentialRegistry;

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * isValid — check whether a VC is currently valid (exists, not revoked, not expired).
 * This is the critical gate for credential-gated transfers in AssetRegistry.
 */
export function useIsVCValid(vcId: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: CredentialRegistryAbi,
    functionName: "isValid",
    args: vcId ? [vcId] : undefined,
    query: { enabled: !!vcId && !!address },
  });
}

/**
 * getCredential — fetch the full Credential struct for a given vcId.
 * Returns: { subjectDid, issuerDid, vcHash, role, validUntil, revoked, exists }
 */
export function useGetCredential(vcId: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: CredentialRegistryAbi,
    functionName: "credentials",
    args: vcId ? [vcId] : undefined,
    query: { enabled: !!vcId && !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * issueCredential — mint a new verifiable credential on-chain.
 * Requires ISSUER_ROLE. Emits CredentialIssued.
 */
export function useIssueCredential() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function issueCredential({
    subjectDid,
    issuerDid,
    vcHash,
    role,
    validUntil,
  }: {
    subjectDid: `0x${string}`;
    issuerDid: `0x${string}`;
    vcHash: `0x${string}`;
    role: string;
    validUntil: bigint;
  }) {
    if (!address) throw new Error("CredentialRegistry address not configured");
    writeContract({
      address,
      abi: CredentialRegistryAbi,
      functionName: "issueCredential",
      args: [subjectDid, issuerDid, vcHash, role, validUntil],
    });
  }

  return { issueCredential, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * revokeCredential — revoke a VC (ISSUER_ROLE or DEFAULT_ADMIN_ROLE emergency path).
 * Emits CredentialRevoked.
 */
export function useRevokeCredential() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function revokeCredential(vcId: `0x${string}`) {
    if (!address) throw new Error("CredentialRegistry address not configured");
    writeContract({ address, abi: CredentialRegistryAbi, functionName: "revokeCredential", args: [vcId] });
  }

  return { revokeCredential, hash, isPending: isPending || isConfirming, isSuccess, error };
}
