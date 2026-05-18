# MConnect — Design Spec v1 Addendum

> Companion to `DESIGN-SPEC-V1.md`. Captures product reframe + answers the design-tool prompts that were still open.

---

## 1. Product reframe (this is the change)

**v1 spec said**: "MConnect — terminal in your pocket, control AI agents from your phone."

**v1.1 reality**: same core, plus **fleet + visual surfaces + sandbox**.

The product, restated:

> **MConnect is a unified mobile control plane for every machine you can run agents on — terminal, GUI, and sandboxed all at once.**

Three surfaces, one app:

1. **Terminal** — the original wedge. SwiftTerm-powered live PTY into any agent session.
2. **Screen** — visual control. VNC / Apple Remote Desktop into the host. Watch the agent work, interrupt, take over, hand back.
3. **Fleet** — the new layer. One pane of glass for ALL machines you have access to (your Mac mini, your dev container, your colleague's leased GPU box, a sandboxed Docker on a leased Linux host). Pick a machine, spawn an agent, sandbox the blast radius via git or Docker, oversee from one place.

The sandbox layer is critical: agents inside an ephemeral git worktree or Docker container, so a bad command can't burn the host. This is where lockshell + skill-lab gate plug in — the trust layer is what makes the fleet idea defensible.

**Why this matters for design**: the IA in v1 spec is right (Hosts / Agents / Terminal / Screen / Vault) but **`Hosts` graduates to `Fleet`**. It's not a contact list of machines — it's a real-time fleet view with sandbox status, agent count per host, machine type (Mac / Linux / Docker / leased), and quick-spawn affordance.

### Tagline locked

**Primary**: "Your agents. Every machine. One pocket."

Backup: "Agents in your pocket" (shorter, less precise).

The word "terminal" leaves the headline. It returns as a sub-tagline / feature claim, not the lede.

---

## 2. Answers to the open design-tool prompts

### Adjective that should feel MOST true → **Powerful**

Warp/Raycast-tier confidence. We are not a quiet utility. We are giving the user authority over a fleet of machines running autonomous code. The aesthetic must feel like terminal-native authority — not pretty, not fashion, not toy. Quiet is wrong here; quiet apps don't ship a multi-machine + VNC + secret broker stack.

But: **powerful does not mean noisy.** Linear is powerful AND restrained. Raycast is powerful AND minimal. Both ship dense information without shouting. That's the target.

What "powerful" means for execution:
- Information density beats white-space-as-luxury. List rows show 3-4 facts not 1.
- JetBrains Mono is mandatory for any technical readout — agents, hosts, paths, commands.
- Status is always visible (connection state, sandbox state, approval queue depth). No hidden nav.
- Defaults are pro defaults. No "Welcome! Let's get started!" hand-holding chrome.

### Tagline → "Agents in your pocket. Every machine. One control plane." (or shorter primary above)

### Things to embrace

- **Warp's command-block aesthetic** — the screenshot from the design tool already showed this in Option 1; it's the right direction for terminal output. Each command + its output is one block, visually delineated.
- **Linear's segmented controls + Cmd+K language** — for switching between Terminal / Sessions / Agents within a host.
- **Raycast's status bar density** — small text, lots of facts, clean alignment.
- **The current `lecoder.lesearch.ai` palette** — `#191919` bg, cream text, `>_<` mark — keep this. The new directions iterate on top, not replace.
- **Variable accent color** — yes to the Tweaks panel that toggles accent hue (red / blue / green / orange / purple). Default green (success-green = the "agent is alive" feel). Let the user pick. Persists per-device.
- **iPhone frames for hero shots, raw screens for the comparison grid.** Show finish AND show density.

### Things to avoid

- **Termius / TeamViewer chrome** — too sysadmin, too utility-belt. We're not 2010.
- **AI-purple gradients, glass blur, skeumorphic cards** — visual styling that screams "AI app." We are an infrastructure tool that uses agents, not an "AI assistant."
- **Onboarding tutorials** — single pair-screen entry, not 4-slide carousel.
- **Toast spam** — confirmation toasts only on irreversible actions; everything else inline.
- **Custom font for headlines** — Inter for UI is fine, JetBrains Mono / IBM Plex Mono for technical readout. NO third font.
- **Generic stock illustrations** — the OpenCode pixel-`L` lineage is the visual identity. No vector people, no spot illustrations.

### Audiences (priority order)

1. **YC partners** — must understand the product in 8 seconds from the landing page hero. Decoder for them: "fleet of machines running agents, controlled from a phone, sandboxed by default."
2. **Founders + solo developers** running 2+ agents (Karpathy-tier) — they feel the pain we're solving and recognize the wedge instantly.
3. **Investors (post-seed, agent infra thesis)** — credit-economy + fleet + sandbox is the moat narrative.
4. **Internal dogfood** — me using my own product daily. If the design feels heavy on day 30, it's wrong.

NOT the audience: enterprise IT, MDM buyers, RDP power users, casual consumers, students.

### Constraints

- **Must work one-handed on iPhone**, including approval flow. The point is "I'm not at my desk."
- **Must look credible in landscape** for the demo video moment when iPhone is held sideways during a screen-share.
- **Must support light + dark** but launch dark-first. Light parity in v1.1 (post-YC).
- **Must respect Reduced Motion** — no spring animations as the only feedback path.
- **Must look great on iPhone 13 / 14 / 15 base models** (the median user device, not Pro Max).
- **Marketing site (`lecoder.lesearch.ai`) must use the same token system** as the iOS app. Web first, app second OR app first, web second — but tokens shared, never forked.

### 3rd design direction (since you picked 2 = current + adventurous)

If the design tool offers a 3rd slot in any iteration: **a typographic-only direction** — no chrome at all, just JetBrains Mono on `#191919`, terminal-native to the extreme, every screen a typed transcript. Think Tot meets a real terminal. High risk / high reward. Worth seeing once even if we don't ship it.

---

## 3. Marketing landing page direction (since picked as priority)

The website redesign at `lecoder.lesearch.ai` should communicate the reframe:

- **Hero**: full-bleed iPhone mockup showing the Fleet view (3-4 machines listed with live status dots) → tap a machine → terminal pane → live agent output. Single hero loop, no scroll-jacking.
- **Headline**: "Your agents. Every machine. One pocket."
- **Subhead**: "Control AI coding agents on every machine you can reach — terminal, VNC, sandboxed by default."
- **Below the fold**:
  - 3 product surfaces (Terminal / Screen / Fleet) in 3 columns. Each: device mockup + 2-line claim + one demo GIF/Lottie.
  - "Trust layer" section — lockshell vault audit log screenshot + "Agents can't read your raw secrets" claim. Critical for YC reviewers.
  - "How it works" — pair via QR → start an agent → mobile approves dangerous commands. 3 steps, 3 illustrations (terminal-style ASCII blocks, not stock).
  - Social proof slot (quotes from beta users — keep blank if none yet, don't fake).
  - Footer: GitHub, TestFlight, npm package, Twitter/X, brand mark.
- **Site shell**: same monospace + monochrome aesthetic as the iOS app. NO marketing-site-only fonts (no Inter Display, no Söhne).
- **Performance**: ship as static Next.js, no client-side framework chrome above 50KB. No video — Lottie or animated SVG only. Lighthouse 95+ mobile.

---

## 4. Hand-back to design tool

When you paste this into the design tool's chat, also tell it:

> Mock these 4 screens at minimum, in both directions:
> 1. **Approval modal** (the hero moment — iPhone in hand, command in JetBrains Mono, Approve / Reject buttons, FaceID badge)
> 2. **Terminal tab with live PTY** (Warp-style command blocks; show 2 commands rendered + 1 streaming)
> 3. **Fleet view** (NEW — replaces "Hosts" — list of 3 machines with live status dots, sandbox badge, agent count, quick-spawn FAB)
> 4. **Marketing landing hero** (full-bleed iPhone Fleet → Terminal loop, headline above, "Get TestFlight" CTA below)
>
> Optional:
> 5. **Screen tab connected** (VNC framebuffer + toolbar + tap-to-click affordance)
> 6. **Vault audit log** (timeline of secret grants per agent)
>
> Style: Powerful, Linear/Warp/Raycast-tier confidence, monospace native. Tweaks panel for accent color (default green) + density toggle (compact / regular).

---

## 5. What NOT to ask the design tool to do

- Don't ask for a logo redesign — pixel `L` mark is locked. We use what's in `brand-assets/`.
- Don't ask for a new color palette — extend STYLE.md, don't replace.
- Don't ask for an Apple Watch / iPad / visionOS variant. Phone first. Web second. Nothing else in v1.
- Don't ask for an admin dashboard / web settings UI. Out of scope.

---

**Addendum version**: 1.0  
**Date**: 2026-05-03  
**Pairs with**: `DESIGN-SPEC-V1.md`  
**Use**: paste into design tool chat as context; refer to it during prototype review.
