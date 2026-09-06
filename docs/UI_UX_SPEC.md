# UI/UX Specification — BEL Chain

## 0. Design Concept

**Subject:** a defense-sector cryptographic control system, not a consumer Web3 app. The audience is
security leadership, IT admins, and auditors who need to trust the interface the way they trust a
signal-ops console — precise, quiet, legible under pressure. We deliberately avoid the generic Web3
"gradient-on-black + neon cyan" look and the generic SaaS "rounded card grid" look. The visual language
is closer to an instrument panel: a persistent rail of module glyphs, a live event ledger as the spine of
the home screen (because the actual product truth is "everything is an immutable event"), and monospace
treatment for anything that is a hash, address, or DID — because in this system, exact characters matter.

## 1. Design Tokens

### Color (dark-first; light mode is a mirrored token set, not a redesign)

| Token | Hex | Use |
|---|---|---|
| `graphite-950` | `#0A0C10` | App background |
| `graphite-900` | `#12151A` | Panel background |
| `graphite-850` | `#161A21` | Elevated panel / modal |
| `graphite-800` | `#1B1F26` | Card surface, hairline borders |
| `graphite-700` | `#242933` | Hover surface |
| `ink-50` | `#F4F5F7` | Primary text |
| `ink-400` | `#8B93A1` | Secondary text |
| `ink-600` | `#5B6371` | Disabled / tertiary text |
| `signal-500` | `#5B8DEF` | Primary interactive accent (links, active nav, primary buttons) |
| `verified-500` | `#34B37A` | Verified / active / success states |
| `alert-500` | `#E0A63E` | Pending / expiring / warning states |
| `danger-500` | `#E5484D` | Revoked / paused / critical states |

Never more than one accent color (`signal-500`) used for pure decoration; `verified`/`alert`/`danger` are
**status-semantic only** — they never appear as decoration, only as state indicators (role status, tx
status, dispute status).

### Typography

- **UI/Display:** Geist (fallback: Inter) — used for all headings, nav labels, buttons, body copy.
- **Data/mono:** Geist Mono (fallback: IBM Plex Mono) — used exclusively for DIDs, wallet addresses,
  transaction hashes, CIDs, timestamps, and role-expiry countdowns. This is a structural choice: in an
  identity/ledger product, the monospace block is how a user visually distinguishes "an exact machine
  value I could verify myself" from "prose the UI is telling me."
- **Scale:** 12 / 13 / 15 / 17 / 21 / 28 / 40 px, weights 400/500/650. Hierarchy comes from weight + size
  + the ink-50/ink-400 split, never from color alone.

### Layout Shape

No sidebar-with-labels + topbar-with-search combo. Instead:

```
┌──┬────────────────────────────────────────────────┬──────────┐
│  │  Context bar: current module · role badge · ⌘K   │          │
│R │──────────────────────────────────────────────────│  Detail  │
│a │                                                    │  panel   │
│i │        Primary content (module-specific)          │ (slides  │
│l │                                                    │  in on   │
│  │                                                    │  select) │
└──┴────────────────────────────────────────────────┴──────────┘
```

- **Rail (left, 64px):** icon-only module switcher (Overview / Identity / Access / Assets / Governance /
  Audit). No text labels — the icon + a 2px `signal-500` left-edge indicator on the active item is enough
  once a user has used it twice; first-run adds a one-time tooltip sweep.
- **Context bar:** shows current module name, the connected wallet's active role badge (color = role
  status), and the ⌘K command palette trigger — the primary way to *act* (grant role, propose mint, raise
  dispute) rather than hunting through menus.
- **Detail panel:** a right-hand slide-in (not a modal overlay) for inspecting a single DID, asset, or
  transaction — keeps the primary list/stream visible underneath for context, reinforcing "nothing here
  is ever the only copy of the truth."

### Motion

One orchestrated moment per screen, not scattered hover fades everywhere:
- **Ledger stream (Overview):** new on-chain events enter with a single upward slide + fade, ~220ms,
  spring (`stiffness: 300, damping: 30`) — this is the one animation that matters because it *is* the
  product's core promise (things happen, you see them happen).
- **Role expiry ring:** a circular countdown that visibly depletes in real time (CSS conic-gradient +
  Framer Motion), not a static progress bar — makes "time-bound" tangible.
- **Multisig approval:** each signer's avatar chip fills solid as their signature lands; the action button
  only becomes enabled with a satisfying single "unlock" spring when the threshold is met.
- Hover states are quiet: 1px border color shift + 80ms opacity change. No scale-up hover on cards.

## 2. Screens

### 2.1 Overview (`/`)
- Live ledger stream (center): every `DIDCreated / RoleGranted / AssetMinted / DisputeRaised /
  EmergencyPaused` event, newest at top, monospace hash + human label + relative time.
- Left-of-stream: system health strip — active DIDs, roles expiring in 24h, pending multisig actions,
  paused/unpaused status.
- Right detail panel: click any event → full decoded payload + link to the module.

### 2.2 Identity (`/identity`)
- Table of DIDs: identifier (mono, truncated with copy affordance), linked role, credential status
  (verified/pending/revoked chip), guardian count.
- "Register Guardians" flow: 3–5 guardian DID picker + time-lock window setting.
- "Recover Identity" flow: shows M-of-N guardian signature collection progress live.

### 2.3 Access Control (`/access-control`)
- Role matrix: rows = DIDs, columns = roles, cell = expiry ring (green >7d, amber <48h, red expired/none).
- "Grant Timed Role" command (via ⌘K or button): role, target DID, validity window, requires 2-of-3
  Admin co-sign shown as a live signer-chip row.
- Emergency section (Super Admin only): single high-contrast `Pause All` control with a confirmation
  step that names exactly what will freeze.

### 2.4 Assets (`/assets`)
- Grid of asset cards (image/doc preview from IPFS, CID shown in mono, owner DID, legal-reference chip
  if present).
- Mint flow: 3-step — upload to IPFS → propose (Admin) → co-sign (Manager) — shown as a horizontal
  stepper with the two required signatures as named chips, not generic "step 2 of 3."

### 2.5 Governance (`/governance`)
- Two lanes: **Multisig Queue** (Super Admin actions awaiting signatures) and **Timelock Queue**
  (high-value transfers in their cooling-off window, with a visible countdown and a `Raise Dispute`
  action for Auditor-role viewers).

### 2.6 Audit (`/audit`)
- Full filterable/exportable event log (same data as Overview stream, but table form + filters by actor,
  module, date range).
- Anomaly alerts panel: risk-scored flags (mint velocity, off-hours role change, mass transfer) with a
  one-line rule explanation — never a black-box score alone.

## 3. Component Inventory (all custom-styled on a shadcn/ui base — see FEATURES.md for behavior)

Card · Button (primary/secondary/danger/ghost) · Input · Select · Table · Tabs · Modal (used sparingly —
prefer slide-in panel) · Toast/Notification · Tooltip · Badge (status-semantic colors only) · Progress
ring · Command Palette (`cmdk`) · Signer-chip row · Countdown/expiry ring · Empty states (each screen has
a bespoke empty state illustration built from the mono-grid motif, not a generic "no data" icon).

## 4. Accessibility

WCAG AA contrast minimum on all text/background pairs (validated token pairs only — no ad hoc grays).
Full keyboard path for every action including multisig co-sign and dispute raise. Visible focus ring =
2px `signal-500` offset 2px. `prefers-reduced-motion` disables the ledger-stream slide-in (falls back to
instant fade) and the pulse-ring animation.
