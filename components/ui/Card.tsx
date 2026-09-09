import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "card-surface rounded-3xl p-5",
        interactive && "cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      {...rest}
    >
      {children}
    </div>
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
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid-motif flex flex-col items-center justify-center rounded-3xl border border-graphite-800 bg-graphite-900/40 px-6 py-16 text-center">
      <div className="mb-4 h-10 w-10 rounded-full border border-graphite-700 bg-graphite-800" />
      <p className="text-[15px] font-medium text-ink-50">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-danger-500/25 bg-danger-500/[0.04] px-6 py-16 text-center">
      <div className="mb-4 h-10 w-10 rounded-full border border-danger-500/30 bg-danger-500/10" />
      <p className="text-[15px] font-medium text-ink-50">{title}</p>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
