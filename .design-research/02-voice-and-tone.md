# LeCoder MConnect — Voice & Tone Guide (Draft)

> Editorial layer of the design system. Independent of visual evolution.

## Brand voice in one sentence

**The calm operator** — confident, precise, low-drama. We are the second-in-command on a developer's machine; we don't shout, we just work.

## Three voice anchors

1. **Pragmatic over poetic** — "Pair your phone" not "Forge a connection between your devices"
2. **Specific over abstract** — "5 agents, 1 phone" not "Effortless multi-agent control"
3. **Calm over hype** — "Connected" not "🚀 Successfully connected!"

## Voice spectrum (where we sit)

```
formal ───●─────────────────── casual
                    │
   technical ─────────●─── plainspoken
                          │
       neutral ───●─────────── opinionated
                  │
       silent ──────●────────── chatty
```

We are: lightly casual, plainspoken, mildly opinionated, near-silent.

## Tone modulation by context

| Surface | Tone | Example |
|---|---|---|
| CLI output | Direct, monospace, no emoji | `connected · 1 agent · port 8765` |
| Pairing flow | Reassuring, terse | "Almost there. Enter the 6-digit code." |
| Errors | Honest, actionable | "Daemon not running. Try `mconnect daemon start`." |
| Success states | Quiet acknowledgment | "Paired" not "Successfully paired! 🎉" |
| Marketing | Confident, evidence-led | "Run 5 agents in parallel. Control them from your phone." |
| Docs | Imperative, step-numbered | "1. Install the CLI. 2. Run `mconnect`. 3. Scan the QR." |
| Social | Personality OK, no cringe | "your laptop on a hike. ssh from a coffee shop. agents still working." |

## Lexicon

**Words we use**
- agent (lowercase) — the AI tool (Claude Code, Gemini, etc.)
- session — a running agent + workspace
- pair / paired — the phone/laptop handshake
- control — who's driving the terminal right now
- worktree — git isolation per agent
- pane — a single agent's terminal view

**Words we avoid**
- "AI-powered" — yes, obviously
- "magical" / "seamless" / "effortless" — earn it, don't claim it
- "leverage" / "synergy" / "robust" — corporate noise
- "revolutionary" / "game-changer" — vapid
- "just works" — dishonest; nothing always just works
- "supercharge" — banned
- emoji in product UI (allowed sparingly in social/blog)

## Microcopy patterns

### Buttons (verb-first, ≤3 words)
- "Pair phone" not "Click to pair"
- "Grant control" not "Hand over the keyboard"
- "Stop session" not "Click here to stop"
- "Send" not "Submit"

### Empty states (3 lines max)
```
No agents running.
Spin one up:
  mconnect run --provider claude
```

### Errors (what happened · why · what to do)
```
Pairing failed.
The code expired after 5 minutes.
Generate a new one in the CLI.
```

### Loading (specific, not generic)
- "Connecting…" → "Pairing with phone…" (more useful)
- "Loading…" → "Restoring scrollback…" (more useful)

### Success (acknowledge, don't celebrate)
- ✓ "Paired"
- ✓ "Control granted to phone"
- ✗ "🎉 You did it!"

## Headline patterns (marketing)

**Pattern A: Object + verb + place**
- "Your terminal in your pocket"
- "Five agents on one phone"

**Pattern B: Negative space**
- "Your laptop, but you're at the dentist"
- "No more 'check on the build'"

**Pattern C: Concrete number**
- "5 agents. 1 phone. 0 ssh."

Avoid: pun headlines, alliteration ("ship swiftly"), gerund-stacks ("Building. Shipping. Scaling.")

## Punctuation & formatting

- Sentence case for headings (not Title Case, not ALLCAPS)
- No periods on UI labels or short headings
- Periods on full sentences in body
- Em-dash for asides (—) not hyphens (-)
- Code: backticks for filenames/commands; never "screenshot of code as image"
- Numbers: numerals from 2 onward ("one phone, 2 agents, 30 sessions")
- Commands: `mconnect run` lowercase, monospace, no leading `$`

## Length budgets

| Element | Max |
|---|---|
| Button | 3 words |
| Section heading | 6 words |
| Hero headline | 8 words |
| Toast/notification | 60 chars |
| Error message | 2 sentences |
| Empty state | 3 short lines |
| Tweet | 280 (use it; don't pad) |

## Voice anti-patterns (what we will NEVER do)

- "Hi! 👋 Welcome to LeCoder!" — too eager
- "Oops! Something went wrong." — hides info, treats user like child
- "Sit back and relax while we do the heavy lifting." — passive-aggressive about computers being slow
- "Let's get started!" — false enthusiasm
- "We're so excited to announce…" — start with the news, not the feelings
- "AI-powered" anywhere it's not load-bearing

## Reference voices we like (and why)

- **Linear** — terse, declarative, every word earns its place
- **Stripe** — technical without showing off, examples over adjectives
- **Vercel** — confident, infrastructure-as-aesthetic
- **Warp** — terminal-native voice that doesn't condescend to non-CLI users

## Reference voices we don't want to be

- **Salesforce** — corporate-speak word salad
- **Most YC startup landing pages** — "Stop wasting time on X. Start doing Y." formula
- **Vercel circa 2018** — over-clever puns
