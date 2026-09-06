/**
 * lib/hooks/useAssetRegistry.ts
 *
 * React hooks for AssetRegistry — dual-attestation mint, credential-gated
 * transfers, and token metadata reads.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { AssetRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.assetRegistry;

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Get the IPFS CID metadata URI for a token (returned as ipfs://<cid>).
 */
export function useTokenURI(tokenId: bigint | undefined) {
  return useReadContract({
    address,
    abi: AssetRegistryAbi,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && !!address },
  });
}

/**
 * Get the credential ID (vcId) gating a token's transferability.
 * Returns bytes32 — look up in CredentialRegistry to verify validity.
 */
export function useVcIdOf(tokenId: bigint | undefined) {
  return useReadContract({
    address,
    abi: AssetRegistryAbi,
    functionName: "vcIdOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && !!address },
  });
}

/**
 * ownerOf — ERC-721 standard: who owns this token right now.
 */
export function useOwnerOf(tokenId: bigint | undefined) {
  return useReadContract({
    address,
    abi: AssetRegistryAbi,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * proposeMint — step 1 of the dual-attestation mint flow (Admin proposes).
 * Returns a requestId via the MintProposed event.
 *
 * Usage:
 *   const { proposeMint, isPending } = useProposeMint();
 *   proposeMint({ cid: "bafybei...", vcId: "0x...", recipient: "0x..." });
 */
export function useProposeMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function proposeMint({
    cid,
    vcId,
    recipient,
  }: {
    cid: string;
    vcId: `0x${string}`;
    recipient: `0x${string}`;
  }) {
    if (!address) throw new Error("AssetRegistry address not configured");
    writeContract({ address, abi: AssetRegistryAbi, functionName: "proposeMint", args: [cid, vcId, recipient] });
  }

  return { proposeMint, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * coSignMint — step 2 of the dual-attestation mint flow (Manager co-signs).
 * Executes the mint and emits AssetMinted once threshold is met.
 */
export function useCoSignMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function coSignMint(requestId: bigint) {
    if (!address) throw new Error("AssetRegistry address not configured");
    writeContract({ address, abi: AssetRegistryAbi, functionName: "coSignMint", args: [requestId] });
  }

  return { coSignMint, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * attachLegalReference — bind an off-chain legal document hash to a token.
 * Can only be called by the token owner. Emits LegalReferenceAttached.
 */
export function useAttachLegalReference() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function attachLegalReference(tokenId: bigint, documentHash: `0x${string}`) {
    if (!address) throw new Error("AssetRegistry address not configured");
    writeContract({ address, abi: AssetRegistryAbi, functionName: "attachLegalReference", args: [tokenId, documentHash] });
  }

  return { attachLegalReference, hash, isPending: isPending || isConfirming, isSuccess, error };
}
