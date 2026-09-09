/**
 * lib/hooks/useAssetRegistry.ts
 *
 * React hooks for AssetRegistry — dual-attestation mint, credential-gated
 * transfers, and token metadata reads.
 */

import { useMemo } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { decodeEventLog } from "viem";
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

/**
 * pendingMints — real on-chain state of a proposed-but-not-yet-executed mint request.
 * Drives the mint-flow stepper honestly (no step is ever marked "done" without reading it here).
 */
export function usePendingMint(requestId: bigint | undefined) {
  return useReadContract({
    address,
    abi: AssetRegistryAbi,
    functionName: "pendingMints",
    args: requestId !== undefined ? [requestId] : undefined,
    query: { enabled: requestId !== undefined && !!address },
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
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

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

  // Decode the real requestId from the mined transaction's MintProposed log — never guessed
  // or inferred from local state, since another proposer's tx could land in between.
  const requestId = useMemo(() => {
    if (!receipt || !address) return undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== address.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: AssetRegistryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "MintProposed") {
          return (decoded.args as { requestId: bigint }).requestId;
        }
      } catch {
        // not a MintProposed log — skip
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `address` is the module-level
    // contract address constant, not a React value; only `receipt` should retrigger this.
  }, [receipt]);

  return { proposeMint, hash, requestId, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * coSignMint — step 2 of the dual-attestation mint flow (Manager co-signs).
 * Executes the mint and emits AssetMinted once threshold is met.
 */
export function useCoSignMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { data: receipt, isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function coSignMint(requestId: bigint) {
    if (!address) throw new Error("AssetRegistry address not configured");
    writeContract({ address, abi: AssetRegistryAbi, functionName: "coSignMint", args: [requestId] });
  }

  // Decode the real tokenId from the mined transaction's AssetMinted log — same pattern as
  // useProposeMint's requestId decoding, and for the same reason: never guessed/inferred.
  const tokenId = useMemo(() => {
    if (!receipt || !address) return undefined;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== address.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: AssetRegistryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "AssetMinted") {
          return (decoded.args as { tokenId: bigint }).tokenId;
        }
      } catch {
        // not an AssetMinted log — skip
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `address` is the module-level
    // contract address constant, not a React value; only `receipt` should retrigger this.
  }, [receipt]);

  return { coSignMint, hash, tokenId, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * transferAsset — the inherited ERC-721 transferFrom, credential-gated via AssetRegistry's
 * overridden _update hook (reverts with RecipientCredentialInvalid if the recipient's
 * credential is invalid/revoked — see docs/API_SPEC.md AssetRegistry.transferFrom).
 */
export function useTransferAsset() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function transferAsset({ from, to, tokenId }: { from: `0x${string}`; to: `0x${string}`; tokenId: bigint }) {
    if (!address) throw new Error("AssetRegistry address not configured");
    writeContract({ address, abi: AssetRegistryAbi, functionName: "transferFrom", args: [from, to, tokenId] });
  }

  return { transferAsset, hash, isPending: isPending || isConfirming, isSuccess, error };
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
