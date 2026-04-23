# LeCoder MConnect — DESIGN.md

> Canonical design system spec. Successor to STYLE.md.
> Status: PROPOSAL — pending user approval before replacing STYLE.md.
> Format: LLM-readable (per Google Stitch convention) — drop-in for AI code agents.

---

## 0. Positioning sentence

> **LeCoder MConnect is a calm, mobile-native control room for AI coding agents — terminal-precise on the inside, productivity-tool ergonomic on the outside.**

Three brand truths derived:
1. **Calm** — no alarm clocks, no celebration confetti. The system is in control.
2. **Mobile-native** — every decision asks "does this work with one thumb on a moving subway?"
3. **Precise + ergonomic** — terminal honesty (mono numerics, exact timestamps) wrapped in productivity-tool affordances (haptics, swipes, sheets).

---

## 1. Design principles (rules, not opinions)

1. **Convenience is a feature** — measure every interaction in thumb-distance and seconds-to-act. If a critical action takes 3 taps on a phone, that's a bug.
2. **Accessibility is the entry-point, not the addendum** — WCAG 2.2 AA is the floor; a tool that can't be used by a blind dev is a tool that can't be used.
3. **One accent only** — every additional color is documented status, not decoration.
4. **Borders over shadows on chrome** — shadows reserved for sheets, modals, popovers.
5. **Mono for facts (numbers, paths, timestamps), sans for intent (headlines, labels).**
6. **Asymmetry over symmetry** — bento layouts, never 3-equal-card grids.
7. **Density earns attention** — 7/10 visual density on the app, 3/10 on marketing.
8. **Reduced motion is the default for accessibility users** — every animation has a 0.01ms fallback.
9. **No emoji in product UI** — sparingly allowed in social/marketing only.
10. **No AI-cliché imagery** — no purple gradients, no "brain on fire", no glassmorphism. Pixel-craft only.

---

## 2. Brand foundation

### Logo
Existing pixelated "L" mark stays — no redesign needed.
**Evolution: Cursor-Notch L** — one amber pixel block appended to bottom-right of horizontal bar.
- Digital: blinking (cursor language)
- Print/static: 70% opacity, no animation
- Construction: additive only, zero changes to existing geometry

### Wordmark
Existing wordmark + simple wordmark stay. Use Geist Sans uppercase variant for new typesetting where wordmark unavailable.

### Visual signature (in-feed recognition)
The amber-notch L. One element. 0.3-second feed recognition.

---

## 3. Color system

### Primitives — warm-grey scale (warmer than STYLE.md neutral)

```css
/* Greyscale — warm-tinted */
--grey-0:    #0E0D0D;  /* pure black, rare */
--grey-50:   #161513;  /* canvas bg */
--grey-100:  #1C1B19;  /* surface */
--grey-150:  #252321;  /* elevated */
--grey-200:  #2D2A28;  /* border subtle */
--grey-300:  #3A3633;  /* border default */
--grey-400:  #524D49;  /* border hover */
--grey-500:  #6E6862;  /* text dim */
--grey-600:  #8E8780;  /* text muted */
--grey-700:  #B0A89F;  /* text secondary */
--grey-800:  #D9D2C9;  /* text primary soft */
--grey-900:  #F1ECE6;  /* text primary */
--grey-950:  #FAF7F2;  /* text headline */
```

Rationale: warm shift moves us off cold cyber-grey (Linear/Cursor) toward terminal-warmth (Warp lineage) — but less brown than Warp, more neutral. Reads as "developer tool with personality" not "wellness app".

### Brand accent — Terminal Amber

```css
--accent-400:  #F5C46B;  /* hover, highlight */
--accent-500:  #E8A030;  /* PRIMARY brand accent */
--accent-600:  #C68822;  /* pressed */
--accent-glow: rgba(232, 160, 48, 0.18);  /* subtle wash */
```

**Decision** (resolves conflict): Amber wins.
- CRT phosphor heritage maps to brand story
- Differentiated from Cursor's darker amber `#C08532`
- Warmer with our warm-grey scale
- Social kit already designed around it
- Teal (`#00D4AA`) deferred to data-viz layer only (charts, sparklines, NOT chrome)

### Status colors (extended for observability)

```css
--status-success-400: #5EE795;
--status-success-500: #3BC472;
--status-success-600: #2A9956;

--status-error-400:   #FF7A6B;
--status-error-500:   #E8543F;
--status-error-600:   #BF3A28;

--status-warning-400: #FFC857;
--status-warning-500: #E8A82F;  /* deliberately near accent — semantic siblings */
--status-warning-600: #BF8420;

--status-running-400: #7BB6FF;
--status-running-500: #4A8FE8;  /* blue */
--status-running-600: #2E6BBF;

--status-queued-400:  #B099FF;
--status-queued-500:  #8B6FE8;  /* violet */
--status-queued-600:  #6850BF;

--status-idle-400:    #B0A89F;
--status-idle-500:    #8E8780;
--status-idle-600:    #6E6862;
```

All accents verified ≥4.5:1 contrast on `--grey-50`.

### Data accent (charts/sparklines only — NOT chrome)

```css
--data-teal-500: #00D4AA;  /* charts, sparklines */
```

Filling the unoccupied competitive lane without polluting chrome.

### Light mode mirror
Required (not optional). Generated from same primitives via inverted scale. Observability dashboard + marketing site need both modes.

---

## 4. Typography

### Family — dual-track

```css
--font-sans:    'Geist', 'Inter', system-ui, sans-serif;
--font-display: 'Geist', system-ui, sans-serif;  /* same as sans, weight + tracking carry the work */
--font-mono:    'Geist Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

**Decision** (resolves conflict): Geist + Geist Mono. Free, Vercel-native, ships in 0 days. Plan ABC Diatype Variable upgrade evaluation Q2 if budget allows (~$500/style).

Mono allocation:
- All numerics (latency, token counts, costs, timestamps)
- All paths, commands, file names, IDs
- Terminal output (xterm)
- Code blocks
- Status pill labels

Sans allocation:
- Headlines, body copy, labels
- Marketing-site type
- Button labels

### Scale — fluid clamp()

```css
--text-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);   /* 40-72px */
--text-h1:      clamp(2rem, 3vw + 1rem, 3rem);        /* 32-48px */
--text-h2:      clamp(1.5rem, 2vw + 0.75rem, 2rem);   /* 24-32px */
--text-h3:      clamp(1.25rem, 1vw + 0.75rem, 1.5rem);/* 20-24px */
--text-body:    1rem;       /* 16px LOCKED — prevents iOS auto-zoom */
--text-small:   0.875rem;   /* 14px */
--text-caption: 0.75rem;    /* 12px */
--text-tiny:    0.625rem;   /* 10px UI badges only */
```

### Weights — restraint
- 400 (regular) — body, mono terminal output
- 500 (medium) — UI labels, nav, button text
- 600 (semibold) — headings, emphasis

NEVER use 700+ in app UI (Linear/Warp restraint principle).

### Tracking & line height

```css
--tracking-display: -0.04em;   /* -2.4px @ 60px */
--tracking-h1:      -0.02em;   /* -0.8px @ 40px */
--tracking-h2:      -0.01em;
--tracking-body:    0;
--tracking-micro:   0.08em;    /* 1.5px @ 12px UPPERCASE labels */

--leading-tight:    1.05;      /* display */
--leading-snug:     1.2;       /* headings */
--leading-normal:   1.5;       /* body sans */
--leading-mono:     1.6;       /* mono code blocks */
```

OpenType features always-on: `font-feature-settings: "liga", "tnum", "ss01"`.

---

## 5. Spacing — 4px base, fluid sections

```css
--space-1:  0.25rem;  /*  4px */
--space-2:  0.5rem;   /*  8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1rem;     /* 16px */
--space-6:  1.5rem;   /* 24px */
--space-8:  2rem;     /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-24: 6rem;     /* 96px */

/* Semantic */
--space-touch:   2.75rem;                       /* 44px MIN touch target */
--space-touch-comfortable: 3rem;                /* 48px */
--space-card:    var(--space-6);
--space-section: clamp(3rem, 8vw, 6rem);
--space-gutter:  clamp(1rem, 4vw, 2rem);
```

---

## 6. Radius

```css
--radius-sharp:  0;          /* terminal regions, ANSI panels */
--radius-sm:     0.25rem;    /* badges, inline pills */
--radius-md:     0.5rem;     /* buttons, inputs */
--radius-lg:     0.75rem;    /* cards */
--radius-xl:     1rem;       /* modals, sheets */
--radius-2xl:    1.5rem;     /* mobile bottom sheet (top corners only) */
--radius-pill:   9999px;     /* status dots, avatars */
```

---

## 7. Borders & shadows

### Borders (preferred for chrome)

```css
--border-hairline: 1px solid rgba(255, 255, 255, 0.06);  /* whisper */
--border-subtle:   1px solid var(--grey-200);
--border-default:  1px solid var(--grey-300);
--border-hover:    1px solid var(--grey-400);
--border-accent:   1px solid var(--accent-500);
```

### Shadow-as-border (Vercel technique, dark-mode-friendly)

```css
--ring-subtle: 0 0 0 1px rgba(255, 255, 255, 0.06);
--ring-default: 0 0 0 1px rgba(255, 255, 255, 0.10);
```

### Shadows (only for floating layers)

```css
--shadow-sheet:   0 -8px 24px -4px rgba(0, 0, 0, 0.40);
--shadow-modal:   0 16px 48px -8px rgba(0, 0, 0, 0.50);
--shadow-popover: 0 8px 24px -4px rgba(0, 0, 0, 0.35);

--glow-amber-soft: inset 0 0 0 1px var(--accent-500),
                   0 0 24px -4px var(--accent-glow);
```

NEVER use box-shadow for chrome on dark surfaces (looks muddy).

---

## 8. Motion

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-spring:    cubic-bezier(0.5, 1.5, 0.5, 1);

--duration-instant: 50ms;
--duration-fast:    150ms;
--duration-base:    250ms;
--duration-slow:    400ms;

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0.01ms;
    --duration-fast:    0.01ms;
    --duration-base:    0.01ms;
    --duration-slow:    0.01ms;
  }
}
```

Rules:
- Animate `transform` + `opacity` only (never width/height — causes reflow)
- 150ms for state transitions (hover, focus, press)
- 250ms for component transitions (modal, tooltip)
- 400ms for sheet/page (with spring easing)
- NO bounce/elastic on chrome
- NO perpetual animations on live data
- Tactile feedback on `:active`: `transform: scale(0.98)` or `translate-y(1px)`

---

## 9. Layout principles

### Bento grid (NOT 3-equal-cards)
```
┌─────────────────────┬─────────┐
│   PRIMARY AGENT     │ AGENT 2 │
│   (2fr — large)     │ (1fr)   │
│                     ├─────────┤
│                     │ AGENT 3 │
│                     │ (1fr)   │
└─────────────────────┴─────────┘
```

### Mobile single-column with snap-x
```
┌──────────────┐  ┌──────────────┐  ┌──
│  AGENT 1     │  │  AGENT 2     │  │
│  (full w)    │  │  (full w)    │  │
└──────────────┘  └──────────────┘  └──
   ←─── swipe ───→
```

### Anti-center on mobile
- CTAs left-aligned for thumb scan (right-thumb users tap right edge)
- Headlines left, supporting text below
- Centered hero banned when DESIGN_VARIANCE > 4

### Safe-area always
```css
padding-top:    env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left:   env(safe-area-inset-left);
padding-right:  env(safe-area-inset-right);
```

Use `100dvh` not `100vh`. Use `100dvw` not `100vw`.

---

## 10. Components — primitives spec

### Button

```
Variants:    primary, secondary, ghost, destructive
Sizes:       sm (32h), md (40h), lg (48h)
Min target:  44×44pt always (use min-w-11 min-h-11)
Padding:     px-4 (16px) horizontal, py-2 (8px md) vertical
Radius:      var(--radius-md)
Tactile:     :active scale-[0.98]
Focus:       focus-visible: 2px solid var(--accent-500), offset 2px
Loading:     replace label with spinner, lock width
```

### Input

```
Min font:    16px (prevents iOS zoom)
Height:      44px min
Padding:     px-3 py-2.5
Border:      var(--border-default)
Focus:       border-color var(--accent-500), no shadow ring
Error:       border-color var(--status-error-500), aria-invalid
Disabled:    opacity 0.5, cursor not-allowed
```

### Card

```
Bg:           var(--grey-100)
Border:       var(--border-subtle)
Radius:       var(--radius-lg)
Padding:      var(--space-card) — 24px
Hover:        border-color var(--border-default)
NO shadow on chrome.
```

### StatusDot

```
Size:         8px (sm), 10px (md), 12px (lg)
Shape:        pill
Pulse:        running state only — keyframe scale 1→1.4 opacity 0.4→0
Triple-encode: ALWAYS pair with text label and icon
Reduced motion: pulse → solid color
```

### Modal / Sheet

```
Modal:        center-screen, max-width clamp(20rem, 90vw, 32rem)
Sheet:        bottom-anchored, swipe-down to dismiss, --radius-2xl top
Backdrop:     rgba(0,0,0,0.5), blur-sm
Focus trap:   REQUIRED (Radix Dialog or HeadlessUI)
Escape close: REQUIRED
Focus restore: REQUIRED on close
Aria:         role=dialog, aria-modal=true, aria-labelledby
```

### Toast

```
Position:     bottom-center mobile, top-right desktop
Auto-dismiss: 4s default, 8s for warnings, never for errors
Stack:        max 3 visible, queue rest
Aria:         role=status (info), role=alert (error)
Haptic:       trigger on appear (medium impact for warning, error)
```

### Terminal (xterm)

```
Family:       var(--font-mono)
Size:         14px on desktop, 13px on mobile
Cursor:       block, blinking only when active
Selection:    var(--accent-500) bg, alpha 0.3
Theme:        flat ANSI — NO neon glow text-shadow
ScreenReader: screenReaderMode: true, screenReaderLiveRegion: true
Container:    role="application", aria-label="Terminal output"
Touch:        double-tap to select word, long-press for paste menu
Overscroll:   contain (prevents pull-to-refresh kill)
Scrollback:   10k lines + IntersectionObserver for older
```

---

## 11. Iconography

- Library: Lucide React
- Stroke: 1.5px (default) — never override unless variant
- Sizes: 16px (inline), 20px (UI), 24px (large), 32px (hero)
- Color: currentColor — inherit from parent
- Decorative icons: `aria-hidden="true"`
- Functional icons: `aria-label` REQUIRED on parent button/link

---

## 12. Illustration system

### Style: pixel-craft device composites

- All device frames drawn on 4px grid (matches L-mark construction)
- Real terminal screenshots composited inside frames
- Figma-producible (no Spline, no 3D, no Three.js)
- Color palette restricted to: greyscale + accent amber + status colors

### Anti-illustration patterns

- ✗ Isometric 3D renders
- ✗ Photo-real device mockups
- ✗ Vector flat illustration with gradient meshes
- ✗ AI-generated stock illustrations
- ✗ Floating chrome-y devices in space

---

## 13. Microcopy & voice

See `02-voice-and-tone.md` for full guide. Key rules:

- Buttons: verb-first, ≤3 words ("Pair phone" not "Click to pair")
- Empty states: 3 lines max, include actionable next step
- Errors: what happened · why · what to do (3 lines)
- Success: acknowledge, don't celebrate ("Paired" not "🎉 You did it!")
- Numbers: numerals from 2 ("one phone, 2 agents")
- Commands: backticks, lowercase, no `$` prefix

---

## 14. Mobile patterns (DIFFERENTIATORS)

These are the convenience moats. Competitors don't do these.

1. **Haptics on agent state changes** — connection, control grant/release, kill, error, approval, pairing success. User-toggle in settings, persisted.
2. **Swipe-left on agent cards** for actions: pause, kill, share, mute notifications. iOS-native pattern.
3. **Persistent top status bar** — active session count + connection quality (3-bar signal). Always visible.
4. **Bottom-sheet keyboard input** pinned above software keyboard via Visual Viewport API. Never gets covered.
5. **Pull-to-refresh** on agent grid. With haptic. NOT on terminal (overscroll-behavior: contain).
6. **Long-press card** → bottom sheet detail view (not nav push — preserves real-time context).
7. **One-handed reachability** — primary CTAs in bottom 1/3 of screen. Destructive actions (kill) require long-press OR confirm modal.
8. **PWA install** — `beforeinstallprompt` capture, dismissible "Add to Home Screen" banner after first paired session.

---

## 15. Accessibility floor (WCAG 2.2 AA — non-negotiable)

- All text: ≥4.5:1 contrast (3:1 for ≥18pt or 14pt bold)
- All status: triple-encoded (icon + color + text)
- All icon-only buttons: aria-label
- All focus states: visible, 2px outline + offset
- All modals: focus trap, escape close, focus restore
- All animations: respect prefers-reduced-motion
- All inputs: associated label or aria-label
- Touch targets: 44×44pt minimum (WCAG 2.5.8)
- Pinch-zoom: NEVER blocked (`maximumScale: 1` is BANNED)
- xterm: screenReaderMode: true REQUIRED
- Live regions: alerts get role=alert; status changes get aria-live=polite
- Heading hierarchy: h1 → h2 → h3, no skips
- Skip link: required on long pages

---

## 16. PWA requirements (mobile-first floor)

- `manifest.json` PRESENT with: icons (192/512/maskable), display:standalone, theme_color matching `--grey-50`, background_color, start_url:"/"
- Service worker with offline shell + offline queue handling
- iOS apple-touch-icon links (180×180)
- Apple meta tags: `apple-mobile-web-app-capable`, status-bar-style appropriate
- Install prompt UX (dismissible banner)
- Reconnect logic with exponential backoff (3→6→12→cap 60s) + visible attempt counter

---

## 17. Per-surface dial calibration

| Surface | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|
| Marketing website | 7 | 5 | 3 |
| Mobile PWA app | 5 | 4 | 7 |
| Observability dashboard | 6 | 4 | 8 |
| Documentation site | 4 | 2 | 5 |
| Social kit | 8 | 6 | 4 |

Different design languages, shared tokens.

---

## 18. Anti-patterns (banned, not avoided)

Hard NO list:
- Inter font (use Geist)
- Purple-to-blue gradients
- Neon text-shadow on terminal output
- Pure `#000000` on `#FFFFFF`
- Gray text on colored backgrounds
- Bounce/elastic easing on chrome
- 3-equal-card grids
- Centered hero on marketing
- Glassmorphism / blur backdrop on chrome
- Side-tab thick colored borders
- Icon-tile-stack above every heading
- Emoji in product UI
- AI brain-on-fire imagery
- Stock photos of devs at laptops
- Animated width/height (use transform)
- Hover-only reveal on touch surfaces
- Color-only state signaling

---

## 19. Implementation order

See `10-IMPLEMENTATION-ROADMAP.md` for surface-by-surface plan with effort estimates and dependencies.

---

## 20. Living document

This DESIGN.md is the source of truth.
- Bumped version + changelog at top on every meaningful change.
- LLM-readable: drop into any AI agent context to get matching output.
- Sibling: AGENTS.md (how to build) + DESIGN.md (how to look).

**Version**: 0.1.0-proposal
**Last updated**: 2026-04-15
**Author**: design synthesis pass
**Status**: pending user approval
