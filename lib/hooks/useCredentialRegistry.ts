/**
 * lib/hooks/useCredentialRegistry.ts
 *
 * React hooks for CredentialRegistry — issuing, checking, and revoking VCs.
 */

import { useMemo } from "react";
import { decodeEventLog, keccak256, toBytes } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CredentialRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.credentialRegistry;

/**
 * CredentialRegistry is its own standalone `AccessControl` contract (not
 * `TimeBoundAccessControl`) — `ISSUER_ROLE` here is a completely separate grant from the 5 roles
 * `lib/hooks/useAccessControl.ts` checks against the main RBAC engine (see
 * `scripts/postDeploySetup.ts`'s `credRegistry.grantRole(ISSUER_ROLE, issuerWallet.address)`,
 * a different contract call from every `TimeBoundAccessControl` grant). Don't reuse
 * `useAccessControl.ts`'s `useHasRole`/`ROLE.ISSUER_ROLE` for this — it reads the wrong contract.
 */
export const ISSUER_ROLE = keccak256(toBytes("ISSUER_ROLE"));

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Check if an account holds ISSUER_ROLE on CredentialRegistry specifically (see note above).
 */
export function useHasIssuerRole(account: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: CredentialRegistryAbi,
    functionName: "hasRole",
    args: account ? [ISSUER_ROLE, account] : undefined,
    query: { enabled: !!account && !!address },
  });
}

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
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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

  // Decode the real vcId from the mined transaction's CredentialIssued log — same pattern as
  // useAssetRegistry's useProposeMint decoding requestId, never guessed at the call site.
  const vcId = useMemo(() => {
    if (!receipt || !address) return undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== address.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: CredentialRegistryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "CredentialIssued") {
          return (decoded.args as { vcId: `0x${string}` }).vcId;
        }
      } catch {
        // not a CredentialIssued log — skip
      }
    }
    return undefined;
  }, [receipt, address]);

  return { issueCredential, hash, vcId, isPending: isPending || isConfirming, isSuccess, error };
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
