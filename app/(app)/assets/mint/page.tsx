"use client";

import { useState } from "react";
import Link from "next/link";
import { UploadCloud, FileCheck, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SignerChips } from "@/components/modules/SignerChips";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, identities } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";
import { dataMode } from "@/lib/services/dataMode";
import { truncateMiddle } from "@/lib/utils";

async function uploadMetadataToIPFS(metadata: { name: string; category: string }): Promise<string> {
  const res = await fetch("/api/ipfs/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to upload metadata to IPFS");
  return data.cid as string;
}

const stepLabels = ["Upload to IPFS", "Propose mint", "Manager co-signs"];

export default function MintAssetPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const assetService = useAssetService();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Certification");
  const [ownerDid, setOwnerDid] = useState(identities[0]!.did);
  const [vcId, setVcId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [cid, setCid] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOnchain = dataMode === "onchain";
  const isProposed = assetService.isProposeConfirmed;
  const isMinted = assetService.isCoSignConfirmed;
  const mintedAsset = assetService.lastMintedTokenId !== undefined ? assetService.getAsset(assetService.lastMintedTokenId) : undefined;

  const step = isMinted ? 3 : isProposed ? 2 : cid ? 1 : 0;

  async function handleUpload() {
    if (!name) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const uploadedCid = await uploadMetadataToIPFS({ name, category });
      setCid(uploadedCid);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePropose() {
    if (!cid || !name) return;
    setActionError(null);
    try {
      await assetService.proposeMint({ name, category, ownerDid, cid, proposer: me.did, vcId, recipient });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to propose mint");
    }
  }

  async function handleCoSign() {
    if (assetService.lastRequestId === undefined) return;
    setActionError(null);
    try {
      await assetService.coSignMint(assetService.lastRequestId, identities.find((i) => i.role === "MANAGER")!.did);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to co-sign mint");
    }
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

      {actionError && (
        <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {!isProposed ? (
        <Card className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Asset name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sonar Array Component Provenance"
              className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-signal-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
            />
          </div>

          {!isOnchain && (
            <div>
              <label className="mb-1.5 block text-[12px] text-ink-500">Recipient identity</label>
              <select
                value={ownerDid}
                onChange={(e) => setOwnerDid(e.target.value)}
                className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
              >
                {identities.map((i) => (
                  <option key={i.did} value={i.did}>
                    {i.name} — {i.department}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isOnchain && (
            <>
              <div>
                <label className="mb-1.5 block text-[12px] text-ink-500">
                  Recipient&apos;s credential (vcId, bytes32) —{" "}
                  <span className="text-ink-600">
                    a real{" "}
                    <span className="mono-value">CredentialRegistry.issueCredential</span> id, not a
                    DID hash — transfers revert if this doesn&apos;t gate a valid, non-revoked credential.{" "}
                  </span>
                  <Link href="/identity/issue" className="text-signal-400 underline underline-offset-2 hover:text-signal-300">
                    Issue one first →
                  </Link>
                </label>
                <input
                  value={vcId}
                  onChange={(e) => setVcId(e.target.value)}
                  placeholder="0x... (from Issue credential's confirmation)"
                  className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] text-ink-500">Recipient wallet address</label>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {!cid ? (
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={handleUpload} disabled={!name || isUploading}>
                <UploadCloud size={14} /> {isUploading ? "Uploading..." : "Upload metadata to IPFS"}
              </Button>
              {uploadError && <p className="text-[12px] text-danger-400">{uploadError}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
              <FileCheck size={13} /> <span className="mono-value">{truncateMiddle(cid, 14, 6)}</span>
            </div>
          )}

          <Button onClick={handlePropose} disabled={!cid || !name || assetService.isPending || (isOnchain && (!vcId || !recipient))}>
            {assetService.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Confirming tx...
              </>
            ) : (
              <>
                Propose mint <ArrowRight size={14} />
              </>
            )}
          </Button>
        </Card>
      ) : (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-ink-50">{mintedAsset?.name ?? name}</p>
              <p className="mono-value mt-0.5 text-[11px] text-ink-600">
                {isMinted ? `Token #${assetService.lastMintedTokenId}` : `Request #${assetService.lastRequestId}`}
              </p>
            </div>
            <Badge tone={isMinted ? "verified" : "alert"}>{isMinted ? "Finalized" : "Pending co-sign"}</Badge>
          </div>

          {!isOnchain && (
            <SignerChips
              signers={[
                { did: me.did, signed: true },
                { did: identities.find((i) => i.role === "MANAGER")!.did, signed: isMinted },
              ]}
              required={2}
            />
          )}

          {!isMinted ? (
            <Button className="mt-4 w-full" variant="secondary" onClick={handleCoSign} disabled={assetService.isPending}>
              {assetService.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Confirming tx...
                </>
              ) : isOnchain ? (
                "Co-sign as Manager"
              ) : (
                "Simulate Manager co-sign"
              )}
            </Button>
          ) : (
            <Link href={`/assets/${assetService.lastMintedTokenId}`}>
              <Button className="mt-4 w-full">View finalized asset</Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
