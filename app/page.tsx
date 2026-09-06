import { auditEvents, systemHealth, identities, governanceItems } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EventRow } from "@/components/modules/EventRow";
import { Fingerprint, Hourglass, Landmark, Octagon } from "lucide-react";

const healthCards = [
  {
    label: "Active identities",
    value: systemHealth.activeIdentities,
    icon: Fingerprint,
    tone: "text-signal-400 bg-signal-500/10",
  },
  {
    label: "Roles expiring < 24h",
    value: systemHealth.expiringIn24h,
    icon: Hourglass,
    tone: "text-alert-400 bg-alert-500/10",
  },
  {
    label: "Pending governance",
    value: systemHealth.pendingGovernance,
    icon: Landmark,
    tone: "text-verified-400 bg-verified-500/10",
  },
  {
    label: "Platform status",
    value: systemHealth.platformPaused ? "Paused" : "Operational",
    icon: Octagon,
    tone: systemHealth.platformPaused
      ? "text-danger-400 bg-danger-500/10"
      : "text-verified-400 bg-verified-500/10",
  },
];

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {healthCards.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-ink-400">{label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={14} strokeWidth={1.75} />
              </div>
            </div>
            <p className="mt-2 text-[26px] font-medium leading-none text-ink-50">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-ink-50">Ledger stream</h2>
            <span className="text-[12px] text-ink-600">Newest first · live from chain events</span>
          </div>
          <div>
            {auditEvents
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((event, i) => (
                <EventRow key={event.id} event={event} index={i} />
              ))}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="mb-3 text-[14px] font-medium text-ink-50">Roles expiring soon</h2>
            <div className="flex flex-col gap-3">
              {identities
                .filter((i) => i.roleExpiresAt > Date.now())
                .sort((a, b) => a.roleExpiresAt - b.roleExpiresAt)
                .slice(0, 3)
                .map((identity) => (
                  <div key={identity.did} className="flex items-center justify-between text-[13px]">
                    <span className="mono-value truncate text-ink-200">
                      {identity.did.slice(0, 14)}…
                    </span>
                    <Badge tone="alert">{identity.role}</Badge>
                  </div>
                ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-[14px] font-medium text-ink-50">Governance queue</h2>
            <div className="flex flex-col gap-3">
              {governanceItems.map((item) => (
                <div key={item.id} className="text-[13px]">
                  <p className="truncate text-ink-200">{item.title}</p>
                  <Badge tone={item.status === "disputed" ? "danger" : "signal"} className="mt-1">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
