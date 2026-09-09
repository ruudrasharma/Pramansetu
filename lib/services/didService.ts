"use client";

/**
 * lib/services/didService.ts — Decentralized Identity & Verifiable Credentials (M1).
 * Components import ONLY `useDidService` — never the mock/onchain implementation below it.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { credentialForDid, guardianSetFor, findIdentity, type Identity, type Credential, type GuardianSet } from "@/lib/mock/fixtures";
import { useCreateDID as useCreateDIDOnchain } from "@/lib/hooks/useDIDRegistry";
import {
  useInitiateRecovery as useInitiateRecoveryOnchain,
  useSignRecovery as useSignRecoveryOnchain,
  useFinalizeRecovery as useFinalizeRecoveryOnchain,
} from "@/lib/hooks/useGuardianRecovery";

export interface DidService {
  resolveDID: (did: string) => Identity | undefined;
  listCredentials: (did: string) => Credential[];
  getGuardians: (did: string) => GuardianSet | undefined;
  createDID: (input: { name: string; department: string }) => void;
  initiateRecovery: (did: string, initiatedBy: string) => void;
  signRecovery: (did: string, guardianDid: string) => void;
  finalizeRecovery: (did: string) => void;
  isPending: boolean;
}

function useMockDidService(): DidService {
  const store = useMockDataStore();

  return {
    resolveDID: (did) => findIdentity(did),
    listCredentials: (did) => {
      const c = credentialForDid(did);
      return c ? [c] : [];
    },
    getGuardians: (did) => guardianSetFor(did),
    createDID: () => {
      store.logEvent("DIDCreated", "self", "New DID registered — credential issuance pending");
    },
    initiateRecovery: store.initiateRecovery,
    signRecovery: store.signRecovery,
    finalizeRecovery: store.finalizeRecovery,
    isPending: false,
  };
}

function useOnchainDidService(): DidService {
  const { createDID, isPending: isCreating } = useCreateDIDOnchain();
  const { initiateRecovery, isPending: isInitiating } = useInitiateRecoveryOnchain();
  const { signRecovery, isPending: isSigning } = useSignRecoveryOnchain();
  const { finalizeRecovery, isPending: isFinalizing } = useFinalizeRecoveryOnchain();

  return {
    // TODO(onchain): resolveDID needs a bytes32 `did` — mock uses the human-readable
    // "did:ethr:0x..." string throughout. Resolve the mapping via useDIDOf(controller
    // address) → bytes32 did → useResolveDID(did), then adapt the DIDDocument shape to
    // Identity before returning (see docs/API_SPEC.md §1 DIDRegistry.resolveDID).
    resolveDID: () => undefined,
    // TODO(onchain): CredentialRegistry has no "list credentials for a subject" view —
    // only isValid(vcId)/credentials(vcId). Needs a subgraph query (docs/API_SPEC.md
    // GET /identities/:did) or an off-chain index of issued vcIds per subject.
    listCredentials: () => [],
    // TODO(onchain): GuardianRecovery.guardiansOf(did, index) is per-index only — no
    // full-array view. Iterate 0..recoveryThreshold-1 or query the subgraph.
    getGuardians: () => undefined,
    createDID: ({ name, department }) => {
      // TODO(onchain): generate a real keypair client-side; pubKey/metadataURI below
      // are placeholders until the onboarding wizard's keypair step is wired in.
      createDID({ pubKey: "0x00", metadataURI: JSON.stringify({ name, department }) });
    },
    initiateRecovery: (did, _initiatedBy) =>
      initiateRecovery({ did: did as `0x${string}`, newController: "0x0000000000000000000000000000000000000000", newPubKey: "0x00" }),
    signRecovery: (did) => signRecovery(did as `0x${string}`),
    finalizeRecovery: (did) => finalizeRecovery(did as `0x${string}`),
    isPending: isCreating || isInitiating || isSigning || isFinalizing,
  };
}

export function useDidService(): DidService {
  // Both are called unconditionally (never `dataMode === "x" ? useA() : useB()`) so this
  // stays valid under React's rules of hooks regardless of what dataMode resolves to —
  // the unused branch's hooks (wagmi reads with no address, or an idle Zustand store) are
  // cheap no-ops, and only the selected object is ever returned to the caller.
  const mock = useMockDidService();
  const onchain = useOnchainDidService();
  return dataMode === "onchain" ? onchain : mock;
}
