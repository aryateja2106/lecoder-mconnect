# LeCoder MConnect — Design System Implementation Roadmap

> What to build, in what order, with effort buckets. NO code in this run (per user direction).
> Codifies the synthesis from `09-DESIGN.md` into a phased plan across 5 surfaces.

## Surfaces (recap)

| # | Surface | Path | Status |
|---|---|---|---|
| 1 | Marketing website | `apps/website` | Exists, 95% token-aligned |
| 2 | Mobile PWA | `apps/web` | Exists, 40% token-drifted, PWA broken |
| 3 | Observability dashboard | `apps/observability` | Empty greenfield |
| 4 | Documentation site | NEW (proposal) | Doesn't exist |
| 5 | Social brand kit | `brand-assets/` + Figma | Logo+wordmark only |

---

## Phase 0 — Approve & lock (DO FIRST)

User decisions needed before any code:

| Decision | Recommendation | Alternative | Locked? |
|---|---|---|---|
| Brand accent | Terminal Amber `#E8A030` | Teal `#00D4AA` | pending |
| Font pair | Geist Sans + Geist Mono (free) | ABC Diatype Variable (~$500/style) | pending |
| Greyscale shift | Warm-grey (warmer than current) | Cool-grey (current STYLE.md) | pending |
| Logo evolution | Cursor-notch L (additive amber pixel) | Keep current L unchanged | pending |
| Replace STYLE.md | Yes, with `09-DESIGN.md` | Keep both, deprecate gradually | pending |
| Mono in marketing | Mono for facts, sans for everything else | Mono everywhere (current) | pending |
| Light mode | Required (observability + marketing) | Dark-only | pending |

**Cost of no decision**: parallel teams continue building drift. Worth ~30 min sync to lock.

---

## Phase 1 — Token foundation (build once, share everywhere)

**Output**: `packages/design-tokens` workspace package consumed by all 5 surfaces.

### Tasks

1. Create `packages/design-tokens/` Bun workspace package
2. Author primitives (TS source of truth)
3. Generate distributions:
   - `dist/tokens.css` — CSS custom properties
   - `dist/tokens.tailwind.js` — Tailwind theme extension
   - `dist/tokens.json` — for design tools
4. Wire each app's `globals.css` to import token CSS
5. Wire each app's `tailwind.config` to extend with token plugin
6. Add `prefers-color-scheme: light` block + `[data-theme="light"]` override
7. Add `prefers-reduced-motion` block reducing all duration tokens to 0.01ms
8. Add Geist + Geist Mono font hosting (next/font/google or self-host)

**Effort bucket**: M (medium) — single dev, 1-2 days
**Blockers**: Phase 0 decisions
**Validation**: render a test page in each app showing all tokens; check side-by-side identical

---

## Phase 2 — Component primitive library

**Output**: `packages/ui` shared component library, consumed by web + observability + (eventually) website.

### Components in build order

1. **Button** (sm/md/lg, primary/secondary/ghost/destructive variants, loading + disabled states)
2. **Input** (text, number, password — 16px font min, focus ring, error state, disabled)
3. **Card** (default, hover, with-action-bar variants)
4. **Badge / Pill** (status, count, accent)
5. **StatusDot** (sm/md/lg, with optional pulse, triple-encoded)
6. **Toast** (info/success/warning/error, auto-dismiss, queue)
7. **Modal / Dialog** (Radix or HeadlessUI base, focus trap built-in)
8. **BottomSheet** (mobile-first, swipe-down dismiss, focus trap, aria-modal)
9. **Tabs** (top + bottom variants)
10. **Spinner / Skeleton** (skeleton matches layout, spinner for inline only)
11. **CommandPalette** (cmd-k, fuzzy search, keyboard nav)
12. **TerminalView** (xterm wrapper, screenReaderMode enabled, theme tokens, mobile gestures)

### Cross-cutting requirements every component must meet

- All sizes use semantic spacing tokens
- All colors via CSS variables (zero hardcoded hex)
- All have visible `:focus-visible` ring
- All icon-only buttons require `aria-label` prop (TS-enforced)
- All animations honor reduced-motion
- All have 44pt min touch target
- All have Storybook story + a11y test
- All have light + dark mode validation

**Effort bucket**: L (large) — 1 dev, 1-2 weeks for primitive set + Storybook
**Validation**: axe-core a11y scan passing on every component story

---

## Phase 3 — Mobile PWA hardening (`apps/web`)

The current PWA is the most drifted + has critical functional gaps. Audit produced 10 critical fixes.

### Critical fixes (P0 — half-day each)

1. Create `public/manifest.json` (icons 192/512/maskable, theme_color, standalone)
2. Add minimal service worker (offline shell, page cache, queue support)
3. Add iOS apple-touch-icon (180×180) + apple-* meta tags
4. Remove `maximumScale: 1` and `userScalable: false` from viewport meta
5. Enable xterm `screenReaderMode: true` + `screenReaderLiveRegion: true`
6. Add `role="application"` + `aria-label="Terminal output"` on xterm container
7. Bump all `<input>` font-size to 16px min (prevents iOS zoom)
8. Replace `h-screen` → `h-dvh` everywhere
9. Add safe-area insets to header (top + landscape sides)
10. Add `overscroll-behavior: contain` on terminal container (prevents pull-to-refresh kill)

### High-impact fixes (P1)

11. Wire focus trap on all 4 modals (`ControlBar`, `TakeControlButton`, `OfflineQueue`)
12. Add `aria-label` to every icon-only button (~12 instances)
13. Add global `:focus-visible` outline rule
14. Triple-encode all status (icon + color + text) — replace color-only status dots
15. Bump low-contrast text (raise zinc-500/600 → grey-700+ for AA)
16. Add reconnect exponential backoff (3→6→12→cap 60s) + visible attempt counter
17. Wire `IntersectionObserver` for xterm scrollback `loadMore`
18. Persist scroll position via existing `lastScrollPosition` field
19. Capture `beforeinstallprompt` + show dismissible "Add to Home Screen" banner
20. Add `prefers-reduced-motion` global rule

### Convenience differentiators (P2 — the moat)

21. Haptic feedback: pair success, control grant/release, kill, error, approval
22. Swipe-left on agent cards: pause, kill, share, mute
23. Persistent top status bar: active count + 3-bar signal
24. Visual Viewport API: bottom-sheet input pinned above software keyboard
25. Pull-to-refresh on agent grid (with haptic)
26. Long-press card → bottom sheet detail (preserves real-time context)
27. Token in URL → move to `sessionStorage` (screenshot-leak fix)
28. Wire orphaned `ReconnectOverlay` + `OfflineQueue` components into page

### Migration off zinc

29. Replace `bg-zinc-950` etc. → `bg-[var(--color-bg-canvas)]` everywhere
30. Replace cyan-500/yellow-500 hardcoded → semantic status tokens or accent
31. Replace `font-sans` body → keep sans for chrome, mono for facts (per DESIGN.md §4)

**Effort bucket**: L (large) — 1 dev, 1.5-2 weeks for full pass
**Critical-only**: 1 dev, 2 days
**Validation**: Lighthouse PWA score ≥90, axe-core 0 violations, real-device test on iOS 17 + Android 14

---

## Phase 4 — Observability dashboard greenfield (`apps/observability`)

Greenfield = clean implementation against new tokens + components. Easier than retrofitting.

### Build order

1. App shell: nav, layout, theme provider
2. Agent card primitive (highest density — sets visual rhythm)
3. Mobile bottom sheet (most complex interaction)
4. Activity feed
5. Cmd-K palette
6. Inline Opik drawer
7. Settings (notifications per event type, sync, integrations)
8. Sessions historical view
9. Audit log view

### Hero layout per breakpoint

- **1440px**: left rail nav (220px) + bento `2fr 1fr` main + collapsible right rail (360px)
- **768px**: top nav, 2-col agent grid, activity at bottom
- **375px**: persistent status bar, single-col swipeable cards (snap-x), bottom 5-tab nav

### Metrics-on-screen (must)

- Active agents count + per-agent status (running/idle/waiting/error/queued)
- Connection / sync state (3-bar signal)
- Recent guardrail blocks (last hour)
- One-tap kill-all / pause-all (with confirm haptic)

### Open product questions to resolve

- Multi-session: 1 dashboard across all sessions, or 1 per session?
- Token cost attribution: per-agent / per-session / per-day?
- Guardrail remediation: in-dashboard approve, or notification only?
- Collaboration presence: nav avatar bar, or per-card?
- Opik project scope: one per workspace, or per session?

**Effort bucket**: XL (extra large) — 1 dev, 3-4 weeks for v1
**Hackathon-scope**: 1 dev, 1 week for control room + agent card + Opik drawer
**Validation**: real-time updates without flicker; light + dark; axe pass; 60fps on iPhone 13 mini

---

## Phase 5 — Marketing website refactor (`apps/website`)

Mostly token-aligned already. Smaller scope.

### Tasks

1. Migrate to design-tokens package (replace inline hex)
2. Add accent amber + use sparingly on hero + primary CTA
3. Add display sans (Geist) for hero — currently mono everywhere
4. Refactor framer-motion (currently imported but unused) into actual motion design
   - Hero scroll-in stagger
   - Section reveal on intersection
   - Asset rotation (phone mockups)
5. Apply DESIGN_VARIANCE 7: break centered hero, asymmetric feature grid
6. Add `prefers-reduced-motion` global
7. Add aria-labels to all icon-only links
8. Add light mode (currently dark-only)
9. Bump muted text to AAA contrast
10. New hero pattern: terminal-prompt-as-interaction (per competitive decision 3)

```
which agent do you want to connect?
[ pair my phone                    →]
[Claude] [Gemini] [Codex] [Cursor] [Aider]
```

11. Add new sections: "the convenience moat" (haptics, swipe, sheet keyboard), "anti-ssh" (positioning)

**Effort bucket**: M (medium) — 1 dev, 1 week
**Validation**: Lighthouse ≥95 perf/a11y/SEO; both modes; real device test

---

## Phase 6 — Documentation site (NEW, proposal)

Doesn't exist yet. Per PRD plan, lives at `lecoder.lesearch.ai/docs`.

### Decision: Nextra OR Mintlify OR custom Next.js?

- **Nextra** — Vercel-favorite, MDX, free, easy. Recommended.
- **Mintlify** — beautiful but paid, ties us to their hosting
- **Custom** — full control, more work

**Recommendation**: Nextra. Apply design-tokens + components packages.

### Build order
1. Nextra scaffold + token wiring
2. Information architecture (Quickstart, Concepts, Guides, API, Plugin SDK, Changelog)
3. First doc set: Quickstart + 3 core concept pages
4. Search (Algolia DocSearch)

**Effort bucket**: M — 1 dev, 1 week
**Defer to Phase 7+**: not blocking pitch

---

## Phase 7 — Social brand kit production

Per `10-social-kit-spec.md`. Figma work, no code.

### Order (~2 hours total)

1. Figma file: lecoder brand kit (pages: Tokens, Logo, Templates, Illustrations)
2. Build cursor-notch L variants (digital animated, static print)
3. Build pixel-craft device library (phone, laptop, tablet — 4px grid)
4. GitHub repo social preview (1280×640) — 45 min
5. OG image template Variant A — 25 min
6. ProductHunt gallery hero — 20 min
7. Mobile story template (1080×1920) — 20 min
8. Favicon set export — 15 min
9. Brand bumper (After Effects or Rive — separate task, ~2h)

**Effort bucket**: S (small for static assets) + M (motion bumper)
**Pitch-ready window**: 2 hours static, defer motion bumper

---

## Phase 8 — Validation & rituals

Ongoing.

1. Add Impeccable detector to CI: `npx impeccable detect apps/`
2. Add axe-core CI gate (no critical violations on PR)
3. Add Storybook a11y addon
4. Add visual regression (Chromatic or Playwright snapshots)
5. Establish design review ritual: every PR with UI change posts before/after to a design channel
6. Quarterly DESIGN.md changelog update
7. Track convenience scorecard quarterly (target: 7/10 minimum across all dimensions)

---

## Effort summary

| Phase | Bucket | 1-dev wall time | Critical for pitch? |
|---|---|---|---|
| 0 — Approve | — | 30 min sync | YES |
| 1 — Tokens | M | 1-2 days | YES |
| 2 — Components | L | 1-2 weeks | partial (button + card + status + sheet) |
| 3 — PWA hardening | L | 2 days critical-only / 2 weeks full | critical-only YES |
| 4 — Observability | XL | 1 week hackathon-scope / 4 weeks v1 | hackathon-scope YES |
| 5 — Website refactor | M | 1 week | partial (hero + accent) |
| 6 — Docs site | M | 1 week | NO |
| 7 — Social kit | S+M | 2h static + 2h motion | YES |
| 8 — Validation | ongoing | — | NO |

**Pitch-ready minimum (1 dev, ~5 days)**:
- Phase 0 (decisions)
- Phase 1 (tokens — full)
- Phase 2 (button + card + statusdot + sheet only)
- Phase 3 critical-only fixes (PWA manifest, viewport, xterm a11y, contrast)
- Phase 4 hackathon-scope (control room + agent card + Opik drawer)
- Phase 5 hero refactor + accent only
- Phase 7 static assets only

**Full system rollout (1 dev)**: ~6-8 weeks

---

## Risks

| Risk | Mitigation |
|---|---|
| Parallel feat/paseo-parity branch lands while we refactor → conflicts | Coordinate with that team; design system goes in separate PRs after merge |
| Geist license requires self-hosting → bundle size | next/font/google handles; pre-test bundle |
| User picks teal over amber → social kit needs rework | Decision in Phase 0; Figma swap is 30 min |
| Designer agent wrapper template hides full specs (this run) | Manual authoring + targeted re-prompts; mostly complete |
| Hackathon Feb 9 deadline missed | Pitch-ready scope defined above; 5-day path achievable |

---

## What this roadmap explicitly DOES NOT do

- Refactor any component code (per user instruction this run)
- Replace STYLE.md (proposal only — pending approval)
- Touch the parallel `feat/paseo-parity` worktree
- Spec backend protocol changes
- Touch CLI ergonomics
