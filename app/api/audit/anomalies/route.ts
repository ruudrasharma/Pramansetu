import { NextResponse } from "next/server";
import { GraphQLClient } from "graphql-request";
import { GET_AUDIT_EVENTS } from "@/lib/queries";
import { getDismissedAlerts, dismissAlert } from "@/lib/server/dismissedAlerts";
import { computeAnomalies } from "@/lib/server/anomalyDetection";

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

    // 2. Compute anomalies (pure heuristics, tested independently — see
    // lib/server/anomalyDetection.test.ts).
    const anomalies = computeAnomalies(events);

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
