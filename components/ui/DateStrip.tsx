"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type DateStripItem = {
  date: Date;
  /** Optional status dot color under the day cell (e.g. a countdown urgency marker). */
  tone?: "verified" | "alert" | "danger";
};

const toneDot: Record<NonNullable<DateStripItem["tone"]>, string> = {
  verified: "bg-verified-500",
  alert: "bg-alert-500",
  danger: "bg-danger-500",
};

/** Horizontal row of rounded-square day cells — active day filled solid in the accent color. */
export function DateStrip({
  items,
  selected,
  onSelect,
  className,
}: {
  items: DateStripItem[];
  selected?: Date;
  onSelect?: (date: Date) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto", className)}>
      {items.map((item) => {
        const isActive = selected && item.date.toDateString() === selected.toDateString();
        return (
          <button
            key={item.date.toISOString()}
            type="button"
            onClick={() => onSelect?.(item.date)}
            className={cn(
              "relative flex h-16 w-12 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-[12px] transition-colors",
              isActive ? "bg-signal-500 text-white" : "bg-graphite-700/50 text-ink-400 hover:bg-graphite-700"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="date-strip-active"
                className="absolute inset-0 rounded-2xl bg-signal-500"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative uppercase tracking-wide opacity-80">
              {item.date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
            </span>
            <span className="relative text-[14px] font-semibold">{item.date.getDate()}</span>
            {item.tone && <span className={cn("relative h-1 w-1 rounded-full", toneDot[item.tone])} />}
          </button>
        );
      })}
    </div>
  );
}
