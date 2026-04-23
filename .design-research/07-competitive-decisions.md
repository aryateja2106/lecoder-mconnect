# Competitive Analysis — 4 Locked Decisions

> Source: parallel designer agent (Notion/Warp/Linear background). Surveyed Warp, Linear, Notion, Vercel, Replit, OpenCode, Cursor.

## Decision 1: Color lane — warm teal on near-black

Competitor occupancy:
- Linear `#5E6AD2` indigo
- Notion `#455DD3` indigo-blue
- Cursor `#C08532` amber
- Replit `#FF3C00` red-orange
- Vercel black/white
- Warp warm-cream on charred black (no accent)

**Recommended unoccupied lane: warm teal `#00D4AA` on `#121212`**
- Terminal-native heritage (classic green-phosphor, evolved)
- Sharp on dark
- Distinct from all competitors

⚠️ **CONFLICT WITH SOCIAL KIT** — social kit locked Terminal Amber `#E8A030` (citing CRT phosphor culture, gap-filling). Competitive analysis says amber is Cursor's lane.

**Decision needed**: amber (cursor-adjacent but heritage) vs teal (unoccupied + terminal-native). See synthesis doc for resolution.

## Decision 2: Typography — license premium or stay free

Options:
- **Matter** (Warp's choice) — warm, geometric, premium. Risks DNA-share with north star.
- **ABC Diatype Variable** (Replit's, Dinamo foundry) — more personality, distinctly ours.
- **Geist Sans + Geist Mono** (Vercel, free) — resource synthesis recommendation.

⚠️ **CONFLICT WITH RESOURCE SYNTHESIS** — synthesis said Geist (free, Vercel-native). Competitive says license premium for distinctness.

**Recommendation**: Start Geist (free, ship fast for pitch). Plan upgrade to ABC Diatype Variable in Q2 if budget allows. License cost: ~$300-600 single-style.

## Decision 3: Hero pattern — terminal prompt AS INTERACTION

Replit's "describe your idea" is the most honest mobile-first hero in the group. For lecoder, the equivalent:

```
┌──────────────────────────────┐
│  Which agent do you want     │
│  to connect?                 │
│                              │
│  ┌──────────────────────┐    │
│  │ pair my phone        │ →  │
│  └──────────────────────┘    │
│                              │
│  [Claude] [Gemini] [Codex]   │
│  [Cursor]    [Aider]         │
│                              │
└──────────────────────────────┘
```

Single input. Big CTA. Category chips. Works on phone without layout gymnastics.

NOT: hero with rotating laptop screenshot, gradient mesh background, lifestyle photography.

## Decision 4: Mobile-native patterns NONE of competitors do

Where lecoder wins on UX (not just visual):
1. **Haptic feedback on agent state changes** — connection, control grant, kill, error, approval
2. **Swipe-left on agent cards for actions** — pause, kill, share, mute notifications
3. **Persistent top status bar** — active session count + connection quality always visible
4. **Bottom-sheet keyboard input pinned above software keyboard** — Visual Viewport API, never gets covered

These are the differentiation. Visual polish gets us to "looks good"; these get us to "actually better than ssh'ing from a phone".

## Reconciliation needed (for user decision)

**Accent**: amber `#E8A030` vs teal `#00D4AA`?
- Amber argument: phosphor heritage, social kit already designed around it, warmer with grey-50 warm-tinted bg
- Teal argument: unoccupied competitive lane, more distinct, sharper hierarchy on dark

**Font**: Geist (free, ship now) vs ABC Diatype Variable (~$500, distinct)?
- Geist argument: free, Vercel-native, mono companion, ships in 0 days
- Diatype argument: distinct from every competitor, more personality, but cost + license tracking
