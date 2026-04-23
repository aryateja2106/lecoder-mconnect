# Social Kit — Locked Decisions

> Agent returned summary only; full spec being re-fetched. These 3 anchors are confirmed.

## Lock 1: Brand Accent — Terminal Amber

**Primary**: `#E8A030`
**Light mode variant**: `#B87820`

Why:
- Fills gap in competitor landscape (cyan=Cursor/Warp, indigo=Linear, black/white=Vercel)
- References CRT phosphor culture (terminal heritage)
- Passes WCAG AA on warm-dark backgrounds
- Differentiated, not "another developer cyan"

Pairs with token-architecture doc proposal — confirms amber direction.

## Lock 2: Visual Signature — Cursor-Notch L

The existing pixelated "L" mark (STYLE.md) gets ONE amber pixel-block appended to bottom-right of horizontal bar.

- Digital: blinking (matches terminal cursor language)
- Print/static: 70% opacity, no animation
- Construction: zero changes to existing mark — purely additive
- Reads in feed in 0.3 seconds — single recognizable element

```
┌──────────────┐
│ ████         │
│ ████         │
│ ██▓▓         │
│ ████         │
│ ████████████▓│   ← amber pixel notch
└──────────────┘
```

This is THE recognition primitive for OG images, favicons, video stingers.

## Lock 3: Illustration System — Pixel-Craft Device Composites

- Phone/laptop frames drawn on same 4px grid as L mark
- Real terminal screenshots composited inside frames
- Figma-producible (no 3D tooling, no Spline, no Three.js)
- Visual coherence with existing mark language

NOT: isometric 3D renders, photo-real device mockups, vector flat illustration.

## First Asset Priority

**GitHub repo social preview (1280×640)** — ship FIRST.
- Static, permanent distribution on every link share
- 45-minute Figma task
- Pays for entire brand kit investment day-one

Then in order: OG image template, Twitter card template, YouTube thumbnail, mobile story (1080×1920).

## Implications for token doc

- ✅ Amber accent confirmed → token-architecture.md `--accent-amber-500: #E8A030` matches
- ✅ Pixel-art aesthetic → no glassmorphism, no gradients, no 3D shaders
- ✅ Mark stays — no logo redesign required
- ⚠️ Need 4px-grid Figma library for illustration consistency

## Pending (re-prompted to agent)

Full spec covering: typography for marketing, asset templates with dimensions/grids, messaging templates, motion/short-form video, anti-patterns, implementation roadmap.
