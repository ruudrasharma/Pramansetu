import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconBadgeTone = "signal" | "sage" | "charcoal" | "verified" | "alert" | "danger";

const toneStyles: Record<IconBadgeTone, string> = {
  signal: "bg-signal-500",
  sage: "bg-sage-500",
  charcoal: "bg-charcoal-500",
  verified: "bg-verified-500",
  alert: "bg-alert-500",
  danger: "bg-danger-500",
};

/** Small solid-fill circular icon badge — the icon-context pattern used on every stat card and list row. */
export function IconBadge({
  icon: Icon,
  tone = "signal",
  size = 40,
  className,
}: {
  icon: LucideIcon;
  tone?: IconBadgeTone;
  size?: 32 | 40 | 48;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full text-white", toneStyles[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.45} strokeWidth={1.75} />
    </div>
  );
}
