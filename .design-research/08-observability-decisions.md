# Observability Dashboard — Locked Decisions

> Source: parallel designer agent. Full prose lost to summary wrapper but anchor decisions captured.

## Locked decisions

1. **Default landing = control room (live state), not metrics dashboard**
   - Developers need "what's running NOW" before "what happened over time"
   - Charts/historical metrics live in second-tier nav

2. **Mobile drill-down = bottom sheet, NOT nav push**
   - Preserves ambient real-time context
   - Native iOS/Android pattern, swipeable

3. **Triple-encoded status = icon + color + text label**
   - WCAG AA without sacrificing density
   - Color-only is BANNED (per a11y audit)

4. **Opik integration surface = inline drawer (NOT separate tab)**
   - Respects progressive disclosure
   - Jordan persona: doesn't see it unless asks
   - Sam persona: sees aggregate in detail panel
   - One-click expand for full traces

5. **Status tokens (extends STYLE.md)**
   - Running: blue `#3B82F6` (4.5:1 verified on #191919)
   - Queued: violet `#8B5CF6` (4.5:1 verified on #191919)
   - Already in STYLE.md: success/error/warning
   - Token doc proposal: also add idle grey + extended luminance variants

6. **Motion rules**
   - Linear-inspired: opacity layering, no color shifts
   - Real-time updates without flicker (key-stable React lists)
   - 150ms snappy transitions, no perpetual animations on live data
   - Reduced-motion fallback for any sparkline animation

## Information architecture (inferred)

Top-level nav (max 5 — mobile bottom-tab constraint):
1. **Control Room** — live agent grid (default)
2. **Sessions** — historical session log
3. **Traces** — Opik traces tab (also reachable inline)
4. **Audit** — file ops, guardrail blocks, decisions
5. **Settings** — sync, integrations, notifications

## Metric ranking (must / nice / hide)

**Must show (above the fold)**
- Active agents count + per-agent status (running/idle/waiting/error)
- Connection / sync state
- Recent guardrail blocks (if any in last hour)
- One-tap "kill all" / "pause all"

**Nice to show**
- Token usage / cost per agent (Claude Max, Gemini Pro, etc.)
- Tasks in flight + completion rate
- Active collaborators
- Latency p50/p95

**Hide unless drilled in**
- Tool call breakdown
- Per-file ops
- Network call detail
- Audit log raw entries

## Hero layout (descriptive)

**Desktop 1440px**: 
- Left rail: nav (60px collapsed icon, 220px expanded)
- Main: bento grid `2fr 1fr` — primary active agent (large card), secondary agents (compact column)
- Right rail (collapsible 360px): activity feed + Opik inline drawer

**Tablet 768px**:
- Top nav (collapsed)
- 2-col agent grid
- Activity feed at bottom

**Mobile 375px**:
- Top: persistent status bar (active count + connection quality)
- Single-column swipeable agent cards (snap-x)
- Bottom tab nav (5 items)
- Long-press card → bottom sheet (detail + Opik drawer)
- Pull-to-refresh on grid

## Agent detail bottom sheet

Sections (top to bottom):
1. Agent identity (name, type, accent, status)
2. Live terminal preview (compact xterm, 200px height)
3. Decision log timeline (last 5 decisions)
4. File ops (collapsible)
5. Comments thread (collaboration)
6. Opik trace summary (inline drawer — expand to full)
7. Share controls (link + permission selector)
8. Destructive: stop / restart / kill (long-press confirm)

## Convenience patterns confirmed

- **Cmd-K spotlight** for jumping agents (Linear pattern)
- **Glanceable system health indicator** in nav (green dot / amber dot / red dot)
- **One-tap "kill all" / "pause all"** with confirm haptic
- **Notification preferences per event type** (settings)
- **Mobile pull-to-refresh** + haptic on alert

## Open questions (for product)

1. Multi-session: 1 dashboard view across all sessions, or 1 per session?
2. Token cost attribution: per-agent, per-session, per-day, or all three?
3. Guardrail remediation: in-dashboard approve/deny, or notification-only?
4. Collaboration presence: avatar bar in nav, or per-card?
5. Opik project scope: one project per workspace, or per session?

## Component build priority

1. Agent card (highest density, sets visual rhythm)
2. Mobile bottom sheet (most complex interaction, surfaces xterm sizing)
3. Activity feed item
4. Cmd-K palette
5. Inline Opik drawer
