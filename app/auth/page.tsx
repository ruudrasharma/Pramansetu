"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { KeyRound, Wallet, PenLine, Fingerprint, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { truncateMiddle } from "@/lib/utils";

type Step = "connect" | "sign" | "resolving" | "done";

const CHALLENGE = `BEL SecureChain — sign to authenticate.\nNonce: ${Date.now().toString(36)}\nNo password was ever created for this account.`;

const steps: { key: Step; label: string; icon: typeof Wallet }[] = [
  { key: "connect", label: "Connect wallet", icon: Wallet },
  { key: "sign", label: "Sign challenge", icon: PenLine },
  { key: "resolving", label: "Resolve DID", icon: Fingerprint },
  { key: "done", label: "Authenticated", icon: CheckCircle2 },
];

export default function AuthPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: { onSuccess: () => setStep("resolving") },
  });
  const [step, setStep] = useState<Step>("connect");

  const currentIndex = steps.findIndex((s) => s.key === step);

  function handleSign() {
    signMessage({ message: CHALLENGE });
  }

  function handleSimulateResolve() {
    setStep("resolving");
    setTimeout(() => {
      setStep("done");
      setTimeout(() => router.push("/dashboard"), 900);
    }, 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-graphite-950 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-5 text-center">
          <Badge tone="signal" className="mx-auto">
            <KeyRound size={12} /> Passwordless by design
          </Badge>
          <h1 className="mt-3 text-[17px] font-medium text-ink-50">Authenticate with your DID</h1>
          <p className="mt-1 text-[13px] text-ink-400">
            No password exists for this account — identity is proven by a wallet-signed challenge, verified
            against your on-chain DID document.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  i < currentIndex
                    ? "border-verified-500/40 bg-verified-500/15 text-verified-400"
                    : i === currentIndex
                      ? "border-signal-500/50 bg-signal-500/15 text-signal-400"
                      : "border-graphite-800 bg-graphite-900 text-ink-600"
                }`}
              >
                <s.icon size={14} />
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-1 h-px flex-1 ${i < currentIndex ? "bg-verified-500/40" : "bg-graphite-800"}`} />
              )}
            </div>
          ))}
        </div>

        {step === "connect" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-center text-[13px] text-ink-400">
              Connect a wallet to begin. This identifies your device — it does not by itself grant access to
              anything; the next step proves you control it.
            </p>
            <w3m-button />
            {isConnected && (
              <Button className="mt-1" onClick={() => setStep("sign")}>
                Continue
              </Button>
            )}
          </div>
        )}

        {step === "sign" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-center text-[13px] text-ink-400">
              Sign this challenge with{" "}
              <span className="mono-value text-ink-200">{address ? truncateMiddle(address, 8, 4) : "your wallet"}</span>{" "}
              to prove ownership — it costs no gas and authorizes nothing on its own.
            </p>
            <pre className="mono-value w-full whitespace-pre-wrap rounded-lg border border-graphite-800 bg-graphite-900 p-3 text-[11px] text-ink-500">
              {CHALLENGE}
            </pre>
            <div className="flex gap-2">
              <Button onClick={handleSign} disabled={isSigning}>
                {isSigning ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                Sign challenge
              </Button>
              <Button variant="secondary" onClick={handleSimulateResolve}>
                Simulate (demo)
              </Button>
            </div>
          </div>
        )}

        {step === "resolving" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={22} className="animate-spin text-signal-400" />
            <p className="text-[13px] text-ink-400">Resolving DID from signature…</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 size={26} className="text-verified-400" />
            <p className="text-[13px] text-ink-200">Authenticated — redirecting to your dashboard…</p>
          </div>
        )}
      </Card>
    </div>
  );
}
