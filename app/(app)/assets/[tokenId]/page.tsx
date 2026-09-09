"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileCheck, ExternalLink } from "lucide-react";
import { Card, EmptyState, MonoValue } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { truncateMiddle, formatRelativeTime } from "@/lib/utils";
import { findIdentity, type AssetStatus } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";

const statusTone: Record<AssetStatus, "verified" | "alert" | "signal" | "danger"> = {
  finalized: "verified",
  pending_cosign: "alert",
  transferred: "signal",
  disputed: "danger",
};

export default function AssetDetailPage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = Number(params.tokenId);
  const assetService = useAssetService();
  const asset = assetService.getAsset(tokenId);

  if (!asset) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState title="Asset not found" description={`No asset with token ID #${params.tokenId} exists in the registry.`} />
      </div>
    );
  }

  const owner = findIdentity(asset.ownerDid);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/assets" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to registry
      </Link>

      <Card className="mb-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="mono-value text-[12px] text-ink-600">Token #{asset.tokenId}</p>
            <h1 className="mt-0.5 text-[17px] font-medium text-ink-50">{asset.name}</h1>
          </div>
          <Badge tone={statusTone[asset.status]}>{asset.status.replace("_", " ")}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-graphite-800 pt-4 md:grid-cols-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Category</p>
            <p className="text-[13px] text-ink-200">{asset.category}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Owner</p>
            <p className="text-[13px] text-ink-200">{owner?.name ?? truncateMiddle(asset.ownerDid)}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">CID</p>
            <MonoValue className="text-[12px]">{truncateMiddle(asset.cid, 10, 6)}</MonoValue>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Proposer</p>
            <p className="text-[13px] text-ink-200">{findIdentity(asset.proposer)?.name ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Co-signer</p>
            <p className="text-[13px] text-ink-200">{asset.coSigner ? findIdentity(asset.coSigner)?.name ?? "—" : "Awaiting co-sign"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Legal reference</p>
            {asset.legalReference ? (
              <span className="flex items-center gap-1 text-[13px] text-verified-400">
                <FileCheck size={12} /> Attached
              </span>
            ) : (
              <span className="text-[13px] text-ink-600">None</span>
            )}
          </div>
        </div>

        {asset.legalReference && (
          <p className="mt-3 text-[11px] text-ink-600">
            Not yet a recognized legal title under current Indian law — a hash bridge to an off-chain
            document, per docs/FEATURES.md F3.4.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {asset.status === "finalized" && (
            <Link href={`/assets/${asset.tokenId}/transfer`}>
              <Button variant="secondary">Initiate transfer</Button>
            </Link>
          )}
          <a
            href={`https://sepolia.etherscan.io/token/${asset.tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-graphite-800 bg-graphite-900 px-3.5 py-2 text-[13px] text-ink-400 hover:border-graphite-600 hover:text-ink-200"
          >
            View on-chain <ExternalLink size={12} />
          </a>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-[13px] font-medium text-ink-50">Provenance</h3>
        <div className="flex flex-col gap-4">
          {asset.provenance.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="h-2 w-2 shrink-0 rounded-full bg-signal-500" />
                {i < asset.provenance.length - 1 && <span className="mt-1 w-px flex-1 bg-graphite-800" />}
              </div>
              <div className="pb-2">
                <p className="text-[13px] text-ink-200">{step.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-600">
                  {findIdentity(step.actorDid)?.name ?? truncateMiddle(step.actorDid)} · {formatRelativeTime(step.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
