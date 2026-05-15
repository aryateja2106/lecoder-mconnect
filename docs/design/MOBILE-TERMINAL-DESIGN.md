# MConnect Mobile Terminal — iOS-First Design Reference

Source: redesign screenshot shared 2026-05-07. This is the canonical reference for the iOS-style mobile terminal experience. The web client (`apps/web`) and the native iOS client (`packages/ios-app`) should both target this look and behavior.

## Layout (top → bottom)

### 1. Status bar (system, untouched)

Standard iOS status bar with safe-area inset. UI must respect `env(safe-area-inset-top)`.

### 2. App header (sticky, ~56pt)

| Region | Content | Notes |
|---|---|---|
| Left | Back chevron in pill button | Returns to machines list |
| Center | Session title with chevron disclosure: `● Shell ⌄` | Green dot = active session. Tap opens session switcher / new tab. |
| Right | Connection status pill: `● Connected` | Green dot, lozenge-shaped, soft white pill on dark bg |

Header background: white pill chips on the dark terminal background — light mode chips on dark canvas. This matches iOS "glassy" controls.

### 3. Terminal body (fills available space)

- Pure black background `#000000`.
- Monospaced font (SF Mono on iOS, JetBrains Mono / Fira Code as web fallback).
- Color palette (already visible in screenshot): green prompts/arrows, blue directories, magenta images, gray plain files, white text, default cursor block.
- Long-press anywhere selects word; drag handles extend selection (use native iOS selection on the WKWebView; for web, intercept long-press to use `Selection` API + custom handles).
- Pinch-to-zoom adjusts font size (12 → 22pt clamp).
- Tap on output dismisses keyboard / floating pill if shown.

### 4. Floating control pill (centered above keyboard, ~48pt tall, ~280pt wide)

Translucent dark pill, 5 round buttons:

1. **Mic** — voice-to-text / dictation into the terminal
2. **Keyboard** — toggle iOS keyboard show/hide
3. **Sparkle / AI** — open quick agent action sheet (Run agent, Resume session, …)
4. **Tuner / Settings** — session settings (font size, theme, keep-alive)
5. **X** — dismiss pill

Implementation note: the pill should auto-hide after 3s of input inactivity and reappear on a 2-finger tap or upward edge swipe.

### 5. Hardware-key toolbar (above iOS keyboard, two rows, ~88pt total)

Light pills on dark background, ~36pt tall each.

**Row 1 (modifiers + control):** `Esc` `Tab` `Ctrl` `Shift` `Alt` `Cmd` `Del`
- Modifier keys (`Ctrl`, `Shift`, `Alt`, `Cmd`) are **sticky toggles** — tap once to arm for next keystroke, double-tap to lock, tap again to release. Visually: armed state shows filled background.
- `Esc` and `Del` send immediately.
- `Tab` sends `\t`.

**Row 2 (navigation):** `←` `↑` `↓` `→` `Home` `End` `PgUp` `PgDn`
- Arrows send xterm sequences (`ESC[A` etc.).
- `Home`/`End`/`PgUp`/`PgDn` map to standard xterm escapes.
- Long-press on arrows = key repeat at 60ms intervals.

### 6. iOS keyboard (system)

Standard. We do NOT replace it. The toolbar above is a `UIInputAccessoryView` on native, a sticky CSS `position: sticky; bottom: env(keyboard-inset-height, 0)` band on web.

## Critical UX rules

1. **Copy-paste must "just work."** Long-press in terminal → iOS context menu shows Copy/Paste/Select All. Tapping Paste pipes clipboard text into the PTY (with bracketed-paste markers if the shell supports them).
2. **No virtual scrollbar that hides content under the toolbar.** Toolbar reserves bottom space; terminal scrolls within remaining viewport.
3. **Keyboard show/hide is animated in sync with the toolbar.** Use the `visualViewport` API on web; `keyboardWillShowNotification` on native.
4. **Hardware modifier sticky-state survives until release.** A user tapping `Ctrl` then `c` should send SIGINT, full stop — no more, no less.
5. **Connection state pill is always live.** Reflect WebSocket state: green = Connected, amber = Reconnecting, red = Disconnected.
6. **Safe-area inset everywhere.** Header respects top inset; toolbar respects bottom (home indicator) inset when keyboard is hidden.
7. **Two-finger tap on terminal body** = quick agent actions sheet (Run, Stop, Resume).

## Color tokens (locking this in)

```css
--bg-terminal: #000000;
--fg-terminal: #ffffff;
--accent-prompt: #4ade80;     /* green prompt arrow */
--accent-dir: #818cf8;        /* indigo for directories */
--accent-image: #f472b6;      /* magenta for images */
--accent-muted: #9ca3af;      /* gray for plain files */
--chip-bg: rgba(255,255,255,0.95);
--chip-fg: #111827;
--pill-bg: rgba(0,0,0,0.55);  /* floating control pill */
--pill-fg: rgba(255,255,255,0.9);
--status-connected: #22c55e;
--status-reconnecting: #f59e0b;
--status-disconnected: #ef4444;
```

## Components to build / refactor

In `apps/web` (Next.js, xterm.js):

- `components/terminal/MobileTerminalShell.tsx` — outer layout, safe-area, viewport handling
- `components/terminal/SessionHeader.tsx` — back button, session pill, connection status
- `components/terminal/FloatingControlPill.tsx` — mic / keyboard / AI / settings / dismiss
- `components/terminal/HardwareKeyToolbar.tsx` — two-row key bar with sticky modifier state
- `hooks/useStickyModifiers.ts` — Ctrl/Shift/Alt/Cmd state machine
- `hooks/useVisualViewport.ts` — track keyboard height for toolbar positioning
- `hooks/useTerminalSelection.ts` — long-press → native context menu integration

In `packages/ios-app` (SwiftUI):

- `Views/Terminal/MobileTerminalView.swift`
- `Views/Terminal/SessionHeaderView.swift`
- `Views/Terminal/FloatingControlPill.swift`
- `Views/Terminal/HardwareKeyAccessory.swift` — `UIInputAccessoryView` host
- `ViewModels/StickyModifierState.swift`
