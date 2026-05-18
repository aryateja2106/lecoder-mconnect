# MConnect — Design Spec v1

> Hand this to a designer (or yourself in Figma). When prototypes come back, the implementation lane reads this doc + the prototypes and ships.

**Source of truth for tokens**: `STYLE.md` (root). Don't redefine values here — reference and extend.
**Source of truth for code**: `packages/ios-app/MConnect/` (SwiftUI, iOS 17+, MVVM).
**Tagline**: "Terminal in your pocket."

---

## 1. North Star — what the user feels

In one sentence: **"This is a terminal in my pocket. It's fast, quiet, and trustworthy."**

Three feelings the design must produce:

1. **Calm authority.** The user is controlling production-grade infra (their Mac, their AI agents). The UI must never feel toy-ish, never feel anxious, never demand attention it didn't earn.
2. **Inevitability.** Every action has one obvious next step. No dead ends. No "what do I tap now?" moments. Designed pathways, not menus.
3. **Trust through transparency.** When something happens (agent runs, secret accessed, command approved), the user can see exactly what + when. Audit logs visible by default.

What the design must NOT feel like:
- Not a "remote desktop" app (TeamViewer/Jump aesthetic — too utility, too sysadmin).
- Not a "developer tool" with rainbow syntax highlighting and 12 panels.
- Not consumer-trendy (no bouncy springs, no glassmorphism, no AI-purple gradients).

Reference brands: Linear (terseness, monospace accents), 1Password (trust + restraint), Things 3 (typography quality), TestFlight (iOS-native restraint).

---

## 2. Brand foundation

Already locked in `STYLE.md`. Designer must use these tokens:

- **Colors (dark, primary)**: `#191919` bg, `#202020` cards, `#F1ECEC` text, `#9b9b9b` body, accents only for state (`#4ade80` success, `#ef4444` error, `#fbbf24` warning).
- **Light mode**: yes, full parity. iOS user setting wins. No app-level toggle in v1 (Settings tab can ship the toggle in v2).
- **Type**: JetBrains Mono everywhere. Display 52 / H1 36 / H2 28 / H3 20 / Body 16 / Small 14 / Caption 12. Weights 400/500/600 only.
- **Spacing**: 4px grid (xs 4, sm 8, md 16, lg 24, xl 32, 2xl 48, 3xl 64).
- **Radius**: sm 4, md 8, lg 12, xl 16. Never above 16.
- **Shadows**: minimal. Borders > shadows. The one allowed shadow is the modal-sheet shadow iOS provides natively.
- **Iconography**: SF Symbols (NOT Lucide on iOS — STYLE.md says Lucide for web). Outline weight, regular by default. 17pt inline, 22pt UI, 28pt large.
- **Logo**: pixel "L" mark from `brand-assets/Logo/`. Wordmark only on launch screen + about. Never in nav bars.

### Voice & tone for UI copy

- Sentence case, no terminal periods on headlines.
- Active voice. ("Approve npm publish?" not "An approval is required for the publish operation.")
- Numbers + units, not adjectives. ("3 agents running", not "Several agents are active.")
- Errors quote the literal failure: `Connection refused: 192.168.1.5:5900`, never "Something went wrong."

---

## 3. Information architecture

### Tab structure (5 tabs, bottom nav)

```
[ Hosts ] [ Agents ] [ Terminal ] [ Screen ] [ Vault ]
```

Order rationale: left-to-right matches **mental task flow** — pair a host → see its agents → drop into terminal → optionally see screen → manage secrets.

| Tab | Icon (SF Symbol) | Purpose | Default state |
|---|---|---|---|
| Hosts | `server.rack` | Pair + manage Mac connections | List of hosts; "+" to add (QR or manual) |
| Agents | `cpu` | See running AI agent sessions across hosts | Grouped by session, with live status |
| Terminal | `terminal` | Drop into a live PTY for an agent | Picker if multiple agents; embedded SwiftTerm |
| Screen | `display` | VNC/ARD viewer to a paired Mac | Empty state → connect form → live framebuffer |
| Vault | `lock.shield` | Lockshell-managed secrets + audit log | List of stored secrets, recent grants |

> **Note**: Current code wires Terminal as a navigated child of Hosts (host → detail → terminal). Decide v1: promote Terminal to top-level tab OR keep as nav child. Recommendation: **promote** — terminal is the hero feature and must be one tap away. (Today's commits added Screen but kept Terminal nested — designer should resolve.)

### Hidden routes (no tab, deep linkable)

- `mconnect://callback` — OAuth callback handler (already wired)
- `mconnect://approve/<request-id>` — push notification deep link to approval modal
- `mconnect://session/<id>` — direct deep link to a specific terminal session

### Non-goals for v1

- No settings tab. iOS Settings.app integration only (theme, biometrics opt-in).
- No social / profile / account.
- No web dashboard inside iOS app. The web dashboard is a separate surface (`apps/web/`).

---

## 4. Screen-by-screen — what the designer must produce

For each screen: produce **6 states** at minimum: empty, populated, loading, error, success, skeleton (during initial fetch).

### 4.1 Pairing flow (first run + add host)

**Goal**: from cold app launch → paired in 30 seconds.

States:
1. **Welcome** (cold launch, no hosts). Logo + tagline + 2 buttons: **"Scan QR"** (primary), **"Add manually"** (secondary).
2. **QR scanner** (camera viewfinder, framing guide overlay, manual entry escape).
3. **Pairing** (animated dot pulse, copy: "Connecting to <hostname>… verifying token…").
4. **Paired** (success checkmark, host name + tag, button "View agents").
5. **Pair failed** (error code visible, suggested fix, retry button, "Add manually" fallback).
6. **Host list with biometric lock** (face ID / passcode required to view).

Key components: QR frame overlay, status pill (connecting/connected/offline), biometric trigger.

### 4.2 Hosts tab

**List view**:
- Row: hostname (H3) + `host:port` (small muted) + status dot (green/gray) + lock icon if TLS + Face ID icon if biometric.
- Swipe to delete (iOS native).
- Pull-to-refresh — pings each host's `/health` endpoint.
- "+" toolbar = menu: "Scan QR Code" / "Add Manually".

**Host detail view**:
- Header: hostname + tagline + connection status (large badge, animated when connecting).
- Stats: active sessions count, agent count, last connected timestamp.
- Sections: Settings (TLS toggle, biometric toggle, port edit), Danger (Disconnect, Delete host).
- CTA: "Open Terminal" (primary) "Open Screen" (secondary).

### 4.3 Agents tab

**Grouped list** by session:
- Section header: session name (or "Session abc12345" if untitled) + last activity time.
- Row: agent type (Claude Code / Gemini / Aider / Cursor / Codex) + state pill (idle / thinking / running command / awaiting input / awaiting approval) + last output preview (1 line, truncated).
- Tap row → AgentDetailView (live PTY).

**Approval pending banner** (sticky, top of list):
- Yellow background (`#fbbf24` at 15% alpha), warning icon.
- Copy: "1 approval pending". Tap → modal.
- Pulses subtly until acted on.

### 4.4 Terminal tab (the hero)

**Layout**:
- Top bar: agent picker (Menu/Picker showing all available agents), connection status icon (right).
- Body: SwiftTerm full-bleed (black bg in dark mode, white bg in light mode — JetBrains Mono 13pt, line-height 1.4).
- Bottom: collapsing input dock.
  - Collapsed (default): single-line text field + send button.
  - Expanded (tap or drag up): keyboard accessory bar (ESC, Tab, Ctrl, Arrow keys, "/" "~" "|" pipe shortcuts).
- Approval banner: appears INSIDE terminal pane when guardrail catches a dangerous command. Dim the terminal. Modal-style banner with command echo, Approve/Reject.

**States**:
- Connected idle (cursor blinking, prompt visible).
- Streaming output (auto-scroll, but pin button if user scrolls up — Things-3 style).
- Disconnected (overlay: "Connection lost. Tap to reconnect.").
- Awaiting approval (centered modal banner, terminal dimmed 40%).
- Empty (no active agent — empty state with "Start an agent on your Mac to see output here").

**Gestures**:
- Two-finger pinch — font size scale (12 / 13 / 14 / 16pt).
- Long-press on output — selection menu (copy, search in scrollback).
- Swipe right edge → scrollback timeline (1 day, 1 hour, now markers).

### 4.5 Screen tab (VNC/ARD viewer)

**Empty state**:
- ContentUnavailableView with copy: "Connect to a Mac to see its screen."
- "Connect" CTA → opens connect form.

**Connect form (modal sheet)**:
- Host (text field, prefilled if any host paired)
- Port (default 5900, hidden behind "advanced")
- Username (optional, label: "ARD username (leave blank for VNC)")
- Password (secure entry, "Save to Keychain" toggle, default on)
- Connect (primary button)

**Connected state**:
- Framebuffer fills the bounds (aspect-fit by default).
- Toolbar: zoom (1x / fit / 2x), keyboard toggle, disconnect.
- Tap → mouse click. Two-finger tap → right click. Pan → mouse move. Pinch → zoom (CSS-style, not server-side resize).
- Keyboard: tap keyboard icon → iOS keyboard slides up over bottom 1/3 of framebuffer; typing forwards to remote Mac.

**Edge states**:
- Connecting (centered spinner + "Connecting to 192.168.1.5…").
- Reconnecting (background → foreground transition; auto-attempts 3x, then shows manual retry).
- Auth failed (error message quoting RFB security type + "Check password").
- Cellular warning toast (persistent until ack: "On cellular — quality reduced").

### 4.6 Vault tab

**List**:
- Row: category icon + label (key name, e.g. "OPENAI_API_KEY") + small caption "Used by agent X, 12 min ago" if recent grant.
- Empty state: "Vault Empty — Stored credentials will appear here." + "Add" CTA.

**Add/Edit modal**:
- Label, category (API key / Password / SSH key / Other), value (secure entry).
- Lockshell template (advanced: command pattern this secret is allowed in).
- Audit log toggle.

**Audit log view** (deep route from any vault item):
- Timeline list: timestamp + agent name + command pattern + outcome (granted / denied / redacted).
- Filter by agent, by date, by outcome.
- Export to file (system share sheet).

### 4.7 Approval modal (cross-cutting)

This is the YC-demo-defining surface. Designer must perfect this.

**Anatomy**:
- Top: agent name + session id (small, muted).
- Center hero: the literal command in JetBrains Mono, syntax-highlighted (light hint of color for keywords, but mostly mono). Big enough to read on a phone in sunlight (24pt min).
- Below command: rationale from agent ("Publishing release version 0.1.8 as planned in PR #42").
- Risk pills: any guardrail flags (e.g. "writes to npm" / "deletes files" / "sends network request to api.openai.com").
- Bottom: 2 buttons. **"Reject"** (secondary, left). **"Approve"** (primary, right, requires Face ID).

**Motion**:
- Sheet slides up over current screen with iOS-native cross dissolve.
- On approve: brief checkmark animation (300ms), then sheet dismisses.
- On reject: subtle shake + sheet dismisses.

---

## 5. Components inventory

What the designer must define + Figma-component-ize:

### Atoms
- `StatusDot` (4 sizes: 6 / 8 / 12 / 16px; 4 colors: success / error / warning / muted)
- `StatusPill` (text + optional icon; 5 styles: idle / active / pending / error / success)
- `ConnectionBadge` (animated when connecting; static when connected/offline)
- `IconButton` (3 sizes: 32 / 44 / 56pt; 2 styles: solid / ghost)
- `KeyboardKey` (terminal accessory: ESC, Tab, Ctrl, etc. — 36pt height, 8pt radius)

### Molecules
- `HostRow`, `AgentRow`, `VaultRow` (list-item triplets)
- `EmptyState` (icon + title + description + optional CTA — extends iOS `ContentUnavailableView`)
- `ApprovalBanner` (inline) + `ApprovalSheet` (modal) — share same content model
- `QRFrameOverlay` (camera viewfinder framing guide)
- `BiometricGate` (Face ID prompt overlay)

### Organisms
- `TerminalSurface` (SwiftTerm bridge + accessory bar + approval overlay slot)
- `VNCSurface` (RoyalVNC framebuffer + toolbar + gesture handlers)
- `SessionGroup` (header + agent rows)
- `AuditTimeline` (chronological list, filter chips)

### Templates
- `TabbedRoot` (5 tabs)
- `NavStackScreen` (back button + title + body + toolbar)
- `ModalSheet` (drag handle + title + body + button row)

---

## 6. Interaction & motion

- **Default transition duration**: 0.15s (snap), 0.2s (feedback), 0.3s (page). Springs only on the approval-success checkmark.
- **Reduced Motion respected** (iOS setting): replace springs with cross-fade.
- **Haptics**:
  - Light impact on tab switch.
  - Medium impact on approve.
  - Notification haptic (warning) on incoming approval request.
  - Heavy impact on reject (intentional friction).
- **Loading shimmer**: skeletons for list rows during initial fetch. JetBrains-Mono-shaped placeholder bars, never circles.
- **Pull to refresh**: native iOS, no custom indicator.

---

## 7. Accessibility floor

- All interactive elements ≥ 44×44 pt hit target.
- VoiceOver labels on every icon-only button.
- Dynamic Type supported up to xxxLarge for body text. Terminal stays at user-set size (12/13/14/16pt fixed). Document this exception.
- Color contrast: 4.5:1 for body, 3:1 for large text. Verify dark + light variants both clear AA.
- Status not communicated by color alone — pair with icon + text.
- No motion-only feedback; pair with haptic or text.

---

## 8. Open design questions (for designer to resolve in v1 prototypes)

1. **Terminal as tab vs nested?** (Recommendation in §3 — needs visual proof.)
2. **Approval modal: full-sheet vs half-sheet?** (Half preserves context but truncates risk pills on small screens.)
3. **Screen tab orientation lock?** Force landscape when connected? Or allow portrait (cropped framebuffer)?
4. **Agent picker location** — top-bar Menu vs persistent left rail vs bottom dock? Affects one-handed reach.
5. **Onboarding length** — 1 screen ("Pair to begin") or 3 (welcome → permissions → pair)? Anti-pattern: 5+ screens.
6. **Empty Vault state** — should it teach lockshell, or just say "empty"? Education vs minimalism.
7. **Light mode parity** — full parity at launch, or dark-first with light-mode polish in v2?

---

## 9. Reference shots / inspiration boards

Designer should pull these into a Figma reference frame:

- **Linear** (Cmd+K UI, motion language, monospace accents)
- **Things 3** (typographic restraint, list-row composition)
- **1Password 8** (trust UI, audit log presentation, vault item layout)
- **TestFlight iOS** (status badges, beta version surfacing)
- **Tot** (zero-chrome canvas, designed for speed)
- **OpenCode website** (the "L" pixel mark lineage — `STYLE.md` cites this directly)
- **Termius iOS** (anti-pattern: too much chrome — what NOT to do)

---

## 10. Deliverables expected from the design pass

1. **Figma file** with:
   - All 5 tab screens × 6 states each (~30 frames)
   - Approval modal + sheet variants
   - Pairing flow (5 frames)
   - Components library (atoms / molecules / organisms / templates)
   - Light + dark variants in the same component sets via theme variables
2. **Prototype links** for 3 critical flows:
   - First-run pair-to-terminal (cold launch → typing in terminal)
   - Approval flow (push notification → modal → approve → confirmation)
   - Connect to Mac via Screen tab (form → connected framebuffer)
3. **Token export** — Figma variables → JSON, mapping to `STYLE.md` keys. (We can wire this to SwiftUI tokens.)
4. **Asset export** — SF Symbols + custom icons in PDF (vector) and PNG @2x/@3x.
5. **Open-question resolutions** — designer's recommendation on each item in §8 with screenshots.
6. **Motion spec** — short Loom or Figma-prototype demonstrating timing/easing on the 3 flows.

---

## 11. Out of scope for v1 design

- Marketing site (`apps/website/` is a separate surface and a separate design pass).
- Web PWA terminal (`apps/web/` — different responsive concerns; iOS app design is the source for visual language but not literal layouts).
- Apple Watch / iPad / visionOS / macOS — NOT v1. Design with phone-first layout. No multi-column variants.
- Onboarding video / motion graphics — text-only onboarding at launch.
- In-app purchase / subscription UI — none in v1.

---

## 12. Working agreement (designer ↔ implementer)

- **Source of token truth**: `STYLE.md`. Anything new the designer wants → propose an additional row, don't override existing.
- **Naming**: Figma component name = SwiftUI view name. `HostRow` in Figma = `HostRow.swift`. Never diverge.
- **Light mode** is implementer's responsibility once dark variant approved. Designer specifies color tokens, not pixel values, so iOS appearance auto-adapts.
- **Dev hand-off**: every prototype frame links to the SwiftUI view it maps to (file path comment in Figma).
- **Iteration cadence**: 1 round of designer mock → 1 round of implementer feedback → 1 polish round → ship. No more than 3 rounds before MVP.

---

## 13. References

- `STYLE.md` — color/type/spacing tokens (canonical)
- `brand-assets/Logo/` — logo + wordmark SVGs
- `packages/ios-app/MConnect/` — current SwiftUI implementation (5 view trees: Hosts/Agents/Terminal/Screen/Vault)
- `.omc/YC-PITCH-V1.md` — product positioning
- `.omc/DEMO-VIDEO-SHOT-LIST.md` — what the user sees in the 60s pitch (informs hero shots)

---

**Spec version**: 1.0  
**Date**: 2026-05-03  
**Owner**: Arya Teja Rudraraju  
**Next**: Designer prototypes Figma → implementer reads this doc + prototypes → ship.
