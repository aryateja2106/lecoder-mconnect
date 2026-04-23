# Social Kit Spec — Authored from anchors

> Designer agent kept returning meta-summary. This is authored from the 3 locked decisions
> + competitive analysis + token system. Anchors: amber `#E8A030`, cursor-notch L, pixel-craft devices.

## 1. Typography for marketing

Marketing surfaces sit at DESIGN_VARIANCE 7 / DENSITY 3 — editorial pacing.

```
Headline (OG, Twitter card):     Geist Sans 600, 56-72px, tracking -0.04em, leading 1.0
Subhead:                          Geist Sans 500, 24-28px, tracking -0.01em, leading 1.2
Body (long-form post art):        Geist Sans 400, 18px, leading 1.5
Micro-label (UPPERCASE):          Geist Mono 500, 11px, tracking 0.08em
Terminal screenshot caption:      Geist Mono 400, 14px

Mono usage in marketing assets:
  - Command snippets ($ npx mconnect)
  - Latency / agent counts ("5 agents · 12ms")
  - File paths
  - Status pills
Sans usage:
  - All headlines
  - All body copy
  - Button labels in calls-to-action
```

Anti-patterns:
- ✗ Inter on any asset
- ✗ Mixed mono + serif anywhere
- ✗ Display weight > 600
- ✗ Centered headlines on landscape assets (always left-align)
- ✗ Outlined / stroke-only headlines

## 2. Asset templates with ASCII sketches

### GitHub repo social preview (1280×640) — PRIORITY 1

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  L̲ lecoder mconnect          [amber-notch-L]             │
│                                                          │
│                                                          │
│   Terminal in your pocket.                               │
│   ═══════════════════════                                │
│   Run 5 agents in parallel.                              │
│   Control them from your phone.                          │
│                                                          │
│                                                          │
│                       ┌─────────────────────────┐        │
│                       │ $ npx mconnect          │        │
│                       │ ✓ paired                │        │
│                       │ ✓ 3 agents · port 8765  │        │
│                       └─────────────────────────┘        │
│                                                          │
│  github.com/lecoder/mconnect              v0.2.0         │
└──────────────────────────────────────────────────────────┘
   bg: var(--grey-50)  ·  text: var(--grey-900)  ·  amber notch
```

### OG image (1200×630) — variants

**Variant A — Blog post**
```
┌──────────────────────────────────────────────┐
│ L̲ lecoder                                    │
│                                              │
│  How we got 5 agents to coordinate           │
│  through one phone                           │
│                                              │
│  ────                                        │
│  Engineering blog · Apr 15                   │
│                                              │
│                          [pixel phone art]   │
└──────────────────────────────────────────────┘
```

**Variant B — Release announcement**
```
┌──────────────────────────────────────────────┐
│ L̲ lecoder                          v0.2.0    │
│                                              │
│  ┌──────────────────────────────┐            │
│  │ Multi-agent orchestration.   │            │
│  │ Now in your pocket.          │            │
│  └──────────────────────────────┘            │
│                                              │
│  → npx lecoder-mconnect@latest               │
└──────────────────────────────────────────────┘
```

**Variant C — Feature**
```
┌──────────────────────────────────────────────┐
│ L̲ NEW                                        │
│                                              │
│  Swipe-left on agent cards.                  │
│                                              │
│  [phone with swipe gesture illustration]     │
│                                              │
│  Pause · Kill · Share · Mute                 │
└──────────────────────────────────────────────┘
```

### Twitter/X header (1500×500)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   [pixel-art device row: phone | laptop | phone]             │
│                                                              │
│   L̲ lecoder mconnect — terminal in your pocket               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Twitter/X post card (1600×900)

Same proportions as OG, denser headline area, leaves room for tweet text overlay (avoid bottom 100px and right 200px).

### YouTube thumbnail (1280×720) — signature pattern

```
┌──────────────────────────────────────────────────┐
│ ┌──────────────────────┐  ┌────────────────────┐ │
│ │                      │  │                    │ │
│ │   FACE CUTOUT ZONE   │  │  TERMINAL          │ │
│ │   (video presenter)  │  │  SCREENSHOT ZONE   │ │
│ │   ~480×640           │  │  ~640×480          │ │
│ │                      │  │                    │ │
│ │                      │  │                    │ │
│ └──────────────────────┘  └────────────────────┘ │
│                                                  │
│  ▓ "5 AGENTS · 1 PHONE"     [amber burst tag]   │
└──────────────────────────────────────────────────┘
```

Always left = face, right = terminal. Headline bottom strip in mono uppercase. Amber accent burst tag for "NEW" / "v0.2" / episode label.

### ProductHunt gallery image (1270×760)

```
┌──────────────────────────────────────────────────┐
│  L̲ lecoder mconnect                              │
│                                                  │
│  Terminal in your pocket                         │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ feature  │  │ feature  │  │ feature  │       │
│  │   1      │  │   2      │  │   3      │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│  ASYMMETRIC — break grid: span 1 card across 2  │
│                                                  │
│  → install · → docs · → github                  │
└──────────────────────────────────────────────────┘
```

### Mobile story (1080×1920) — IG/TikTok

```
┌────────────────┐
│                │
│  L̲ lecoder    │  (top safe-area)
│                │
│                │
│   "5 agents.   │  display headline
│    1 phone.    │  weight 600, 84px
│    0 ssh."     │  left-aligned
│                │
│                │
│ [phone mockup  │  pixel-craft device
│  showing       │  composite, real
│  agent grid]   │  screenshot inside
│                │
│                │
│                │
│  → swipe up    │  bottom safe-area
└────────────────┘
```

### Square post (1080×1080)

Single quote / single feature / single command. Generous whitespace. Bottom-left amber notch L watermark.

### Open Graph favicon set

| File | Size | Notes |
|---|---|---|
| favicon.ico | 32×32 | classic, multi-resolution |
| favicon-16x16.png | 16×16 | tab |
| favicon-32x32.png | 32×32 | bookmark |
| apple-touch-icon.png | 180×180 | iOS home screen |
| icon-192.png | 192×192 | PWA |
| icon-512.png | 512×512 | PWA |
| icon-maskable-192.png | 192×192 | PWA maskable safe-zone |
| icon-maskable-512.png | 512×512 | PWA maskable safe-zone |

All show the L mark with amber notch on `--grey-50` background. Maskable variants have 20% safe-zone padding.

## 3. Messaging templates

### Taglines

**Short (≤6 words)**
- "Terminal in your pocket"
- "Five agents. One phone."
- "Your laptop, anywhere."

**Medium (≤12 words)**
- "Run 5 AI agents in parallel. Control them from your phone."
- "Multi-agent orchestration that fits in a back pocket."
- "Mobile-first remote control for AI coding agents."

**Long (sentence)**
- "LeCoder MConnect lets you spin up multiple AI coding agents on your laptop, then drive each one from your phone over an encrypted Cloudflare tunnel — without giving up read-only safety, audit logs, or the terminal you already love."

### Hashtag set

Primary: `#lecoder` `#mconnect` `#terminalinmypocket`
Topical: `#aiagents` `#aicoding` `#claudecode` `#cursoragent` `#devtools` `#openai` `#opensource`
Avoid: `#AI`, `#startup`, `#productivity` (too noisy, no signal)

### Voice snippets

1. *"5 agents on the laptop. me on the bus. them still working."*
2. *"ssh from your phone is the wrong abstraction. give them a phone."*
3. *"shipped a feature. didn't open my laptop."*
4. *"the agents don't sleep. neither does the dashboard."*
5. *"a calm interface for a noisy room."*

## 4. Motion / short-form video

### Brand bumper (2 seconds)

Frame-by-frame:
```
0.0s  ─ black
0.1s  ─ amber notch-pixel appears center, blinks once
0.3s  ─ pixel block grows up + left into the L bar
0.7s  ─ rest of L wireframes in (one quadrant at a time, 100ms each)
1.1s  ─ "lecoder" wordmark fades in to right of L
1.5s  ─ everything settles, slight grain animates 0.5s
2.0s  ─ cut
```
No music in the bumper. Optional: single terminal "beep" at 0.1s when amber notch appears.

### Transition style between clips

- Cuts > fades. Mostly hard cuts, never crossfades.
- Allowed: 80ms wipe with amber bar moving horizontally
- Banned: zoom transitions, swipe page turns, cube rotations

### Caption style (devtok shorts)

- Geist Mono 500, 32-40px, weight 500
- Color: `var(--grey-900)` on `var(--grey-50)` translucent panel (`rgba(22,21,19,0.85)`)
- Position: bottom-third, never overlapping safe-area
- Highlight word: amber `var(--accent-500)` background, no text-shadow
- 1 line per beat. Max 7 words per line.
- No emoji. No exclamation points.

### Music direction

Pick ONE per video, don't mix:
- **Lo-fi typing-ASMR** (no music, real keyboard sounds + UI clicks)
- **Synth ambient** (Tycho-adjacent, sub-100 BPM, no drops)
- **Silence + voice-over only**

Banned: stock corporate uplifting orchestral, dubstep drops, anime trap, viral TikTok song-of-the-week.

## 5. Anti-patterns — explicit NEVERs

- ✗ Purple gradients
- ✗ Pink → blue gradient meshes  
- ✗ AI brain-on-fire imagery
- ✗ Stock photos of devs at laptops in coffee shops
- ✗ "Synapses firing" neural network wallpaper
- ✗ Glassmorphism cards floating in space
- ✗ Generic startup gradient mesh backgrounds
- ✗ Holographic foil cards
- ✗ Lottie-animated robot mascots
- ✗ "Robot hand touching human hand" cliché
- ✗ Code-rain Matrix backgrounds
- ✗ Lifestyle photography of forests/mountains (Warp owns this)
- ✗ Inspirational quotes overlay on city skyline
- ✗ Emoji in headline
- ✗ Headline ending in "!" or "?"

## 6. Implementation roadmap — 5 assets, ~2 hours total

| Order | Asset | Effort | Why first |
|---|---|---|---|
| 1 | GitHub repo social preview (1280×640) | 45 min | Permanent, every link share, biggest ROI |
| 2 | OG image template (Variant A blog) | 25 min | Resize from #1, used in every post |
| 3 | ProductHunt gallery hero (1270×760) | 20 min | Resize from #1, needed for launch |
| 4 | Mobile story template (1080×1920) | 20 min | New canvas — first social-native asset |
| 5 | Favicon set (8 sizes) | 15 min | Auto-export from L mark in Figma |

Pitch-ready in 2 hours starting from the GitHub preview anchor. Every other asset is a derivative.

## Token references

All assets use ONLY:
- `--grey-50` `--grey-100` `--grey-200` `--grey-700` `--grey-900` `--grey-950`
- `--accent-500` (amber `#E8A030`)
- `--accent-glow` (amber wash for highlights)
- Status colors only when showing status (green=connected, amber=warning, red=error)

NEVER reach for one-off colors. If a swatch isn't in DESIGN.md, it's not in the asset.
