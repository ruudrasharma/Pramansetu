"use client";

import { useEffect } from "react";
import { OctagonAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-graphite-950 px-4 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-danger-500/25 bg-danger-500/10">
        <OctagonAlert size={24} className="text-danger-400" />
      </div>
      <h1 className="text-[19px] font-medium text-ink-50">Something went wrong on this screen</h1>
      <p className="mt-2 max-w-sm text-[13px] text-ink-400">
        The error was caught client-side and nothing on-chain was affected — no transaction from this
        session was left half-submitted.
      </p>
      {error.digest && <p className="mono-value mt-2 text-[11px] text-ink-600">Digest: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw size={14} /> Try again
      </Button>
    </div>
  );
}
