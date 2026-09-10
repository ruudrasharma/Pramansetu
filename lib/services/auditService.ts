"use client";

/**
 * lib/services/auditService.ts — Immutable Audit Trail + Anomaly Detection (M4).
 *
 * `subscribeToEvents` (T-037): the onchain branch throws rather than silently no-op-ing,
 * because the real "live arrival" mechanism for this project's scope is the `refetchInterval`
 * polling already on `eventsQuery`/`anomaliesQuery` below (5s / 10s) — a genuinely-updating
 * read, just not a push subscription. There are zero real callers of this method anywhere in
 * the app; if one appears, wire `wagmi`'s `useWatchContractEvent` per relevant contract rather
 * than reusing this signature for polling. Documented as such in docs/API_SPEC.md too. The mock
 * branch's no-op is intentional, not a stub — mock mode's "live" ledger already comes from
 * Zustand store writes (the Dashboard's Simulate button), not a subscription of any kind.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { type AuditEvent, type AnomalyAlert } from "@/lib/mock/fixtures";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_AUDIT_EVENTS } from "@/lib/queries";

export interface AuditService {
  getEvents: () => AuditEvent[];
  getAnomalies: () => AnomalyAlert[];
  dismissAlert: (alertId: string, reason: string) => void;
  subscribeToEvents: (onEvent: (event: AuditEvent) => void) => () => void;
  /**
   * Set only when the real events query genuinely failed (network error, subgraph
   * unreachable, GraphQL error) — `getEvents()` still returns `[]` in that case (never
   * `undefined`) so callers don't need a null-check, but without this field a real outage is
   * visually indistinguishable from "zero events, honestly" (docs/TODO.md-tracked bug, closed
   * 2026-09-11 — directly relevant while T-050's subgraph is genuinely unreachable). Always
   * `undefined` in mock mode.
   */
  eventsError: string | undefined;
  /** Same as `eventsError`, for `getAnomalies()`. */
  anomaliesError: string | undefined;
}

function useMockAuditService(): AuditService {
  const store = useMockDataStore();

  return {
    getEvents: () => store.auditEvents,
    getAnomalies: () => store.anomalyAlerts,
    dismissAlert: store.dismissAlert,
    subscribeToEvents: () => () => {},
    eventsError: undefined,
    anomaliesError: undefined,
  };
}

function useOnchainAuditService(): AuditService {
  const eventsQuery = useQuery({
    queryKey: ["auditEvents"],
    queryFn: async () => getGraphQLClient().request<any>(GET_AUDIT_EVENTS, { first: 100, skip: 0 }),
    refetchInterval: 5000,
  });

  const anomaliesQuery = useQuery({
    queryKey: ["anomalyAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/audit/anomalies");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load anomalies");
      return json;
    },
    refetchInterval: 10000,
  });

  const events = eventsQuery.data?.auditEvents?.map((e: any) => ({
    ...e,
    timestamp: Number(e.timestamp) * 1000,
  })) || [];

  return {
    getEvents: () => events,
    getAnomalies: () => anomaliesQuery.data || [],
    // Typed `=> void` on the interface but genuinely async underneath — same pattern as
    // rbacService's grantTimedRole/revokeRole; callers that `await` this still get the real
    // promise at runtime despite the looser static type (see AlertCard.tsx's caller).
    dismissAlert: async (alertId, reason) => {
      const res = await fetch("/api/audit/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to dismiss alert");
      await anomaliesQuery.refetch();
    },
    subscribeToEvents: () => {
      throw new Error(
        "subscribeToEvents is not implemented in onchain mode — see TODO.md T-037; getEvents()/getAnomalies() already poll live via refetchInterval."
      );
    },
    eventsError: eventsQuery.error instanceof Error ? eventsQuery.error.message : eventsQuery.isError ? "Failed to load events." : undefined,
    anomaliesError:
      anomaliesQuery.error instanceof Error ? anomaliesQuery.error.message : anomaliesQuery.isError ? "Failed to load anomalies." : undefined,
  };
}

export function useAuditService(): AuditService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockAuditService();
  const onchain = useOnchainAuditService();
  return dataMode === "onchain" ? onchain : mock;
}
