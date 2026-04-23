# LeCoder MConnect — Design System Research Bundle

> Generated 2026-04-15 by 6 parallel research agents + synthesis pass.
> Status: research + spec only. No code edits this run (per user direction).

## Read order

| # | File | What it is |
|---|---|---|
| 00 | `00-INDEX.md` | This file — entry point |
| 01 | `01-surface-audit.md` | Forensic audit of website + web PWA + observability. Top 10 jarring inconsistencies. |
| 02 | `02-voice-and-tone.md` | Editorial system. Calm-operator voice. Microcopy patterns. |
| 03 | `03-mobile-a11y-audit.md` | Mobile PWA + a11y audit. Convenience scorecard 4.4/10. Top 10 wins. |
| 04 | `04-token-architecture.md` | Token system architecture proposal. Layer model. Distribution strategy. |
| 05 | `05-resource-synthesis.md` | Cross-resource synthesis. Top 10 patterns from Warp/Linear/Notion/Vercel/Impeccable/UI-UX Pro Max/21st.dev/Taste. |
| 06 | `06-social-kit-decisions.md` | 3 locked anchors: amber accent, cursor-notch L, pixel-craft illustration. |
| 07 | `07-competitive-decisions.md` | 4 locked decisions from competitor survey. Conflicts flagged. |
| 08 | `08-observability-decisions.md` | Dashboard locked decisions: control room landing, bottom sheet drill-down, triple-encoded status, inline Opik drawer. |
| 09 | `09-DESIGN.md` | **THE DELIVERABLE.** Canonical design system spec. Successor to STYLE.md. LLM-readable. |
| 10 | `10-social-kit-spec.md` | Full social brand kit: 9 asset templates with ASCII sketches, taglines, motion, anti-patterns, 5-asset roadmap. |
| 11 | `11-IMPLEMENTATION-ROADMAP.md` | 8-phase build plan across 5 surfaces. Effort buckets. Pitch-ready 5-day path. |

## TL;DR for the user

### The 5 decisions you need to lock (Phase 0)

1. **Brand accent**: Terminal Amber `#E8A030` ✅ recommended (vs teal `#00D4AA` alternative)
2. **Font**: Geist Sans + Geist Mono ✅ recommended (free; ABC Diatype Variable as Q2 upgrade)
3. **Greyscale**: Warm-shifted ✅ recommended (vs current cool-grey)
4. **Logo**: Cursor-notch L ✅ recommended (additive amber pixel; existing mark unchanged)
5. **Replace STYLE.md** with `09-DESIGN.md` ✅ recommended (single source of truth)

### What's broken right now (audit findings)

- Web PWA `manifest.json` is referenced but **doesn't exist** — install is broken
- Web PWA blocks pinch-zoom (WCAG 2.2 violation)
- xterm `screenReaderMode` is OFF — blind users can't read agent output (kills product value prop)
- Web PWA drifted to zinc palette + cyan accent (40% token-aligned)
- All icon-only buttons missing `aria-label`
- All 4 modals lack focus trap
- Critical text contrast failing AA (zinc-500/600 on bg-zinc-950)
- No haptics anywhere except approval (should be on grant/release/kill/error/pair)
- ReconnectOverlay + OfflineQueue components built but never rendered
- Token persists in URL forever (screenshot-leak risk)
- Convenience scorecard: 4.4/10 overall

### What's the upside (post-implementation)

- Convenience score 4.4 → 7+ with critical-only fixes (~2 days work)
- 3 highest-leverage fixes (manifest+SW, viewport unlock, xterm screenReaderMode) each <2 hours
- Pitch-ready design system rolled across all surfaces in ~5 dev-days
- Full system rollout in 6-8 dev-weeks
- Differentiation moats unlocked: haptics, swipe-actions, persistent status bar, sheet-keyboard input

### What's NOT in this bundle (next steps)

- Actual component refactors (per user direction: spec only this run)
- New STYLE.md replacement (pending Phase 0 approval)
- Figma file (designer to author from `10-social-kit-spec.md`)
- Token package code (Phase 1)
- Service worker code (Phase 3 critical)

## How to use this bundle

### If you want to lock decisions and start building

1. Read `09-DESIGN.md` — confirm or reject the 5 Phase 0 decisions
2. Read `11-IMPLEMENTATION-ROADMAP.md` — pick scope (pitch-ready 5-day, or full 6-8 week)
3. Pass `09-DESIGN.md` + `10-social-kit-spec.md` to next dev/designer

### If you want to use this with AI coding agents

1. Drop `09-DESIGN.md` into any agent's context (it's LLM-readable per Stitch convention)
2. Agent will produce code matching the system without further prompting
3. Pair with AGENTS.md (how to build) — DESIGN.md (how to look)

### If you want a second opinion

1. The 6 underlying agent reports (01-08) are the raw research
2. You can audit any synthesis claim against its source
3. File paths + line numbers cited throughout

## Conflicts surfaced (need user resolution)

| Conflict | Source A | Source B | Recommendation |
|---|---|---|---|
| Accent color | Social kit: amber `#E8A030` | Competitive: teal `#00D4AA` | Amber (locked in DESIGN.md) — teal demoted to data-viz-only |
| Font | Synthesis: Geist (free) | Competitive: Diatype (~$500) | Geist now, Diatype Q2 evaluation |

Both resolved in `09-DESIGN.md`. Override if you disagree.

## Agents used

| Agent | Type | Output quality |
|---|---|---|
| Surface audit | Explore | ✅ full, detailed, file:line cited |
| Mobile/a11y audit | accessibility-expert | ✅ full, severity-rated, scorecard |
| Resource synthesis | researcher | ✅ full, top-10 pattern synthesis |
| Competitive | designer | ⚠️ summary-wrapped, anchors only |
| Observability dashboard | designer | ⚠️ summary-wrapped, anchors only |
| Social kit | designer | ⚠️ summary-wrapped, anchors only |

The 3 designer agents returned meta-summaries instead of full prose due to a wrapper template. Anchor decisions were captured; full specs were authored manually from the anchors. If higher fidelity needed, use `general-purpose` or `researcher` agent type for design-spec re-prompts.
