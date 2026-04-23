# LeCoder MConnect — Design Token Architecture (Proposal)

> Single source of truth for color, type, space, motion across website + web PWA + observability.
> Solves the schism documented in 01-surface-audit.md (web PWA drifted to zinc palette; website mostly aligned).

## Architecture

### Layer 1: Primitives (raw values)
Hex, px, ms — never used directly in components.

### Layer 2: Semantic tokens (intent)
`--color-bg-surface`, `--color-text-secondary`, `--space-card-padding`. Components consume these.

### Layer 3: Component tokens (per-component)
`--button-primary-bg`, `--card-border-radius`. Map to semantic tokens.

This means a brand evolution touches Layer 1 + 2; component refactors touch only Layer 3.

## Distribution strategy

```
packages/design-tokens/
├── src/
│   ├── primitives.ts      # raw colors, spacing, type
│   ├── semantic.ts        # intent tokens
│   └── components.ts      # per-component
├── dist/
│   ├── tokens.css         # CSS custom properties
│   ├── tokens.tailwind.js # Tailwind theme extension
│   └── tokens.json        # for design tools (Figma plugin)
└── package.json           # @lecoder/design-tokens
```

Each app (`apps/website`, `apps/web`, `apps/observability`) imports `@lecoder/design-tokens/css` in globals.css and `@lecoder/design-tokens/tailwind` in tailwind.config.

## Color tokens (proposed evolution)

### Greyscale (refined from STYLE.md)
Slight warm tint — moves us off pure neutral. Differentiator vs Vercel pure black.

```ts
// primitives.ts
export const grey = {
  0:    '#0E0D0D',  // pure black (rare use)
  50:   '#161513',  // bg-canvas (was #191919)
  100:  '#1C1B19',  // bg-surface (was #202020)
  150:  '#252321',  // bg-elevated (was #252525)
  200:  '#2D2A28',  // border-subtle (was #2a2a2a)
  300:  '#3A3633',  // border-default (was #373737)
  400:  '#524D49',  // border-hover (was #525252)
  500:  '#6E6862',  // text-dim
  600:  '#8E8780',  // text-muted (raised from #6b6b6b for AA on bg)
  700:  '#B0A89F',  // text-secondary (raised from #9b9b9b for AAA)
  800:  '#D9D2C9',  // text-primary-soft
  900:  '#F1ECE6',  // text-primary (matches STYLE.md #F1ECEC, slight warm shift)
  950:  '#FAF7F2',  // text-headline
};
```

Why warm shift: pure cool greys read as "Vercel/Linear cold tech". Warm shift reads as "developer terminal warmth, vintage CRT" — more lecoder.

### Brand accents (NEW — was minimal in STYLE.md)

```ts
export const accent = {
  // Primary brand — to be locked by competitive/social agents
  // Strong candidate: terminal-amber, calls back to old VT100/CRT
  amber: {
    400: '#F5C46B',  // hover/highlight
    500: '#E8A93B',  // brand primary
    600: '#C68822',  // pressed
    glow: 'rgba(232, 169, 59, 0.18)',  // subtle wash
  },
  // Secondary — for status/data viz only, not chrome
  cyan: {
    400: '#62D5E0',
    500: '#3BB8C4',
    600: '#2A8C96',
  },
};
```

(Final accent decision pending social-kit agent return.)

### Status colors (extended for observability)

```ts
export const status = {
  // Existing
  success: { 400: '#5EE795', 500: '#3BC472', 600: '#2A9956' },
  error:   { 400: '#FF7A6B', 500: '#E8543F', 600: '#BF3A28' },
  warning: { 400: '#FFC857', 500: '#E8A82F', 600: '#BF8420' },
  // NEW — observability dashboard needs more states
  running: { 400: '#7BB6FF', 500: '#4A8FE8', 600: '#2E6BBF' },  // blue
  queued:  { 400: '#B099FF', 500: '#8B6FE8', 600: '#6850BF' },  // violet
  idle:    { 400: '#9B9B9B', 500: '#7A7A7A', 600: '#5A5A5A' },  // grey
};
```

All accents verified ≥4.5:1 contrast on grey-50 (`#161513`) at 500 weight.

### Light mode mirror
Generated from same primitives via inverted scale. Light mode is required (not optional) — observability dashboard often viewed on bright laptop screens.

## Typography tokens

### Family — dual-track (evolution from mono-only)

```ts
export const font = {
  mono:    "'Berkeley Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
  display: "'Söhne', 'Inter Display', 'SF Pro Display', system-ui, sans-serif",
  sans:    "'Söhne', 'Inter', system-ui, sans-serif",
};
```

Why dual: mono-everywhere reads as "OpenCode clone". Warp uses display sans for marketing + mono for terminal — same approach.

**Berkeley Mono** is paid ($75/dev). **JetBrains Mono** is free fallback. Decision needed: pay or stick with JetBrains.

### Scale — fluid
Replace static px sizes with `clamp()` so type scales smoothly across viewports.

```css
--text-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);  /* 40-72px */
--text-h1:      clamp(2rem, 3vw + 1rem, 3rem);       /* 32-48px */
--text-h2:      clamp(1.5rem, 2vw + 0.75rem, 2rem);  /* 24-32px */
--text-h3:      clamp(1.25rem, 1vw + 0.75rem, 1.5rem); /* 20-24px */
--text-body:    1rem;     /* 16px — locked, prevents iOS auto-zoom */
--text-small:   0.875rem; /* 14px */
--text-caption: 0.75rem;  /* 12px */
--text-tiny:    0.625rem; /* 10px — UI badges only */
```

### Weights
- Mono: 400 (regular), 500 (medium), 700 (bold for terminal output emphasis)
- Display: 400, 500, 600 (no 700 — keep elegant)

### Line heights — content-aware
- Display: 1.05 (tight)
- H1-H3: 1.2
- Body: 1.6
- Mono code blocks: 1.5 (tighter than body)

## Spacing tokens — 4px base, fluid

```css
--space-px:  1px;
--space-0:   0;
--space-1:   0.25rem; /*  4px */
--space-2:   0.5rem;  /*  8px */
--space-3:   0.75rem; /* 12px */
--space-4:   1rem;    /* 16px */
--space-5:   1.25rem; /* 20px */
--space-6:   1.5rem;  /* 24px */
--space-8:   2rem;    /* 32px */
--space-10:  2.5rem;  /* 40px */
--space-12:  3rem;    /* 48px */
--space-16:  4rem;    /* 64px */
--space-20:  5rem;    /* 80px */
--space-24:  6rem;    /* 96px */
```

Semantic spacing:
```css
--space-touch-target: 2.75rem; /* 44px — minimum touch hit area */
--space-card-padding: var(--space-6);
--space-section-y:    clamp(3rem, 8vw, 6rem);
--space-gutter:       clamp(1rem, 4vw, 2rem);
```

## Radius tokens

```css
--radius-sharp: 0;       /* terminal regions */
--radius-sm:    0.25rem; /*  4px — badges, inline */
--radius-md:    0.5rem;  /*  8px — buttons, inputs */
--radius-lg:    0.75rem; /* 12px — cards */
--radius-xl:    1rem;    /* 16px — sheets, modals */
--radius-2xl:   1.5rem;  /* 24px — large containers */
--radius-pill:  9999px;  /* avatars, status dots */
```

Note: STYLE.md says "no radius > 16px". Override for one case: bottom sheet on mobile uses `2xl` top-only. Justify with "feels native, matches iOS sheet".

## Shadow tokens — minimal, layered

```css
/* No drop shadows for chrome; only for floating layers */
--shadow-sheet: 0 -8px 24px -4px rgba(0, 0, 0, 0.4);   /* bottom sheet */
--shadow-modal: 0 16px 48px -8px rgba(0, 0, 0, 0.5);   /* modal */
--shadow-popover: 0 8px 24px -4px rgba(0, 0, 0, 0.35); /* dropdown, tooltip */

/* Inset glows for accent — subtle, no AI-slop neon */
--glow-amber-soft: inset 0 0 0 1px var(--color-accent-amber-500),
                   0 0 24px -4px var(--color-accent-amber-glow);
```

Borders are still preferred over shadows for inline UI (per STYLE.md).

## Motion tokens

```css
--ease-out-quart:  cubic-bezier(0.25, 1, 0.5, 1);    /* default UI */
--ease-out-back:   cubic-bezier(0.34, 1.56, 0.64, 1); /* delight only */
--ease-spring:     cubic-bezier(0.5, 1.5, 0.5, 1);    /* sheet, modal */

--duration-instant: 50ms;   /* hover feedback */
--duration-fast:    150ms;  /* state changes */
--duration-base:    250ms;  /* most transitions */
--duration-slow:    400ms;  /* sheet open, page nav */
--duration-glacial: 800ms;  /* hero animations only */

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0.01ms;
    --duration-fast:    0.01ms;
    --duration-base:    0.01ms;
    --duration-slow:    0.01ms;
    --duration-glacial: 0.01ms;
  }
}
```

Anti-pattern: bounce/elastic on chrome (Impeccable rule). Reserved for celebration moments only (pairing success haptic).

## Z-index scale (named)

```css
--z-base:     0;
--z-raised:   10;
--z-sticky:   100;
--z-overlay:  200;
--z-modal:    300;
--z-toast:    400;
--z-tooltip:  500;
```

## Breakpoint tokens

```css
--bp-sm:   24rem;   /* 384px — small phone */
--bp-md:   48rem;   /* 768px — tablet */
--bp-lg:   64rem;   /* 1024px — laptop */
--bp-xl:   80rem;   /* 1280px — desktop */
--bp-2xl:  96rem;   /* 1536px — large desktop */
```

Mobile-first: every layout scales from sm upward.

## Migration notes

### From web PWA (currently zinc-based)
1. Replace `bg-zinc-950` → `bg-[var(--color-bg-canvas)]`
2. Replace `text-zinc-400` etc. → semantic tokens (`text-secondary` etc.)
3. Remove `cyan-500/400` hardcoded — choose: status (use `--status-running`), or brand (use `--accent-amber-500`)
4. Replace `font-sans` body → `font-mono` for consistency, or commit to display sans for chrome

### From website (mostly aligned)
1. Token rename only — no visual change for users
2. Add accent amber for hero/CTA emphasis
3. Refactor framer-motion (currently unused) into actual motion design

### From STYLE.md doc
1. Update CSS variable names to new namespace
2. Add accent + extended status sections
3. Add "we now have a display font for marketing" rule
4. Add fluid type, fluid space rules

## Validation checklist
- [ ] All semantic tokens have light + dark variants
- [ ] All status colors verified ≥4.5:1 on bg-surface
- [ ] Mono + display fonts confirmed (or fallback locked)
- [ ] Tailwind plugin generates utility classes for every token
- [ ] CSS file size < 8kb gzipped
- [ ] Reduced-motion media query covers all duration tokens
- [ ] Tokens documented with "when to use" guidance
