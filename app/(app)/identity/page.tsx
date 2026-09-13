"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  Copy,
  ExternalLink,
  ShieldCheck,
  Lock,
  Loader2,
  CheckCircle2,
  Check,
  Users,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { CredentialCard } from "@/components/modules/CredentialCard";
import { cn, truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identities, ROLE_LABEL } from "@/lib/mock/fixtures";
import { useDidService, type DidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { useHasIssuerRole } from "@/lib/hooks/useCredentialRegistry";
import { dataMode } from "@/lib/services/dataMode";
import { ROLE, useHasRole } from "@/lib/hooks/useAccessControl";
import {
  useCommitmentOf,
  useGroupIdOf,
  useIsMember,
  useRegisterCommitment,
  useSyncMember,
  useRemoveMemberFromRole,
  useVerifyProofOnchain,
} from "@/lib/hooks/useSemaphoreRoleGroups";
import {
  getOrCreateIdentity,
  hasLocalIdentity,
  reconstructGroup,
  proveRole,
  verifyRoleProofLocal,
  toOnchainProof,
  type SemaphoreProof,
  type Identity as SemaphoreIdentityType,
} from "@/lib/services/semaphoreIdentity";

const candidateGuardians = identities.filter((i) => i.credentialStatus === "verified").slice(0, 8);

function RegisterGuardiansCard({ myDid, didService }: { myDid: string; didService: DidService }) {
  const [mockGuardianDids, setMockGuardianDids] = useState<string[]>([]);
  const [onchainAddresses, setOnchainAddresses] = useState("");
  const [threshold, setThreshold] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMockGuardian(did: string) {
    setMockGuardianDids((prev) => (prev.includes(did) ? prev.filter((d) => d !== did) : prev.length < 5 ? [...prev, did] : prev));
  }

  const onchainGuardians = onchainAddresses
    .split(/[\n,]/)
    .map((a) => a.trim())
    .filter(Boolean);
  const guardians = dataMode === "mock" ? mockGuardianDids : onchainGuardians;
  const canSubmit = guardians.length >= 3 && guardians.length <= 5 && threshold >= 1 && threshold <= guardians.length;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await didService.registerGuardians({ guardians, threshold });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register guardians");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-5">
      <div className="mb-3 flex items-center gap-2">
        <IconBadge icon={Users} tone="sage" />
        <div>
          <h3 className="text-[14px] font-medium text-ink-50">Register guardians</h3>
          <p className="text-[12px] text-ink-400">
            No guardian set configured for {truncateMiddle(myDid, 10, 4)} yet — 3–5 guardians who can jointly
            recover this identity if the key is lost.
          </p>
        </div>
      </div>

      {dataMode === "mock" ? (
        <div className="mb-4 grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {candidateGuardians
            .filter((g) => g.did !== myDid)
            .map((g) => {
              const selected = mockGuardianDids.includes(g.did);
              return (
                <button
                  key={g.did}
                  type="button"
                  onClick={() => toggleMockGuardian(g.did)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-[12px] transition-colors",
                    selected ? "border-signal-500/50 bg-signal-500/10" : "border-graphite-800 bg-graphite-900 hover:border-graphite-700"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink-200">{g.name}</p>
                    <p className="truncate text-[11px] text-ink-600">{g.department}</p>
                  </div>
                  {selected && <Check size={14} className="shrink-0 text-signal-400" />}
                </button>
              );
            })}
        </div>
      ) : (
        <div className="mb-4">
          <label className="mb-1.5 block text-[12px] text-ink-500">
            Guardian wallet addresses (3–5, one per line or comma-separated)
          </label>
          <textarea
            value={onchainAddresses}
            onChange={(e) => setOnchainAddresses(e.target.value)}
            placeholder={"0x...\n0x...\n0x..."}
            rows={4}
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value placeholder:text-ink-700 focus:border-signal-500 focus:outline-none"
          />
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-[12px] text-ink-500">Recovery threshold</label>
          <Select value={String(threshold)} onValueChange={(v: string) => setThreshold(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: Math.max(1, guardians.length) }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} of {guardians.length || "N"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="mono-value flex-1 text-[11px] text-ink-600">
          {guardians.length}/5 selected (min. 3)
        </p>
      </div>

      {error && <p className="mb-3 text-[12px] text-danger-400">{error}</p>}

      <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting || didService.isPending}>
        {(isSubmitting || didService.isPending) && <Loader2 size={14} className="animate-spin" />}
        {isSubmitting || didService.isPending ? "Confirming transaction…" : "Register guardians"}
      </Button>

      {didService.isRegisterGuardiansConfirmed && (
        <p className="mt-3 text-[12px] text-verified-400">Guardian set registered.</p>
      )}
    </Card>
  );
}

function CreateIdentityCard({ onCreate }: { onCreate: (input: { name: string; department: string }) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name || !department) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate({ name, department });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create DID");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mb-5">
      <h3 className="mb-1 text-[14px] font-medium text-ink-50">No DID registered for this wallet yet</h3>
      <p className="mb-4 text-[13px] text-ink-400">
        Generates a real keypair client-side and registers its public key on-chain via
        `DIDRegistry.createDID` — this submits a real transaction from your connected wallet.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
        />
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Department"
          className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
        />
      </div>
      {error && <p className="mb-3 text-[12px] text-danger-400">{error}</p>}
      <Button onClick={handleSubmit} disabled={!name || !department || isSubmitting}>
        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
        {isSubmitting ? "Confirming transaction…" : "Create identity"}
      </Button>
    </Card>
  );
}

const ROLE_HASHES: { label: string; hash: `0x${string}` }[] = [
  { label: "SUPER_ADMIN", hash: ROLE.SUPER_ADMIN_ROLE },
  { label: "ADMIN", hash: ROLE.ADMIN_ROLE },
  { label: "MANAGER", hash: ROLE.MANAGER_ROLE },
  { label: "AUDITOR", hash: ROLE.AUDITOR_ROLE },
  { label: "USER", hash: ROLE.USER_ROLE },
];

/**
 * Real zero-knowledge proof-of-role (T-015, gap analysis §2.1.4) — not split by dataMode, since a
 * Semaphore proof is real cryptography against the real connected wallet regardless of whether
 * the rest of the page is showing mock or onchain contract data. Operates on whichever role the
 * REAL connected wallet actually, currently holds (same highest-privilege-first derivation
 * didService.ts's onchain resolveDID already uses) — not the mock role-switcher persona.
 */
function ZkRoleProofCard() {
  // Same hydration-mismatch fix as lib/hooks/useCurrentIdentity.ts: SSR always renders with no
  // wallet state, but wagmi can restore a persisted connection on the client before the first
  // render commits, so `address` here could already differ from what the server sent by the time
  // the `!address` branch below is reconciled — this card calls useAccount() directly instead of
  // going through useCurrentIdentity(), so it wasn't covered by that hook's existing fix.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);
  const { address: rawAddress } = useAccount();
  const address = hasMounted ? rawAddress : undefined;

  // Real, live role checks against the real connected wallet — independent of dataMode/activeRole.
  // Called individually (not via .map()) since React Hooks can't be called inside a callback —
  // the array is fixed-length (ROLE_HASHES never changes), so this is a fixed 5 calls, not a
  // variable-length loop, but the hook itself still has to be invoked directly per Rules of Hooks.
  const hasSuperAdmin = useHasRole(ROLE.SUPER_ADMIN_ROLE, address);
  const hasAdmin = useHasRole(ROLE.ADMIN_ROLE, address);
  const hasManager = useHasRole(ROLE.MANAGER_ROLE, address);
  const hasAuditor = useHasRole(ROLE.AUDITOR_ROLE, address);
  const hasUser = useHasRole(ROLE.USER_ROLE, address);
  const roleChecks = [hasSuperAdmin, hasAdmin, hasManager, hasAuditor, hasUser];
  const heldIndex = roleChecks.findIndex((q) => q.data === true);
  const myRole = heldIndex >= 0 ? ROLE_HASHES[heldIndex] : undefined;

  const { data: commitment } = useCommitmentOf(address);
  const isRegistered = !!commitment && commitment !== 0n;
  const { data: isMemberOfMyRole } = useIsMember(myRole?.hash, address);

  // Surface any stale membership across all 5 groups (a role this wallet no longer holds but is
  // still synced into) — this is what makes the "revoked mid-session, live root not cached"
  // edge case (docs/FEATURES.md F1.4) a real, actionable UI state, not just a comment.
  const memberSuperAdmin = useIsMember(ROLE.SUPER_ADMIN_ROLE, address);
  const memberAdmin = useIsMember(ROLE.ADMIN_ROLE, address);
  const memberManager = useIsMember(ROLE.MANAGER_ROLE, address);
  const memberAuditor = useIsMember(ROLE.AUDITOR_ROLE, address);
  const memberUser = useIsMember(ROLE.USER_ROLE, address);
  const staleChecks = [memberSuperAdmin, memberAdmin, memberManager, memberAuditor, memberUser];
  const staleRoles = ROLE_HASHES.filter((_, i) => staleChecks[i]?.data === true && roleChecks[i]?.data === false);

  const [identity, setIdentity] = useState<SemaphoreIdentityType | null>(null);
  const [proof, setProof] = useState<SemaphoreProof | null>(null);
  const [proving, setProving] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { registerCommitment, isPending: registering } = useRegisterCommitment();
  const { syncMember, isPending: syncing } = useSyncMember();
  const { removeMemberFromRole, isPending: removing } = useRemoveMemberFromRole();

  useEffect(() => {
    setIdentity(null);
    setProof(null);
    if (!address || !hasLocalIdentity(address)) return;
    try {
      setIdentity(getOrCreateIdentity(address));
    } catch {
      // storage unavailable — leave identity null, "Set up" button will surface the same error.
    }
  }, [address]);

  const { data: myGroupId } = useGroupIdOf(myRole?.hash);
  const onchainProof = proof ? toOnchainProof(proof) : undefined;
  const {
    data: onchainValid,
    isLoading: verifyingOnchain,
    error: onchainError,
    refetch: refetchOnchain,
  } = useVerifyProofOnchain(myGroupId, onchainProof);

  async function handleSetUpIdentity() {
    if (!address) return;
    setError(null);
    try {
      setIdentity(getOrCreateIdentity(address));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up a local identity");
    }
  }

  async function handleRegister() {
    if (!identity) return;
    setError(null);
    try {
      registerCommitment(identity.commitment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register commitment");
    }
  }

  async function handleSync() {
    if (!myRole || !address) return;
    setError(null);
    try {
      syncMember({ role: myRole.hash, account: address });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync group membership");
    }
  }

  async function handleProve() {
    if (!identity || !myRole) return;
    setError(null);
    setProving(true);
    setProof(null);
    try {
      const group = await reconstructGroup(myRole.hash);
      const generated = await proveRole(identity, group, myRole.hash);
      const valid = await verifyRoleProofLocal(generated);
      if (!valid) throw new Error("Generated proof did not verify locally — try again.");
      setProof(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate proof");
    } finally {
      setProving(false);
    }
  }

  async function handleCleanUp(role: { label: string; hash: `0x${string}` }) {
    if (!address) return;
    setError(null);
    setCleaning(role.hash);
    try {
      const group = await reconstructGroup(role.hash);
      const index = group.indexOf(commitment ?? 0n);
      if (index === -1) throw new Error("Could not find this commitment in the reconstructed group — try refreshing.");
      const merkleProof = group.generateMerkleProof(index);
      removeMemberFromRole({ role: role.hash, account: address, merkleProofSiblings: merkleProof.siblings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clean up stale membership");
    } finally {
      setCleaning(null);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconBadge icon={ShieldCheck} tone="signal" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-medium text-ink-50">Prove role without revealing identity</h3>
            <Badge tone="verified">Real zero-knowledge proof (Semaphore)</Badge>
          </div>
          <p className="mt-1 max-w-lg text-[13px] text-ink-400">
            Uses your connected wallet and the official Semaphore protocol contract on Sepolia —
            proves membership in a role&apos;s group without revealing which wallet you are. See{" "}
            <code className="mono-value text-[11px]">docs/FEATURES.md</code> F1.4.
          </p>

          {error && (
            <p className="mt-3 rounded-xl border border-danger-500/25 bg-danger-500/[0.04] px-3 py-2 text-[12px] text-danger-400">
              {error}
            </p>
          )}

          {!address ? (
            <p className="mt-3 text-[12px] text-ink-600">Connect a wallet to use this feature.</p>
          ) : !identity ? (
            <Button variant="secondary" className="mt-3" onClick={handleSetUpIdentity}>
              Set up anonymous proof
            </Button>
          ) : !isRegistered ? (
            <Button variant="secondary" className="mt-3" onClick={handleRegister} disabled={registering}>
              {registering && <Loader2 size={14} className="animate-spin" />}
              {registering ? "Registering…" : "Register identity commitment"}
            </Button>
          ) : !myRole ? (
            <p className="mt-3 text-[12px] text-ink-600">
              Your connected wallet doesn&apos;t currently hold a role — nothing to prove yet.
            </p>
          ) : !isMemberOfMyRole ? (
            <Button variant="secondary" className="mt-3" onClick={handleSync} disabled={syncing}>
              {syncing && <Loader2 size={14} className="animate-spin" />}
              {syncing ? "Syncing…" : `Sync ${ROLE_LABEL[myRole.label as keyof typeof ROLE_LABEL] ?? myRole.label} membership`}
            </Button>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleProve} disabled={proving}>
                {proving && <Loader2 size={14} className="animate-spin" />}
                {proof ? <CheckCircle2 size={14} className="text-verified-400" /> : null}
                {proving ? "Generating proof…" : proof ? "Proved (verified locally)" : `Prove ${ROLE_LABEL[myRole.label as keyof typeof ROLE_LABEL] ?? myRole.label} anonymously`}
              </Button>
              {proof && (
                <>
                  <Button variant="secondary" className="px-2.5 py-1 text-[12px]" onClick={() => refetchOnchain()} disabled={verifyingOnchain}>
                    {verifyingOnchain ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : onchainValid === true ? (
                      <CheckCircle2 size={12} className="text-verified-400" />
                    ) : onchainError ? (
                      <AlertTriangle size={12} className="text-danger-400" />
                    ) : (
                      <Eye size={12} />
                    )}
                    {verifyingOnchain
                      ? "Verifying on-chain…"
                      : onchainValid === true
                        ? "Verified on-chain"
                        : onchainError
                          ? "Retry on-chain verify"
                          : "Also verify on-chain"}
                  </Button>
                  {onchainError && !verifyingOnchain && (
                    <p className="w-full text-[11px] text-danger-400">
                      {onchainError instanceof Error ? onchainError.message : "On-chain verification failed."}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {staleRoles.length > 0 && (
            <div className="mt-4 rounded-2xl border border-alert-500/25 bg-alert-500/[0.06] p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-alert-400">
                <AlertTriangle size={13} /> Stale group membership detected
              </p>
              <p className="mt-1 text-[11px] text-ink-500">
                You no longer hold {staleRoles.map((r) => ROLE_LABEL[r.label as keyof typeof ROLE_LABEL] ?? r.label).join(", ")}, but
                your identity is still synced into that group — a proof against the old root stays
                valid until it&apos;s cleaned up (or the root&apos;s grace window elapses).
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {staleRoles.map((role) => (
                  <Button
                    key={role.hash}
                    variant="danger"
                    className="px-2.5 py-1 text-[11px]"
                    onClick={() => handleCleanUp(role)}
                    disabled={removing && cleaning === role.hash}
                  >
                    {removing && cleaning === role.hash && <Loader2 size={12} className="animate-spin" />}
                    Clean up {ROLE_LABEL[role.label as keyof typeof ROLE_LABEL] ?? role.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function IdentityPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, address: myAddress, isResolving: isResolvingMe, hasNoDid } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const me = didService.resolveDID();
  const credentials = didService.listCredentials();
  const guardianSet = didService.getGuardians();
  const { data: hasIssuerRoleOnchain } = useHasIssuerRole(myAddress);
  const isIssuer = dataMode === "onchain" ? !!hasIssuerRoleOnchain : activeRole === "ADMIN" || activeRole === "SUPER_ADMIN";

  if (dataMode === "onchain" && !myDid) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {isResolvingMe ? (
          <Card className="flex items-center gap-2 text-[13px] text-ink-400">
            <Loader2 size={14} className="animate-spin" /> Resolving your identity from the connected wallet…
          </Card>
        ) : hasNoDid ? (
          <CreateIdentityCard onCreate={didService.createDID} />
        ) : (
          <EmptyState title="No wallet connected" description="Connect a wallet to view or create your on-chain identity." />
        )}
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Resolving identity…
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Decentralized identity</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Every user, device, and department is a DID — credential-gated, guardian-recoverable, no
            master identity database.
          </p>
        </div>
        <div className="flex gap-2">
          {isIssuer && (
            <Link href="/identity/issue">
              <Button variant="secondary">Issue credential</Button>
            </Link>
          )}
          <Link href="/identity/recovery">
            <Button variant="secondary">Guardian recovery</Button>
          </Link>
          <Link href="/identity/recovery/guardian">
            <Button variant="secondary">Act as a guardian</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="signal">
            <Lock size={11} /> Soulbound
          </Badge>
          <Badge tone="neutral">{ROLE_LABEL[dataMode === "onchain" ? me.role : activeRole]}</Badge>
          <Badge tone={me.credentialStatus === "verified" ? "verified" : me.credentialStatus === "pending" ? "alert" : "danger"}>
            {me.credentialStatus}
          </Badge>
        </div>

        <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">DID</p>
        <div className="mb-4 flex items-center gap-2">
          <span className="mono-value break-all text-[14px] text-ink-100">{me.did}</span>
          <button aria-label="Copy DID" className="shrink-0 text-ink-600 hover:text-ink-300">
            <Copy size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Controller</p>
            <span className="mono-value text-[13px] text-ink-200">{truncateMiddle(me.controller, 10, 6)}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Created</p>
            <span className="text-[13px] text-ink-200">{new Date(me.createdAt).toLocaleDateString("en-US")}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Key type</p>
            <span className="mono-value text-[13px] text-ink-200">{me.keyType}</span>
          </div>
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Guardians</p>
            <span className="text-[13px] text-ink-200">{guardianSet ? `${guardianSet.guardians.length}` : "0"} configured</span>
          </div>
        </div>

        <a
          href={`https://sepolia.etherscan.io/address/${me.controller}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-signal-400 hover:text-signal-300"
        >
          View on-chain <ExternalLink size={12} />
        </a>
      </Card>

      {!guardianSet && <RegisterGuardiansCard myDid={me.did} didService={didService} />}

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {credentials.length === 0 ? (
          <Card className="sm:col-span-2 text-[13px] text-ink-500">No credentials issued yet.</Card>
        ) : (
          credentials.map((c) => <CredentialCard key={c.vcId} credential={c} />)
        )}
      </div>

      <ZkRoleProofCard />
    </div>
  );
}
