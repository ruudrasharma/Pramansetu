"use client";

/**
 * lib/services/auditService.ts — Immutable Audit Trail + AI Anomaly Detection (M4).
 * `subscribeToEvents` is the one place a future live-indexer subscription plugs in; the
 * mock implementation just returns a no-op unsubscribe since the ledger stream already
 * demonstrates "live arrival" via the Overview page's Simulate button + Zustand writes.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { auditEvents, anomalyAlerts, type AuditEvent, type AnomalyAlert } from "@/lib/mock/fixtures";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_AUDIT_EVENTS } from "@/lib/queries";

export interface AuditService {
  getEvents: () => AuditEvent[];
  getAnomalies: () => AnomalyAlert[];
  dismissAlert: (alertId: string, reason: string) => void;
  subscribeToEvents: (onEvent: (event: AuditEvent) => void) => () => void;
}

function useMockAuditService(): AuditService {
  const store = useMockDataStore();

  return {
    getEvents: () => store.auditEvents,
    getAnomalies: () => store.anomalyAlerts,
    dismissAlert: store.dismissAlert,
    subscribeToEvents: () => () => {},
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
    dismissAlert: () => {},
    subscribeToEvents: () => () => {},
  };
}

export function useAuditService(): AuditService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockAuditService();
  const onchain = useOnchainAuditService();
  return dataMode === "onchain" ? onchain : mock;
}
