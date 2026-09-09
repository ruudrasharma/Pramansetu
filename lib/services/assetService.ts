"use client";

/**
 * lib/services/assetService.ts — NFT-Based Digital Asset Registry (M3): dual-attestation
 * minting, credential-gated transfers, content-addressed metadata.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { assets, assetById, type Asset } from "@/lib/mock/fixtures";
import { useProposeMint as useProposeMintOnchain, useCoSignMint as useCoSignMintOnchain } from "@/lib/hooks/useAssetRegistry";

export interface AssetService {
  listAssets: () => Asset[];
  getAsset: (tokenId: number) => Asset | undefined;
  getProvenance: (tokenId: number) => Asset["provenance"];
  proposeMint: (input: { name: string; category: string; ownerDid: string; cid: string; proposer: string }) => Asset;
  coSignMint: (tokenId: number, coSigner: string) => void;
  transferAsset: (tokenId: number, newOwnerDid: string, actorDid: string) => void;
  isPending: boolean;
}

function useMockAssetService(): AssetService {
  const store = useMockDataStore();

  return {
    listAssets: () => store.assets,
    getAsset: (tokenId) => store.assets.find((a) => a.tokenId === tokenId),
    getProvenance: (tokenId) => store.assets.find((a) => a.tokenId === tokenId)?.provenance ?? [],
    proposeMint: store.proposeMint,
    coSignMint: store.coSignMint,
    transferAsset: store.transferAsset,
    isPending: false,
  };
}

function useOnchainAssetService(): AssetService {
  const { proposeMint, isPending: isProposing } = useProposeMintOnchain();
  const { coSignMint, isPending: isCoSigning } = useCoSignMintOnchain();

  return {
    // TODO(onchain): no "list all tokens" view — AssetRegistry only exposes per-tokenId
    // reads (tokenURI/vcIdOf/ownerOf). Needs a subgraph query over Asset entities
    // (docs/DATABASE_SCHEMA.md) or an ERC-721 Enumerable extension.
    listAssets: () => assets,
    getAsset: (tokenId) => assetById(tokenId),
    // TODO(onchain): provenance/transfer history isn't stored on AssetRegistry itself —
    // it's reconstructed from the indexed AssetMinted/AssetTransferred event stream
    // (docs/API_SPEC.md GET /audit?type=AssetTransferred&...).
    getProvenance: (tokenId) => assetById(tokenId)?.provenance ?? [],
    proposeMint: ({ cid, ownerDid }) => {
      // TODO(onchain): `ownerDid` here is a human-readable DID string; AssetRegistry.
      // proposeMint expects (cid, vcId, recipient address) — resolve the recipient's vcId
      // and controller address first (contracts/AssetRegistry.sol:118-120 convention).
      proposeMint({ cid, vcId: "0x0000000000000000000000000000000000000000000000000000000000000000", recipient: "0x0000000000000000000000000000000000000000" });
      return assetById(0) ?? assets[0]!;
    },
    coSignMint: (tokenId) => coSignMint(BigInt(tokenId)),
    // TODO(onchain): transfers are the inherited ERC-721 transferFrom/safeTransferFrom,
    // credential-gated via the overridden _update hook — no dedicated hook exists yet in
    // lib/hooks/useAssetRegistry.ts.
    transferAsset: () => {},
    isPending: isProposing || isCoSigning,
  };
}

export function useAssetService(): AssetService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockAssetService();
  const onchain = useOnchainAssetService();
  return dataMode === "onchain" ? onchain : mock;
}
