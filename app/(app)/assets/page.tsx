"use client";

import Link from "next/link";
import { Boxes, FileCheck } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { truncateMiddle } from "@/lib/utils";
import { useAssetService } from "@/lib/services/assetService";
import type { AssetStatus } from "@/lib/mock/fixtures";

const statusTone: Record<AssetStatus, "verified" | "alert" | "signal" | "danger"> = {
  finalized: "verified",
  pending_cosign: "alert",
  transferred: "signal",
  disputed: "danger",
};

const statusLabel: Record<AssetStatus, string> = {
  finalized: "Finalized",
  pending_cosign: "Pending co-sign",
  transferred: "Transferred",
  disputed: "Disputed",
};

export default function AssetsPage() {
  const assetService = useAssetService();
  const assets = assetService.listAssets();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Digital asset registry</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Every asset is minted only after two independent roles co-sign — content-addressed on
            IPFS, ownership enforced by the contract.
          </p>
        </div>
        <Link href="/assets/mint">
          <Button>Propose mint</Button>
        </Link>
      </div>

      {assets.length === 0 ? (
        <EmptyState title="No assets minted yet" description="Propose a mint to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Link key={asset.tokenId} href={`/assets/${asset.tokenId}`}>
              <Card className="flex h-full flex-col gap-3 transition-colors hover:border-graphite-600">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
                    <Boxes size={16} strokeWidth={1.75} />
                  </div>
                  <Badge tone={statusTone[asset.status]}>{statusLabel[asset.status]}</Badge>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-ink-50">{asset.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-500">{asset.category}</p>
                </div>
                <div className="mt-auto flex flex-col gap-1 text-[11px] text-ink-600">
                  <span className="mono-value truncate">CID {truncateMiddle(asset.cid, 10, 6)}</span>
                  <span className="mono-value truncate">Owner {truncateMiddle(asset.ownerDid, 12, 4)}</span>
                </div>
                {asset.legalReference && (
                  <div className="flex items-center gap-1 text-[11px] text-verified-400">
                    <FileCheck size={11} /> Legal reference attached
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
