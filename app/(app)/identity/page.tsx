"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, ShieldCheck, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CredentialCard } from "@/components/modules/CredentialCard";
import { truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";

export default function IdentityPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const didService = useDidService();
  const credentials = didService.listCredentials(me.did);
  const guardianSet = didService.getGuardians(me.did);

  const [zkState, setZkState] = useState<"idle" | "proving" | "proved">("idle");

  function runZkDemo() {
    setZkState("proving");
    setTimeout(() => setZkState("proved"), 1400);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Decentralized identity</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Every user, device, and department is a DID — credential-gated, guardian-recoverable, no
            master identity database.
          </p>
        </div>
        <Link href="/identity/recovery">
          <Button variant="secondary">Guardian recovery</Button>
        </Link>
      </div>

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="signal">
            <Lock size={11} /> Soulbound
          </Badge>
          <Badge tone="neutral">{ROLE_LABEL[activeRole]}</Badge>
          <Badge tone={me.credentialStatus === "verified" ? "verified" : me.credentialStatus === "pending" ? "alert" : "danger"}>
            {me.credentialStatus}
          </Badge>
        </div>

        <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">DID</p>
        <div className="mb-4 flex items-center gap-2">
          <span className="mono-value break-all text-[14px] text-ink-100">{me.did}</span>
          <button aria-label="Copy DID" className="shrink-0 text-ink-600 hover:text-ink-300">
            <Copy size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Controller</p>
            <span className="mono-value text-[13px] text-ink-200">{truncateMiddle(me.controller, 10, 6)}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Created</p>
            <span className="text-[13px] text-ink-200">{new Date(me.createdAt).toLocaleDateString()}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Key type</p>
            <span className="mono-value text-[13px] text-ink-200">{me.keyType}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Guardians</p>
            <span className="text-[13px] text-ink-200">{guardianSet ? `${guardianSet.guardians.length}` : "0"} configured</span>
          </div>
        </div>

        <a
          href={`https://sepolia.etherscan.io/address/${me.controller}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-signal-400 hover:text-signal-300"
        >
          View on-chain <ExternalLink size={12} />
        </a>
      </Card>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {credentials.length === 0 ? (
          <Card className="sm:col-span-2 text-[13px] text-ink-500">No credentials issued yet.</Card>
        ) : (
          credentials.map((c) => <CredentialCard key={c.vcId} credential={c} />)
        )}
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
              <ShieldCheck size={17} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-ink-50">Prove role without revealing identity</h3>
              <p className="mt-1 max-w-md text-[13px] text-ink-400">
                Generates a zero-knowledge proof (Semaphore) that you hold a valid {ROLE_LABEL[activeRole]}{" "}
                credential, checked against the on-chain membership root — without disclosing which DID you
                are.
              </p>
            </div>
          </div>
          <Button variant="secondary" className="shrink-0" onClick={runZkDemo} disabled={zkState === "proving"}>
            {zkState === "proving" && <Loader2 size={14} className="animate-spin" />}
            {zkState === "proved" && <CheckCircle2 size={14} className="text-verified-400" />}
            {zkState === "idle" ? "Generate proof" : zkState === "proving" ? "Proving…" : "Proved"}
          </Button>
        </div>
        {zkState === "proved" && (
          <div className="mt-3 rounded-lg border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
            Proof verified against the current Merkle root — role membership confirmed, identity not
            disclosed.
          </div>
        )}
      </Card>
    </div>
  );
}
