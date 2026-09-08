import { Badge } from "@/components/ui/Badge";
import { ExpiryRing } from "@/components/modules/ExpiryRing";
import { ROLE_LABEL, type Role } from "@/lib/mock/fixtures";
import { expiryLevel } from "@/lib/utils";
import { cn } from "@/lib/utils";

const roleTone: Record<Role, "signal" | "verified" | "alert" | "neutral" | "danger"> = {
  SUPER_ADMIN: "danger",
  ADMIN: "signal",
  MANAGER: "verified",
  AUDITOR: "alert",
  USER: "neutral",
};

/** Role name + colored countdown ring — the visual anchor for "roles carry a validity
 * window and silently expire on-chain" (brief's differentiator, made literal per-badge). */
export function RoleBadge({ role, expiresAt, size = "md" }: { role: Role; expiresAt: number; size?: "sm" | "md" }) {
  const level = expiryLevel(expiresAt);
  return (
    <div className="flex items-center gap-2.5">
      <Badge tone={roleTone[role]} className={cn(level === "expired" && "opacity-50")}>
        {ROLE_LABEL[role]}
      </Badge>
      <ExpiryRing expiresAt={expiresAt} size={size === "sm" ? 26 : 34} />
    </div>
  );
}
