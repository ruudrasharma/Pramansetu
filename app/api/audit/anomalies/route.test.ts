import { beforeEach, describe, expect, it, vi } from "vitest";

const dismissAlert = vi.fn();

vi.mock("@/lib/server/dismissedAlerts", () => ({
  dismissAlert: (...args: unknown[]) => dismissAlert(...args),
  getDismissedAlerts: vi.fn(async () => ({})),
}));

import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/audit/anomalies", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
