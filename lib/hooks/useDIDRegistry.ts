/**
 * lib/hooks/useDIDRegistry.ts
 *
 * React hooks for reading from and writing to the DIDRegistry contract.
 * All reads use wagmi's useReadContract; all writes use useWriteContract.
 *
 * If NEXT_PUBLIC_DID_REGISTRY_ADDRESS isn't set, these hooks stay disabled
 * (`{ data: undefined, isLoading: false }`, via `query.enabled`) rather than
 * substituting any mock/placeholder value — see deployments/sepolia.json for
 * the currently deployed address.
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DIDRegistryAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/wagmi";

const address = contractAddresses.didRegistry;

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Resolve a DID to its on-chain DIDDocument.
 * Returns: { controller, keyType, pubKey, metadataURI, createdAt, exists }
 */
export function useResolveDID(did: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: DIDRegistryAbi,
    functionName: "resolveDID",
    args: did ? [did] : undefined,
    query: { enabled: !!did && !!address },
  });
}

/**
 * Look up which DID is registered to a given controller address.
 * Reverse of resolveDID — maps wallet address → DID hash.
 */
export function useDIDOf(controller: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: DIDRegistryAbi,
    functionName: "didOf",
    args: controller ? [controller] : undefined,
    query: { enabled: !!controller && !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * createDID — register a new on-chain identity.
 *
 * Usage:
 *   const { createDID, isPending, isSuccess } = useCreateDID();
 *   await createDID({ pubKey: "0x...", metadataURI: "ipfs://..." });
 */
export function useCreateDID() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function createDID({ pubKey, metadataURI }: { pubKey: `0x${string}`; metadataURI: string }) {
    if (!address) throw new Error("DIDRegistry address not configured — set NEXT_PUBLIC_DID_REGISTRY_ADDRESS");
    writeContract({ address, abi: DIDRegistryAbi, functionName: "createDID", args: [pubKey, metadataURI] });
  }

  return { createDID, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * rotateKey — update the public key bound to a DID.
 * Requires an optional cryptographic proof (checked if signatureVerifier is set).
 */
export function useRotateKey() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function rotateKey({
    did,
    newPubKey,
    keyType,
    proof,
  }: {
    did: `0x${string}`;
    newPubKey: `0x${string}`;
    keyType: string;
    proof: `0x${string}`;
  }) {
    if (!address) throw new Error("DIDRegistry address not configured");
    writeContract({
      address,
      abi: DIDRegistryAbi,
      functionName: "rotateKey",
      args: [did, newPubKey, keyType, proof],
    });
  }

  return { rotateKey, hash, isPending: isPending || isConfirming, isSuccess, error };
}
