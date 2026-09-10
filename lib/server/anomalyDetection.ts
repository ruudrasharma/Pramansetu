/**
 * Pure event -> anomaly heuristics for GET /api/audit/anomalies (TODO.md T-058), extracted out of
 * the route handler so it can be exercised with fixed fake event arrays instead of only against a
 * live subgraph. Behavior is unchanged from the inline version this replaced — same two rules
 * (velocity check, emergency-pause detection), same thresholds, same output shape.
 */

export interface RawAuditEvent {
  id: string;
  type: string;
  actorAddress: string;
  timestamp: string | number;
}

export interface ComputedAnomaly {
  id: string;
  rule: string;
  detail: string;
  severity: "warning" | "critical";
  riskScore: number;
  actorDid: string;
  timestamp: number;
  status: "open";
}

export function computeAnomalies(events: RawAuditEvent[]): ComputedAnomaly[] {
  const anomalies: ComputedAnomaly[] = [];

  // Heuristic A: Velocity checks (e.g., >3 role grants from same actor in short time)
  const roleGrantsByActor: Record<string, number[]> = {};

  // Heuristic B: Off-hours or emergency operations
  let hasEmergencyPause = false;

  for (const event of events) {
    const timestamp = Number(event.timestamp) * 1000;

    // Track Role Grants
    if (event.type === "RoleGranted" || event.type === "RoleRevoked") {
      if (!roleGrantsByActor[event.actorAddress]) {
        roleGrantsByActor[event.actorAddress] = [];
      }
      roleGrantsByActor[event.actorAddress]!.push(timestamp);
    }

    // Check Emergency Actions. actorDid is nullable on AuditEvent (many handlers, including the
    // one that emits EmergencyPaused, never set it) — actorAddress always is, so use that
    // instead of crashing on a real null value here (confirmed live: this route 500s on the
    // real deployed subgraph's current data without this fix).
    if (event.type === "EmergencyPaused" && !hasEmergencyPause) {
      anomalies.push({
        id: `anomaly-emergency-${event.id}`,
        rule: "Emergency Action",
        detail: `Platform was paused by ${event.actorAddress.slice(0, 10)}... Requires immediate review.`,
        severity: "critical",
        riskScore: 90,
        actorDid: event.actorAddress,
        timestamp: timestamp,
        status: "open",
      });
      hasEmergencyPause = true;
    }
  }

  // Evaluate Velocity (Heuristic A)
  // If an actor performed > 3 role operations within a 1-hour window (3600000 ms)
  for (const actor in roleGrantsByActor) {
    const times = roleGrantsByActor[actor]!.sort((a, b) => b - a);
    for (let i = 0; i < times.length - 2; i++) {
      if (times[i]! - times[i + 2]! < 3600000) {
        // Flagged
        anomalies.push({
          id: `anomaly-velocity-${actor}-${times[i]}`,
          rule: "Velocity Check: Rapid Role Grants",
          detail: `Actor ${actor.slice(0, 10)}... performed 3+ role operations within 1 hour.`,
          severity: "warning",
          riskScore: 75,
          actorDid: actor,
          timestamp: times[i]!,
          status: "open",
        });
        break; // Only flag once per actor to avoid spam
      }
    }
  }

  return anomalies;
}
