import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("card-surface rounded-2xl p-5", className)}>{children}</div>
  );
}

export function MonoValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("mono-value text-ink-200", className)}>{children}</span>;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid-motif flex flex-col items-center justify-center rounded-2xl border border-graphite-800 bg-graphite-900/40 px-6 py-16 text-center">
      <div className="mb-4 h-10 w-10 rounded-lg border border-graphite-700 bg-graphite-800" />
      <p className="text-[15px] font-medium text-ink-50">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-400">{description}</p>
    </div>
  );
}
