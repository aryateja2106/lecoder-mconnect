# LeCoder MConnect — Mobile UX & A11y Audit

> Source: parallel a11y agent. Convenience score 4.4/10. Critical PWA + screen-reader gaps.

## Top 10 Wins (ranked by user impact)

1. **Create missing `/manifest.json`** — `apps/web/src/app/layout.tsx:7` references it but file doesn't exist. PWA install broken for "terminal in your pocket" product. Add icons (192/512/maskable), display:standalone, theme_color, start_url:"/".
2. **Stop blocking pinch-zoom** — `layout.tsx:18-19` `maximumScale:1` + `userScalable:false` violates WCAG 2.2 SC 1.4.4. Remove both.
3. **Bump pairing input font to 16px** — `OfflineQueue.tsx:101` is `text-sm` (14px) → iOS auto-zoom on focus. Enforce 16px min on every `<input>`.
4. **Fix bottom-sticky overlap with software keyboard** — `ControlBar.tsx:67,79` uses `fixed bottom-0`. Use Visual Viewport API (`window.visualViewport.height`) to float above keyboard, or `100dvh` + `interactive-widget=resizes-content`.
5. **Enforce 44pt tap targets on icon controls** — `page.tsx:298-308` (~24px), `OfflineQueue.tsx:108-139` (~24px), `page.tsx:736-742` back arrow (~26px). WCAG 2.2 SC 2.5.8 requires ≥24px; HIG/Material 44/48. Use `min-w-11 min-h-11`.
6. **Add aria-label to every icon-only button** — none have one. Back, copy, demo controls, edit/remove, terminal itself.
7. **Enable xterm screen-reader mode** — `TerminalView.tsx:21-51` constructor missing `screenReaderMode:true` + `screenReaderLiveRegion:true`. Container needs `role="application"` + `aria-label="Terminal output"`.
8. **Focus traps in 4 modals** — `ControlBar.tsx:152,178`, `TakeControlButton.tsx:64,115`, `OfflineQueue.tsx:147,177` lack focus trap, `role=dialog`, `aria-modal`, Escape close, focus restoration. Use Radix/HeadlessUI dialog.
9. **Add prefers-reduced-motion** — 8+ spinners, animate-pulse status dot, transitions everywhere. Add global media query reducing animation/transition durations.
10. **Expand haptics** — `useWebSocket.ts:228-230` only vibrates on approval. Add: control grant, kill success, command_blocked, disconnect, pairing success. Persist user toggle in localStorage.

## Critical Findings by Dimension

### Touch & gesture
- Copy button uses `opacity-0 group-hover:opacity-100` — INVISIBLE on touch (`page.tsx:298`)
- Zero swipe gestures
- Kill button adjacent to Approve — fat-finger risk despite confirm modal
- `justify-between` pushes destructive Kill to far edge

### Mobile keyboard / viewport
- Visual Viewport API NEVER USED (confirmed by grep)
- No `padding-top: env(safe-area-inset-top)` on header — notch overlap on landscape
- `h-screen` instead of `h-dvh` — iOS dynamic toolbar bottom-bar cutoff
- No orientationchange listener on xterm fit

### Scroll
- No `overscroll-behavior: contain` on terminal — pull-to-refresh DESTROYS session
- No `-webkit-overflow-scrolling: touch` on session list / offline queue
- `useScrollback.ts:95-119` has loadMore but NO IntersectionObserver wires it — users can't see history beyond live buffer
- `sessionStore.ts:134-138` stores lastScrollPosition but nobody reads/writes it

### PWA quality
- manifest.json: 404
- No service worker — page won't load offline despite "offline queue" feature
- No iOS apple-touch-icon
- No beforeinstallprompt capture
- No theme-color meta — wrong status bar color

### A11y critical
- xterm screenReaderMode = false — blind users CAN'T READ AGENT OUTPUT (kills product value prop)
- All 4 modals lack focus trap
- No `*:focus-visible` global rule
- Color-only signaling on session status dots and ControlStatus
- Contrast failures:
  - `text-zinc-500` on `bg-zinc-950` ≈ 4.21:1 — fails AA for body
  - `text-zinc-600` on `bg-zinc-950` ≈ 3.05:1 — fails AA
  - `disabled:text-zinc-500` on `bg-zinc-700` ≈ 2.8:1 — fails AA
  - Fix: raise meta text to `text-zinc-400` (≈6.8:1)
- Pairing inputs lack labels — SR hears "edit text" 6 times
- Heading hierarchy: missing h1 on main terminal view

### Connection / state
- 🎮 emoji in demo banner not aria-hidden
- "Invalid code" error not announced (no role=alert)
- Reconnect 3s no backoff, no max attempts — drains battery on flaky cellular
- ReconnectOverlay component EXISTS BUT NEVER RENDERED (dead code)
- OfflineQueue component built but NOT WIRED into page.tsx
- No connection-quality indicator (RTT measured but not surfaced)
- "Unauthorized" state has no re-pair CTA
- Token persists in URL forever — screenshot leaks token

## Convenience Scorecard

| Dimension | Score | Why |
|---|---|---|
| One-handed use | 5 | Bottom bar correct, but icon targets small, Kill adjacent to Approve, no swipes |
| Blind reachability | 4 | Primary actions bottom+large (good), but no haptics on grant/release, many p-1/p-1.5 |
| Glanceability | 6 | Strong language but color-only state, low-contrast meta text, no signal indicator |
| Error recovery | 5 | Retry exists but no backoff, orphaned overlay, offline queue unwired, no role=alert |
| Install friction | 2 | manifest 404, no SW, no install prompt, no iOS icons, pinch-zoom disabled |

**Overall: 4.4/10**

3 highest-leverage fixes (manifest+SW, viewport unlock, xterm screenReaderMode) each <2 hours and move score to ~7.

## Component-Level Quick Wins
- ControlBar: separate Kill from Approve (long-press Kill or secondary toolbar)
- Copy button: always-visible 50% opacity (no hover)
- Status dots: add icon + text label (not color-only)
- All icon buttons: `min-w-11 min-h-11` + aria-label
- xterm container: `role=application` + `aria-label`, screenReaderMode in constructor
- Pairing inputs: `aria-label="Digit N of 6"` + `role=group`
