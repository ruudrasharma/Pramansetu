"use client";

/**
 * lib/services/assetService.ts — NFT-Based Digital Asset Registry (M3): dual-attestation
 * minting, credential-gated transfers, content-addressed metadata.
 */

import { useState } from "react";
import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { type Asset } from "@/lib/mock/fixtures";
import {
  useProposeMint as useProposeMintOnchain,
  useCoSignMint as useCoSignMintOnchain,
  useTransferAsset as useTransferAssetOnchain,
} from "@/lib/hooks/useAssetRegistry";
import { resolveControllerAddress } from "@/lib/hooks/useDIDRegistry";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_ASSETS } from "@/lib/queries";
import { deriveAssetStatus } from "@/lib/services/shared/assets";

export interface AssetService {
  listAssets: () => Asset[];
  getAsset: (tokenId: number) => Asset | undefined;
  getProvenance: (tokenId: number) => Asset["provenance"];
  proposeMint: (input: { name: string; category: string; ownerDid: string; cid: string; proposer: string; vcId?: string; recipient?: string }) => void;
  coSignMint: (requestId: number, coSigner: string) => void;
  transferAsset: (tokenId: number, newOwnerDid: string, actorDid: string) => void;
  isPending: boolean;
  isLoadingAssets: boolean;
  /** Real, reactive mint-flow status. proposeMint/coSignMint above no longer return a value
   * (the old onchain stub returned a hardcoded fake Asset regardless of what was actually
   * proposed — see TODO.md T-042) — callers read progress from these fields instead, which
   * resolve instantly in mock mode and only once a real transaction confirms in onchain mode. */
  lastRequestId: number | undefined;
  isProposeConfirmed: boolean;
  lastMintedTokenId: number | undefined;
  isCoSignConfirmed: boolean;
  isTransferConfirmed: boolean;
}

function useMockAssetService(): AssetService {
  const store = useMockDataStore();
  const [lastRequestId, setLastRequestId] = useState<number>();
  const [lastMintedTokenId, setLastMintedTokenId] = useState<number>();
  const [isTransferConfirmed, setIsTransferConfirmed] = useState(false);

  return {
    listAssets: () => store.assets,
    getAsset: (tokenId) => store.assets.find((a) => a.tokenId === tokenId),
    getProvenance: (tokenId) => store.assets.find((a) => a.tokenId === tokenId)?.provenance ?? [],
    proposeMint: (input) => {
      const created = store.proposeMint(input);
      setLastRequestId(created.tokenId);
      setLastMintedTokenId(undefined);
    },
    coSignMint: (requestId, coSigner) => {
      store.coSignMint(requestId, coSigner);
      setLastMintedTokenId(requestId);
    },
    transferAsset: (tokenId, newOwnerDid, actorDid) => {
      store.transferAsset(tokenId, newOwnerDid, actorDid);
      setIsTransferConfirmed(true);
    },
    isPending: false,
    isLoadingAssets: false,
    lastRequestId,
    isProposeConfirmed: lastRequestId !== undefined,
    lastMintedTokenId,
    isCoSignConfirmed: lastMintedTokenId !== undefined,
    isTransferConfirmed,
  };
}

const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

async function fetchAssetMetadata(cid: string): Promise<{ name: string; category: string }> {
  const hash = cid.replace(/^ipfs:\/\//, "");
  const res = await fetch(`${IPFS_GATEWAY}${hash}`);
  if (!res.ok) throw new Error(`IPFS gateway returned ${res.status}`);
  const json = await res.json();
  return { name: json.name ?? "", category: json.category ?? json.description ?? "" };
}

interface RawAsset {
  id: string;
  tokenId: string;
  cid: string;
  ownerAddress: string;
  mintRecipient: string;
  owner: { id: string } | null;
  vcId: string;
  legalReference: string | null;
  mintedAt: string;
  proposedBy: string;
  coSignedBy: string;
  txHash: string;
}

async function adaptAsset(raw: RawAsset): Promise<Asset> {
  // Real IPFS fetch, honestly labeled if it fails — never a blank/fabricated name. Worth the
  // extra round-trip here (unlike didService's name/department, left unpopulated) because
  // Asset.name is prominently displayed everywhere assets appear, not a rarely-read field.
  let name = "";
  let category = "";
  try {
    const meta = await fetchAssetMetadata(raw.cid);
    name = meta.name;
    category = meta.category;
  } catch {
    name = "(metadata unavailable)";
  }

  return {
    tokenId: Number(raw.tokenId),
    cid: raw.cid,
    name,
    category,
    ownerDid: raw.owner?.id ?? "",
    ownerAddress: raw.ownerAddress,
    // vcIdOf really stores a DID hash, not a VC id, on the currently deployed contract — see
    // TODO.md T-019 (contract-level, not fixed without sign-off). Passed through as-is.
    vcId: raw.vcId,
    legalReference: raw.legalReference,
    mintedAt: Number(raw.mintedAt) * 1000,
    proposer: raw.proposedBy,
    coSigner: raw.coSignedBy,
    // "transferred" is a real, cheap derivation (T-063): mintRecipient is recorded once, at mint
    // time, from the originating MintRequest, while ownerAddress mutates on every real Transfer —
    // if they've diverged, a real transfer has happened since minting. "disputed" is intentionally
    // not derived here: this contract has no asset-level dispute concept, only
    // GovernanceTimelock's generic queued-transaction disputes (Dispute → GovernanceTx), and
    // there's no field linking a GovernanceTx back to a specific tokenId — a real implementation
    // would mean regex-matching free-text summaries against a target contract/calldata heuristic,
    // fragile enough that it's not worth guessing at for a list-view status (same call T-043 made
    // for getProvenance).
    status: deriveAssetStatus(raw.ownerAddress, raw.mintRecipient),
    provenance: [],
  };
}

function useOnchainAssetService(): AssetService {
  const { proposeMint, requestId, isPending: isProposing, isSuccess: isProposeSuccess } = useProposeMintOnchain();
  const { coSignMint, tokenId: mintedTokenId, isPending: isCoSigning, isSuccess: isCoSignSuccess } = useCoSignMintOnchain();
  const { transferAsset: transferAssetOnchain, isPending: isTransferring, isSuccess: isTransferSuccess } = useTransferAssetOnchain();

  const assetsQuery = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const data = await getGraphQLClient().request<{ assets: RawAsset[] }>(GET_ASSETS);
      return Promise.all(data.assets.map(adaptAsset));
    },
  });

  return {
    listAssets: () => assetsQuery.data ?? [],
    getAsset: (tokenId) => assetsQuery.data?.find((a) => a.tokenId === tokenId),
    getProvenance: () => {
      // Confirmed zero callers anywhere in the app (2026-09-09), same as rbacService's
      // getRoleExpiry (T-027) — stopgapped rather than building unverifiable machinery for a
      // dead code path. If a caller does appear: AuditEvent has no assetId/targetId field to
      // filter by (checked against schema.graphql directly), only a free-text `summary` — a
      // real implementation means fetching the event stream and regex-matching "#<tokenId>"
      // against summary text, honest but fragile, and worth doing properly rather than
      // guessing at call-site shape for a function nothing currently uses. See TODO.md T-043.
      throw new Error("getProvenance is not implemented in onchain mode yet — see TODO.md T-043.");
    },
    proposeMint: async ({ cid, vcId, recipient }) => {
      if (!vcId || !recipient) {
        throw new Error("A recipient address and vcId/recipientDid are required — none reaches a real transaction as a zero placeholder (see TODO.md T-029).");
      }
      proposeMint({ cid, vcId: vcId as `0x${string}`, recipient: recipient as `0x${string}` });
    },
    coSignMint: (requestId) => coSignMint(BigInt(requestId)),
    transferAsset: async (tokenId, newOwnerDid, _actorDid) => {
      const asset = assetsQuery.data?.find((a) => a.tokenId === tokenId);
      if (!asset?.ownerAddress) throw new Error(`Asset #${tokenId} not found or has no known owner address.`);
      const to = await resolveControllerAddress(newOwnerDid as `0x${string}`);
      transferAssetOnchain({ from: asset.ownerAddress as `0x${string}`, to, tokenId: BigInt(tokenId) });
    },
    isPending: isProposing || isCoSigning || isTransferring,
    isLoadingAssets: assetsQuery.isLoading,
    lastRequestId: requestId !== undefined ? Number(requestId) : undefined,
    isProposeConfirmed: isProposeSuccess,
    lastMintedTokenId: mintedTokenId !== undefined ? Number(mintedTokenId) : undefined,
    isCoSignConfirmed: isCoSignSuccess,
    isTransferConfirmed: isTransferSuccess,
  };
}

export function useAssetService(): AssetService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockAssetService();
  const onchain = useOnchainAssetService();
  return dataMode === "onchain" ? onchain : mock;
}
