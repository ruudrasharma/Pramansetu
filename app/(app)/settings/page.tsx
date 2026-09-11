"use client";

import { useState } from "react";
import Link from "next/link";
import { Sun, Bell, Wallet, ShieldCheck, KeyRound, ArrowRight, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconBadge } from "@/components/ui/IconBadge";
import { Switch } from "@/components/ui/Switch";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { truncateMiddle } from "@/lib/utils";

export default function SettingsPage() {
  // Was unconditionally identityByRole[activeRole] (the mock-fixture persona's address) — showed
  // a fabricated wallet address regardless of what was actually connected, the exact same
  // dishonesty T-064 already fixed on /dashboard. useCurrentIdentity() is the same real
  // address/DID resolution TopBar.tsx already gets right for this card.
  const { address: myAddress } = useCurrentIdentity();
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
          <IconBadge icon={Sun} tone="signal" />
          <div>
            <p className="text-[13px] font-medium text-ink-50">Theme</p>
            <p className="text-[12px] text-ink-500">Light by default — switch to dark anytime.</p>
          </div>
        </div>
        <ThemeToggle />
      </Card>

      <Card className="mb-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <IconBadge icon={Bell} tone="alert" />
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
          <IconBadge icon={Wallet} tone="sage" />
          <div>
            <p className="text-[13px] font-medium text-ink-50">Connected wallet</p>
            <p className="mono-value text-[12px] text-ink-500">
              {myAddress ? truncateMiddle(myAddress, 10, 6) : "Not connected"}
            </p>
          </div>
        </div>
        <w3m-button />
      </Card>

      <Card className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBadge icon={ShieldCheck} tone="charcoal" />
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
          <IconBadge icon={Layers} tone="signal" />
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
          <IconBadge icon={KeyRound} tone="sage" />
          <div>
            <p className="text-[13px] font-medium text-ink-50">Crypto-agility</p>
            <p className="text-[12px] text-ink-500">Signature verification is a swappable contract module.</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Badge tone="verified">Active</Badge>
            <span className="mono-value text-[13px] text-ink-200">ES256K</span>
          </div>
          <span className="text-[12px] text-ink-600">ECDSASignatureVerifier</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-graphite-800 bg-graphite-900/40 px-3 py-2.5">
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
