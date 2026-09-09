"use client";

/**
 * lib/hooks/useCurrentIdentity.ts
 *
 * Mode-aware "who am I" resolution for service calls. Every page used to compute this as
 * `identityByRole[useAppStore((s) => s.activeRole)]` unconditionally — a demo-only construct
 * (see lib/store/appStore.ts) that lets a judge switch between 5 pre-baked personas without
 * connecting 5 wallets. That's fine in mock mode, but none of the 5 fixture personas
 * correspond to a real registered DID on the deployed contract (nobody holds their private
 * keys), so in onchain mode "who am I" must come from the wallet actually connected via
 * wagmi's useAccount(), resolved to a real DID via DIDRegistry.didOf(address) — not from the
 * role switcher. See the 2026-09-09 Phase B.1 audit for the full reasoning.
 */

import { useAccount } from "wagmi";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { dataMode } from "@/lib/services/dataMode";
import { useDIDOf } from "@/lib/hooks/useDIDRegistry";

const ZERO_BYTES32 = ("0x" + "0".repeat(64)) as `0x${string}`;

export interface CurrentIdentity {
  /** bytes32 did in onchain mode, "did:ethr:0x..." string in mock mode — always the value
   * that should be passed into didService.resolveDID/listCredentials/getGuardians. */
  did: string | undefined;
  address: `0x${string}` | undefined;
  /** True while the onchain didOf(address) read is in flight. Always false in mock mode. */
  isResolving: boolean;
  /** True once we know for certain there's no DID registered for the connected wallet
   * (onchain mode only — mock personas always "have" an identity by construction). */
  hasNoDid: boolean;
}

export function useCurrentIdentity(): CurrentIdentity {
  const activeRole = useAppStore((s) => s.activeRole);
  const { address, isConnected } = useAccount();
  const { data: didHash, isLoading, isFetched } = useDIDOf(address);

  if (dataMode === "mock") {
    const identity = identityByRole[activeRole];
    return { did: identity.did, address: identity.controller as `0x${string}`, isResolving: false, hasNoDid: false };
  }

  const resolvedDid = didHash && didHash !== ZERO_BYTES32 ? (didHash as string) : undefined;

  return {
    did: resolvedDid,
    address,
    isResolving: isConnected && isLoading,
    hasNoDid: isConnected && isFetched && !resolvedDid,
  };
}
