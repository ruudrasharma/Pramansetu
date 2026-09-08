import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid-motif flex min-h-screen flex-col items-center justify-center bg-graphite-950 px-4 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-graphite-800 bg-graphite-900">
        <Compass size={24} className="text-signal-400" />
      </div>
      <p className="mono-value text-[13px] text-ink-600">404</p>
      <h1 className="mt-1 text-[19px] font-medium text-ink-50">This route doesn&apos;t exist on-chain — or off it.</h1>
      <p className="mt-2 max-w-sm text-[13px] text-ink-400">
        The page you&apos;re looking for was moved, renamed, or never existed. Check the sidebar, or head
        back to your dashboard.
      </p>
      <Link href="/dashboard" className="mt-6">
        <Button>
          Go to dashboard <ArrowRight size={14} />
        </Button>
      </Link>
    </div>
  );
}
