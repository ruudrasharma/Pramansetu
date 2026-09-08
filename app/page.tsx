import Link from "next/link";
import { Fingerprint, ShieldCheck, Boxes, ScrollText, Landmark, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const modules = [
  {
    icon: Fingerprint,
    title: "Decentralized Identity",
    description:
      "Soulbound, guardian-recoverable DIDs replace the centralized IAM database — no single point of compromise, no password to phish.",
  },
  {
    icon: ShieldCheck,
    title: "Time-Bound RBAC",
    description:
      "Roles carry a validity window and expire on-chain automatically. No manual revocation path to forget, no standing access to abuse.",
  },
  {
    icon: Boxes,
    title: "Dual-Attestation Assets",
    description:
      "Every digital asset is minted only after two independent roles co-sign — provenance is enforced by the contract, not a spreadsheet.",
  },
  {
    icon: ScrollText,
    title: "Immutable Audit + Anomaly Detection",
    description:
      "Every state change emits a typed, tamper-proof event. Rule-based detection flags what's unusual — and always names the rule that fired.",
  },
  {
    icon: Landmark,
    title: "Multi-Sig Governance",
    description:
      "No Admin key acts alone. High-value transfers cool off before finalizing, and any Auditor can freeze one mid-window.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-graphite-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="mono-value flex h-8 w-8 items-center justify-center rounded-lg bg-signal-500/15 text-[12px] font-semibold text-signal-400">
            BC
          </div>
          <span className="text-[14px] font-medium text-ink-50">BEL SecureChain</span>
        </div>
        <Link href="/auth">
          <Button variant="secondary">Connect Wallet</Button>
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="signal" className="mx-auto">
            SIH 2026 · PS 26125 · Bharat Electronics Limited
          </Badge>
          <h1 className="mt-5 text-[34px] font-medium leading-tight text-ink-50 sm:text-[44px]">
            Blockchain-based identity, access, and digital asset management — built for defense-sector trust.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-400">
            Replaces centralized IAM with on-chain decentralized identity, enforces RBAC inside smart
            contracts instead of application code, and tracks organizational assets as dual-attested,
            credential-gated NFTs — with an immutable, AI-monitored audit trail and multi-sig governance
            watching every privileged action.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link href="/auth">
              <Button className="px-6 py-3 text-[14px]">
                Connect Wallet <ArrowRight size={15} />
              </Button>
            </Link>
            <div className="flex items-center gap-1.5 text-[12px] text-ink-500">
              <KeyRound size={13} />
              Passwordless by design — no password field exists anywhere in this app.
            </div>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-500/10 text-signal-400">
                <Icon size={17} strokeWidth={1.75} />
              </div>
              <h3 className="text-[14px] font-medium text-ink-50">{title}</h3>
              <p className="text-[13px] leading-relaxed text-ink-400">{description}</p>
            </Card>
          ))}
          <Card className="flex flex-col justify-center gap-2 border-dashed bg-transparent">
            <p className="text-[13px] font-medium text-ink-50">Prototype → production</p>
            <p className="text-[12px] leading-relaxed text-ink-400">
              Deployed today on Ethereum Sepolia testnet; architected with a documented migration path to a
              permissioned Hyperledger Fabric / Polygon Edge chain for BEL&apos;s data-localization needs.
            </p>
            <Link href="/compliance" className="mt-1 flex items-center gap-1 text-[12px] font-medium text-signal-400">
              View architecture <ArrowRight size={12} />
            </Link>
          </Card>
        </div>
      </main>

      <footer className="border-t border-graphite-800 py-6 text-center text-[12px] text-ink-600">
        BEL SecureChain — Blockchain & Cybersecurity · SIH 2026 PS 26125
      </footer>
    </div>
  );
}
