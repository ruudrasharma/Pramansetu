"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Series = {
  key: string;
  color: "signal" | "sage" | "charcoal";
  label: string;
};

const seriesColorVar: Record<Series["color"], string> = {
  signal: "var(--signal-500)",
  sage: "var(--sage-500)",
  charcoal: "var(--charcoal-500)",
};

/** Floating rounded dark badge rendered at a ReferenceDot's position — the peak-value callout. */
function PeakBadge({ viewBox, text }: { viewBox?: { x?: number; y?: number }; text: string }) {
  if (!viewBox || viewBox.x === undefined || viewBox.y === undefined) return null;
  const width = Math.max(28, text.length * 7 + 16);
  const height = 22;
  const x = viewBox.x - width / 2;
  const y = viewBox.y - height - 12;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={height / 2} fill="var(--charcoal-500)" />
      <text x={viewBox.x} y={y + height / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
        {text}
      </text>
    </g>
  );
}

/**
 * Smooth gradient-fill area chart with a floating dark tooltip badge pinned to the peak of
 * the primary series and a dotted connector down to the axis — the one recurring chart
 * pattern reused across the dashboard volume chart, audit event volume, and anomaly severity.
 */
export function AreaChartCard({
  title,
  subtitle,
  data,
  series,
  valueFormatter = (v: number) => v.toLocaleString(),
  className,
}: {
  title: string;
  subtitle?: string;
  data: Array<Record<string, number | string>>;
  series: Series[];
  valueFormatter?: (v: number) => string;
  className?: string;
}) {
  const primary = series[0];

  const peak = useMemo(() => {
    if (!data.length || !primary) return null;
    let best = data[0]!;
    for (const d of data) {
      if ((d[primary.key] as number) > (best[primary.key] as number)) best = d;
    }
    return best;
  }, [data, primary]);

  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-ink-50">{title}</h3>
          {subtitle && <p className="text-[12px] text-ink-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seriesColorVar[s.color] }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={seriesColorVar[s.color]} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={seriesColorVar[s.color]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={["dataMin - 2", "dataMax + 4"]} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={seriesColorVar[s.color]}
                strokeWidth={2}
                fill={`url(#gradient-${s.key})`}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
            {peak && primary && (
              <>
                <ReferenceLine x={peak.label as string} stroke="var(--graphite-600)" strokeDasharray="3 3" ifOverflow="extendDomain" />
                <ReferenceDot
                  x={peak.label as string}
                  y={peak[primary.key] as number}
                  r={4}
                  fill={seriesColorVar[primary.color]}
                  stroke="var(--graphite-850)"
                  strokeWidth={2}
                  label={<PeakBadge text={valueFormatter(peak[primary.key] as number)} />}
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
