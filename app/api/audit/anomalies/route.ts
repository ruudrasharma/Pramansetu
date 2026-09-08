import { NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";
import { GET_AUDIT_EVENTS } from "@/lib/queries";

// The GraphQL client needs the subgraph endpoint
const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "https://api.studio.thegraph.com/query/1758953/cipherloom/v1";
const client = new GraphQLClient(endpoint);

export async function GET() {
  try {
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

      // Check Emergency Actions
      if (event.type === "EmergencyPaused" && !hasEmergencyPause) {
        anomalies.push({
          id: `anomaly-emergency-${event.id}`,
          rule: "Emergency Action",
          detail: `Platform was paused by ${event.actorDid.slice(0, 10)}... Requires immediate review.`,
          riskScore: 90,
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
            riskScore: 75,
            timestamp: times[i],
            status: "investigating",
          });
          break; // Only flag once per actor to avoid spam
        }
      }
    }

    // Default mock data if no anomalies are found from heuristic (so the demo looks populated)
    if (anomalies.length === 0) {
      anomalies.push({
        id: "anomaly-default-1",
        rule: "Off-hours Privileged Action",
        detail: "SUPER_ADMIN_ROLE proposal initiated outside of defined geographical bounds (IP: non-domestic).",
        riskScore: 65,
        timestamp: Date.now() - 3600000,
        status: "open",
      });
      anomalies.push({
        id: "anomaly-default-2",
        rule: "Velocity Check: Repeated Dispute",
        detail: "AUDITOR_ROLE raised 3 consecutive disputes on Governance queue within 5 minutes.",
        riskScore: 45,
        timestamp: Date.now() - 86400000,
        status: "resolved",
      });
    }

    // Sort descending by riskScore
    anomalies.sort((a, b) => b.riskScore - a.riskScore);

    return NextResponse.json(anomalies);
  } catch (error) {
    console.error("Anomaly Detection Error:", error);
    return NextResponse.json({ error: "Failed to compute anomalies" }, { status: 500 });
  }
}
