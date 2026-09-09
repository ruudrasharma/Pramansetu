import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Layers, Server, ShieldCheck, Link2 } from "lucide-react";

const layers = [
  {
    icon: Layers,
    name: "Layer 4 — Application",
    detail: "Next.js App Router UI · wagmi/viem wallet connect · role-aware dashboards",
  },
  {
    icon: Server,
    name: "Layer 3 — Off-Chain Services",
    detail: "Subgraph indexer · anomaly detection service · IPFS metadata store · guardian recovery coordination",
  },
  {
    icon: ShieldCheck,
    name: "Layer 2 — Smart Contracts (trust core)",
    detail: "DIDRegistry · CredentialRegistry · TimeBoundAccessControl · AssetRegistry · GovernanceTimelock · GuardianRecovery",
  },
  {
    icon: Link2,
    name: "Layer 1 — Ledger / Consensus",
    detail: "Swappable — this is the layer that changes between prototype and production",
  },
];

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Compliance & deployment architecture</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Each layer only talks to the layer directly adjacent to it — that discipline is what lets
          Layer 1 be swapped without touching the identity graph, RBAC engine, or UI.
        </p>
      </div>

      <Card className="mb-5">
        <div className="flex flex-col gap-2">
          {layers.map(({ icon: Icon, name, detail }, i) => (
            <div key={name}>
              <div className="flex items-start gap-3 rounded-xl border border-graphite-800 bg-graphite-900 p-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal-500 text-white">
                  <Icon size={15} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-ink-50">{name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-400">{detail}</p>
                </div>
              </div>
              {i < layers.length - 1 && <div className="mx-auto h-3 w-px bg-graphite-700" />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-ink-50">Prototype (current)</h3>
            <Badge tone="signal">Active</Badge>
          </div>
          <ul className="flex flex-col gap-2 text-[13px] text-ink-300">
            <li>• Public EVM testnet — Ethereum Sepolia</li>
            <li>• Public read/write access for demo purposes</li>
            <li>• Subgraph indexer hosted on The Graph&apos;s public service</li>
          </ul>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-ink-50">Production target</h3>
            <Badge tone="neutral">Planned</Badge>
          </div>
          <ul className="flex flex-col gap-2 text-[13px] text-ink-300">
            <li>• Permissioned chain — Hyperledger Fabric or private Polygon Edge</li>
            <li>• Data localization within BEL-controlled infrastructure</li>
            <li>• Self-hosted, re-derivable indexer — no centralized read dependency</li>
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <h3 className="mb-2 text-[13px] font-medium text-ink-50">Explicit non-goals</h3>
        <ul className="flex flex-col gap-1.5 text-[12px] text-ink-500">
          <li>• Not claiming legal enforceability of NFTs under Indian law — the legal-reference field is a hash bridge, not a title.</li>
          <li>• Not shipping production ML anomaly detection in this prototype — rule-based checks only, each naming the rule that fired.</li>
          <li>• Not claiming quantum-proof cryptography — ships a crypto-agile interface (swappable ISignatureVerifier), not a post-quantum scheme.</li>
        </ul>
      </Card>
    </div>
  );
}
