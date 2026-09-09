"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCheck, KeyRound, Fingerprint, Users, FileCheck, ArrowRight, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, truncateMiddle } from "@/lib/utils";
import { identities } from "@/lib/mock/fixtures";

const steps = ["HR verification", "Key generation", "DID confirmation", "Guardian selection", "Credential receipt"] as const;
const candidateGuardians = identities.filter((i) => i.credentialStatus === "verified").slice(0, 8);

const newDid = "did:ethr:0x" + Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40);

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [guardians, setGuardians] = useState<string[]>([]);

  function toggleGuardian(did: string) {
    setGuardians((prev) => (prev.includes(did) ? prev.filter((d) => d !== did) : prev.length < 5 ? [...prev, did] : prev));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-graphite-950 px-4 py-10">
      <Card className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-signal-500" : "bg-graphite-800")} />
          ))}
        </div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">
          Step {step + 1} of {steps.length}
        </p>
        <h1 className="mb-5 text-[17px] font-medium text-ink-50">{steps[step]}</h1>

        {step === 0 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <UserCheck size={28} className="text-signal-400" />
            <p className="max-w-sm text-[13px] text-ink-400">
              HR has verified your real-world identity and department assignment. This is the only
              off-chain identity check in the entire system — everything after this point is
              cryptographic.
            </p>
            <Badge tone="verified">Verified by HR & Compliance</Badge>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <KeyRound size={28} className="text-signal-400" />
            <p className="max-w-sm text-[13px] text-ink-400">
              A keypair is generated client-side — your private key never leaves this device, and BEL
              never sees it.
            </p>
            <div className="mono-value rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[11px] text-ink-500">
              pubKey: 0x{Math.random().toString(16).slice(2).padEnd(48, "0").slice(0, 48)}…
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <Fingerprint size={28} className="text-signal-400" />
            <p className="max-w-sm text-[13px] text-ink-400">
              Your DID has been registered on-chain via <span className="mono-value">DIDRegistry.createDID</span>.
              It is soulbound to this keypair — non-transferable by design.
            </p>
            <div className="mono-value rounded-lg border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
              {newDid}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-signal-400" />
              <p className="text-[13px] text-ink-400">
                Pick 3–5 guardians. Any {Math.min(3, Math.max(2, Math.ceil(guardians.length / 2)))} of them can
                jointly recover your identity if you lose this device.
              </p>
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {candidateGuardians.map((g) => {
                const selected = guardians.includes(g.did);
                return (
                  <button
                    key={g.did}
                    type="button"
                    onClick={() => toggleGuardian(g.did)}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition-colors",
                      selected ? "border-signal-500/50 bg-signal-500/10" : "border-graphite-800 bg-graphite-900 hover:border-graphite-700"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-ink-200">{g.name}</p>
                      <p className="truncate text-[11px] text-ink-600">{g.department}</p>
                    </div>
                    {selected && <Check size={14} className="shrink-0 text-signal-400" />}
                  </button>
                );
              })}
            </div>
            <p className="mono-value text-[11px] text-ink-600">{guardians.length}/5 selected (min. 3)</p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <FileCheck size={28} className="text-verified-400" />
            <p className="max-w-sm text-[13px] text-ink-400">
              Your onboarding credential has been issued — it binds your DID to your role and department,
              signed by an HR Issuer.
            </p>
            <div className="w-full rounded-lg border border-graphite-800 bg-graphite-900 p-3 text-left text-[12px]">
              <div className="flex justify-between border-b border-graphite-800 pb-1.5">
                <span className="text-ink-600">DID</span>
                <span className="mono-value text-ink-200">{truncateMiddle(newDid, 12, 6)}</span>
              </div>
              <div className="flex justify-between border-b border-graphite-800 py-1.5">
                <span className="text-ink-600">Guardians</span>
                <span className="text-ink-200">{guardians.length}-of-{Math.max(2, Math.ceil(guardians.length / 2))}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-ink-600">Status</span>
                <Badge tone="verified">Issued</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 3 && guardians.length < 3}>
              Continue <ArrowRight size={14} />
            </Button>
          ) : (
            <Link href="/dashboard">
              <Button>
                Go to dashboard <ArrowRight size={14} />
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
