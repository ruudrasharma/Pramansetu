"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ProgressTone = "signal" | "sage" | "charcoal" | "verified" | "alert" | "danger";

const toneStyles: Record<ProgressTone, string> = {
  signal: "bg-signal-500",
  sage: "bg-sage-500",
  charcoal: "bg-charcoal-500",
  verified: "bg-verified-500",
  alert: "bg-alert-500",
  danger: "bg-danger-500",
};

export type ProgressItem = {
  label: string;
  value: number;
  tone?: ProgressTone;
};

/** Thin, fully-rounded, color-coded progress bars shown as a small stacked list with % labels. */
export function ProgressList({ items, className }: { items: ProgressItem[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((item, i) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-ink-200">{item.label}</span>
            <span className="text-ink-400">{Math.round(item.value)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-700">
            <motion.div
              className={cn("h-full rounded-full", toneStyles[item.tone ?? "signal"])}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, item.value))}%` }}
              transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
