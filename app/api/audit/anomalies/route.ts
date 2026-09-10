import { NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";
import { GET_AUDIT_EVENTS } from "@/lib/queries";
import { getDismissedAlerts, dismissAlert } from "@/lib/server/dismissedAlerts";

export async function GET() {
  try {
    const endpoint = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!endpoint) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUBGRAPH_URL is not configured — set it in .env.local (see docs/ENVIRONMENT.md)." },
        { status: 500 }
      );
    }
    const client = new GraphQLClient(endpoint);

    // 1. Fetch recent events from the subgraph (last 50)
    const data: any = await client.request(GET_AUDIT_EVENTS, { first: 50, skip: 0 });
    const events = data.auditEvents || [];

    // 2. Compute anomalies
    const anomalies = [];
    
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
            timestamp: times[i],
            status: "open",
          });
          break; // Only flag once per actor to avoid spam
        }
      }
    }

    // Zero anomalies is a correct, honest result — the UI renders "No anomalies detected." for
    // an empty array (see app/audit/page.tsx) rather than needing a populated placeholder here.

    // Overlay dismissed state (T-036) — anomaly ids are deterministic per source event/actor+
    // timestamp, so a dismissal recorded against one id keeps applying every time this route
    // recomputes the same anomaly on the next poll.
    const dismissed = await getDismissedAlerts();
    const withDismissed = anomalies.map((a) =>
      dismissed[a.id] ? { ...a, status: "dismissed", dismissReason: dismissed[a.id]!.reason } : a
    );

    // Sort descending by riskScore
    withDismissed.sort((a, b) => b.riskScore - a.riskScore);

    return NextResponse.json(withDismissed);
  } catch (error) {
    console.error("Anomaly Detection Error:", error);
    return NextResponse.json({ error: "Failed to compute anomalies" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, reason } = body ?? {};
    if (typeof id !== "string" || !id || typeof reason !== "string" || !reason) {
      return NextResponse.json({ error: "Both `id` and `reason` are required strings." }, { status: 400 });
    }
    await dismissAlert(id, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Anomaly Dismiss Error:", error);
    return NextResponse.json({ error: "Failed to dismiss alert" }, { status: 500 });
  }
}
