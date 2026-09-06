"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { useState } from "react";

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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
