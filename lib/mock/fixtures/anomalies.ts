// @ts-nocheck -- hand-authored static fixture data with deliberate array cross-references (identities[i].did etc.); noUncheckedIndexedAccess adds zero safety here, matching the original lib/mock-data.ts convention.
/**
 * Mock anomaly-detection fixtures — rule-based (not ML) per docs/PRD.md non-goals. Each alert
 * names the specific rule that fired, never a black-box score alone.
 */

import { identities, DAY, HOUR } from "./identities";

const now = Date.now();
const id = (i: number) => identities[i].did;

export interface AnomalyAlert {
  id: string;
  rule: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  riskScore: number;
  actorDid: string;
  relatedEventId?: string;
  timestamp: number;
  status: "open" | "dismissed";
  dismissReason?: string;
}

export const anomalyAlerts: AnomalyAlert[] = [
  {
    id: "alert-1",
    rule: "Off-hours role escalation",
    detail: `${id(4).slice(0, 14)}… granted an ADMIN-tier role at 02:47 local time`,
    severity: "critical",
    riskScore: 81,
    actorDid: id(0),
    relatedEventId: "evt-1035",
    timestamp: now - 40 * HOUR,
    status: "open",
  },
  {
    id: "alert-2",
    rule: "Elevated mint velocity",
    detail: "3 mints proposed within 6 minutes from Procurement — 4.2× rolling 7-day baseline",
    severity: "warning",
    riskScore: 54,
    actorDid: id(4),
    timestamp: now - 5 * DAY,
    status: "open",
  },
  {
    id: "alert-3",
    rule: "Repeated failed authentication",
    detail: `5 failed challenge-signature attempts against ${id(11).slice(0, 14)}…`,
    severity: "info",
    riskScore: 38,
    actorDid: id(11),
    timestamp: now - 9 * DAY,
    status: "dismissed",
    dismissReason: "Confirmed device re-pairing by employee, no compromise — closed by Admin.",
  },
  {
    id: "alert-4",
    rule: "Dispute filed on high-value transfer",
    detail: "Token #50 (External Contractor Access Grant) transfer disputed within cooling-off window",
    severity: "warning",
    riskScore: 58,
    actorDid: id(9),
    relatedEventId: "evt-1032",
    timestamp: now - 6 * HOUR,
    status: "open",
  },
  {
    id: "alert-5",
    rule: "Guardian recovery on active session",
    detail: `Recovery initiated for ${id(7).slice(0, 14)}… while a signed-in session remained active elsewhere`,
    severity: "warning",
    riskScore: 49,
    actorDid: id(13),
    relatedEventId: "evt-1033",
    timestamp: now - 5 * HOUR,
    status: "open",
  },
  {
    id: "alert-6",
    rule: "Mass transfer pattern",
    detail: "4 asset transfers from Naval Systems dept. within 24h — above seasonal reallocation norm",
    severity: "info",
    riskScore: 31,
    actorDid: id(7),
    timestamp: now - 15 * DAY,
    status: "dismissed",
    dismissReason: "Scheduled quarterly asset reallocation — verified against Procurement calendar.",
  },
  {
    id: "alert-7",
    rule: "Emergency pause triggered",
    detail: "Platform paused by 2-of-2 Super Admin co-sign pending anomalous mint velocity review",
    severity: "critical",
    riskScore: 88,
    actorDid: id(1),
    relatedEventId: "evt-1035",
    timestamp: now - 45 * DAY,
    status: "dismissed",
    dismissReason: "Investigation closed — no compromise found, platform unpaused.",
  },
];
