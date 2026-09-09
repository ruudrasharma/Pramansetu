"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function breakdown(ms: number) {
  const clamped = Math.max(0, ms);
  const hrs = Math.floor(clamped / 3_600_000);
  const mins = Math.floor((clamped % 3_600_000) / 60_000);
  const secs = Math.floor((clamped % 60_000) / 1000);
  return { hrs, mins, secs };
}

/** A live, ticking cooling-off countdown — used on Governance/Disputes so "24-48h timelock"
 * reads as a real clock, not a static label. Ticks every second while mounted. */
export function TimelockCountdown({ eta, size = "md" }: { eta: number; size?: "sm" | "md" | "lg" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = eta - now;
  const expired = remaining <= 0;
  const { hrs, mins, secs } = breakdown(remaining);

  const unitClass = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[15px]" : "text-[20px]";

  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("mono-value font-medium tabular-nums", unitClass, expired ? "text-danger-400" : "text-ink-50")}>
        {expired ? "cooling-off ended" : `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`}
      </span>
    </div>
  );
}
