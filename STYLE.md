# LeCoder Style Guide

> Brand guidelines for the LeCoder ecosystem.

---

## Brand Identity

### Name
- **Organization**: LeCoder (or LeCoder AI)
- **Product**: MConnect
- **Full**: LeCoder MConnect

### Tagline
- Primary: "Terminal in your pocket"
- Secondary: "Control AI agents from anywhere"

### Voice & Tone
- **Developer-first**: Technical but approachable
- **Confident**: Not arrogant, but assured
- **Minimal**: Say more with less
- **Terminal-inspired**: Monospace, command-line aesthetic

---

## Logo

### The "L" Mark

The LeCoder logo is a pixelated "L" inspired by OpenCode's design language. It features a two-tone effect with an inner "depth" block.

```
┌──────────────┐
│ ████         │
│ ████         │
│ ██▓▓         │  ▓▓ = Inner depth block
│ ████         │  ██ = Outer L shape
│ ████████████ │
└──────────────┘
```

### Logo Specifications

**Grid System**: 4×5 units (scalable)

**Dark Mode (for dark backgrounds)**:
- Outer L: `#F1ECEC` (cream)
- Inner Block: `#4B4646` (charcoal)

**Light Mode (for light backgrounds)**:
- Outer L: `#211E1E` (near black)
- Inner Block: `#CFCECD` (light gray)

### Logo Files
```
brand-assets/
├── Logo/
│   ├── lecoder-logo-dark.svg      # For dark backgrounds
│   └── lecoder-logo-light.svg     # For light backgrounds
├── Wordmark/
│   ├── lecoder-wordmark-dark.svg  # "LECODER" text with depth
│   └── lecoder-wordmark-light.svg
└── Wordmark Simple/
    ├── lecoder-wordmark-simple-dark.svg   # Single color
    └── lecoder-wordmark-simple-light.svg
```

### Clear Space
Maintain clear space around the logo equal to 1 grid unit (25% of logo width).

### Minimum Size
- Digital: 24px height minimum
- Print: 10mm height minimum

---

## Colors

### Dark Mode (Primary)

| Name | Hex | Usage |
|------|-----|-------|
| Background Primary | `#191919` | Page background |
| Background Secondary | `#202020` | Cards, elevated surfaces |
| Background Elevated | `#252525` | Hover states |
| Text Primary | `#F1ECEC` | Headings, important text |
| Text Secondary | `#9b9b9b` | Body text |
| Text Muted | `#6b6b6b` | Captions, hints |
| Text Dim | `#4a4a4a` | Disabled, decorative |
| Border Subtle | `#2a2a2a` | Dividers |
| Border Default | `#373737` | Inputs, cards |
| Border Hover | `#525252` | Interactive borders |
| Logo Outer | `#F1ECEC` | L shape |
| Logo Inner | `#4B4646` | Depth block |

### Light Mode

| Name | Hex | Usage |
|------|-----|-------|
| Background Primary | `#FFFFFF` | Page background |
| Background Secondary | `#F5F5F5` | Cards, elevated surfaces |
| Background Elevated | `#EBEBEB` | Hover states |
| Text Primary | `#211E1E` | Headings, important text |
| Text Secondary | `#656363` | Body text |
| Text Muted | `#8a8a8a` | Captions, hints |
| Text Dim | `#b0b0b0` | Disabled, decorative |
| Border Subtle | `#E5E5E5` | Dividers |
| Border Default | `#D4D4D4` | Inputs, cards |
| Border Hover | `#A3A3A3` | Interactive borders |
| Logo Outer | `#211E1E` | L shape |
| Logo Inner | `#CFCECD` | Depth block |

### Accent Colors (Minimal Use)

| Name | Hex | Usage |
|------|-----|-------|
| Success | `#4ade80` | Confirmations, connected |
| Error | `#ef4444` | Errors, destructive |
| Warning | `#fbbf24` | Warnings, pending |

---

## Typography

### Font Family

**Primary**: JetBrains Mono
```css
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

**Fallback Stack**: Fira Code → SF Mono → Consolas → monospace

### Font Sizes

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| Display | 52px | 1.1 | Hero headlines |
| H1 | 36px | 1.2 | Page titles |
| H2 | 28px | 1.3 | Section headers |
| H3 | 20px | 1.4 | Subsections |
| Body | 16px | 1.6 | Paragraphs |
| Small | 14px | 1.5 | UI elements |
| Caption | 12px | 1.4 | Labels, hints |
| Tiny | 10px | 1.3 | Badges |

### Font Weights
- Regular: 400
- Medium: 500 (headings)
- Semibold: 600 (emphasis)

---

## Spacing

Based on 4px grid:

| Name | Value | Usage |
|------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Inline elements |
| md | 16px | Component padding |
| lg | 24px | Section gaps |
| xl | 32px | Large gaps |
| 2xl | 48px | Section spacing |
| 3xl | 64px | Major sections |

---

## Border Radius

| Name | Value | Usage |
|------|-------|-------|
| sm | 4px | Small elements |
| md | 8px | Buttons, inputs |
| lg | 12px | Cards |
| xl | 16px | Large cards |
| full | 9999px | Pills, avatars |

---

## Shadows

Minimal shadows - prefer borders for depth.

```css
/* Subtle shadow for elevated elements */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

/* Card shadow */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
```

---

## Components

### Buttons

**Primary (CTA)**:
- Dark mode: `#F1ECEC` background, `#191919` text
- Light mode: `#211E1E` background, `#FFFFFF` text
- Hover: Invert colors with border

**Secondary**:
- Transparent background
- Border: `border-default`
- Hover: Slight background tint

### Code Blocks

```css
.code-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 16px 20px;
  font-family: var(--font-mono);
}
```

### Cards

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 24px;
}

.card:hover {
  border-color: var(--border-default);
}
```

---

## Icons

- **Style**: Outline, 1.5px stroke
- **Library**: Lucide React
- **Size**: 16px (inline), 20px (UI), 24px (large)

---

## Animation

Keep animations subtle and functional:

```css
/* Default transition */
transition: all 0.15s ease;

/* Hover effects */
transition: all 0.2s ease;

/* Page transitions */
transition: opacity 0.3s ease, transform 0.3s ease;
```

---

## Writing Style

### Headlines
- Short, punchy
- No periods at end
- Sentence case

### Body Text
- Clear, concise
- Technical but accessible
- Active voice

### Code Examples
- Always include copy button
- Show realistic commands
- Include comments for clarity

---

## Do's and Don'ts

### Do
- Use monospace everywhere
- Keep it minimal
- Prefer borders over shadows
- Use subtle hover states
- Support both light and dark modes

### Don't
- Use gradients
- Use multiple accent colors
- Use heavy shadows
- Use serif fonts
- Use rounded corners > 16px

---

## CSS Variables

```css
:root {
  /* Dark mode (default) */
  --bg-primary: #191919;
  --bg-secondary: #202020;
  --bg-elevated: #252525;
  --text-primary: #F1ECEC;
  --text-secondary: #9b9b9b;
  --text-muted: #6b6b6b;
  --text-dim: #4a4a4a;
  --border-subtle: #2a2a2a;
  --border-default: #373737;
  --border-hover: #525252;
  --logo-outer: #F1ECEC;
  --logo-inner: #4B4646;
  --accent-success: #4ade80;
  --accent-error: #ef4444;
  --accent-warning: #fbbf24;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 8px;
}

[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F5;
  --bg-elevated: #EBEBEB;
  --text-primary: #211E1E;
  --text-secondary: #656363;
  --text-muted: #8a8a8a;
  --text-dim: #b0b0b0;
  --border-subtle: #E5E5E5;
  --border-default: #D4D4D4;
  --border-hover: #A3A3A3;
  --logo-outer: #211E1E;
  --logo-inner: #CFCECD;
}
```

---

## Resources

- **Logo files**: `/brand-assets/`
- **Design reference**: OpenCode (opencode.ai)
- **Icon library**: [Lucide](https://lucide.dev)
- **Font**: [JetBrains Mono](https://www.jetbrains.com/mono/)

---

<p align="center">
  <b>>_<</b> LeCoder Brand Guidelines v1.0
</p>
