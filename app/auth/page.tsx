"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { KeyRound, Wallet, PenLine, Fingerprint, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { truncateMiddle } from "@/lib/utils";
import { dataMode } from "@/lib/services/dataMode";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";

type Step = "connect" | "sign" | "resolving" | "done";

const CHALLENGE = `Praman Setu — sign to authenticate.\nNonce: ${Date.now().toString(36)}\nNo password was ever created for this account.`;

const steps: { key: Step; label: string; icon: typeof Wallet }[] = [
  { key: "connect", label: "Connect wallet", icon: Wallet },
  { key: "sign", label: "Sign challenge", icon: PenLine },
  { key: "resolving", label: "Resolve DID", icon: Fingerprint },
  { key: "done", label: "Authenticated", icon: CheckCircle2 },
];

export default function AuthPage() {
  const router = useRouter();
  // Same hydration-mismatch fix as lib/hooks/useCurrentIdentity.ts (see its comment for the full
  // explanation): SSR always renders with no wallet state, but wagmi restores a persisted
  // connection on the client often before React's first client render even commits, so
  // isConnected/address here could already differ from what the server sent. That mismatch is
  // exactly what threw the React hydration errors (#418/#423) confirmed live on this page — React
  // discards and fully re-renders the tree when it hits one, which is what full-page "auto
  // reload" flicker looks like from the outside. This page called useAccount() directly instead of
  // going through useCurrentIdentity(), so it wasn't covered by that hook's existing fix.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);
  const { isConnected: rawIsConnected, address: rawAddress } = useAccount();
  const isConnected = hasMounted && rawIsConnected;
  const address = hasMounted ? rawAddress : undefined;
  // No onError handler previously existed here — a rejected/failed signature (wallet locked,
  // permission revoked, user hit Reject) left the user stuck on this step with zero feedback,
  // indistinguishable from the button doing nothing. That's what "connecting doesn't take me to
  // the dashboard" looks like from the outside: the flow never reaches the resolving/redirect
  // step at all, silently.
  const [signError, setSignError] = useState<string | null>(null);
  const { signMessage, isPending: isSigning } = useSignMessage({
    mutation: {
      onSuccess: () => setStep("resolving"),
      onError: (err) => setSignError(err instanceof Error ? err.message : "Signature request failed."),
    },
  });
  const [step, setStep] = useState<Step>("connect");
  // T-045: this is what actually resolves the "resolving" step — didOf(address) only needs the
  // connected address (not the signature itself; there's no on-chain/server-side signature
  // verification anywhere in this flow, matching how the rest of the app treats a connected
  // wallet as proof of key control). Mode-aware for free: mock personas resolve instantly with
  // isResolving=false/hasNoDid=false by construction, so this same effect closes the dead-end in
  // both data modes, not just onchain.
  const { did: myDid, isResolving: isResolvingIdentity, hasNoDid } = useCurrentIdentity();

  const currentIndex = steps.findIndex((s) => s.key === step);

  function handleSign() {
    setSignError(null);
    signMessage({ message: CHALLENGE });
  }

  useEffect(() => {
    if (step !== "resolving" || isResolvingIdentity || !myDid) return;
    setStep("done");
    const t = setTimeout(() => router.push("/dashboard"), 900);
    return () => clearTimeout(t);
  }, [step, isResolvingIdentity, myDid, router]);

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
            <pre className="mono-value w-full whitespace-pre-wrap rounded-xl border border-graphite-800 bg-graphite-900 p-3 text-[11px] text-ink-500">
              {CHALLENGE}
            </pre>
            <div className="flex gap-2">
              <Button onClick={handleSign} disabled={isSigning}>
                {isSigning ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                Sign challenge
              </Button>
              {dataMode === "mock" && (
                <Button variant="secondary" onClick={handleSimulateResolve}>
                  Simulate (demo)
                </Button>
              )}
            </div>
            {signError && (
              <p className="text-center text-[12px] text-danger-400">
                {signError} — check your wallet for a pending request, or try again.
              </p>
            )}
          </div>
        )}

        {step === "resolving" && (
          <div className="flex flex-col items-center gap-3 py-8">
            {hasNoDid ? (
              <>
                <Fingerprint size={22} className="text-alert-400" />
                <p className="text-center text-[13px] text-ink-200">
                  Signature verified, but no DID is registered for{" "}
                  <span className="mono-value">{address ? truncateMiddle(address, 8, 4) : "this wallet"}</span> yet —
                  there&apos;s no identity document to authenticate against.
                </p>
                <Link href="/identity">
                  <Button className="mt-1">
                    <UserPlus size={14} /> Create your identity
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Loader2 size={22} className="animate-spin text-signal-400" />
                <p className="text-[13px] text-ink-400">Resolving DID from signature…</p>
              </>
            )}
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
