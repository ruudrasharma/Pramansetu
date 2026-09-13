"use client";

import { WagmiProvider, useBlockNumber } from "wagmi";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect, useRef, useState } from "react";

// Initialize Web3Modal (this attaches it to the Wagmi config and injects the UI)
import "@/lib/web3modal";

// Query-key tags used by this app's GraphQL/subgraph-backed useQuery hooks (lib/services/
// rbacService.ts, didService.ts, assetService.ts, governanceService.ts, auditService.ts,
// oracleAttestationService.ts) — see lib/queries.ts for the actual GET_* documents. These hit
// Graph Studio's free tier, which rate-limits ("Too many requests") far sooner than Alchemy's RPC
// does; the very first version of BlockWatcher invalidated ALL queries every block, which
// hammered the subgraph into that rate limit within minutes and made credentials/identities look
// "pending"/missing even though the real on-chain data was fine. Direct on-chain reads (wagmi's
// own useReadContract/useBalance/etc., and this app's own RPC-backed hooks like usePendingGrants
// in useAccessControl.ts and useGuardiansList in useGuardianRecovery.ts) aren't in this set and
// still get invalidated every block — only the GraphQL-backed ones fall back to their existing
// staleTime-driven refetch (on navigation/focus) instead of a constant background poll.
// IMPORTANT: adding a new subgraph-backed useQuery hook means adding its key here too.
const SUBGRAPH_QUERY_KEY_TAGS = new Set([
  "identities",
  "credentials",
  "recovery",
  "assets",
  "auditEvents",
  "anomalyAlerts",
  "oracleFacts",
  "platformActions",
  "pendingGrants", // governanceService.ts's GraphQL one — distinct from useAccessControl.ts's
  // RPC-backed "pendingSuperAdminGrants" key, which is deliberately NOT in this set.
  "governanceTxs",
]);

/**
 * Invalidates direct on-chain read queries on each new Sepolia block, so pages relying on them
 * (role checks, pending grants, guardian lists, balances, ...) refresh on their own instead of
 * needing a manual page reload — covers both "my own transaction just landed" and "someone else
 * changed on-chain state" (e.g. a second Super Admin co-signing a grant from a different session)
 * with one mechanism, rather than wiring a refetch call into every individual write hook across
 * the app. Sepolia blocks land roughly every 12s, so that's the cadence this runs at. Explicitly
 * excludes the GraphQL/subgraph-backed queries — see SUBGRAPH_QUERY_KEY_TAGS above for why.
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
        return typeof tag !== "string" || !SUBGRAPH_QUERY_KEY_TAGS.has(tag);
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
