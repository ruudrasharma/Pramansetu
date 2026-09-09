"use client";

import { expiryLevel, formatCountdown } from "@/lib/utils";

const levelColor: Record<string, string> = {
  safe: "var(--verified-500)",
  warning: "var(--alert-500)",
  critical: "var(--danger-500)",
  expired: "var(--ink-600)",
};

/**
 * Makes "time-bound" tangible: a depleting ring rather than a static badge. Percentage is a rough
 * visual proxy (not literally proportional to the original grant window, since that varies per
 * grant) — the ring's job is to communicate urgency tier at a glance, with the exact countdown in
 * mono text underneath for the precise value.
 */
export function ExpiryRing({ expiresAt, size = 40 }: { expiresAt: number; size?: number }) {
  const level = expiryLevel(expiresAt);
  const color = levelColor[level];
  const pct = level === "safe" ? 0.85 : level === "warning" ? 0.45 : level === "critical" ? 0.15 : 0;
  const circumference = 2 * Math.PI * ((size - 6) / 2);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 6) / 2}
          fill="none"
          stroke="var(--graphite-700)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - 6) / 2}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <span className="mono-value text-[12px] text-ink-400">{formatCountdown(expiresAt)}</span>
    </div>
  );
}
