# Changelog

All notable changes to Praman Setu (SIH 2026, PS 26125) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning is `MAJOR.MINOR.PATCH` starting from `0.1.0` (pre-deployment).

---

## [0.13.0] — 2026-09-11 — Real guardian-actor UI + subgraph support (T-039, T-023, T-025, T-046)

Closes T-039, T-023, T-025, T-046.

### Added
- `app/(app)/identity/recovery/guardian/page.tsx` — the real guardian-actor console: look up any DID,
  initiate recovery on its behalf (real `newController`/`newPubKey` inputs, communicated out-of-band
  by the affected person), or sign an in-progress one. `/identity/recovery` (viewing "my own" status)
  and this console are necessarily separate pages — `initiateRecovery`/`signRecovery` can only ever be
  called by a registered guardian's own wallet, never the affected person's.
- A "Register guardians" card on `/identity` (self-service, shown when none exist yet) — there was no
  UI anywhere to register guardians at all before this; the Command Palette's "Register Guardians"
  entry navigated to a query param `/identity/page.tsx` never read (a dead menu item).
- `subgraph/src/guardian-recovery.ts` + a new `Recovery` schema entity + `subgraph.yaml` dataSource —
  `GuardianRecovery.sol` had no subgraph mapping at all. Real signer count/initiator for a recovery
  now come from this instead of being permanently `undefined` (`activeRecovery(did)`'s auto-generated
  getter can't expose either). `graph codegen`/`graph build` verified clean.
- `lib/services/didService.ts`: `registerGuardians` method; `initiateRecovery` extended to accept the
  real `newIdentity` (controller + pubKey) input it always needed; `signRecovery`/`finalizeRecovery`
  now submit real transactions in onchain mode instead of throwing.
- `lib/hooks/useGuardianRecovery.ts`'s existing `useRegisterGuardians`/`useInitiateRecovery`/
  `useSignRecovery`/`useFinalizeRecovery` hooks are now actually called (they were fully built, just
  unused, since this session's earlier work).

### Fixed — found while wiring this up
- `didService.ts`'s mock branch read `getGuardians()`/`listCredentials()` from **static fixture
  helpers**, not the reactive Zustand store mutations actually write to — the existing "Simulate
  recovery" button on `/identity/recovery` has been silently non-functional in the UI as a result
  (it mutated the store; the page always re-read the unmutated fixture). Fixed by reading from the
  store instead.
- `/identity/recovery/page.tsx`'s "Finalize recovery" button had no `onClick` handler — dead even
  when correctly enabled. `finalizeRecovery` is genuinely permissionless (the affected person can
  call it themselves once ready); now wired for real with error surfacing.

### Attempted, blocked
`graph deploy ... --version-label v6` (shipping the new `GuardianRecovery` support) failed with the
same "Subgraph not found" as T-050 — the third confirmation of this across three separate redeploy
attempts. Ready to ship the moment the Graph Studio slot exists.

### Changed
- `docs/FEATURES.md` F1.3, `docs/USER_FLOWS.md` §1/§5: corrected "guardian DIDs" to "guardian
  addresses" (matches `guardiansOf`'s real return type) and rewritten to describe the real 3-page
  flow instead of the old single-page framing.

### Found, not fixed this pass (tracked in TODO.md)
- No UI flags an off-boarded guardian (their own DID/role later revoked) — `docs/FEATURES.md` F1.3's
  edge case, tracked as a follow-up.

---

## [0.12.0] — 2026-09-11 — Fix /auth's real sign-in dead-end (T-045)

Closes T-045.

### Fixed
- `app/auth/page.tsx`: `handleSign`'s real (non-simulated) path set `step` to `"resolving"` but
  nothing ever advanced it — a real user who actually signed the challenge got stuck on "Resolving
  DID from signature…" forever, with no way to reach the dashboard through this page. Added a
  `useEffect` watching `useCurrentIdentity()` (the same address→DID hook `TopBar.tsx` uses): once
  resolved with a real DID, advances to `"done"` and redirects, matching the existing UX. Mode-aware
  for free (mock personas resolve instantly by construction) — this also fixes the same dead-end in
  mock mode when signing for real instead of clicking "Simulate (demo)".

### Added
- A real, honest "Signature verified, but no DID is registered for this wallet yet" state (with a
  link to `/identity`'s real `createDID` flow) for a connected wallet with no registered identity —
  previously unreachable code path that would have hit the same infinite spinner; never silently
  claims "Authenticated" for a wallet with no DID to authenticate as.

---

## [0.11.9] — 2026-09-11 — Warn on duplicate credential issuance (T-052)

Closes T-052.

### Added
- `app/(app)/identity/issue/page.tsx`: a warning banner (non-blocking — the contract allows it) when
  the selected subject already holds a valid, non-expired, non-revoked credential of the selected
  role, naming its `vcId` and expiry. Reads the subject's credentials via a second, independent
  `useDidService(subjectDid)` call alongside the existing issuer-scoped one.

### Corrected
- `docs/FEATURES.md` F1.2's edge-case note claimed "most recent `validUntil` governs authorization
  checks" — checked `CredentialRegistry.issueCredential` and that's not how it works. Each `vcId` is an
  independently keyed `Credential` struct; issuing a new one doesn't revoke or supersede an older one
  for the same subject+role, both stay independently valid, and whichever specific `vcId` a consumer
  references is what's actually checked. Reworded to match — the new warning is an anti-duplicate
  nudge, not a reflection of any real conflict-resolution the contract performs.

---

## [0.11.8] — 2026-09-11 — Fix proposedBy/raisedBy/resolvedBy/executedBy's DID leftover (T-055 follow-up)

Closes the address-vs-DID leftover flagged in T-055's closing note.

### Changed
- `/governance`, `/governance/approvals`, `/governance/disputes`: every governance write call
  (`pause`/`unpause`/`approveProposal`/`raiseDispute`/`resolveDispute`/`executeTransaction`) now
  passes a mode-aware actor identifier (`currentSignerId`/`currentActorId` — a real connected address
  onchain, a DID in mock mode) instead of `me.did` unconditionally. Functionally inert today (every
  onchain service implementation ignores these arguments — the real actor is always `msg.sender`), but
  was wrong to leave: it read as if DID were correct everywhere, and would have silently regressed the
  moment any of these arguments became load-bearing.

---

## [0.11.7] — 2026-09-11 — "Propose Admin change" UI + PendingGrant subgraph support (T-054)

Closes T-054.

### Added
- `app/(app)/governance/page.tsx`: a "Propose Admin change" dialog (Super-Admin-gated) — Add/Remove
  Admin kind select, target-identity field (mock dropdown / onchain DID resolved to an address at
  submit time via `resolveControllerAddress`), and a validity-period select for Add Admin. Calls the
  real per-kind `governanceService.proposeAction` branching built for T-033.
- `subgraph/schema.graphql`: `PendingGrant` entity — privileged grants (`addAdmin`) live in a
  completely separate `pendingGrants` mapping/threshold from `PlatformAction` on
  `TimeBoundAccessControl`, with no prior subgraph representation at all.
- `subgraph/src/access-control.ts`: `handleGrantProposed`/`handleGrantCoSigned` mappings, plus the
  corresponding `subgraph.yaml` manifest entries.
- `lib/queries.ts`: `GET_PENDING_GRANTS`, merged into `governanceService.ts`'s `getProposals()`
  alongside `PlatformAction` results.

### Fixed — found while wiring the form up
Without the `PendingGrant` subgraph work above, a real "Add Admin" proposal made through the new form
would have succeeded on-chain and then **silently vanished** from the visible multisig queue — nothing
to co-sign, no sign it ever happened. `graph codegen`/`graph build` verified clean; an actual redeploy
attempt (`--version-label v5`) failed with the same "Subgraph not found" as T-050 (see that entry) —
confirms the missing-slot issue isn't a one-off, and this fix is ready to ship the moment it's resolved.

---

## [0.11.6] — 2026-09-11 — executeTransaction UI + governance pages' dataMode wiring (T-053, T-055)

Closes T-053 and T-055.

### Added
- `GovernanceService.executeTransaction(txId, executedBy)`: onchain wraps the existing (previously
  unused since T-035's fix) `useExecuteTransaction` hook; mock mode gained a matching
  `mockDataStore.executeTransaction` action mirroring the real contract's preconditions (queued,
  `eta` passed) — a never-disputed queued tx had no way to become "executed" in either mode before.
- `app/(app)/governance/disputes/page.tsx`: an "Execute" button on each queued-tx row, shown once a
  live-ticking clock shows `eta` has passed — no role gate, matching `executeTransaction`'s real
  permissionless access control.

### Changed
- `/governance`, `/governance/approvals`, `/governance/disputes` now resolve "me" via
  `useCurrentIdentity()`/`useDidService(...).resolveDID()` in onchain mode instead of the mock-only
  demo role switcher — `canPause`/`canRaise`/`canResolve` now gate on a real connected wallet's
  on-chain role. `MultisigApprovalWidget`'s `currentSignerDid` now receives the real connected
  **address** in onchain mode (not DID), matching how T-032's `getProposals()` keys onchain signers —
  the "already signed" check now actually matches a real signer instead of never matching.
  `pause`/`unpause`/`approveProposal`/`raiseDispute`/`resolveDispute`/`executeTransaction` are all now
  awaited with real error surfacing instead of firing-and-forgetting, matching `/roles`' convention.
- `docs/API_SPEC.md`: updated `executeTransaction`'s row — it now has a real caller.

---

## [0.11.5] — 2026-09-10 — Phase 3 §3.1(a): fix the mint page's vcId/DID mixup, no contract change (T-019)

Closes the functional half of T-019, per explicit sign-off on the gap audit's §2.1 plan, option (a).

### Changed
- `app/(app)/assets/mint/page.tsx`: the onchain mint form's recipient-credential field previously
  asked the operator for a "Recipient DID hash (bytes32)" and fed it straight into `proposeMint`'s
  `vcId` argument — since a DID hash was never registered as a credential, `_update()`'s
  `credentialRegistry.isValid(vcIdOf[tokenId])` check would revert on essentially every real
  transfer. The field now asks for a real `vcId` and links directly to `/identity/issue` (T-051) to
  issue one. No contract change — `AssetRegistry.proposeMint`/`_update()` were already correct; the
  bug was entirely in what the frontend asked the operator to type in.

### Not changed (approved scope was frontend-only)
- The contract's parameter is still named `recipientDid` internally — a naming-clarity issue, not a
  functional one, now that the frontend supplies the right value. A rename/gating-model-change option
  was drafted in this session's Phase 3 plans but not approved.

---

## [0.11.4] — 2026-09-10 — Housekeeping: confirmed no stray `master` branch exists

Per `Praman_Setu_Implementation_Gap_Audit.md` §6 item 3 (Phase 2 housekeeping) — the audit's own
GitHub branch-API check was rate-limited and couldn't confirm this independently.

### Verified (no code change)
- `git branch -a` + `git ls-remote --heads origin`: no `master` branch exists, locally or on the
  remote. The remote has only `main` and `feat/sepolia-migration-ui` (already merged into `main` per
  the Phase 10 changelog entry). A local-only `dev` branch also exists, untouched — not named in the
  audit's ask and not confirmed stale.

---

## [0.11.3] — 2026-09-10 — Housekeeping: bump next to 14.2.35 (disclosed CVEs)

Per `Praman_Setu_Implementation_Gap_Audit.md` §6 item 2 (Phase 2 housekeeping).

### Changed
- `package.json`/`package-lock.json`: `next` `14.2.15` → `14.2.35`, the latest 14.2.x patch — the
  pinned `14.2.15` had disclosed, since-patched CVEs (`npm install` warns on it directly). Kept as an
  exact pin (no `^` range), matching this dependency's existing convention (unlike most other
  dependencies in this project, `next` is deliberately hard-pinned per
  `docs/TECH_STACK.md`'s Version Pinning Rationale) — `npm install next@14.2.35` initially widened it
  to `^14.2.35`, corrected back to an exact pin.
- `docs/TECH_STACK.md`: updated the pinned version to match.

### Verified
- `tsc --noEmit`, `npm run lint`, `npm run build`: all clean.
- `npm run test:contracts`: 90/90 Hardhat tests passing (unaffected by this frontend-only bump, run
  anyway per the housekeeping instruction to run the full test suite after the version bump).

---

## [0.11.2] — 2026-09-10 — Housekeeping: remove stale CIPHERLOOM_STATE_AND_PLAN.md

Per `Praman_Setu_Implementation_Gap_Audit.md` §6 item 1 (Phase 2 housekeeping).

### Removed
- `CIPHERLOOM_STATE_AND_PLAN.md` — a 20 KB pre-rename audit doc. Cross-checked every finding in it
  against the current code before deleting: §0.1's anomalies fake-fallback (removed in Phase 8), §0.2's
  IPFS Pinata env-var mismatch/client-exposed secret (fixed, moved server-side in Phase 8), and §0.4's
  three subgraph mapping field-mismatch bugs (`asset-registry.ts`, `did-registry.ts`,
  `credential-registry.ts` all now read real values via bound contract calls, not adjacent-field
  workarounds) are all genuinely fixed in the current code, not just claimed fixed. §0.3's fabricated-
  deployment concern is superseded by the real Phase 7 Sepolia deployment. Nothing unresolved found to
  fold into `TODO.md` first.

---

## [0.11.1] — 2026-09-10 — Gap audit fixes, batch 8: label /onboarding as a demo walkthrough (T-057)

Closes T-057 (audit §3) — the last Phase 1 item from the 2026-09-10 gap audit.

### Changed
- `app/onboarding/page.tsx`: added a visible "Demo walkthrough — illustrative, not a real
  transaction" badge and a "Go to the real flow" link to `/identity`, plus a doc comment explaining
  the choice. Chose to keep it as an explicitly-labeled explainer rather than rebuild it as a second
  real onchain wizard — `/identity` (createDID) and `/identity/issue` (T-051) already are the real,
  working flow; duplicating that logic behind a second UI had no functional upside.

This closes out every Phase 1 item from `Praman_Setu_Implementation_Gap_Audit.md` (1.1–1.8). Phase 3's
contract-level findings (§2.1–2.5 / TODO §3.1–3.4) remain open pending sign-off per
`AI_DEVELOPMENT_RULES.md` §9.

---

## [0.11.0] — 2026-09-10 — Gap audit fixes, batch 7: governanceService onchain wiring (T-032–T-035)
## + a critical subgraph manifest fix that was silently blocking every subgraph deploy

Closes T-032, T-033, T-034, T-035.

### Added
- `lib/hooks/useAccessControl.ts`: `useProposePrivilegedGrant()` + `useCoSignGrant()` (wrap
  `TimeBoundAccessControl.proposePrivilegedGrant`/`coSignGrant` — the real path for `addAdmin`, a
  separate `pendingGrants` mapping/threshold from `pendingActions`). `useProposePlatformAction()` now
  also decodes the real `actionId` from the `ActionProposed` log.
- `lib/hooks/useGovernanceTimelock.ts`: `useResolveDispute()` wrapping the real
  `GovernanceTimelock.resolveDispute(txId, proceed)` — confirmed to exist and behave as described
  (`proceed: true` → back to Queued, `false` → Cancelled).
- `lib/queries.ts`: `GET_PLATFORM_ACTIONS`; extended `GET_GOVERNANCE`'s nested `dispute` selection.

### Changed
- `lib/services/governanceService.ts` (onchain branch), fully rewired: `getProposals`/`getDisputes`
  query real subgraph entities instead of mock fixtures; `proposeAction` branches per kind for real
  (`addAdmin`→`proposePrivilegedGrant`, `removeAdmin`→`proposePlatformAction(1, ...)`,
  `pause`/`unpause` unchanged, `upgrade`→honest "not yet supported" error — no on-chain path exists);
  `approveProposal` decodes real numeric ids (prefixed `action-`/`grant-` to disambiguate which
  contract mapping/co-sign function applies) instead of calling `BigInt()` on a mock-shaped string;
  `resolveDispute` calls the new real hook instead of unconditionally calling `executeTransaction`.
- `docs/API_SPEC.md`: added the previously-undocumented `resolveDispute` row; flagged
  `executeTransaction` as having no UI/service caller (T-053).

### Fixed — critical, found while implementing the above
`subgraph/subgraph.yaml` declared **wrong event signatures** for 5 event handlers across
`TimeBoundAccessControl`, `CredentialRegistry`, `DIDRegistry`, and `AssetRegistry` (wrong event names,
param counts, and param types — see TODO.md's governanceService entry for the full list). `graph
codegen` failed outright before this fix: **the subgraph could not have been built from the current
repo state at all**, regardless of this session's changes. Fixed all 5 signatures, plus added two
previously-missing handlers this session's own fixes need to work correctly: `handleActionCoSigned`
(`subgraph/src/access-control.ts`, populates `PlatformAction.coSigner` — schema already declared this
field, no handler ever set it) and `handleDisputeResolved` (`subgraph/src/governance-timelock.ts`,
populates new `Dispute.proceeded`/`resolvedBy`/`resolvedAt` fields — without it, T-035's real
`resolveDispute` would succeed on-chain but never stop showing as disputed in `getDisputes()`).
`graph codegen` and `graph build` both verified clean after these fixes.

**Attempted, blocked**: `graph deploy praman-setu ... --deploy-key <key>` failed with "Subgraph not
found" — the `praman-setu` slot doesn't exist under this deploy key's Graph Studio account. This
confirms and sharpens T-050 (previously: the live query endpoint returns "Not found"). Needs a human
with Graph Studio dashboard access to (re)create the subgraph slot before any deploy can succeed — see
TODO.md T-050 for the full detail and the exact redeploy command to run once that's done.

### Found, not fixed this pass (tracked in TODO.md)
- **T-053**: no UI or service method calls `executeTransaction` — a queued, undisputed tx has no way
  to actually finalize once `eta` passes.
- **T-054**: the real `addAdmin`/`removeAdmin` branching this pass built has no UI caller yet — needs
  a minimal propose form on the governance page.
- **T-055**: `/governance`, `/governance/approvals`, `/governance/disputes` are not `dataMode`-aware at
  all (still read the mock-only demo role switcher unconditionally) — needs the same page-level rewrite
  `/roles`/`/identity` already got in earlier phases.
- **T-056**: `docs/DATABASE_SCHEMA.md` §2's subgraph schema sketch doesn't match the real
  `subgraph/schema.graphql` — pervasive drift, flagged with a note, not fixed line-by-line.

---

## [0.10.9] — 2026-09-10 — Gap audit fixes, batch 6: Verifiable-Credential issuance UI (T-051)

Closes T-051 (audit §4.1) — the last unimplemented step of the onboarding workflow.

### Added
- `app/(app)/identity/issue/page.tsx`: ISSUER_ROLE-gated form to issue a real Verifiable Credential
  (subject DID, role, validity period). Linked from `/identity`'s header, shown only to issuers.
- `lib/hooks/useCredentialRegistry.ts`: `useHasIssuerRole` (ISSUER_ROLE lives on `CredentialRegistry`
  itself, a separate `AccessControl` instance — not `TimeBoundAccessControl`'s 5-role hierarchy, so the
  existing `useHasRole` would have checked the wrong contract). `useIssueCredential` now also decodes
  the real `vcId` from the transaction's `CredentialIssued` log (same pattern as `useProposeMint`).
- `lib/services/didService.ts`: new `issueCredential` method plus `lastIssuedVcId`/`isIssueConfirmed`
  reactive fields. Onchain branch computes a real `vcHash` commitment from the credential's actual
  subject/issuer/role/validUntil fields (not a placeholder). Mock branch pushes a real `Credential`
  into the mock store via a new `lib/store/mockDataStore.ts` `issueCredential` action.

### Changed
- `docs/USER_FLOWS.md` step 5, `docs/FEATURES.md` F1.2: updated to name the real UI surface and note
  it's a standalone route (no DID directory/detail-panel exists yet to hang a panel off of, revising
  the doc's earlier description).

### Found, not fixed this pass (tracked in TODO.md)
- **T-052**: the new page doesn't warn when a subject already holds a non-expired credential of the
  same role, per `docs/FEATURES.md` F1.2's edge-case spec.
- **T-050** 🔴: smoke-testing this against the live deployment (`NEXT_PUBLIC_DATA_MODE=onchain` in this
  machine's `.env.local`) surfaced that the configured subgraph URL
  (`https://api.studio.thegraph.com/query/1758953/praman-setu/v3`) returns `{"message":"Not found"}` —
  not a network error, a real dead endpoint. This blocks live verification of every subgraph-backed
  onchain-mode feature in this session (this one included) against real data; everything was verified
  by source reading + `tsc`/`next build`/lint instead, same limitation the original audit hit for
  contract compilation.

---

## [0.10.8] — 2026-09-10 — Gap audit fixes, batch 5: auditService onchain wiring (T-036, T-037)

Closes T-036 and T-037.

### Added
- `lib/server/dismissedAlerts.ts`: minimal server-side JSON-file persistence for dismissed anomaly
  alert ids (`data/dismissed-alerts.json`, gitignored — see `docs/DATABASE_SCHEMA.md` §4.1).
- `POST /api/audit/anomalies`: dismisses an alert by id + reason (documented in `docs/API_SPEC.md`).

### Changed
- `app/api/audit/anomalies/route.ts` (`GET`): overlays dismissed status/`dismissReason` from the new
  store onto each freshly-recomputed anomaly. Also fixed two latent bugs found while doing this:
  the velocity-check anomaly's `status: "investigating"` wasn't a valid `AnomalyAlert.status` value
  (normalized to `"open"`), and every emitted anomaly was missing the required `severity`/`actorDid`
  fields — `AlertCard.tsx` indexes `severity` unconditionally, so this route returning real data would
  have crashed the anomalies page on first use. Both fixed (severity by rule, `actorDid` = the real
  actor address).
- `lib/services/auditService.ts`: onchain `dismissAlert` now makes the real `POST` call and refetches;
  `subscribeToEvents` now throws a clear error in onchain mode naming the T-037 decision (kept as
  polling, not a push subscription — zero real callers exist) instead of silently no-op-ing.
- `app/(app)/audit/anomalies/page.tsx`: dismiss action is now awaited with real error surfacing
  instead of firing-and-forgetting.

### Found, not fixed this pass (tracked in TODO.md)
- **T-049**: no frontend/API-route test framework exists anywhere in this repo (only Hardhat contract
  tests) — the new endpoint above has no automated test as a result, same as every pre-existing route.

---

## [0.10.7] — 2026-09-10 — Gap audit fixes, batch 4: honest ZK proof labeling (T-015 partial)

Closes the labeling half of T-015 per the 2026-09-10 audit §4.2. The actual Semaphore/snarkjs
integration remains open (Phase 4).

### Changed
- `app/(app)/identity/page.tsx`: the "Prove role without revealing identity" card (`runZkDemo`, which
  fabricates a proof result via `setTimeout` in every data mode) is now gated behind
  `dataMode === "mock"`, carries a visible "Illustrative — not a real proof" badge, and its copy/result
  message no longer implies a real Merkle-root check happened.
- `docs/FEATURES.md` F1.4, `docs/SECURITY.md` §5.2: both now explicitly state the ZK role-proof
  feature is not yet implemented (Phase 4 roadmap) instead of reading as a shipped mitigation.

---

## [0.10.6] — 2026-09-10 — Gap audit fixes, batch 3: honest "AI" anomaly-detection labeling (T-047)

Closes T-047.

### Changed
- `README.md`, `docs/README.md`: "AI-monitored audit trail" / "AI Anomaly Detection... AI monitoring"
  reworded to "rule-based anomaly detection" / describe the real velocity + emergency-pause heuristics.
- `docs/ARCHITECTURE.md`: Anomaly Detection service row now says "Rule-based heuristics on indexed
  events (prototype); lightweight ML is a Phase 3 roadmap item" instead of implying ML ships today.
- `docs/TECH_STACK.md`: Anomaly detection row now says "TypeScript Next.js API route, rule-based
  heuristics" instead of "Python service, rule-based + lightweight ML" — the shipped implementation is
  neither Python nor ML.
- Left `docs/SECURITY.md` §5.3 and `docs/DEPLOYMENT.md`'s Phase 3 row unchanged — both already frame
  "AI anomaly-detection service" as future-facing/production-roadmap, not a claim about this build.

### Found, not fixed this pass (tracked in TODO.md)
- **T-048**: `docs/TODO.md`/`docs/CHANGELOG.md`/`docs/README.md` are stale duplicates of this file, this
  changelog, and the root `README.md` — last touched end of Phase 9, missing everything since. Needs a
  deliberate decision (delete, redirect, or repoint `AI_DEVELOPMENT_RULES.md` §6), not a drive-by fix.

---

## [0.10.5] — 2026-09-10 — Gap audit fixes, batch 2: restore `KeyRotated` event type (T-038)

Closes T-038.

### Fixed
- `lib/mock/fixtures/auditEvents.ts`: added `KeyRotated` back to the `EventType` union — a real
  `KeyRotated` event from the subgraph (`subgraph/src/did-registry.ts` has emitted it since Phase 8)
  had no matching frontend type since some point in the Phase 10 fixture-file split.
- `components/modules/EventRow.tsx`: added a `KeyRotated` entry to `eventMeta` (new `KeyRound` icon).
- `app/(app)/audit/page.tsx`: added `KeyRotated` to the audit filter's `eventTypes` list, which had
  also silently dropped it.

### Found, not fixed this pass (tracked in TODO.md)
- **T-046**: the subgraph has no mapping for `GuardianRecovery.sol` at all, so
  `GuardianRegistered`/`RecoveryInitiated`/`RecoveryFinalized` — already valid `EventType` union
  members — never actually reach the audit trail in onchain mode.

---

## [0.10.4] — 2026-09-10 — Gap audit fixes, batch 1: fabrication gates (T-040, T-044)

Closes T-040 and T-044 per Rule Zero, found respectively in the 2026-09-09 self-audit and the
2026-09-10 `Praman_Setu_Implementation_Gap_Audit.md` (§2.4).

### Changed
- `app/auth/page.tsx`: the "Simulate (demo)" button (`handleSimulateResolve`, which fakes
  wallet-signature authentication via `setTimeout`) is now gated behind `dataMode === "mock"` and
  hidden entirely in onchain mode.
- `app/(app)/dashboard/page.tsx`: the ledger stream's "Simulate" button (`simulateLiveEvent`, which
  injected a synthetic on-chain event with a fabricated tx hash into the same list as real subgraph
  events) is now gated the same way — previously it ran in *every* data mode, unlike the auth page's
  equivalent button.

### Found, not fixed this pass (tracked in TODO.md)
- **T-045**: `app/auth/page.tsx`'s real (non-simulated) `handleSign` path never advances `step` past
  `"resolving"` — no code anywhere resolves a real DID from the signature and reaches `"done"`. Gating
  T-040's simulate button means onchain-mode users now have no way to complete sign-in through this
  page until T-045 is fixed.

---

## [0.10.3] — 2026-09-09 — Phase B.3: assetService wired to real onchain data

Closes T-029/T-030, plus T-042 (found this pass, higher severity than a stub), per Rule Zero.
Partially closes T-031; T-043 stopgapped (zero real callers, same as T-027).

### Added
- `lib/hooks/useAssetRegistry.ts`: `useTransferAsset()` — real `transferFrom` write. `useCoSignMint()`
  now decodes the real minted `tokenId` from the `AssetMinted` event log, same pattern as
  `useProposeMint`'s existing `requestId` decoding.
- `lib/mock/fixtures/assets.ts`: `Asset.ownerAddress?` — the real owner wallet address, needed so
  `transferAsset` can resolve a real `from` argument without indirecting through a DID that might
  not exist. Undefined in mock mode.

### Changed
- `lib/services/assetService.ts` (onchain branch): `listAssets`/`getAsset` now query real `Asset`
  subgraph entities, each merged with its real IPFS-pinned metadata (name/category) rather than the
  mock fixture array. `proposeMint` throws if `vcId`/`recipient` are missing instead of defaulting
  to a zero placeholder. `transferAsset` performs the real credential-gated ERC-721 transfer.
- **Found and fixed, not in the original catalogue (T-042)**: the old `proposeMint` submitted a
  real transaction but returned a hardcoded fake `Asset` regardless of what was actually proposed;
  `coSignMint`'s caller separately faked `status: "finalized"` on click without waiting for the
  real co-sign transaction. `proposeMint`/`coSignMint` no longer return anything — callers read
  real, reactive progress (`lastRequestId`, `isProposeConfirmed`, `lastMintedTokenId`,
  `isCoSignConfirmed`) instead.
- `app/(app)/assets/mint/page.tsx`: mint flow now reflects real transaction state at every step;
  onchain mode's recipient-DID-hash field is relabeled to flag T-019 (it's really a DID, not a VC
  id, on the currently deployed contract).
- `app/(app)/assets/[tokenId]/transfer/page.tsx`: no longer redirects until the real transfer
  transaction confirms; recipient picker and credential check use real `rbacService`/`didService`
  data in onchain mode instead of mock fixtures.

---

## [0.10.2] — 2026-09-09 — Phase B.2: rbacService wired to real onchain data

Closes T-026/T-028, plus T-041 (found this pass, not in the original catalogue), per Rule Zero.

### Added
- `lib/hooks/useDIDRegistry.ts`: `resolveControllerAddress(did)` — imperative (non-hook) DID→address
  resolution for write paths whose target `did` is only known inside a click handler, not at render
  time; throws a clear error if the did doesn't resolve to a real registered identity, rather than
  falling back to a zero address.
- `lib/hooks/useAccessControl.ts`: `findActiveRole(account)` — imperative "which of the 5 checkable
  roles does this account currently hold," needed because `revokeRole`'s mock-era interface
  (`revokeRole(did, revokedBy)`) doesn't carry a role argument at all.
- `lib/services/shared/credentials.ts`: credential-adaptation/status/role-derivation helpers
  extracted out of `didService.ts` so `rbacService.ts` doesn't duplicate them.

### Changed
- `lib/services/rbacService.ts` (onchain branch): `grantTimedRole`/`revokeRole` resolve the real
  target address (and, for revoke, the real currently-held role) instead of hardcoding a zero
  address; `listIdentities` now queries real `Identity`+`Credential` subgraph data instead of
  returning the mock fixture array (T-041); `requestRole` throws a clear "no on-chain self-service
  path" error instead of a silent no-op; `getRoleExpiry` throws a clear "not implemented" error
  (confirmed zero real callers — `listIdentities()`'s `roleExpiresAt` already covers its purpose).
- `app/(app)/roles/page.tsx`: "who am I" now resolves via `useCurrentIdentity()` in onchain mode;
  Renew/Revoke actions are async with real error surfacing instead of firing-and-forgetting.
- `app/(app)/roles/request/page.tsx`: onchain mode shows a static "no self-service path — contact
  an Admin" message instead of the old fake "Request submitted" success state.

---

## [0.10.1] — 2026-09-09 — Phase B.1: didService wired to real onchain data

Closes T-021/T-022/T-024 from TODO.md, partially closes T-023, in full per Rule Zero — no stub
was left silently returning fake success; anything not finished throws a clear "not implemented
yet" error naming its TODO item instead.

### Added
- `lib/hooks/useCurrentIdentity.ts`: mode-aware "who am I" — resolves the real connected wallet's
  DID via `DIDRegistry.didOf(address)` in onchain mode, since none of the 5 mock-mode role-switcher
  personas correspond to a real registered identity on the deployed contract.
- `lib/hooks/useGuardianRecovery.ts`: `useGuardiansList(did)` — real guardian-list read, probing
  `guardiansOf(did, 0..4)` (`GuardianRecovery.MAX_GUARDIANS` is a real contract constant) since the
  contract has no direct "guardian count" view.
- `lib/queries.ts`: `GET_CREDENTIALS_BY_SUBJECT` subgraph query.

### Changed
- `lib/services/didService.ts` (onchain branch): `resolveDID`/`listCredentials`/`getGuardians` now
  read real chain/subgraph data instead of returning `undefined`/`[]` unconditionally; `createDID`
  generates a real client-side keypair and uploads real IPFS metadata instead of submitting
  `pubKey: "0x00"` to a real transaction. `initiateRecovery`/`signRecovery`/`finalizeRecovery` now
  throw a clear "not implemented yet — see TODO.md T-025/T-039" error instead of submitting a real
  transaction with hardcoded zero arguments — see TODO.md T-039 for why this needs a product
  decision (a guardian-acting-for-someone-else UI) before it can be wired for real.
- `app/api/ipfs/upload/route.ts`: loosened to accept any JSON metadata with a `name` field, not
  just asset metadata (`description` no longer required) — `didService.createDID` reuses this
  route for `{name, department}` onboarding metadata. Updated `docs/API_SPEC.md` to match.
- `app/(app)/identity/page.tsx`, `app/(app)/identity/recovery/page.tsx`: now resolve "me" via
  `useCurrentIdentity()` instead of the mock-mode role switcher; identity page gains a real
  "create identity" onboarding card for a connected wallet with no DID yet, shown instead of a
  silent blank/not-found state.
- `components/shell/TopBar.tsx`: role switcher is now mock-mode-only — onchain mode shows the real
  connected wallet's truncated address and real derived role instead, with no dropdown to switch it.

### Found, not fixed this pass (tracked in TODO.md)
- **T-039**: guardian recovery's actor model is backwards for onchain mode — needs a real
  "act as a guardian for someone else's recovery" UI, not present anywhere yet.
- **T-040**: `app/auth/page.tsx`'s "Simulate (demo)" button fakes wallet-signature authentication
  via `setTimeout` — a second, independent instance of the fabricated-success pattern this session
  exists to close. Out of `lib/services/*` scope for this pass; flagged so it isn't missed.

---

## [0.10.0] — 2026-09-09 — Phase 10: UI Architecture Refactor

### Changed
- **Merged `feat/sepolia-migration-ui`**: Integrated a massive ~5,000 line structural rewrite of the frontend.
- Adopted Next.js App Router route groups (`app/(app)/*`) to cleanly separate authenticated pages from public landing pages.
- Introduced brand new global layout components: `Sidebar`, `TopBar`, `ThemeToggle`, and `AlertCard` for a more robust and navigable dashboard shell.
- Re-wired the Phase 3 backend logic (Pinata IPFS uploads, Subgraph TanStack queries, Anomaly API) into the new `app/(app)` structure and a new `lib/services/*` mock/onchain data-mode abstraction (`dataMode.ts`). Of the five services built on it, only `auditService.ts` is genuinely wired to live data through this abstraction — see "Corrected" below for the rest.
- Added a client-side "Prove role without revealing identity" ZK demo button on the Identity page. **Not backed by any real implementation** — see "Corrected" below; resolution tracked separately (Phase C of the 2026-09-09 audit, not yet decided).

### Corrected (2026-09-09, same-day audit — this entry originally overclaimed)
This entry originally stated: *"Adopted `onchain` data mode globally as the new default to enforce reading live contracts over static fixtures."* **That was false and has been removed above.** `.env.example`'s `NEXT_PUBLIC_DATA_MODE` default is, and remains, `mock`. What the onchain branch actually does today, service by service:
- `auditService.ts` — genuinely real: live subgraph event query + `/api/audit/anomalies` polling.
- `didService.ts` — `resolveDID`/`listCredentials`/`getGuardians` are stubs returning `undefined`/`[]`. `createDID` and `initiateRecovery` are worse than stubs: they submit **real transactions with hardcoded fake arguments** (`pubKey: "0x00"`; zero `newController`/`newPubKey`).
- `rbacService.ts` — `grantTimedRole`/`revokeRole` target a hardcoded zero address; `getRoleExpiry` always returns `undefined`; `requestRole` is a no-op.
- `assetService.ts` — `proposeMint` submits a zero recipient/vcId when unresolved; `transferAsset` is a no-op; `listAssets`/`getAsset`/`getProvenance` return mock fixtures.
- `governanceService.ts` — `getProposals`/`getDisputes` return mock fixtures; `proposeAction` hardcodes zero role/account and mismaps action kinds onto invalid enum values; `approveProposal` calls `BigInt()` on a mock-shaped string id (throws at runtime); `resolveDispute` ignores its own `proceed` argument and always executes.
- The Identity page's "Generate proof" button fabricates a ZK verification result via `setTimeout`; no Semaphore/snarkjs code exists anywhere in the repo, despite `docs/FEATURES.md`/`docs/SECURITY.md` describing it as a stated mitigation.

Every item above is now tracked individually in `TODO.md` (T-021–T-037) and will be closed service-by-service, or explicitly gated to fail loudly rather than silently fake success, before onchain mode ships as the default.

---

## [0.8.0] — 2026-09-09 — Phase 8: Fake-data removal, real fixes, doc reconciliation

A prior pass had left fabricated/mocked data disguised as real functionality in three places, plus
several bugs that silently produced plausible-but-wrong output instead of failing loudly. This pass
removed all of it and replaced each with either real on-chain reads or an honest failure state.

### Removed
- `app/api/audit/anomalies/route.ts`: deleted the hardcoded fallback that invented two fake
  security incidents whenever the real heuristic found zero anomalies. Zero anomalies now returns
  `[]`, and the `/audit` page's existing "No anomalies detected." empty state renders correctly.
- `lib/ipfs.ts`: deleted. It silently returned a fake `ipfs://mocked-cid-*` whenever Pinata keys
  were missing or misnamed — which, due to a `NEXT_PUBLIC_`-prefix mismatch against `.env.example`,
  was firing on every single mint regardless of configuration.
- `app/assets/page.tsx`: removed the hardcoded `mintSteps` array (`done: true, true, false`)
  that displayed a static "Mint flow — Asset #45" progress stepper unconnected to any real request.
- `components/shell/ContextBar.tsx`: removed the `systemHealth.platformPaused` mock-data read that
  drove the top bar's paused/live indicator on every page regardless of actual chain state.

### Added
- `app/api/ipfs/upload/route.ts`: server-side Pinata pin. Reads `PINATA_API_KEY`/
  `PINATA_SECRET_API_KEY` (server-only, never `NEXT_PUBLIC_`) and returns a clear 500 if unset —
  never a fake CID.
- `usePendingMint` hook (`lib/hooks/useAssetRegistry.ts`) + a real mint-request lookup panel on
  the Assets page: every step shown (proposed / co-signed / executed) is read live from
  `AssetRegistry.pendingMints`, with a working "Co-sign as Manager" button for role-holders.
- Honest "Subgraph not reachable: <message>" error states on `/`, `/audit`, `/governance` when
  `NEXT_PUBLIC_SUBGRAPH_URL` is unset or unreachable, instead of a silent empty/blank result.

### Fixed
- **`lib/hooks/useAccessControl.ts`**: `ROLE.ADMIN_ROLE`/`MANAGER_ROLE`/`AUDITOR_ROLE`/`ISSUER_ROLE`/
  `SUPER_ADMIN_ROLE` were computed as a hex-encoded-and-padded role *name* instead of
  `keccak256(roleName)` — meaning every `useHasRole(ROLE.ADMIN_ROLE, ...)` check in the app was
  silently comparing against a role hash nobody had ever been granted on-chain, always returning
  `false`. Now computed via `keccak256(toBytes(name))`, matching the deployed contract exactly.
- **Subgraph mappings** — three fields that were storing the wrong value instead of the real one
  (looked fixed, weren't):
  - `subgraph/src/asset-registry.ts`: `Asset.ownerAddress` now reads the real owner via a bound
    `ownerOf(tokenId)` call (was storing the recipient's DID hash); `Asset.vcId` and
    `MintRequest.recipient` now read real values via bound `vcIdOf`/`pendingMints` calls (were
    hardcoded/wrong).
  - `subgraph/src/did-registry.ts`: `Identity.metadataURI` and `Identity.pubKey` now come from a
    bound `resolveDID()` call in both `handleDIDCreated` and `handleKeyRotated` (were storing the
    `keyType` string in the `metadataURI` field). `KeyRotated` events are now labeled `"KeyRotated"`
    instead of reusing `"DIDCreated"`.
  - `subgraph/src/credential-registry.ts`: `Credential.vcHash` now reads the real value via a
    bound `credentials(vcId)` call (was storing `vcId` itself as a stand-in).
  - `subgraph/src/access-control.ts`: `handleActionExecuted` previously labeled every
    `actionType` (emergencyRevoke, pause, unpause) as `"EmergencyPaused"`, so a real (benign)
    role revocation showed on the ledger identically to an actual platform pause. Each
    `actionType` now gets its own correct label.
- **`lib/graphql.ts`** / anomalies route: both previously read `NEXT_PUBLIC_GRAPHQL_ENDPOINT`
  (undocumented in `.env.example`) with a hardcoded Graph Studio URL as a silent fallback.
  Consolidated to the documented `NEXT_PUBLIC_SUBGRAPH_URL` everywhere; missing config now throws
  a clear error instead of falling back.
- **`lib/web3modal.ts`**: previously fell back to an all-zeros placeholder WalletConnect project ID
  with only a `console.warn` if unset, silently initializing a non-functional wallet modal. Now
  skips initialization and the UI shows "Wallet connection not configured" instead of a broken
  button.
- **`.env.local`**: consolidated duplicate/appended key declarations into their proper slots (no
  functional change — the later declarations were already the ones in effect), and renamed the
  working subgraph URL from `NEXT_PUBLIC_GRAPHQL_ENDPOINT` to the canonical `NEXT_PUBLIC_SUBGRAPH_URL`.
- **`docs/ENVIRONMENT.md`**: `NEXT_PUBLIC_CHAIN_ID=80002` was a leftover from the Polygon
  Amoy → Sepolia migration (80002 is Amoy's chain ID, not Sepolia's `11155111`); corrected, and
  the dead pre-June-2024 hosted-service subgraph URL default replaced with the real Graph Studio
  URL format.

### Corrected (this file, and `TODO.md`)
- **Deployment status was stale, in the other direction from the fake-data problem**: `TODO.md`
  previously listed Sepolia deployment as blocked on credential provisioning. It isn't blocked —
  it already happened. Verified directly against the chain and the live subgraph (not from any
  doc): all 6 contracts have real bytecode on Sepolia, the Graph Studio subgraph is indexing with
  zero errors, and the post-deploy checklist (second Super Admin, signature verifier, `ISSUER_ROLE`)
  is real and confirmed via live `hasRole()`/`signatureVerifier()` calls. See `TODO.md` for what's
  still genuinely open, including two access-control items (T-017, T-018) that need your sign-off
  before anyone acts on them, and one contract-level bug found in the process (T-019, not fixed).

---

## [0.9.0] — 2026-09-09 — Phase 9: Redeploy to close T-017/T-018, subgraph v3

### Context
A same-day earlier fix for T-017 (untracked address holding `SUPER_ADMIN_ROLE`) and T-018
(deployer retaining `DEFAULT_ADMIN_ROLE`) worked but had a side effect discovered immediately
after: it left the contract with exactly one `SUPER_ADMIN_ROLE` holder and no way to ever add
another one. See `TODO.md`'s "Resolved — T-017/T-018" entry for the full incident note.

### Changed
- Redeployed all 6 core contracts to Sepolia via an unmodified `deploy.ts` + `postDeploySetup.ts`
  run, with no manual role grants outside the two scripts this time. New addresses recorded in
  `deployments/sepolia.json` and `.env.local`; old addresses abandoned.
- `subgraph/subgraph.yaml`: updated to the new contract addresses; `startBlock` set to the actual
  deploy block (`11665400`) on all 5 data sources instead of `0` — the previous `startBlock: 0`
  made the indexer attempt a full scan from Sepolia genesis, which is why the first deploy attempt
  never finished syncing in a reasonable time.
- Subgraph redeployed to Graph Studio as `praman-setu/v3` (`.env.local`'s `NEXT_PUBLIC_SUBGRAPH_URL`
  updated to match), confirmed live and indexing with zero errors, and confirmed to correctly show
  the deployer's role revocation as `"RoleRevoked"` (not `"EmergencyPaused"`) — validating the
  Phase 8 subgraph mapping fix against real fresh data.
- Deployer intentionally retains `DEFAULT_ADMIN_ROLE` on this deployment (see `TODO.md` T-020) —
  not renounced this time, to avoid repeating the lockout.

---

## [0.5.0] — 2026-09-06 — Phase 5: Verification & Polish

### Added
- Coverage report via `hardhat coverage` (94% stmts, 83.5% branches)
- Strict ESLint configuration (`next/core-web-vitals` preset with overrides)
- Slither static analysis run on all contracts
- `CHANGELOG.md` + `TODO.md` to track state and remaining tasks

### Fixed
- Unescaped entity error in `app/audit/page.tsx`
- Slither findings:
  - Fixed `missing-zero-check` on `DIDRegistry.setGuardianRecoveryContract` and `setSignatureVerifier`
  - Fixed `immutable-states` for `owner`, `accessControl`, `didRegistry` across contracts
  - Fixed `reentrancy-events` in `GovernanceTimelock` and `GuardianRecovery` by strictly adhering to Checks-Effects-Interactions (CEI) pattern

---

## [0.6.0] — 2026-09-08 — Phase 6: Live Data Wiring & Testing Polish

### Added
- Subgraph indexer deployed to Graph Studio (`praman-setu` schema) with fully implemented mapping logic
- Wired `lib/hooks/` reads into live UI pages, replacing static mock data entirely
- Implemented cursor-based pagination on Audit stream UI (GraphQL query logic + UI load more button)
- Implemented role-based gating to `app/assets/page.tsx` using `useHasRole`
- `test/ECDSASignatureVerifier.test.ts`: Added full Hardhat coverage for cryptographic verification
- `docs/DEPLOYMENT.md`: Step-by-step production runbook documenting contract & subgraph rollouts + security post-deploy checks
- Updated `mock-data.ts` and `EventRow.tsx` with missing `KeyRotated` events.

---

## [Unreleased] — post-deploy
- **Migration:** Changed public testnet target from Polygon Amoy to Ethereum Sepolia.

### Planned
- Anomaly detection service integration (`GET /audit/anomalies`)
- IPFS upload flow for asset CIDs using Pinata

---

## [0.4.0] — 2026-09-06 — Phase 4: Live Data Wiring

### Added
- `scripts/deploy.ts` — production-hardened deploy script
  - Deterministic contract deploy order (6 contracts)
  - Auto-wires GuardianRecovery address into DIDRegistry post-deploy
  - Writes `deployments/<network>.json` with full address record
  - Best-effort Etherscan/Polygonscan source verification
  - Prints post-deploy security checklist (enroll second SUPER_ADMIN, revoke deployer)
- `lib/hooks/` — complete wagmi hook layer (23 hooks across 6 contracts)
  - `useDIDRegistry.ts`: useResolveDID, useDIDOf, useCreateDID, useRotateKey
  - `useCredentialRegistry.ts`: useIsVCValid, useGetCredential, useIssueCredential, useRevokeCredential
  - `useAccessControl.ts`: ROLE constants, useHasRole, useRoleExpiry, usePlatformPaused, useGrantTimedRole, useProposePlatformAction, useCoSignPlatformAction
  - `useAssetRegistry.ts`: useTokenURI, useVcIdOf, useOwnerOf, useProposeMint, useCoSignMint, useAttachLegalReference
  - `useGuardianRecovery.ts`: useGuardianAtIndex, useRecoveryThreshold, useActiveRecovery, useRegisterGuardians, useInitiateRecovery, useSignRecovery, useFinalizeRecovery
  - `useGovernanceTimelock.ts`: useQueuedTx, useNextTxId, useQueueTransaction, useRaiseDispute, useExecuteTransaction
  - `lib/hooks/index.ts`: single barrel export
- `subgraph/` — TheGraph subgraph scaffold
  - `subgraph.yaml`: 5 data sources covering all core contracts
  - `schema.graphql`: 9 GraphQL entities (Identity, Credential, RoleGrant, Asset, MintRequest, PlatformAction, GovernanceTx, Dispute, AuditEvent)
  - AssemblyScript mappings: `did-registry.ts`, `credential-registry.ts`, `access-control.ts`, `asset-registry.ts`, `governance-timelock.ts`

### Fixed
- `tsconfig.json`: excludes `test/`, `scripts/`, `typechain-types/`, `subgraph/` — prevents Hardhat/AssemblyScript types bleeding into Next.js TS check
- `next.config.js`: webpack stubs for `@x402/*` + `@coinbase/cdp-sdk` (transitive dead dep in wagmi's unused baseAccount connector)

---

## [0.3.0] — 2026-09-06 — Phase 3: Frontend Foundation

### Added
- `components/shell/Web3Providers.tsx` — WagmiProvider + QueryClientProvider as `'use client'` wrapper; keeps `layout.tsx` a Server Component
- `lib/abis/` — typed ABI exports for all 6 contracts (DIDRegistry, CredentialRegistry, TimeBoundAccessControl, AssetRegistry, GuardianRecovery, GovernanceTimelock); import boundary for swapping ABI sources
- `components/shell/CommandPalette.tsx` — ⌘K global action surface (cmdk); 12 commands across 5 groups; fuzzy search; blurred overlay
- `lib/commandPaletteSignal.ts` — lightweight event bus connecting ContextBar ⌘K button to CommandPalette without prop drilling
- `components/shell/DetailPanel.tsx` + `DetailPanelContext.tsx` — spring slide-in right panel (stiffness 300, damping 28); decoded event payload; PolygonScan link; copyable fields; keyboard accessible
- `app/page.tsx` — AnimatePresence per-event ledger stream animation (y=−12 spring slide); "Simulate" button for live event arrival demo; health cards animate on mount

### Fixed
- `app/audit/page.tsx`: explicit return type on `riskTone` (was `as const` on computed expression — TS1355)
- `lib/mock-data.ts`: `@ts-nocheck` for noUncheckedIndexedAccess on static fixture data
- `components/shell/ContextBar.tsx`: ⌘K button now fires `commandPaletteSignal.open()`
- `components/modules/EventRow.tsx`: added 6 missing EventType variants; added `exit` animation for AnimatePresence; wired to DetailPanel on click

---

## [0.2.0] — 2026-09-06 — Phase 2: Smart Contract Hardening

### Added
- `contracts/interfaces/ISignatureVerifier.sol` — injectable signature verifier interface
- `contracts/ECDSASignatureVerifier.sol` — production ECDSA verifier implementation
- Full `docs/SECURITY.md` — threat model, role hierarchy, access control matrix
- `docs/ARCHITECTURE.md` updated with Phase 2 finalized contract interfaces
- `docs/DATABASE_SCHEMA.md` updated — `controllerOf → didOf`, all struct corrections
- `docs/API_SPEC.md` updated — all signatures match Phase 2 contract state

### Changed (Breaking)
- `DIDRegistry.sol`: `controllerOf` → `didOf`; optional ECDSA proof on `rotateKey`; `setSignatureVerifier` + `setGuardianRecoveryContract` admin functions
- `CredentialRegistry.sol`: `issueCredential` now takes 5 args (`+vcHash` param); issuer stored as `issuerDid` not address
- `TimeBoundAccessControl.sol`: `grantTimedRole` restricted to non-privileged roles; added `proposePrivilegedGrant/coSignGrant` 2-of-N multisig; `proposePlatformAction/coSignPlatformAction` for emergency/pause/unpause
- `AssetRegistry.sol`: `proposeMint` takes 3 args (`cid, vcId, recipient`); co-signer wired to access control
- `GuardianRecovery.sol`: `registerGuardians` restricted to DID controller; 24h timelock enforced on `finalizeRecovery`
- `GovernanceTimelock.sol`: Dispute struct with `raisedBy/reason/frozen`; `resolveDispute` added

### Fixed
## [0.2.0] - 2026-09-08
- Rebranded platform name from "Praman Setu" to "Praman Setu".

## [0.1.0] - 2026-09-05 - Phase 1: Contract Environment

### Added
- Monorepo root at `praman-setu/` (Next.js 14 App Router + Hardhat in same directory)
- Contract scaffold: DIDRegistry, CredentialRegistry, TimeBoundAccessControl (UUPS), AssetRegistry (UUPS), GuardianRecovery, GovernanceTimelock
- Hardhat toolbox + OpenZeppelin Contracts Upgradeable v5
- Test suite: 86 tests covering all contracts
- `lib/mock-data.ts` — typed demo dataset mirroring DATABASE_SCHEMA.md §2
- Frontend shell: CommandRail, ContextBar, card/badge/button component library
- Module pages: Identity, Access Control, Assets, Governance, Audit
- `docs/`: ARCHITECTURE.md, SECURITY.md, DATABASE_SCHEMA.md, API_SPEC.md, UI_UX_SPEC.md
