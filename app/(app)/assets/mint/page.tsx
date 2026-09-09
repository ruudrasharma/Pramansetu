"use client";

import { useState } from "react";
import Link from "next/link";
import { UploadCloud, FileCheck, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SignerChips } from "@/components/modules/SignerChips";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, identities } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";
import type { Asset } from "@/lib/mock/fixtures";

const stepLabels = ["Upload to IPFS", "Propose mint", "Manager co-signs"];

export default function MintAssetPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const assetService = useAssetService();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Certification");
  const [ownerDid, setOwnerDid] = useState(identities[0]!.did);
  const [cid, setCid] = useState<string | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);

  const step = asset?.status === "finalized" ? 3 : asset ? 2 : cid ? 1 : 0;

  function handleUpload() {
    setCid("bafybei" + Math.random().toString(36).slice(2).padEnd(52, "0").slice(0, 52));
  }

  function handlePropose() {
    if (!cid || !name) return;
    const created = assetService.proposeMint({ name, category, ownerDid, cid, proposer: me.did });
    setAsset(created);
  }

  function handleCoSign() {
    if (!asset) return;
    assetService.coSignMint(asset.tokenId, identities.find((i) => i.role === "MANAGER")!.did);
    setAsset({ ...asset, status: "finalized" });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Propose asset mint</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">Dual-attestation: an Admin proposes, a Manager must co-sign before the token exists.</p>
      </div>

      <div className="mb-5 flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                i < step ? "bg-verified-500 text-graphite-950" : i === step ? "bg-signal-500 text-white" : "bg-graphite-800 text-ink-600"
              }`}
            >
              {i < step ? <CheckCircle2 size={13} /> : i + 1}
            </div>
            {i < stepLabels.length - 1 && <div className={`mx-1 h-px flex-1 ${i < step ? "bg-verified-500/40" : "bg-graphite-800"}`} />}
          </div>
        ))}
      </div>
      <div className="mb-5 flex justify-between text-[11px] text-ink-500">
        {stepLabels.map((l) => (
          <span key={l} className="w-1/3 text-center first:text-left last:text-right">
            {l}
          </span>
        ))}
      </div>

      {!asset ? (
        <Card className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Asset name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sonar Array Component Provenance"
              className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-signal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Recipient identity</label>
            <select
              value={ownerDid}
              onChange={(e) => setOwnerDid(e.target.value)}
              className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
            >
              {identities.map((i) => (
                <option key={i.did} value={i.did}>
                  {i.name} — {i.department}
                </option>
              ))}
            </select>
          </div>

          {!cid ? (
            <Button variant="secondary" onClick={handleUpload} disabled={!name}>
              <UploadCloud size={14} /> Upload metadata to IPFS
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
              <FileCheck size={13} /> <span className="mono-value truncate">{cid}</span>
            </div>
          )}

          <Button onClick={handlePropose} disabled={!cid || !name}>
            Propose mint <ArrowRight size={14} />
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink-50">{asset.name}</p>
              <p className="mono-value mt-0.5 text-[11px] text-ink-600">Token #{asset.tokenId}</p>
            </div>
            <Badge tone={asset.status === "finalized" ? "verified" : "alert"}>{asset.status === "finalized" ? "Finalized" : "Pending co-sign"}</Badge>
          </div>

          <SignerChips
            signers={[
              { did: me.did, signed: true },
              { did: identities.find((i) => i.role === "MANAGER")!.did, signed: asset.status === "finalized" },
            ]}
            required={2}
          />

          {asset.status !== "finalized" ? (
            <Button className="mt-4 w-full" variant="secondary" onClick={handleCoSign}>
              Simulate Manager co-sign
            </Button>
          ) : (
            <Link href={`/assets/${asset.tokenId}`}>
              <Button className="mt-4 w-full">View finalized asset</Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
