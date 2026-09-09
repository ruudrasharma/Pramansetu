"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { IconBadge } from "@/components/ui/IconBadge";
import { cn } from "@/lib/utils";

function CountUp({ value }: { value: number }) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => rounded.on("change", (v) => {
    if (ref.current) ref.current.textContent = v;
  }), [rounded]);

  return <span ref={ref}>0</span>;
}

/**
 * Dashboard/module stat card — label + icon badge, large value. Numeric values count up on
 * mount; string values (e.g. "Verified", "Operational") render directly, no count-up.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "signal",
  index = 0,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "signal" | "sage" | "charcoal" | "verified" | "alert" | "danger";
  index?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 26, delay: index * 0.04 }}
    >
      <Card className={cn("p-4", className)}>
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-ink-400">{label}</p>
          <IconBadge icon={icon} tone={tone} size={40} />
        </div>
        <p className="mt-3 truncate text-[26px] font-semibold capitalize leading-none text-ink-50">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </p>
      </Card>
    </motion.div>
  );
}
