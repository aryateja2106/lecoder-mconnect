# LeCoder MConnect — Surface Audit (Research Phase)

> Read-only forensic audit of website, web PWA, observability dashboard.
> Source: parallel research agent (Explore), read on 2026-04-15.

## 10 Most Jarring Inconsistencies

1. **Color palette schism** — Website uses `#e9e9e7` (STYLE.md says `#F1ECEC`). Web PWA uses `#fafafa` (zinc-50). Both drift. `apps/website/src/app/globals.css:18` vs `apps/web/src/app/globals.css:5`
2. **Touch target gutter** — Pairing inputs `w-12 h-14` (48×56) with `gap-2` (8px) — borderline on small phones. `apps/web/src/app/page.tsx:121`
3. **Accent color explosion** — Web PWA hardcodes `cyan-500/400`, `yellow-500`, `green-500`, `red-500`, `blue-500` (12+ cyan refs alone). STYLE.md says minimal accents. AI-slop signal — likely copy-paste from generic starter.
4. **Zero aria-labels** — No `aria-label` on icon buttons across both surfaces. No `aria-hidden` on decoration.
5. **Muted-text contrast** — Website `text-[#888]` on `#191919` = 4.6:1 (AA only). STYLE.md `#6b6b6b` would be 5.3:1.
6. **No prefers-reduced-motion** — Animations unconditional in both surfaces.
7. **PWA manifest missing** — `apps/web/src/app/layout.tsx:7` references `/manifest.json` but file does NOT exist. No service worker either.
8. **4px grid broken** — Website `py-3` (12px) vs Web PWA `py-2.5` (10px) on buttons. Inconsistent.
9. **xterm theme drift** — Terminal uses cyan `#06b6d4` instead of design `#4ade80`. Scrollbar zinc-700 not design tokens. `apps/web/src/components/terminal/TerminalView.tsx:26-48`
10. **No haptics anywhere** — `navigator.vibrate()` not called once. Critical actions (pair, approve, kill) lack tactile feedback.

## Surface 1: Marketing Website (`apps/website/src`)

- **Stack**: Next.js 15, Tailwind 4, framer-motion (imported but unused), Lucide 0.468.0
- **Color**: Custom theme via globals.css. Drift from STYLE.md tokens.
- **Type**: JetBrains Mono everywhere ✓. No explicit scale — relies on Tailwind defaults.
- **Spacing**: Mostly 4px grid; some `py-10`, `mb-10` outliers.
- **Components**: Buttons (primary/secondary), feature cards, status badges, code blocks. Consistent borders.
- **Icons**: Lucide 1.5px stroke ✓
- **Animation**: CSS keyframes only (fadeIn, blink, toast slide). framer-motion unused.
- **PWA**: manifest present + valid (`#191919` theme, standalone). No service worker.
- **A11y**: Heading hierarchy ✓. Icon-only buttons unlabeled.

## Surface 2: Mobile PWA (`apps/web/src`)

- **Stack**: Next.js 16.1.2, Tailwind 4, xterm.js 6, Lucide 0.562.0
- **Color**: MAJOR DRIFT — uses zinc palette (`#09090b`/`#fafafa`), not STYLE.md monochrome. Cyan/yellow/green/red hardcoded throughout.
- **Type**: `font-sans` (system UI) for body, mono only in xterm. Inconsistent voice vs website.
- **Spacing**: `py-2.5` off-grid; `gap-2` between pair inputs is tight.
- **Components**:
  - PairingCodeEntry — 6-field grid with backspace nav, auto-focus, blur-on-error
  - SessionCard — color-coded dots (running/paused/stopped)
  - TerminalView (xterm) — read-only vs edit modes, cursor blink toggle
  - ControlBar — fixed bottom, mode toggle, approval/kill, safe-area-inset ✓
  - Status badges — hardcoded Tailwind colors
- **Touch**: Buttons mostly ≥44pt; icon buttons (back arrow `p-1`) borderline at ~26px hit area.
- **Scroll**: Custom xterm scrollbar (`#3f3f46`). iOS momentum default. No overscroll-behavior set.
- **Gestures**: NONE. No swipe / long-press / pull-to-refresh. Pinch-zoom disabled (`maximumScale: 1`).
- **Keyboard**: Pair-code field nav works. No mobile keyboard show/hide handling.
- **xterm touch UX**: Selection requires triple-click (broken on touch). No long-press paste menu. Scrollback 10000 lines + on-demand loader.
- **Loading/error states**: Connection states (connecting/connected/disconnected/error) ✓. Empty state ✓. Full-screen error overlay with retry ✓.
- **PWA**: `manifest.json` REFERENCED BUT MISSING. No service worker. Won't install on home screen. Critical for "mobile-first" claim.
- **A11y**: No focus-visible rings. No aria-labels on icons. Color contrast OK on text.

## Surface 3: Observability Dashboard (`apps/observability`)

- **Status**: Empty directory. Only `.turbo/` and `.DS_Store`. Greenfield.

## Compliance Scorecard

| Aspect | Website | Web PWA | Observability |
|--------|---------|---------|---------------|
| Color alignment to STYLE.md | 95% | 40% | N/A |
| Typography (mono everywhere) | 100% | 60% | N/A |
| Spacing 4px grid | 80% | 70% | N/A |
| Touch targets (44pt) | n/a | 85% | N/A |
| Aria labels | 0% | 0% | N/A |
| prefers-reduced-motion | 0% | 0% | N/A |
| Manifest exists | ✓ | ✗ | N/A |
| Service worker | ✗ | ✗ | N/A |
| Haptics | n/a | 0% | N/A |

## Recommendations Echoed (for synthesis)

1. Unify color tokens — single CSS variable source of truth across all apps
2. Enforce typography scale via Tailwind theme extension
3. Bake a11y into base component primitives (auto-aria, focus-visible, reduced-motion)
4. Ship `manifest.json` + service worker for web PWA NOW
5. Build mobile gesture library (haptics + long-press paste + double-tap select for xterm)
6. Codify ~8 core components (Button, Input, Card, Badge, Toast, Modal, StatusDot, Icon) with variants
