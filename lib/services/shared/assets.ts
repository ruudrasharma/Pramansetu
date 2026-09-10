import { type AssetStatus } from "@/lib/mock/fixtures";

/**
 * Derives a real "finalized" vs. "transferred" asset status (T-063) — extracted out of
 * assetService.ts's adaptAsset so the comparison itself is independently testable, same pattern
 * as lib/server/anomalyDetection.ts's computeAnomalies extraction (T-058).
 *
 * mintRecipient is recorded once, at mint time, from the originating MintRequest
 * (subgraph/src/asset-registry.ts); ownerAddress mutates on every real Transfer. If they've
 * diverged, a real transfer has happened since minting. A "0x" (empty) mintRecipient — the rare
 * case the originating MintRequest wasn't found at mint time — falls back to "finalized" rather
 * than a false-positive "transferred".
 */
export function deriveAssetStatus(ownerAddress: string, mintRecipient: string): AssetStatus {
  if (mintRecipient === "0x") return "finalized";
  return ownerAddress.toLowerCase() === mintRecipient.toLowerCase() ? "finalized" : "transferred";
}

/**
 * Derives a real "disputed" override from an asset's oracle-fact history (T-016, gap analysis
 * §2.2.5) — closes the gap deriveAssetStatus's own callers previously had to document as
 * permanent: "this contract has no asset-level dispute concept" (see assetService.ts's adaptAsset,
 * pre-T-016). OracleAttestation.sol now gives this system a real per-token dispute concept,
 * distinct from GovernanceTimelock's free-text-only, txId-scoped disputes (T-035) — an asset shows
 * "disputed" whenever any of its oracle facts is currently in the Disputed state, regardless of
 * what deriveAssetStatus itself would otherwise say.
 */
export function deriveOracleDisputeOverride(facts: { status: string }[]): boolean {
  return facts.some((f) => f.status === "disputed");
}
