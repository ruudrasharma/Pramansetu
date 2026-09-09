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
  return {
    // TODO(onchain): no on-chain "list events" call exists by design (contracts only
    // emit); the real source is the subgraph's AuditEvent entity (docs/API_SPEC.md
    // GET /audit?actor=&type=&from=&to=).
    getEvents: () => auditEvents,
    // TODO(onchain): anomaly scores are explicitly a computed off-chain layer, never
    // on-chain (docs/DATABASE_SCHEMA.md — AuditEvent.riskScore "populated by the
    // anomaly-detection service, not the chain"). Call ANOMALY_SERVICE_URL's
    // GET /audit/anomalies once that service exists.
    getAnomalies: () => anomalyAlerts,
    dismissAlert: () => {},
    // TODO(onchain): wrap wagmi's useWatchContractEvent per contract (none of
    // lib/hooks/* currently use it) or subscribe to the subgraph over WebSocket.
    subscribeToEvents: () => () => {},
  };
}

export function useAuditService(): AuditService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockAuditService();
  const onchain = useOnchainAuditService();
  return dataMode === "onchain" ? onchain : mock;
}
