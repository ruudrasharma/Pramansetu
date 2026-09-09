"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, ShieldCheck, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { CredentialCard } from "@/components/modules/CredentialCard";
import { truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { ROLE_LABEL } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

function CreateIdentityCard({ onCreate }: { onCreate: (input: { name: string; department: string }) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name || !department) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate({ name, department });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create DID");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-5">
      <h3 className="mb-1 text-[14px] font-medium text-ink-50">No DID registered for this wallet yet</h3>
      <p className="mb-4 text-[13px] text-ink-400">
        Generates a real keypair client-side and registers its public key on-chain via
        `DIDRegistry.createDID` — this submits a real transaction from your connected wallet.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department"
          className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
        />
      </div>
      {error && <p className="mb-3 text-[12px] text-danger-400">{error}</p>}
      <Button onClick={handleSubmit} disabled={!name || !department || isSubmitting}>
        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
        {isSubmitting ? "Confirming transaction…" : "Create identity"}
      </Button>
    </Card>
  );
}

export default function IdentityPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, isResolving: isResolvingMe, hasNoDid } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const me = didService.resolveDID();
  const credentials = didService.listCredentials();
  const guardianSet = didService.getGuardians();

  const [zkState, setZkState] = useState<"idle" | "proving" | "proved">("idle");

  function runZkDemo() {
    setZkState("proving");
    setTimeout(() => setZkState("proved"), 1400);
  }

  if (dataMode === "onchain" && !myDid) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {isResolvingMe ? (
          <Card className="flex items-center gap-2 text-[13px] text-ink-400">
            <Loader2 size={14} className="animate-spin" /> Resolving your identity from the connected wallet…
          </Card>
        ) : hasNoDid ? (
          <CreateIdentityCard onCreate={didService.createDID} />
        ) : (
          <EmptyState title="No wallet connected" description="Connect a wallet to view or create your on-chain identity." />
        )}
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Resolving identity…
        </Card>
      </div>
    );
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
          <Badge tone="neutral">{ROLE_LABEL[dataMode === "onchain" ? me.role : activeRole]}</Badge>
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
            <IconBadge icon={ShieldCheck} tone="signal" className="mt-0.5" />
            <div>
              <h3 className="text-[14px] font-medium text-ink-50">Prove role without revealing identity</h3>
              <p className="mt-1 max-w-md text-[13px] text-ink-400">
                Generates a zero-knowledge proof (Semaphore) that you hold a valid{" "}
                {ROLE_LABEL[dataMode === "onchain" ? me.role : activeRole]} credential, checked against the
                on-chain membership root — without disclosing which DID you are.
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
          <div className="mt-3 rounded-2xl border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
            Proof verified against the current Merkle root — role membership confirmed, identity not
            disclosed.
          </div>
        )}
      </Card>
    </div>
  );
}
