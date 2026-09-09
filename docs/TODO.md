# TODO — Praman Setu

## 🔴 Blocking (needed before demo)
- [ ] Wire real wagmi hooks in `lib/wagmi.ts` to deployed Sepolia testnet addresses (currently scaffolded
      with placeholders — see ENVIRONMENT.md).
- [ ] Deploy contracts to Ethereum Sepolia and populate `NEXT_PUBLIC_*_ADDRESS` env vars.
  - **Demo Risk Warning:** Sepolia testnet faucets are often gated (require mainnet ETH balance) and generally slower/harder to farm than Amoy's. This could present a risk when trying to fund multiple tester wallets for the live demo.
- [ ] Stand up the subgraph (hosted service) and point `NEXT_PUBLIC_SUBGRAPH_URL` at it.
- [ ] Replace `lib/mock-data.ts` reads in each page with live subgraph queries once indexer is live.
- [ ] Record a rehearsed demo script covering all 5 modules within the judging time limit.

## 🟠 Important (pilot hardening)
- [ ] External audit pass (Slither/Mythril + manual review) — see SECURITY.md §7 checklist.
- [ ] Implement Semaphore zero-knowledge proof flow for role-membership disclosure (currently a UI
      affordance placeholder).
- [ ] Build the Python anomaly-detection service (rule-based v1) and wire its API into `/audit`.
- [ ] Guardian recovery notification flow (off-chain — email/Slack to guardians on initiation).
- [ ] Docker Compose for local Graph node so `npm run dev` doesn't require the hosted subgraph.

## 🟡 Nice to Have
- [ ] Command palette (⌘K) fuzzy search across DIDs/assets/tx hashes.
- [ ] Exportable PDF audit reports from the `/audit` screen.
- [ ] `did:web` method support for the future cross-PSU interoperability roadmap item.

## Known Limitations (intentional, documented — not bugs)
- NFT ownership is not currently recognized as legal title under Indian law — `legalReference` field is
  a forward-looking bridge only (see PRD.md §3, SECURITY.md §5.2).
- Anomaly detection ships as rule-based in the MVP; full ML pipeline is Phase 3.
- Quantum resistance is crypto-agility, not a shipped post-quantum signature scheme, in the MVP.

## Bugs
- [ ] `components/shell/TopBar.tsx` role/identity chip: hydration mismatch between server ("Not
      connected") and client ("Resolving…") render of `useCurrentIdentity()`'s wallet-resolving state —
      forces a full client-side re-render on every load in onchain mode. Found during the 2026-09 visual
      pass; not fixed there (logic bug, out of that pass's visual-only scope).
- [ ] `lib/services/auditService.ts` onchain path: the `["auditEvents"]` react-query resolves to
      `undefined` rather than `[]` when the subgraph/indexer isn't reachable (see `NEXT_PUBLIC_DATA_MODE`
      in `.env.local` — currently `onchain` with no local indexer running), which both throws a
      react-query console error and leaves the Dashboard/Audit ledger silently empty instead of showing
      an error or empty state. Same root cause as the "Stand up the subgraph" blocking item above.
