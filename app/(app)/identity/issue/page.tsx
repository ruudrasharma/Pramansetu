"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { useAppStore } from "@/lib/store/appStore";
import { identities, ROLE_LABEL, type Role } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { useHasIssuerRole } from "@/lib/hooks/useCredentialRegistry";
import { dataMode } from "@/lib/services/dataMode";

const issuableRoles: Role[] = ["USER", "AUDITOR", "MANAGER", "ADMIN"];

const validityOptions = [
  { label: "90 days", ms: 90 * 24 * 3_600_000 },
  { label: "1 year", ms: 365 * 24 * 3_600_000 },
  { label: "2 years", ms: 2 * 365 * 24 * 3_600_000 },
];

/**
 * /identity/issue — F1.2 Credential Issuance (docs/FEATURES.md). Closes the last unimplemented
 * step of the onboarding workflow (Complete_Solution_Document.pdf §9.1 step 5): before this page
 * existed, `useIssueCredential` (lib/hooks/useCredentialRegistry.ts) had zero callers anywhere in
 * the app, so there was no way through the product itself to issue a real credential — see
 * TODO.md's original T-036/audit §4.1 finding.
 */
export default function IssueCredentialPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, address: myAddress } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const { data: hasIssuerRoleOnchain, isLoading: isCheckingIssuer } = useHasIssuerRole(myAddress);

  // ISSUER_ROLE lives on CredentialRegistry, not the 5-role RBAC hierarchy TimeBoundAccessControl
  // enforces (see useCredentialRegistry.ts's note) — mock mode has no dedicated issuer persona,
  // so Admin/Super Admin stand in, matching docs/FEATURES.md F1.2's "Admin/HR only".
  const isIssuer = dataMode === "onchain" ? !!hasIssuerRoleOnchain : activeRole === "ADMIN" || activeRole === "SUPER_ADMIN";

  const [subjectDid, setSubjectDid] = useState(dataMode === "mock" ? (identities[0]?.did ?? "") : "");
  const [role, setRole] = useState<Role>("USER");
  const [validityMs, setValidityMs] = useState(validityOptions[1]!.ms);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!subjectDid) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await didService.issueCredential({ subjectDid, role, validUntil: Date.now() + validityMs });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to issue credential");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (dataMode === "onchain" && isCheckingIssuer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Checking ISSUER_ROLE on CredentialRegistry…
        </Card>
      </div>
    );
  }

  if (!isIssuer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <EmptyState
          title="ISSUER_ROLE required"
          description="Only an authorized issuer (Admin/HR, per docs/FEATURES.md F1.2) can issue Verifiable Credentials. Ask a Super Admin to grant ISSUER_ROLE on CredentialRegistry."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Issue a Verifiable Credential</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Binds a subject DID to a role for a fixed validity window — the credential that{" "}
          <span className="mono-value">AssetRegistry</span> transfers depend on being non-revoked. See{" "}
          <Link href="/identity" className="underline underline-offset-2">
            Identity
          </Link>
          .
        </p>
      </div>

      <Card>
        {dataMode === "mock" ? (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] text-ink-500">Subject identity</label>
            <Select value={subjectDid} onValueChange={setSubjectDid}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {identities.map((i) => (
                  <SelectItem key={i.did} value={i.did}>
                    {i.name} — {i.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] text-ink-500">Subject DID (bytes32)</label>
            <input
              value={subjectDid}
              onChange={(e) => setSubjectDid(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
            />
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Role</label>
            <Select value={role} onValueChange={(v: string) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {issuableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Validity</label>
            <Select value={String(validityMs)} onValueChange={(v: string) => setValidityMs(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validityOptions.map((v) => (
                  <SelectItem key={v.label} value={String(v.ms)}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {actionError && <p className="mb-3 text-[12px] text-danger-400">{actionError}</p>}

        <Button onClick={handleSubmit} disabled={!subjectDid || isSubmitting || didService.isPending}>
          {(isSubmitting || didService.isPending) && <Loader2 size={14} className="animate-spin" />}
          <UserPlus size={14} />
          {isSubmitting || didService.isPending ? "Confirming transaction…" : "Issue credential"}
        </Button>

        {didService.isIssueConfirmed && didService.lastIssuedVcId && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-verified-500/25 bg-verified-500/10 px-3 py-2 text-[12px] text-verified-400">
            <CheckCircle2 size={14} />
            Issued — vcId <span className="mono-value">{didService.lastIssuedVcId}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
