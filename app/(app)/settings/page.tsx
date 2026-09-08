"use client";

import { useState } from "react";
import Link from "next/link";
import { Sun, Bell, Wallet, ShieldCheck, KeyRound, ArrowRight, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { truncateMiddle } from "@/lib/utils";

export default function SettingsPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const [notifyAnomalies, setNotifyAnomalies] = useState(true);
  const [notifyGovernance, setNotifyGovernance] = useState(true);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Settings</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">Appearance, notifications, and security for your identity.</p>
      </div>

      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <Sun size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">Theme</p>
            <p className="text-[12px] text-ink-500">Light, dark, or follow system preference.</p>
          </div>
        </div>
        <ThemeToggle />
      </Card>

      <Card className="mb-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <Bell size={16} strokeWidth={1.75} />
          </div>
          <p className="text-[13px] font-medium text-ink-50">Notifications</p>
        </div>
        <div className="flex items-center justify-between pl-12">
          <span className="text-[13px] text-ink-300">Anomaly alerts</span>
          <Switch checked={notifyAnomalies} onCheckedChange={setNotifyAnomalies} />
        </div>
        <div className="flex items-center justify-between pl-12">
          <span className="text-[13px] text-ink-300">Governance activity</span>
          <Switch checked={notifyGovernance} onCheckedChange={setNotifyGovernance} />
        </div>
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <Wallet size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">Connected wallet</p>
            <p className="mono-value text-[12px] text-ink-500">{truncateMiddle(me.controller, 10, 6)}</p>
          </div>
        </div>
        <w3m-button />
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <ShieldCheck size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">Security</p>
            <p className="text-[12px] text-ink-500">Guardian recovery configuration.</p>
          </div>
        </div>
        <Link href="/identity/recovery" className="flex items-center gap-1 text-[13px] font-medium text-signal-400 hover:text-signal-300">
          Manage guardians <ArrowRight size={13} />
        </Link>
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <Layers size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">Compliance & architecture</p>
            <p className="text-[12px] text-ink-500">Prototype vs. production deployment status.</p>
          </div>
        </div>
        <Link href="/compliance" className="flex items-center gap-1 text-[13px] font-medium text-signal-400 hover:text-signal-300">
          View <ArrowRight size={13} />
        </Link>
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
            <KeyRound size={16} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">Crypto-agility</p>
            <p className="text-[12px] text-ink-500">Signature verification is a swappable contract module.</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge tone="verified">Active</Badge>
            <span className="mono-value text-[13px] text-ink-200">ES256K</span>
          </div>
          <span className="text-[12px] text-ink-600">ECDSASignatureVerifier</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg border border-graphite-800 bg-graphite-900/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge tone="alert">Roadmap</Badge>
            <span className="mono-value text-[13px] text-ink-400">CRYSTALS-Dilithium</span>
          </div>
          <span className="text-[12px] text-ink-600">Dilithium-ready</span>
        </div>
        <p className="mt-3 text-[11px] text-ink-600">
          Every signature check routes through a pluggable <span className="mono-value">ISignatureVerifier</span> —
          migrating to a post-quantum scheme is a contract swap, not a rewrite of the identity graph.
        </p>
      </Card>
    </div>
  );
}
