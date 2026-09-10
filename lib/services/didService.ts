"use client";

/**
 * lib/services/didService.ts — Decentralized Identity & Verifiable Credentials (M1).
 * Components import ONLY `useDidService` — never the mock/onchain implementation below it.
 *
 * `useDidService` takes the *subject* did as a parameter (not the returned functions) because
 * resolveDID/listCredentials/getGuardians are backed by wagmi/react-query hooks in onchain mode,
 * and hooks can only be called with concrete args at the top of this function — not inside a
 * closure invoked later with an arbitrary did chosen at call time. Every current caller already
 * resolves exactly one did per render (their own, via useCurrentIdentity()), so this isn't a
 * loss of capability, just an honest reflection of how the real reads actually work.
 */

import { useState } from "react";
import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { credentialForDid, guardianSetFor, findIdentity, type Identity, type Credential, type GuardianSet, type Role } from "@/lib/mock/fixtures";
import { useCreateDID as useCreateDIDOnchain, useResolveDID } from "@/lib/hooks/useDIDRegistry";
import { ROLE, useHasRole } from "@/lib/hooks/useAccessControl";
import { useRecoveryThreshold, useGuardiansList } from "@/lib/hooks/useGuardianRecovery";
import {
  useInitiateRecovery as useInitiateRecoveryOnchain,
  useSignRecovery as useSignRecoveryOnchain,
  useFinalizeRecovery as useFinalizeRecoveryOnchain,
} from "@/lib/hooks/useGuardianRecovery";
import { useIssueCredential as useIssueCredentialOnchain } from "@/lib/hooks/useCredentialRegistry";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_CREDENTIALS_BY_SUBJECT } from "@/lib/queries";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, encodePacked } from "viem";
import { adaptCredentials, deriveCredentialStatus, type RawCredential } from "@/lib/services/shared/credentials";

export interface DidService {
  resolveDID: () => Identity | undefined;
  listCredentials: () => Credential[];
  getGuardians: () => GuardianSet | undefined;
  createDID: (input: { name: string; department: string }) => void;
  /** Not implemented in onchain mode yet — see TODO.md T-025/T-039. Throws there. */
  initiateRecovery: (did: string, initiatedBy: string) => void;
  /** Not implemented in onchain mode yet — see TODO.md T-039. Throws there. */
  signRecovery: (did: string, guardianDid: string) => void;
  /** Not implemented in onchain mode yet — see TODO.md T-039. Throws there. */
  finalizeRecovery: (did: string) => void;
  /** Issue a Verifiable Credential to `subjectDid`, signed as the issuer this service was
   * instantiated for (the `did` passed into `useDidService`). Requires ISSUER_ROLE on
   * CredentialRegistry in onchain mode — checked by the caller UI via `useHasIssuerRole`, not
   * re-checked here (the contract itself is the real enforcement boundary either way). */
  issueCredential: (input: { subjectDid: string; role: Role; validUntil: number }) => void;
  /** The real vcId from the last issueCredential call — resolves instantly in mock mode, only
   * once the real transaction confirms onchain (decoded from the CredentialIssued log). */
  lastIssuedVcId: string | undefined;
  isIssueConfirmed: boolean;
  isPending: boolean;
  /** True while a real onchain read backing resolveDID/listCredentials/getGuardians is still
   * in flight — lets callers show a loading state instead of misreading "still loading" as
   * "not found." Always false in mock mode (fixture lookups are synchronous). */
  isResolving: boolean;
}

function useMockDidService(did: string | undefined): DidService {
  const store = useMockDataStore();
  const [lastIssuedVcId, setLastIssuedVcId] = useState<string | undefined>(undefined);

  return {
    resolveDID: () => (did ? findIdentity(did) : undefined),
    listCredentials: () => {
      if (!did) return [];
      const c = credentialForDid(did);
      return c ? [c] : [];
    },
    getGuardians: () => (did ? guardianSetFor(did) : undefined),
    createDID: () => {
      store.logEvent("DIDCreated", "self", "New DID registered — credential issuance pending");
    },
    initiateRecovery: store.initiateRecovery,
    signRecovery: store.signRecovery,
    finalizeRecovery: store.finalizeRecovery,
    issueCredential: ({ subjectDid, role, validUntil }) => {
      const credential = store.issueCredential({ subjectDid, issuerDid: did ?? "unknown-issuer", role, validUntil });
      setLastIssuedVcId(credential.vcId);
    },
    lastIssuedVcId,
    isIssueConfirmed: lastIssuedVcId !== undefined,
    isPending: false,
    isResolving: false,
  };
}

function useCredentialsQuery(did: string | undefined) {
  return useQuery({
    queryKey: ["credentials", did],
    queryFn: async () => {
      const data = await getGraphQLClient().request<{ credentials: RawCredential[] }>(GET_CREDENTIALS_BY_SUBJECT, {
        subject: did,
      });
      return data.credentials;
    },
    enabled: !!did,
  });
}

function useOnchainDidService(did: string | undefined): DidService {
  const bytes32Did = did as `0x${string}` | undefined;

  const { data: doc, isLoading: isLoadingDoc } = useResolveDID(bytes32Did);
  const controller = doc?.exists ? doc.controller : undefined;

  const credentialsQuery = useCredentialsQuery(did);
  const credentials = did && credentialsQuery.data ? adaptCredentials(did, credentialsQuery.data) : [];

  // Real role derivation: check all 5 roles against the resolved controller and take the
  // highest-privilege one held. Nothing currently reads `.role` off resolveDID's result (the
  // identity page's role badge reads the demo activeRole store, not this), but it's cheap and
  // genuinely correct rather than a placeholder, so future callers get a real answer.
  const { data: isSuperAdmin } = useHasRole(ROLE.SUPER_ADMIN_ROLE, controller);
  const { data: isAdmin } = useHasRole(ROLE.ADMIN_ROLE, controller);
  const { data: isManager } = useHasRole(ROLE.MANAGER_ROLE, controller);
  const { data: isAuditor } = useHasRole(ROLE.AUDITOR_ROLE, controller);
  const derivedRole: Role = isSuperAdmin ? "SUPER_ADMIN" : isAdmin ? "ADMIN" : isManager ? "MANAGER" : isAuditor ? "AUDITOR" : "USER";

  const { data: threshold } = useRecoveryThreshold(bytes32Did);
  const guardiansQuery = useGuardiansList(bytes32Did);
  // useActiveRecovery isn't called here: its real shape (confirmed against the compiled ABI)
  // has no signer list or initiator, so there's nothing honest to build from it yet without
  // an event/subgraph source (see the getGuardians comment below and TODO.md T-023).

  const { createDID: createDIDOnchain, isPending: isCreating } = useCreateDIDOnchain();
  const { isPending: isInitiating } = useInitiateRecoveryOnchain();
  const { isPending: isSigning } = useSignRecoveryOnchain();
  const { isPending: isFinalizing } = useFinalizeRecoveryOnchain();
  const { issueCredential: issueCredentialOnchain, vcId: lastIssuedVcId, isSuccess: isIssueConfirmed, isPending: isIssuing } = useIssueCredentialOnchain();

  return {
    resolveDID: () => {
      if (!doc?.exists || !did) return undefined;
      return {
        did,
        controller: doc.controller,
        keyType: doc.keyType as Identity["keyType"],
        // Not populated: would need fetching metadataURI's ipfs:// content, and no current
        // caller reads these two fields off resolveDID's result (see TODO.md T-021).
        name: "",
        department: "",
        createdAt: Number(doc.createdAt) * 1000,
        role: derivedRole,
        credentialStatus: deriveCredentialStatus(credentials),
        // Not populated here — see getGuardians().guardians.length instead (TODO.md T-021).
        guardianCount: 0,
        // Not populated — no current caller reads this off resolveDID's result either.
        roleExpiresAt: 0,
      };
    },
    listCredentials: () => credentials,
    getGuardians: () => {
      if (!did || !guardiansQuery.data || guardiansQuery.data.length === 0) return undefined;
      // activeRecovery's real shape (confirmed against the compiled ABI, not guessed) is
      // { newController, newPubKey, initiatedAt, finalized } — no `signers` array (Solidity's
      // auto-getter omits dynamic-array struct members) and no `initiatedBy` (only emitted in
      // the RecoveryInitiated event, never stored). Signer count / who-initiated therefore
      // need an event/subgraph source that doesn't exist yet — see TODO.md T-023. Rather than
      // guess a signer count, activeRecovery is left undefined here until that's built; this is
      // consistent with initiateRecovery itself being stopgapped this session.
      return {
        did,
        guardians: guardiansQuery.data,
        threshold: threshold ?? 0,
        activeRecovery: undefined,
      };
    },
    createDID: async ({ name, department }) => {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      const res = await fetch("/api/ipfs/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, department }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload DID onboarding metadata to IPFS.");
      }

      // Prototype-grade key storage only (see docs/SECURITY.md) — this key is separate from
      // the connected wallet's own key and cannot be recovered if this fails or the browser
      // storage is cleared. Production custody is out of scope for this pass.
      try {
        localStorage.setItem(`praman-setu:did-key:${account.address}`, privateKey);
      } catch {
        throw new Error("Could not save the new DID's private key locally (storage unavailable) — aborting before submitting the transaction.");
      }

      createDIDOnchain({ pubKey: account.publicKey, metadataURI: data.cid as string });
    },
    initiateRecovery: () => {
      throw new Error(
        "initiateRecovery is not implemented in onchain mode yet — see TODO.md T-025/T-039 (needs a guardian-actor UI and a real new-key input, not just a service fix)."
      );
    },
    signRecovery: () => {
      throw new Error("signRecovery is not implemented in onchain mode yet — see TODO.md T-039 (needs a guardian-actor UI).");
    },
    finalizeRecovery: () => {
      throw new Error("finalizeRecovery is not implemented in onchain mode yet — see TODO.md T-039.");
    },
    issueCredential: ({ subjectDid, role, validUntil }) => {
      if (!did) {
        throw new Error("issueCredential requires a resolved issuer DID — connect a wallet with a registered identity first.");
      }
      const validUntilSeconds = BigInt(Math.floor(validUntil / 1000));
      // vcHash is a commitment to the real fields being issued (T-036/T-037's neighbor, F1.2's
      // "hash + revocation entry go on-chain, full VC handed to the user's wallet off-chain") —
      // genuinely derived from this credential's actual subject/issuer/role/expiry, not a
      // placeholder. A production issuer would hash the full signed VC document instead; this
      // prototype has no VC-document format to hash yet, so the on-chain-relevant fields stand in.
      const vcHash = keccak256(
        encodePacked(
          ["bytes32", "bytes32", "string", "uint256"],
          [subjectDid as `0x${string}`, did as `0x${string}`, role, validUntilSeconds]
        )
      );
      issueCredentialOnchain({
        subjectDid: subjectDid as `0x${string}`,
        issuerDid: did as `0x${string}`,
        vcHash,
        role,
        validUntil: validUntilSeconds,
      });
    },
    lastIssuedVcId,
    isIssueConfirmed,
    isPending: isCreating || isInitiating || isSigning || isFinalizing || isIssuing,
    isResolving: isLoadingDoc || credentialsQuery.isLoading || guardiansQuery.isLoading,
  };
}

export function useDidService(did?: string): DidService {
  // Both are called unconditionally (never `dataMode === "x" ? useA() : useB()`) so this
  // stays valid under React's rules of hooks regardless of what dataMode resolves to —
  // the unused branch's hooks (wagmi reads with no address, or an idle Zustand store) are
  // cheap no-ops, and only the selected object is ever returned to the caller.
  const mock = useMockDidService(did);
  const onchain = useOnchainDidService(did);
  return dataMode === "onchain" ? onchain : mock;
}
