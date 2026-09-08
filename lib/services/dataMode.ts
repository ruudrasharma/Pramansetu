/**
 * NEXT_PUBLIC_* env vars are inlined by Next.js at build time, so this is a compile-time
 * constant, not a runtime setting. Each service file's exported hook calls its mock and
 * onchain implementations unconditionally (both are real hook trees — an idle Zustand
 * store or a wagmi read with no address, either way cheap) and only *selects* which
 * result to return based on this constant, so the pattern stays valid under React's
 * rules of hooks no matter what this resolves to.
 */
export const dataMode: "mock" | "onchain" = process.env.NEXT_PUBLIC_DATA_MODE === "onchain" ? "onchain" : "mock";
