// Shared "start…end" truncation for hex identifiers (addresses, DIDs, role hashes, vcIds) baked
// into AuditEvent.summary strings — matches lib/utils.ts's truncateMiddle(value, head, tail) on
// the frontend, which every other identifier display in the app already uses. Before this, each
// mapping file did its own ad-hoc `hex.slice(0, N) + "…"` (front-only, no trailing characters at
// all) — a third, inconsistent truncation style baked permanently into stored summary text.
export function truncateMiddle(hex: string, head: i32 = 10, tail: i32 = 6): string {
  if (hex.length <= head + tail + 1) return hex;
  return hex.slice(0, head) + "…" + hex.slice(hex.length - tail);
}
