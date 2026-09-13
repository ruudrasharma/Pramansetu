import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Truncates a DID / address / hash for display: did:ethr:0xA11CE...9F2 */
export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// Grants meant to never lapse (e.g. TimeBoundAccessControl.initialize() sets the bootstrap
// deployer's SUPER_ADMIN_ROLE roleExpiry to Solidity's type(uint256).max) still need a concrete
// validUntil wherever the UI sources an expiry from a credential's validity window rather than
// the role grant itself — this threshold (~year 2286) is this app's convention for "effectively
// forever," far enough out that no real countdown will ever reach it, but small enough to stay a
// safe JS number/Date unlike type(uint256).max itself.
export const NEVER_EXPIRES_THRESHOLD_MS = 9_999_999_000_000;

export function formatCountdown(targetTimestamp: number): string {
  if (targetTimestamp >= NEVER_EXPIRES_THRESHOLD_MS) return "Never expires";
  const diffMs = targetTimestamp - Date.now();
  if (diffMs <= 0) return "expired";
  const hrs = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  return `${hrs}h ${mins}m`;
}

export type ExpiryLevel = "safe" | "warning" | "critical" | "expired";

export function expiryLevel(targetTimestamp: number): ExpiryLevel {
  if (targetTimestamp >= NEVER_EXPIRES_THRESHOLD_MS) return "safe";
  const diffMs = targetTimestamp - Date.now();
  if (diffMs <= 0) return "expired";
  const hrs = diffMs / 3_600_000;
  if (hrs < 48) return "critical";
  if (hrs < 24 * 7) return "warning";
  return "safe";
}
