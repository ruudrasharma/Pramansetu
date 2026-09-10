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
import { findIdentity, type Identity, type Credential, type GuardianSet, type Role } from "@/lib/mock/fixtures";
import { useCreateDID as useCreateDIDOnchain, useResolveDID } from "@/lib/hooks/useDIDRegistry";
import { ROLE, useHasRole } from "@/lib/hooks/useAccessControl";
import { useRecoveryThreshold, useGuardiansList } from "@/lib/hooks/useGuardianRecovery";
import {
  useRegisterGuardians as useRegisterGuardiansOnchain,
  useInitiateRecovery as useInitiateRecoveryOnchain,
  useSignRecovery as useSignRecoveryOnchain,
  useFinalizeRecovery as useFinalizeRecoveryOnchain,
} from "@/lib/hooks/useGuardianRecovery";
import { useIssueCredential as useIssueCredentialOnchain } from "@/lib/hooks/useCredentialRegistry";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_CREDENTIALS_BY_SUBJECT, GET_RECOVERY } from "@/lib/queries";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { keccak256, encodePacked } from "viem";
import { adaptCredentials, deriveCredentialStatus, type RawCredential } from "@/lib/services/shared/credentials";

export interface DidService {
  resolveDID: () => Identity | undefined;
  listCredentials: () => Credential[];
  getGuardians: () => GuardianSet | undefined;
  createDID: (input: { name: string; department: string }) => void;
  /** Set (or replace) the 3–5 guardian set + M-of-N threshold for the did this service was
   * instantiated for. Onchain, only that did's current controller may call this for real
   * (GuardianRecovery.sol's onlyController check) — the contract is the real enforcement
   * boundary, same as everywhere else in this app. */
  registerGuardians: (input: { guardians: string[]; threshold: number }) => void;
  /**
   * A registered guardian of `did` (not `did`'s own controller — see TODO.md T-039) initiates
   * recovery on their behalf. `newIdentity` is the affected identity's freshly-generated
   * controller address + public key, communicated to the guardian out-of-band (this app has no
   * mechanism for that hand-off — it's a real-world operational step, same as any social-recovery
   * scheme). Required in onchain mode; ignored in mock mode (kept optional for backward
   * compatibility with the existing mock-only "Simulate recovery" affordance).
   */
  initiateRecovery: (did: string, initiatedBy: string, newIdentity?: { controller: string; pubKey: string }) => void;
  /** A registered guardian of `did` adds their signature to an already-initiated recovery. */
  signRecovery: (did: string, guardianDid: string) => void;
  /** Permissionless once threshold + the 24h timelock are both satisfied — anyone can finalize. */
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
  isRegisterGuardiansConfirmed: boolean;
  isInitiateRecoveryConfirmed: boolean;
  isSignRecoveryConfirmed: boolean;
  isFinalizeRecoveryConfirmed: boolean;
  isPending: boolean;
  /** True while a real onchain read backing resolveDID/listCredentials/getGuardians is still
   * in flight — lets callers show a loading state instead of misreading "still loading" as
   * "not found." Always false in mock mode (fixture lookups are synchronous). */
  isResolving: boolean;
}

function useMockDidService(did: string | undefined): DidService {
  const store = useMockDataStore();
  const [lastIssuedVcId, setLastIssuedVcId] = useState<string | undefined>(undefined);
  const [hasRegisteredGuardians, setHasRegisteredGuardians] = useState(false);
  const [hasInitiatedRecovery, setHasInitiatedRecovery] = useState(false);
  const [hasSignedRecovery, setHasSignedRecovery] = useState(false);
  const [hasFinalizedRecovery, setHasFinalizedRecovery] = useState(false);

  return {
    resolveDID: () => (did ? findIdentity(did) : undefined),
    // T-039: reads store.credentials/store.guardianSets (the reactive, mutable copies), not the
    // static fixture helpers (credentialForDid/guardianSetFor) — those never change, so a real
    // mutation (issueCredential, registerGuardians, initiateRecovery, ...) previously never showed
    // up here. The "Simulate recovery" button below has been silently non-functional in the UI as
    // a result: it mutated store.guardianSets, but this always re-read the unmutated fixture.
    listCredentials: () => (did ? store.credentials.filter((c) => c.subjectDid === did) : []),
    getGuardians: () => (did ? store.guardianSets.find((g) => g.did === did) : undefined),
    createDID: () => {
      store.logEvent("DIDCreated", "self", "New DID registered — credential issuance pending");
    },
    registerGuardians: ({ guardians, threshold }) => {
      if (!did) return;
      store.registerGuardians(did, guardians, threshold);
      setHasRegisteredGuardians(true);
    },
    initiateRecovery: (targetDid, initiatedBy) => {
      store.initiateRecovery(targetDid, initiatedBy);
      setHasInitiatedRecovery(true);
    },
    signRecovery: (targetDid, guardianDid) => {
      store.signRecovery(targetDid, guardianDid);
      setHasSignedRecovery(true);
    },
    finalizeRecovery: (targetDid) => {
      store.finalizeRecovery(targetDid);
      setHasFinalizedRecovery(true);
    },
    issueCredential: ({ subjectDid, role, validUntil }) => {
      const credential = store.issueCredential({ subjectDid, issuerDid: did ?? "unknown-issuer", role, validUntil });
      setLastIssuedVcId(credential.vcId);
    },
    lastIssuedVcId,
    isIssueConfirmed: lastIssuedVcId !== undefined,
    isRegisterGuardiansConfirmed: hasRegisteredGuardians,
    isInitiateRecoveryConfirmed: hasInitiatedRecovery,
    isSignRecoveryConfirmed: hasSignedRecovery,
    isFinalizeRecoveryConfirmed: hasFinalizedRecovery,
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

interface RawRecovery {
  newController: string;
  initiatedBy: string;
  initiatedAt: string;
  signers: string[];
  finalized: boolean;
  finalizedAt: string | null;
}

// T-039/T-046: GuardianRecovery had no subgraph mapping at all before this session — the
// activeRecovery(did) contract getter can't expose signers/initiatedBy (see the Recovery entity's
// schema comment), so this is the only real source for recovery progress.
function useRecoveryQuery(did: string | undefined) {
  return useQuery({
    queryKey: ["recovery", did],
    queryFn: async () => {
      const data = await getGraphQLClient().request<{ recovery: RawRecovery | null }>(GET_RECOVERY, { did });
      return data.recovery;
    },
    enabled: !!did,
    refetchInterval: 10000,
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
  const recoveryQuery = useRecoveryQuery(did);

  const { createDID: createDIDOnchain, isPending: isCreating } = useCreateDIDOnchain();
  const { registerGuardians: registerGuardiansOnchain, isSuccess: isRegisterGuardiansConfirmed, isPending: isRegistering } = useRegisterGuardiansOnchain();
  const { initiateRecovery: initiateRecoveryOnchain, isSuccess: isInitiateRecoveryConfirmed, isPending: isInitiating } = useInitiateRecoveryOnchain();
  const { signRecovery: signRecoveryOnchain, isSuccess: isSignRecoveryConfirmed, isPending: isSigning } = useSignRecoveryOnchain();
  const { finalizeRecovery: finalizeRecoveryOnchain, isSuccess: isFinalizeRecoveryConfirmed, isPending: isFinalizing } = useFinalizeRecoveryOnchain();
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
      // T-023/T-039/T-046: activeRecovery(did)'s auto-generated getter can't expose
      // signers/initiatedBy (Solidity drops dynamic-array struct members from public-mapping
      // getters, and initiatedBy is only ever emitted, never stored) — real signer count and
      // initiator now come from the subgraph's Recovery entity instead (recoveryQuery above).
      // Only surfaced while not yet finalized — once finalized there's no more "active" recovery,
      // matching the mock model's own finalizeRecovery clearing activeRecovery to undefined.
      const r = recoveryQuery.data;
      const activeRecovery =
        r && !r.finalized
          ? {
              newController: r.newController,
              initiatedAt: Number(r.initiatedAt) * 1000,
              initiatedBy: r.initiatedBy,
              signatures: r.signers,
              // RECOVERY_TIMELOCK is a hardcoded 24h constant on the contract
              // (contracts/GuardianRecovery.sol:13) — not indexed anywhere, so computed here.
              timelockEndsAt: Number(r.initiatedAt) * 1000 + 24 * 3_600_000,
            }
          : undefined;
      return {
        did,
        guardians: guardiansQuery.data,
        threshold: threshold ?? 0,
        activeRecovery,
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
    registerGuardians: ({ guardians, threshold: newThreshold }) => {
      if (!did) throw new Error("registerGuardians requires a resolved did.");
      registerGuardiansOnchain({
        did: did as `0x${string}`,
        guardians: guardians as `0x${string}`[],
        threshold: newThreshold,
      });
    },
    initiateRecovery: (targetDid, _initiatedBy, newIdentity) => {
      if (!newIdentity?.controller || !newIdentity?.pubKey) {
        throw new Error(
          "initiateRecovery requires the affected identity's new controller address and public key — communicated out-of-band (this app has no mechanism for that hand-off, same as any real social-recovery scheme)."
        );
      }
      initiateRecoveryOnchain({
        did: targetDid as `0x${string}`,
        newController: newIdentity.controller as `0x${string}`,
        newPubKey: newIdentity.pubKey as `0x${string}`,
      });
    },
    signRecovery: (targetDid) => {
      signRecoveryOnchain(targetDid as `0x${string}`);
    },
    finalizeRecovery: (targetDid) => {
      finalizeRecoveryOnchain(targetDid as `0x${string}`);
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
    isRegisterGuardiansConfirmed,
    isInitiateRecoveryConfirmed,
    isSignRecoveryConfirmed,
    isFinalizeRecoveryConfirmed,
    isPending: isCreating || isRegistering || isInitiating || isSigning || isFinalizing || isIssuing,
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
