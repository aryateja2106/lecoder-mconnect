# Design Resource Synthesis — Cross-Resource Top 10 Patterns

> Source: parallel research agent. Analyzed Warp/Linear/Notion/Vercel DESIGN.md + Impeccable + UI-UX Pro Max v2 + 21st.dev + Taste skill.

## Per-resource highlights

### Warp DESIGN.md
- Type: Matter Regular wt 400 everywhere; Matter Medium 500 only for titles/buttons; Geist Mono terminal. ZERO bold (700+).
- Color: Warm earthy near-black bg, cream `#faf9f6` text, Earth Gray `#353534` buttons, semi-transparent `rgba(226,226,226,0.35)` borders. NO bold accent.
- Display: 80px / line-height 1.0 / letter-spacing -2.4px
- Distinct: warmth (vs cold black competitors) + lifestyle photography
- **Adopt:** warm near-black, cream text, semi-transparent borders, uppercase micro-labels with 2px+ tracking
- **Ignore:** lifestyle nature photography (we have terminal screenshots)

### Linear DESIGN.md
- Type: Inter Variable with `cv01,ss03`, signature **fractional weight 510**, Berkeley Mono for code
- Color: `#08090a`/`#0f1011`/`#191a1b` layered, `#5e6ad2`/`#7170ff` indigo single accent, ultra-thin `rgba(255,255,255,0.05)` borders
- Distinct: 510 fractional weight + aggressive negative tracking = engineered feel
- **Adopt:** layered dark surfaces, ultra-thin borders, single accent w/ 2-3 luminance variants, fractional weight ladder (400/510/590)
- **Ignore:** pure engineering coldness (mobile needs warmth)

### Notion DESIGN.md
- Color: warm whites `#f6f5f4`, dark `#31302e`, near-black `rgba(0,0,0,0.95)`, accent Notion Blue `#0075de`, whisper borders `rgba(0,0,0,0.1)`
- Voice: "Quality paper, not sterile glass"
- **Adopt:** whisper borders → dark mode `rgba(255,255,255,0.06)`, near-white `rgba(255,255,255,0.92)` for primary text
- **Ignore:** serif-adjacent warmth, document-first layout

### Vercel DESIGN.md
- Type: Geist Sans + Geist Mono, `-2.4px to -2.88px` tracking at display, 3 weights (400/500/600), liga everywhere
- Color: `#ffffff`/`#171717`, **workflow-specific accents**: Ship Red `#ff5b4f`, Preview Pink `#de1d8d`, Develop Blue `#0a72ef`
- Technique: shadow-as-border `box-shadow: 0px 0px 0px 1px rgba(0,0,0,0.08)`
- **Adopt:** Geist family (free), workflow-accent system per agent type, shadow-as-border for dark mode
- **Ignore:** light-mode-first

## Impeccable — 24 Anti-Patterns (verified from repo)

CLI-detectable (22): side-tab, border-accent-on-rounded, overused-font (Inter), single-font, flat-type-hierarchy, icon-tile-stack, gradient-text, ai-color-palette (purple-blue), dark-glow (cyberpunk neon), nested-cards, monotonous-spacing, everything-centered, bounce-easing, all-caps-body, pure-black-white, gray-on-color, low-contrast, layout-transition (animating w/h), tight-leading (<1.3), skipped-heading, justified-text, tiny-text (<12px), wide-tracking on body

Browser-only: cramped-padding (<6px vertical), line-length (>75ch)

LLM-only flags: monospace-as-shorthand, dark-mode-default abuse, everything-in-cards, identical-card-grids, hero-metric, glassmorphism, sparkline decoration, generic shadows, modal abuse, every-button-primary, redundant headers, mobile amputation

**18 commands**: teach / craft / extract / audit / critique / polish / distill / clarify / optimize / harden / animate / colorize / bolder / quieter / delight / adapt / typeset / layout

**7 domain refs**: typography, color-and-contrast, spatial-design, motion-design, interaction-design, responsive-design, ux-writing

**Highest-risk for lecoder**: dark-glow (terminal text temptation), identical-card-grids (default agent list), everything-centered (mobile CTAs)

## UI/UX Pro Max v2 — Developer Tool / IDE category

- Color mood: dark syntax theme + blue focus
- Type: monospace + functional
- Patterns: dark mode (OLED) + minimalism
- Effects: syntax highlighting + command palette
- Avoid: light-mode default, slow performance

**Hard rules surfaced**:
- Inter banned ("THE LILA BAN" = no purple/blue AI aesthetic)
- Geist+Geist Mono OR Satoshi+JetBrains Mono only
- Max 1 accent, saturation <80%, no purple glows
- Anti-Center: ban centered hero when DESIGN_VARIANCE > 4
- Mandatory interactive states: skeleton loader, composed empty, inline error, `:active` translate-y/scale
- Animate `transform`+`opacity` only — never width/height
- Bento 2.0 paradigm with asymmetric grid

## 21st.dev (partial — category 404s)

Most relevant components for lecoder:
- Agent Plan component (215 likes) — agent task flow
- AI Prompt Box (275) — terminal command input
- Status indicators (15 components) — connection/agent state
- Message Dock (85) — multi-agent message mgmt

Confirmed 44×44pt min touch target, bottom tab max 5 items, skeleton over spinners.

## Taste skill — three dials

Calibration for lecoder:
- **Marketing site**: VARIANCE 7 / MOTION 5 / DENSITY 3
- **App UI**: VARIANCE 5 / MOTION 4 / DENSITY 7

Bans: Inter, emoji decoration, h-screen, neon glow, pure #000, oversaturated accents, gradient text, 3-equal-card, centered hero
Forces: font-mono for numerics at density >7, CSS Grid, min-h-[100dvh], Geist/Satoshi/Cabinet Grotesk

## TOP 10 Patterns to Adopt (cross-resource)

1. **Font pair: Geist Sans + Geist Mono** (free, mono companion, Vercel lineage). All numeric data in mono with `tnum` font feature.
2. **Warm-dark palette** with single functional accent. Background `#0a0b0e` warm near-black, surfaces `#0f1012`/`#191a1c`, text `#f5f4f1` cream. Single accent (amber per social kit decision).
3. **Layered dark surfaces** (Linear technique): canvas → panel → elevated → hover. Borders `rgba(255,255,255,0.05-0.08)` only. NO box-shadows on dark. Vercel shadow-as-border for containment.
4. **Asymmetric bento for agent dashboard** — ban 3-equal-card. Grid `2fr 1fr` or one card spans 2. Per-card structure: status pulse + name (sans 14/500) + task (mono 12) + latency (mono tnum) + controls.
5. **Mandatory full interaction state coverage** — every agent card: skeleton loader (layout-matched, not spinner), composed empty state, inline error text, `:active scale-[0.98]` or `translate-y-[1px]` tactile feedback.
6. **Weight restraint**: 400/500/600 ladder, never 700+ in app UI. Display: 48-64px, weight 600, tracking -2.4px. Headings: 20-24px / 600 / -0.5px. Body: 14-16px / 400 / lh 1.5. Mono: 13-14px / 400 / lh 1.6. Micro-labels: 11px / 500 / tracking 1.5px UPPERCASE.
7. **Workflow-specific accent per agent type** (Vercel pattern):
   - shell-only = zinc
   - single = blue
   - research-spec-test = amber
   - dev-review = green
   Applied as 2px left border on agent card.
8. **Mobile constraints (hard, not stylistic)**: 44×44pt min targets, 8dp gap, max 5 bottom-tab items, `min-h-[100dvh]`, safe area insets honored.
9. **Anti-pattern immunization** — top 3 risks: dark-glow on terminal text (use flat ANSI), identical-card-grids on agent list (break it), everything-centered on mobile CTAs (left-align for thumb scan). Ban bounce-easing, ban gray-on-color status text.
10. **Taste dial calibration per surface** — different design languages, shared tokens. Marketing = editorial pacing (Warp-like). App = cockpit (mono numerics, tight gaps, divide-y over cards).

## Open question for token doc
The token-architecture doc proposed Berkeley Mono (paid). Resource synthesis says **Geist Mono** (free, Vercel-native). Decision: Geist Sans + Geist Mono pair. JetBrains Mono fallback only.
