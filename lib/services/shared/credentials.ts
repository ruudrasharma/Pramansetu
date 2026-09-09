/**
 * lib/services/shared/credentials.ts — shared between didService.ts and rbacService.ts (and
 * any future service that needs to adapt a subgraph Credential into the mock Credential shape,
 * or derive a credentialStatus/role from a real credential list). Kept here instead of
 * duplicated per-service, or imported service-to-service.
 */

import type { Credential, Identity, Role } from "@/lib/mock/fixtures";

export interface RawCredential {
  id: string;
  issuerDid: string;
  vcHash: string;
  role: string;
  validUntil: string;
  revoked: boolean;
  issuedAt: string;
}

export function adaptCredentials(did: string, raw: RawCredential[]): Credential[] {
  return raw.map((c) => ({
    vcId: c.id,
    subjectDid: did,
    issuerDid: c.issuerDid,
    vcHash: c.vcHash,
    // Real free-text from CredentialRegistry.issueCredential's `role` string param — not
    // validated against the mock's 5-value Role union at runtime (no real credential has been
    // issued through this app yet to establish the real convention against). Display-only in
    // most callers, so a mismatched string here is inert, not misleading.
    role: c.role as Role,
    validUntil: Number(c.validUntil) * 1000,
    revoked: c.revoked,
  }));
}

/** Assumes `credentials` is already ordered most-recent-first (GET_CREDENTIALS_BY_SUBJECT and
 * GET_IDENTITIES both order by issuedAt desc). */
export function deriveCredentialStatus(credentials: Credential[]): Identity["credentialStatus"] {
  if (credentials.length === 0) return "pending";
  const now = Date.now();
  if (credentials.some((c) => !c.revoked && c.validUntil > now)) return "verified";
  return credentials[0]?.revoked ? "revoked" : "pending";
}

/** The role of whichever credential is currently valid (or, failing that, most recent) —
 * "USER" is an honest default absent any credential, not a claim that USER_ROLE was granted. */
export function deriveRoleFromCredentials(credentials: Credential[]): Role {
  const now = Date.now();
  const valid = credentials.find((c) => !c.revoked && c.validUntil > now);
  return (valid ?? credentials[0])?.role ?? "USER";
}
