"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { identities, findIdentity, credentialForDid } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";

export default function TransferAssetPage() {
  const params = useParams<{ tokenId: string }>();
  const router = useRouter();
  const tokenId = Number(params.tokenId);
  const assetService = useAssetService();
  const asset = assetService.getAsset(tokenId);
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];

  const [recipientDid, setRecipientDid] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  if (!asset) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <EmptyState title="Asset not found" description={`No asset with token ID #${params.tokenId} exists.`} />
      </div>
    );
  }

  const recipient = recipientDid ? findIdentity(recipientDid) : undefined;
  const recipientCredential = recipientDid ? credentialForDid(recipientDid) : undefined;
  const credentialValid = recipientCredential && !recipientCredential.revoked && recipientCredential.validUntil > Date.now();

  function handleTransfer() {
    if (!recipientDid || !credentialValid) return;
    assetService.transferAsset(tokenId, recipientDid, me.did);
    setSubmitted(true);
    setTimeout(() => router.push(`/assets/${tokenId}`), 1200);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link href={`/assets/${tokenId}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to asset
      </Link>

      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Transfer &ldquo;{asset.name}&rdquo;</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Transfers are credential-gated — the recipient&apos;s credential is checked on-chain before the
          transfer executes, and high-value transfers cool off for 24-48h with dispute rights.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-[12px] text-ink-500">Recipient identity</label>
          <Select value={recipientDid} onValueChange={setRecipientDid}>
            <SelectTrigger>
              <SelectValue placeholder="Select a recipient…" />
            </SelectTrigger>
            <SelectContent>
              {identities
                .filter((i) => i.did !== asset.ownerDid)
                .map((i) => (
                  <SelectItem key={i.did} value={i.did}>
                    {i.name} — {i.department}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {recipient && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${
              credentialValid ? "border-verified-500/25 bg-verified-500/10 text-verified-400" : "border-danger-500/25 bg-danger-500/10 text-danger-400"
            }`}
          >
            {credentialValid ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {credentialValid
              ? `${recipient.name}'s credential is valid — transfer will pass the on-chain gate.`
              : `${recipient.name}'s credential is revoked or expired — AssetRegistry will revert this transfer.`}
          </div>
        )}

        <Button onClick={handleTransfer} disabled={!recipientDid || !credentialValid || submitted}>
          {submitted ? "Queuing transfer…" : "Queue transfer"} <ArrowRight size={14} />
        </Button>
      </Card>
    </div>
  );
}
