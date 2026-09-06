import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-signal-500 text-white hover:bg-signal-600 disabled:bg-graphite-700 disabled:text-ink-600",
  secondary:
    "bg-graphite-800 text-ink-50 border border-graphite-700 hover:border-graphite-600 hover:bg-graphite-700 disabled:text-ink-600",
  danger:
    "bg-danger-500/12 text-danger-400 border border-danger-500/30 hover:bg-danger-500/20 disabled:text-ink-600",
  ghost: "text-ink-400 hover:bg-graphite-800 hover:text-ink-200",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";
