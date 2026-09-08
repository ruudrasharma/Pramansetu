"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Animated sun/moon theme toggle. Renders a neutral placeholder until mounted so the
 * server-rendered markup never has to guess the resolved theme (avoids hydration mismatch).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-graphite-800 bg-graphite-700 transition-colors duration-150",
        className
      )}
    >
      <motion.span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-graphite-950 text-ink-50 shadow-panel"
        animate={{ x: isDark ? 22 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      >
        {mounted && (isDark ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />)}
      </motion.span>
    </button>
  );
}
