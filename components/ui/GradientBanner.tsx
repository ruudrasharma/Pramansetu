import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rich gradient promo/banner card — used for onboarding steps and "what's next" prompts. */
export function GradientBanner({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  learnMoreHref,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  learnMoreHref?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 text-white",
        "bg-[linear-gradient(135deg,var(--sage-600)_0%,var(--charcoal-500)_100%)]",
        className
      )}
    >
      {learnMoreHref && (
        <a
          href={learnMoreHref}
          className="absolute right-5 top-5 flex items-center gap-1 text-[12px] font-medium text-white/80 hover:text-white"
        >
          Learn more
          <ArrowUpRight size={13} />
        </a>
      )}
      {eyebrow && <p className="text-[12px] font-medium uppercase tracking-wide text-white/70">{eyebrow}</p>}
      <h3 className="mt-1.5 max-w-md text-[19px] font-semibold leading-snug">{title}</h3>
      <p className="mt-1.5 max-w-md text-[13px] text-white/75">{description}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white backdrop-blur transition-colors hover:bg-white/25"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
