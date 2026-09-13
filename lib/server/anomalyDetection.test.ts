import { describe, expect, it } from "vitest";
import { computeAnomalies, type RawAuditEvent } from "./anomalyDetection";

const NOW = 1_757_000_000; // arbitrary fixed unix-seconds epoch, subgraph timestamps are seconds

function event(overrides: Partial<RawAuditEvent> & Pick<RawAuditEvent, "id" | "type" | "actorAddress">): RawAuditEvent {
  return { timestamp: NOW, ...overrides };
}

describe("computeAnomalies", () => {
  it("returns no anomalies for an empty event list", () => {
    expect(computeAnomalies([])).toEqual([]);
  });

  it("returns no anomalies when nothing matches either heuristic", () => {
    const events: RawAuditEvent[] = [
      event({ id: "e1", type: "DIDCreated", actorAddress: "0xabc", timestamp: NOW }),
      event({ id: "e2", type: "AssetMinted", actorAddress: "0xabc", timestamp: NOW + 10 }),
    ];
    expect(computeAnomalies(events)).toEqual([]);
  });

  describe("emergency-pause heuristic", () => {
    it("flags a critical anomaly the first time EmergencyPaused appears", () => {
      const events: RawAuditEvent[] = [event({ id: "e1", type: "EmergencyPaused", actorAddress: "0xSuperAdmin1", timestamp: NOW })];

      const result = computeAnomalies(events);

      expect(result).toEqual([
        {
          id: "anomaly-emergency-e1",
          rule: "Emergency Action",
          detail: "Platform was paused by 0xSuperAdmin1. Requires immediate review.",
          severity: "critical",
          riskScore: 90,
          actorDid: "0xSuperAdmin1",
          timestamp: NOW * 1000,
          status: "open",
        },
      ]);
    });

    it("only flags once even if EmergencyPaused appears more than once in the window", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "EmergencyPaused", actorAddress: "0xSuperAdmin1", timestamp: NOW }),
        event({ id: "e2", type: "EmergencyPaused", actorAddress: "0xSuperAdmin2", timestamp: NOW + 1 }),
      ];

      const result = computeAnomalies(events);

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("anomaly-emergency-e1");
    });
  });

  describe("velocity heuristic", () => {
    it("does not flag an actor with only 2 role operations", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW }),
        event({ id: "e2", type: "RoleRevoked", actorAddress: "0xactor", timestamp: NOW + 60 }),
      ];
      expect(computeAnomalies(events)).toEqual([]);
    });

    it("flags an actor with 3+ role operations within a 1-hour window", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW }),
        event({ id: "e2", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW + 600 }),
        event({ id: "e3", type: "RoleRevoked", actorAddress: "0xactor", timestamp: NOW + 1200 }),
      ];

      const result = computeAnomalies(events);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        rule: "Velocity Check: Rapid Role Grants",
        severity: "warning",
        riskScore: 75,
        actorDid: "0xactor",
      });
    });

    it("does not flag 3 role operations spread beyond a 1-hour window", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW }),
        event({ id: "e2", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW + 2000 }),
        event({ id: "e3", type: "RoleRevoked", actorAddress: "0xactor", timestamp: NOW + 4000 }), // > 3600s span
      ];
      expect(computeAnomalies(events)).toEqual([]);
    });

    it("flags each offending actor independently, once each", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "RoleGranted", actorAddress: "0xactorA", timestamp: NOW }),
        event({ id: "e2", type: "RoleGranted", actorAddress: "0xactorA", timestamp: NOW + 100 }),
        event({ id: "e3", type: "RoleGranted", actorAddress: "0xactorA", timestamp: NOW + 200 }),
        event({ id: "e4", type: "RoleGranted", actorAddress: "0xactorB", timestamp: NOW }),
        event({ id: "e5", type: "RoleGranted", actorAddress: "0xactorB", timestamp: NOW + 100 }),
        event({ id: "e6", type: "RoleGranted", actorAddress: "0xactorB", timestamp: NOW + 200 }),
      ];

      const result = computeAnomalies(events);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.actorDid).sort()).toEqual(["0xactorA", "0xactorB"]);
    });

    it("ignores event types other than RoleGranted/RoleRevoked for the velocity count", () => {
      const events: RawAuditEvent[] = [
        event({ id: "e1", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW }),
        event({ id: "e2", type: "AssetMinted", actorAddress: "0xactor", timestamp: NOW + 10 }),
        event({ id: "e3", type: "DIDCreated", actorAddress: "0xactor", timestamp: NOW + 20 }),
      ];
      expect(computeAnomalies(events)).toEqual([]);
    });
  });

  it("can report both heuristics together in one pass", () => {
    const events: RawAuditEvent[] = [
      event({ id: "e1", type: "EmergencyPaused", actorAddress: "0xSuperAdmin1", timestamp: NOW }),
      event({ id: "e2", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW }),
      event({ id: "e3", type: "RoleGranted", actorAddress: "0xactor", timestamp: NOW + 100 }),
      event({ id: "e4", type: "RoleRevoked", actorAddress: "0xactor", timestamp: NOW + 200 }),
    ];

    const result = computeAnomalies(events);

    expect(result).toHaveLength(2);
    expect(result.map((a) => a.rule).sort()).toEqual(["Emergency Action", "Velocity Check: Rapid Role Grants"]);
  });
});
