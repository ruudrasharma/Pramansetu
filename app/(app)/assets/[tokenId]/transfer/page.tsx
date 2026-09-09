"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { identities as mockIdentities, findIdentity, credentialForDid } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";
import { useRbacService } from "@/lib/services/rbacService";
import { useDidService } from "@/lib/services/didService";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { dataMode } from "@/lib/services/dataMode";

export default function TransferAssetPage() {
  const params = useParams<{ tokenId: string }>();
  const router = useRouter();
  const tokenId = Number(params.tokenId);
  const assetService = useAssetService();
  const asset = assetService.getAsset(tokenId);
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const isOnchain = dataMode === "onchain";

  const [recipientDid, setRecipientDid] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  const rbacService = useRbacService();
  const realIdentities = rbacService.listIdentities();
  const recipientDidService = useDidService(recipientDid || undefined);
  const recipientCredentials = recipientDidService.listCredentials();

  useEffect(() => {
    if (assetService.isTransferConfirmed) {
      router.push(`/assets/${tokenId}`);
    }
  }, [assetService.isTransferConfirmed, router, tokenId]);

  if (!asset) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <EmptyState title="Asset not found" description={`No asset with token ID #${params.tokenId} exists.`} />
      </div>
    );
  }

  const recipient = recipientDid ? (isOnchain ? realIdentities.find((i) => i.did === recipientDid) : findIdentity(recipientDid)) : undefined;
  const credentialValid = isOnchain
    ? recipientCredentials.some((c) => !c.revoked && c.validUntil > Date.now())
    : (() => {
        const c = recipientDid ? credentialForDid(recipientDid) : undefined;
        return !!c && !c.revoked && c.validUntil > Date.now();
      })();

  async function handleTransfer() {
    if (!recipientDid || !credentialValid) return;
    setActionError(null);
    try {
      await assetService.transferAsset(tokenId, recipientDid, me.did);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to transfer asset");
    }
  }

  const candidateIdentities = isOnchain ? realIdentities : mockIdentities;

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

      {actionError && (
        <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      <Card className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-[12px] text-ink-500">Recipient identity</label>
          <Select value={recipientDid} onValueChange={setRecipientDid}>
            <SelectTrigger>
              <SelectValue placeholder="Select a recipient…" />
            </SelectTrigger>
            <SelectContent>
              {candidateIdentities
                .filter((i) => i.did !== asset.ownerDid)
                .map((i) => (
                  <SelectItem key={i.did} value={i.did}>
                    {i.name || i.did.slice(0, 20) + "…"} {i.department && `— ${i.department}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {recipient && (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-[12px] ${
              credentialValid ? "border-verified-500/25 bg-verified-500/10 text-verified-400" : "border-danger-500/25 bg-danger-500/10 text-danger-400"
            }`}
          >
            {credentialValid ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {credentialValid
              ? `${recipient.name || "This recipient"}'s credential is valid — transfer will pass the on-chain gate.`
              : `${recipient.name || "This recipient"}'s credential is revoked, expired, or missing — AssetRegistry will revert this transfer.`}
          </div>
        )}

        <Button onClick={handleTransfer} disabled={!recipientDid || !credentialValid || assetService.isPending}>
          {assetService.isPending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Confirming transfer…
            </>
          ) : (
            <>
              Queue transfer <ArrowRight size={14} />
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
