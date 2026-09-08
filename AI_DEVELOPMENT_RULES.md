# AI_DEVELOPMENT_RULES.md

**Project:** BEL-Chain — SIH 2026, Problem Statement 26125
**Scope:** Governs any AI coding agent (Antigravity, Claude Code, Copilot, Cursor, etc.) operating on this repository.
**Status:** Mandatory. Do not bypass, shorten, or reinterpret these rules to save time.

---

## 0. Source of Truth Hierarchy

When documents conflict, resolve in this order (highest wins):

1. `docs/SECURITY.md` — security requirements are never traded off for speed or convenience.
2. `docs/ARCHITECTURE.md` — layer boundaries, data flow, service responsibilities.
3. `docs/DATABASE_SCHEMA.md` + `docs/API_SPEC.md` — must match each other and the code exactly.
4. `docs/PRD.md` / `docs/FEATURES.md` — product intent and acceptance criteria.
5. `docs/UI_UX_SPEC.md` / `docs/USER_FLOWS.md` — UX contract.
6. `original-docs/` (Gap Analysis + Complete Solution Document) — the original problem framing this build must satisfy, including unstated/future-scope items (quantum resilience, time-bound RBAC, soulbound DID + guardian recovery).

If the codebase contradicts a doc, the doc wins unless the agent flags the contradiction to the user and gets explicit sign-off to update the doc instead.

---

## 1. Mandatory Read-Before-Write Sequence

Before touching any code, the agent MUST read, in order:

1. `README.md`
2. `docs/PRD.md`
3. `docs/ARCHITECTURE.md`
4. `docs/UI_UX_SPEC.md`
5. `docs/DATABASE_SCHEMA.md`
6. `docs/API_SPEC.md`
7. `docs/SECURITY.md`
8. `docs/TECH_STACK.md`
9. This file (`AI_DEVELOPMENT_RULES.md`)
10. The actual repository state (`contracts/`, `app/`, `components/`, `lib/`) — never assume the docs match the code; verify.

No code changes, file creation, or dependency installs happen before this sequence completes for the current session.

---

## 2. Planning Before Implementation

For any non-trivial task (new feature, contract change, schema change, refactor):

1. State which doc(s) justify the change.
2. List every file the change will touch.
3. Call out any inconsistency found between docs and code, or between docs themselves, and propose a resolution.
4. Produce a short implementation plan (numbered steps) before writing code.
5. Wait for user confirmation only if the change touches `contracts/` (on-chain logic), auth/access-control, or anything in `docs/SECURITY.md`'s threat list. Non-security UI/frontend work can proceed without pausing, but must still be planned first.

---

## 3. Implementation Rules

- Implement incrementally, one feature/module at a time. Do not batch unrelated changes into a single pass.
- Run relevant tests (or `npx hardhat test` for contracts, `npm run lint`/`build` for frontend) after each meaningful unit of work, not just at the end.
- Never overwrite or delete existing functionality without first tracing its dependents (imports, callers, ABI consumers, other contracts). Search the full repo, not just the file being edited.
- Never modify a deployed/immutable contract's storage layout casually — this project uses the UUPS proxy pattern; changes to `contracts/` must preserve upgrade-safety (no reordering/removing storage variables, append-only).
- Keep on-chain and off-chain (DB/API) role-permission models in sync — `TimeBoundAccessControl.sol` and `DATABASE_SCHEMA.md`'s permission tables must never drift apart.
- Match exact versions/frameworks pinned in `docs/TECH_STACK.md`; do not silently upgrade or swap libraries.
- Any new endpoint must be added to `docs/API_SPEC.md` in the same change, not as a follow-up.
- Any new table/column must be added to `docs/DATABASE_SCHEMA.md` in the same change.

---

## 4. Security Non-Negotiables

These come directly from `docs/SECURITY.md` and the Gap Analysis. An agent must not weaken any of these even if it makes a task easier:

- All RBAC permissions are time-bound and auto-expiring — no permanent grants introduced anywhere.
- Identity is soulbound-DID based with guardian social recovery — never replace with a simple key-based login as a "quick fix."
- Crypto-agility layer stays intact — ECDSA usage must remain swappable for CRYSTALS-Dilithium/Kyber; do not hardcode ECDSA assumptions into new code.
- No secrets, private keys, or `.env` values committed. `.env.example` only ever contains placeholders.
- Multisig (Gnosis Safe) and `TimelockController` gates on governance actions must not be bypassed for convenience during testing — use testnet equivalents, not shortcuts baked into production paths.
- Any new external call, oracle, or MCP-style integration gets a threat-model note added to `docs/SECURITY.md`.

---

## 5. Testing Discipline

- New contract logic requires corresponding Hardhat tests before being considered done.
- New API endpoints require at least one happy-path and one auth-failure test case, per `docs/TESTING.md`.
- Do not mark a TODO item complete in `docs/TODO.md` without a passing test run referenced in the commit/summary.

---

## 6. Documentation Hygiene

- Every code change that alters behavior described in a doc must update that doc in the same session (not "later").
- `docs/CHANGELOG.md` gets a new entry per completed feature/fix, dated, one line, plain language.
- `docs/TODO.md` is the only place new known gaps get recorded — don't leave TODOs only as inline code comments.

---

## 7. Assumptions Policy

- Do not guess when a requirement is explicitly defined in a spec doc — follow the spec.
- When a requirement is genuinely ambiguous or missing from all docs, state the assumption explicitly in the response/commit message and pick the most conservative (most secure, least destructive) interpretation.
- Never assume test/mock data (`lib/mock-data.ts`) reflects production shape — verify against `DATABASE_SCHEMA.md`.

---

## 8. Repository & Environment Context

- Local working copy: `/Users/rudra/Development/SIH2026_Build`
- Canonical remote: `https://github.com/ruudrasharma/SIH2026`
- Reference-only source material (not part of the build, do not commit): `original-docs/Problem_Gap_Analysis.pdf`, `original-docs/Complete_Solution_Document.pdf`, kept inside the repo per `original-docs/NOTE.md`.

---

## 9. When in Doubt

Stop and ask, rather than proceeding on inference, whenever a change would:
- Alter a smart contract already referenced by a deployment script.
- Change an access-control rule.
- Touch anything under `docs/SECURITY.md`'s explicit scope.

For everything else, proceed, document the assumption, and keep moving.
