/**
 * Inline templates.
 *
 * tsup builds `src/index.ts` into a single bundled `dist/index.js`.
 * Anything outside that bundle (raw `.mdc` / `.md` files) does not ship
 * with the npm package, so we embed the template bodies here as string
 * constants. The `loop-rules.mdc` and `example-spec.md` files in this
 * directory remain the source of truth for humans editing them; this
 * file is kept in sync manually.
 *
 * Build-time check: `npm run check:templates` (added in package.json)
 * verifies LOOP_RULES_MDC and EXAMPLE_SPEC_MD match the on-disk files.
 */

export const LOOP_RULES_MDC = `---
description: lecoder-mconnect infinite loop protocol for Cursor agent
alwaysApply: true
---

# lecoder-loop

You are participating in a **multi-turn agentic loop** orchestrated by \`lecoder-mconnect\`. A \`stop\` hook fires after every one of your turns and may automatically continue the conversation with a new directive — your job is to make consistent, isolated progress on each turn so the loop produces a coherent body of work.

## How it works

1. The user starts a loop with \`mconnect loop start <spec> <output_dir> <count>\`.
2. \`lecoder-mconnect\` writes loop state to \`~/.lecoder/loops/active.json\`.
3. The user pastes a kickoff prompt into this chat. That prompt names the spec, output dir, and target count.
4. After every turn you end, the \`stop\` hook reads the state, advances the iteration counter, and sends you a \`followup_message\` with the next iteration's directive — Cursor automatically starts the next turn with that prompt.

You will see prompts that begin with \`[lecoder-loop]\`. Treat them as authoritative.

## Per-turn protocol

### Spec mode (default)

Each turn produces **exactly one new file** in the output directory.

1. Read the spec at the path given in the prompt.
2. List the existing iterations in the output directory.
3. Generate iteration **N** — the number stated in the prompt — as a single new file. Do **not** edit other iterations.
4. Save it under the filename pattern declared in the spec (or named in the prompt).
5. End your turn with a brief one-line summary like \`Iteration 7 done: ui_hybrid_7.html\`. Do **not** ask for permission to continue.

### Task mode (\`mode=task\`)

Each turn makes one chunk of progress on a single long task brief.

1. Read the brief at the path given in the prompt.
2. Make the next concrete, committable chunk of progress (code, tests, refactor, etc.).
3. End your turn with a one-line summary of what you completed.
4. When you believe the task is fully complete, write \`LECODER_LOOP_DONE\` on its own line and end your turn — the stop hook will see no further work and archive the loop.

## Uniqueness and progressive sophistication

Each turn's prompt embeds a **creative direction** for that iteration band:

| Iterations | Directive |
|-----------:|-----------|
| 1–3        | Foundation pass — single innovation dimension, spec-compliant |
| 4–6        | Refinement pass — combine 2 dimensions |
| 7–12       | Innovation pass — combine 3+ dimensions, new interaction paradigm |
| 13+        | Revolutionary pass — push spec boundaries, novel metaphors |

You are responsible for ensuring each iteration is distinctly different from the previous five (those filenames are listed in the prompt).

## Boundaries

- **Do not** modify files outside the output dir or unrelated source files in spec mode.
- **Do not** call long-running shell commands that block the turn end — the loop relies on turn ends firing the stop hook.
- **Do not** ask the user to confirm before continuing. The stop hook drives continuation.
- **Do not** re-read the spec into context unless you have lost it. Once read, summarise key constraints in a comment in the iteration file.
- If you encounter an error you cannot resolve in this turn, end your turn with a one-line \`BLOCKED: <reason>\`. The stop hook will detect repeated errors and pause the loop.

## Recovering after compaction

If your context is compacted mid-loop:

1. \`cat ~/.lecoder/loops/active.json\` — gives you the loop id, mode, target, completed count, recent history tail.
2. \`cat ~/.lecoder/loops/prompt.txt\` — gives you the most recently issued iteration directive.
3. Resume from the iteration number recorded in \`active.json\` + 1. The stop hook will reconcile if you skip or repeat a number.

## Coexistence with context-mode

If \`context-mode\` hooks are also installed in this project:

- Honor its routing rules (\`ctx_execute\`, \`ctx_search\`, etc.) for analysis and search.
- The lecoder-loop stop hook runs **alongside** context-mode's stop hook; both will return JSON. Your continuation comes from the lecoder-loop entry. Behave normally.
`;

export const EXAMPLE_SPEC_MD = `# Themed Hybrid UI Component Specification

> Adapted from Disler's \`invent_new_ui_v3.md\` for the lecoder-mconnect infinite loop. Use this as a starting point and modify freely for your own specs.

## Core Challenge

Create a **uniquely themed UI component** that combines multiple existing UI elements into one elegant solution. Apply a distinctive design language while solving multiple interface problems in a single, cohesive component — "two birds with one stone" efficiency.

## File Naming

\`ui_hybrid_[iteration_number].html\`

The iteration number is supplied per turn by the loop orchestrator. Save exactly one new file per turn into the configured output directory. Do not modify earlier iterations.

## Content Structure

A standalone, self-contained HTML document — no build step, no external bundles. Inline CSS in \`<style>\` and inline JS in \`<script>\`. The page should render correctly when opened directly in a browser.

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Theme Name] [Hybrid Component Name]</title>
    <style>
        /* Theme implementation across all component aspects */
    </style>
</head>
<body>
    <main>
        <h1>[Hybrid Component Name] — [Theme Name] Theme</h1>
        <div class="hybrid-component">
            <!-- Multiple UI functions integrated into one component -->
            <!-- Realistic demo data showing all combined features -->
        </div>
    </main>
    <script>
        // Coordinated behaviour across the integrated UI functions
    </script>
</body>
</html>
\`\`\`

## Theme dimensions (pick one per iteration; do not repeat the same theme twice in five turns)

- Organic Nature
- Digital Minimalism
- Retro Computing
- Glass Morphism
- Industrial Design
- Playful Animation
- Zen Philosophy
- Cyberpunk Future
- Handcrafted Paper
- Architectural Brutalism

## Hybrid combinations (pick a different one each iteration)

- Search Hub: search bar + autocomplete + recent items + filters + results preview
- Input Intelligence: text field + validation + help system + formatting + autocomplete
- Action Controller: button + loading state + confirmation + success feedback + error handling
- File Manager: upload area + progress + preview + validation + browser
- Navigation Center: tabs + breadcrumbs + search + quick actions + state memory
- Data Explorer: table + pagination + search + filter + sort + export + selection
- Content Card: preview + actions + modal + sharing + favoriting + metadata
- Form Wizard: progress indicator + steps + validation + navigation + save states
- Media Player: controls + playlist + visualizer + sharing + quality selector
- Dashboard Widget: chart + filter + export + refresh + settings + alerts

## Quality bar

- Single self-contained \`.html\` file, no external dependencies
- Accessible: keyboard navigation works for every combined function
- Responsive: works on mobile and desktop
- Visually distinct from previous iterations in the output directory
- No console errors when opened in a recent Chromium browser

## Iteration directive

Read \`~/.lecoder/loops/active.json\` and \`~/.lecoder/loops/prompt.txt\` for your current iteration number, the recent history, and the creative direction for this iteration band. Generate exactly one new file and end your turn.
`;
