"use client";

import { WagmiProvider, useBlockNumber } from "wagmi";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect, useRef, useState } from "react";

// Initialize Web3Modal (this attaches it to the Wagmi config and injects the UI)
import "@/lib/web3modal";

// Custom (non-wagmi) RPC-backed useQuery tags that should refresh on every new block — narrow,
// cheap, cross-session queue reads like usePendingGrants' "pendingSuperAdminGrants"
// (useAccessControl.ts). Distinct from the GraphQL/subgraph-backed tags below, which never belong
// here (see that comment).
const LIVE_REFRESH_QUERY_TAGS = new Set(["pendingSuperAdminGrants"]);

// wagmi's own useReadContract hook tags EVERY contract read with the same literal queryKey[0]
// ("readContract" — see @wagmi/core's readContractQueryKey), no matter which contract or function
// it's reading. An earlier version of this file tried to invalidate "every on-chain read except
// the subgraph-tagged ones" on every block, which — because of that shared tag — actually meant
// *every single* useReadContract call in the entire app (tokenURI, ownerOf, resolveDID, didOf,
// credentials, isValid, facts, commitmentOf, isMember, ...) refetched every ~12s on every page,
// not just the multisig/queue reads that actually need live cross-session freshness. That's the
// root cause behind "the app keeps auto-reloading on every page" — confirmed by inspecting
// @wagmi/core/query/readContract.js's queryKey builder, not just suspected. Only the specific
// contract functions below (multisig/queue state where a *different* session's action, like a
// second Super Admin co-signing, needs to show up without a manual reload) get the block-driven
// refresh now; everything else falls back to the QueryClient's normal 15s staleTime (refetch on
// navigation/focus), same as before BlockWatcher existed.
const LIVE_REFRESH_FUNCTION_NAMES = new Set([
  "hasRole", // role checks — a grant landing (this session's or another's) should reflect fast
  "roleExpiry",
  "paused", // pause/unpause is a platform-wide 2-of-N action another session can execute
  "pendingMints", // AssetRegistry — dual-attestation mint co-sign queue
  "activeRecovery", // GuardianRecovery — in-flight recovery signature count
  "queue", // GovernanceTimelock — queued transaction state
  "nextTxId",
]);

/**
 * Invalidates only the specific on-chain read queries above on each new Sepolia block — see the
 * comments on LIVE_REFRESH_QUERY_TAGS/LIVE_REFRESH_FUNCTION_NAMES for why the scope is this narrow.
 * Sepolia blocks land roughly every 12s, so that's the cadence this runs at.
 */
function BlockWatcher() {
  const queryClient = useQueryClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const lastInvalidated = useRef<bigint | undefined>(undefined);

  useEffect(() => {
    if (blockNumber === undefined || blockNumber === lastInvalidated.current) return;
    lastInvalidated.current = blockNumber;
    queryClient.invalidateQueries({
      predicate: (query) => {
        const tag = query.queryKey[0];
        if (typeof tag === "string") return LIVE_REFRESH_QUERY_TAGS.has(tag);
        if (tag === "readContract") {
          const functionName = (query.queryKey[1] as { functionName?: string } | undefined)?.functionName;
          return !!functionName && LIVE_REFRESH_FUNCTION_NAMES.has(functionName);
        }
        return false;
      },
    });
  }, [blockNumber, queryClient]);

  return null;
}

/**
 * Web3Providers — wraps the app in WagmiProvider + QueryClientProvider.
 * Kept as a separate 'use client' file so layout.tsx can remain a Server Component
 * (Next.js App Router requires provider wrappers to be client components, while the
 * layout itself benefits from server rendering for initial HTML + SEO metadata).
 *
 * QueryClient is instantiated inside the component (not at module level) so that
 * each server-render gets a fresh instance — prevents cross-request cache leakage.
 */
export function Web3Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Blockchain data doesn't go stale as fast as REST APIs.
            // 15s stale time means we won't hammer the RPC on every focus event.
            staleTime: 15_000,
            // Keep cached data for 5 minutes — ledger history is immutable so
            // cached results are always valid until a new block changes state.
            gcTime: 5 * 60 * 1000,
          },
        },
      })
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BlockWatcher />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
