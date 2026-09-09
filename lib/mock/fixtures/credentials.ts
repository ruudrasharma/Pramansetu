// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock verifiable-credential fixtures — mirrors contracts/CredentialRegistry.sol's Credential
 * struct (subjectDid, issuerDid, vcHash, role, validUntil, revoked). One credential per identity.
 */

import { identities, type Role } from "./identities";

export interface Credential {
  vcId: string;
  subjectDid: string;
  issuerDid: string;
  vcHash: string;
  role: Role;
  validUntil: number;
  revoked: boolean;
}

const issuers = [identities[0].did, identities[3].did]; // Super Admin + HR Admin issue credentials

export const credentials: Credential[] = identities.map((subject, i) => ({
  vcId: `vc-${(1000 + i).toString(16)}`,
  subjectDid: subject.did,
  issuerDid: issuers[i % issuers.length],
  vcHash: `0x${(i + 1).toString(16).padStart(4, "0")}${"a1b2c3d4e5f60718".slice(0, 56)}`,
  role: subject.role,
  validUntil: subject.roleExpiresAt,
  revoked: subject.credentialStatus === "revoked",
}));

export function credentialForDid(did: string): Credential | undefined {
  return credentials.find((c) => c.subjectDid === did);
}
