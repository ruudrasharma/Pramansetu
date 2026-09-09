import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Small circular initials avatar — first column of every identity/role/asset table row. */
export function Avatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={cn("mono-value flex shrink-0 items-center justify-center rounded-full bg-signal-500/15 font-semibold text-signal-600", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}
