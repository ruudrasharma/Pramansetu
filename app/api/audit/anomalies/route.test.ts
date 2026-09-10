import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dismissAlert = vi.fn();
const getDismissedAlerts = vi.fn(async () => ({}) as Record<string, { reason: string; dismissedAt: number }>);

vi.mock("@/lib/server/dismissedAlerts", () => ({
  dismissAlert: (...args: unknown[]) => dismissAlert(...args),
  getDismissedAlerts: () => getDismissedAlerts(),
}));

const subgraphRequest = vi.fn();

vi.mock("graphql-request", () => ({
  GraphQLClient: class {
    request = subgraphRequest;
  },
  gql: (strings: TemplateStringsArray) => strings.join(""),
}));

import { GET, POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/audit/anomalies", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/audit/anomalies", () => {
  beforeEach(() => {
    subgraphRequest.mockReset();
    getDismissedAlerts.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 500 without calling the subgraph when NEXT_PUBLIC_SUBGRAPH_URL is unset (failure case)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "");

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "NEXT_PUBLIC_SUBGRAPH_URL is not configured — set it in .env.local (see docs/ENVIRONMENT.md).",
    });
    expect(subgraphRequest).not.toHaveBeenCalled();
  });

  it("computes anomalies from live events, overlays dismissed state, and sorts by riskScore desc (happy path)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "https://example.test/subgraph");
    subgraphRequest.mockResolvedValue({
      auditEvents: [
        { id: "e1", type: "EmergencyPaused", actorAddress: "0xSuperAdmin1", timestamp: "1700000000" },
        { id: "e2", type: "RoleGranted", actorAddress: "0xactor", timestamp: "1700000000" },
        { id: "e3", type: "RoleGranted", actorAddress: "0xactor", timestamp: "1700000100" },
        { id: "e4", type: "RoleRevoked", actorAddress: "0xactor", timestamp: "1700000200" },
      ],
    });
    getDismissedAlerts.mockResolvedValue({
      "anomaly-velocity-0xactor-1700000200000": { reason: "False positive, verified", dismissedAt: 1700000300000 },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    // Sorted descending by riskScore: emergency (90) before velocity (75).
    expect(body[0]).toMatchObject({ rule: "Emergency Action", riskScore: 90, status: "open" });
    expect(body[1]).toMatchObject({
      rule: "Velocity Check: Rapid Role Grants",
      riskScore: 75,
      status: "dismissed",
      dismissReason: "False positive, verified",
    });
  });

  it("returns a handled 500 (not a crash) when the subgraph request fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBGRAPH_URL", "https://example.test/subgraph");
    subgraphRequest.mockRejectedValue(new Error("network error"));

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to compute anomalies" });
  });
});

describe("POST /api/audit/anomalies", () => {
  beforeEach(() => {
    dismissAlert.mockReset();
  });

  it("dismisses an alert given a valid id and reason (happy path)", async () => {
    const response = await POST(jsonRequest({ id: "anomaly-velocity-0xabc-123", reason: "Confirmed false positive" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(dismissAlert).toHaveBeenCalledWith("anomaly-velocity-0xabc-123", "Confirmed false positive");
  });

  it("rejects a request missing `reason` with 400 and does not persist anything", async () => {
    const response = await POST(jsonRequest({ id: "anomaly-velocity-0xabc-123" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Both `id` and `reason` are required strings." });
    expect(dismissAlert).not.toHaveBeenCalled();
  });

  it("rejects a request missing `id` with 400 and does not persist anything", async () => {
    const response = await POST(jsonRequest({ reason: "Confirmed false positive" }));

    expect(response.status).toBe(400);
    expect(dismissAlert).not.toHaveBeenCalled();
  });

  it("rejects a malformed JSON body with a handled error, not a crash", async () => {
    const response = await POST(
      new Request("http://localhost/api/audit/anomalies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      })
    );

    expect(response.status).toBe(500);
    expect(dismissAlert).not.toHaveBeenCalled();
  });
});
