import { describe, expect, it } from "vitest";
import { deriveAssetStatus } from "./assets";

const OWNER = "0xAbC1230000000000000000000000000000dEaD";
const OTHER = "0x0000000000000000000000000000000000BEEF";

describe("deriveAssetStatus", () => {
  it("returns \"finalized\" when ownerAddress still matches mintRecipient", () => {
    expect(deriveAssetStatus(OWNER, OWNER)).toBe("finalized");
  });

  it("returns \"finalized\" for a case-insensitive match (checksum vs. lowercase)", () => {
    expect(deriveAssetStatus(OWNER.toLowerCase(), OWNER.toUpperCase().replace("0X", "0x"))).toBe("finalized");
  });

  it("returns \"transferred\" when ownerAddress has diverged from mintRecipient", () => {
    expect(deriveAssetStatus(OTHER, OWNER)).toBe("transferred");
  });

  it("returns \"finalized\" (not a false-positive \"transferred\") when mintRecipient is empty (\"0x\")", () => {
    expect(deriveAssetStatus(OWNER, "0x")).toBe("finalized");
  });
});
