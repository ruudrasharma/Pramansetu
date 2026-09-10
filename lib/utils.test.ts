import { describe, expect, it } from "vitest";
import { cn, expiryLevel, formatCountdown, formatRelativeTime, truncateMiddle } from "@/lib/utils";

describe("truncateMiddle", () => {
  it("leaves short values untouched", () => {
    expect(truncateMiddle("did:ethr:0xAB")).toBe("did:ethr:0xAB");
  });

  it("truncates long values to head…tail", () => {
    const did = "did:ethr:0xA11CE000000000000000000000000000009F2";
    expect(truncateMiddle(did)).toBe("did:ethr:0…0009F2");
  });

  it("respects custom head/tail lengths", () => {
    expect(truncateMiddle("0x1234567890abcdef", 4, 4)).toBe("0x12…cdef");
  });
});

describe("formatRelativeTime", () => {
  it("formats sub-minute durations in seconds", () => {
    expect(formatRelativeTime(Date.now() - 5_000)).toBe("5s ago");
  });

  it("formats sub-hour durations in minutes", () => {
    expect(formatRelativeTime(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("formats sub-day durations in hours", () => {
    expect(formatRelativeTime(Date.now() - 5 * 3_600_000)).toBe("5h ago");
  });

  it("formats multi-day durations in days", () => {
    expect(formatRelativeTime(Date.now() - 3 * 24 * 3_600_000)).toBe("3d ago");
  });
});

describe("formatCountdown", () => {
  it("reports expired for a timestamp in the past", () => {
    expect(formatCountdown(Date.now() - 1_000)).toBe("expired");
  });

  it("formats sub-day countdowns as Nh Nm", () => {
    expect(formatCountdown(Date.now() + 2 * 3_600_000 + 15 * 60_000)).toBe("2h 15m");
  });

  it("formats multi-day countdowns as Nd Nh", () => {
    expect(formatCountdown(Date.now() + 50 * 3_600_000)).toBe("2d 2h");
  });
});

describe("expiryLevel", () => {
  it("returns expired for a past timestamp", () => {
    expect(expiryLevel(Date.now() - 1_000)).toBe("expired");
  });

  it("returns critical inside the 48h window", () => {
    expect(expiryLevel(Date.now() + 24 * 3_600_000)).toBe("critical");
  });

  it("returns warning between 48h and 7d out", () => {
    expect(expiryLevel(Date.now() + 4 * 24 * 3_600_000)).toBe("warning");
  });

  it("returns safe beyond 7d out", () => {
    expect(expiryLevel(Date.now() + 10 * 24 * 3_600_000)).toBe("safe");
  });
});

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });
});
