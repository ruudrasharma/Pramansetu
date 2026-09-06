import { cn } from "@/lib/utils";

type BadgeTone = "verified" | "alert" | "danger" | "neutral" | "signal";

const toneStyles: Record<BadgeTone, string> = {
  verified: "bg-verified-500/12 text-verified-400 border-verified-500/25",
  alert: "bg-alert-500/12 text-alert-400 border-alert-500/25",
  danger: "bg-danger-500/12 text-danger-400 border-danger-500/25",
  neutral: "bg-graphite-800 text-ink-400 border-graphite-700",
  signal: "bg-signal-500/12 text-signal-400 border-signal-500/25",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] font-medium",
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
