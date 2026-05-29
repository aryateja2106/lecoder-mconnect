# Themed Hybrid UI Component Specification

> Adapted from Disler's `invent_new_ui_v3.md` for the lecoder-mconnect infinite loop. Use this as a starting point and modify freely for your own specs.

## Core Challenge

Create a **uniquely themed UI component** that combines multiple existing UI elements into one elegant solution. Apply a distinctive design language while solving multiple interface problems in a single, cohesive component — "two birds with one stone" efficiency.

## File Naming

`ui_hybrid_[iteration_number].html`

The iteration number is supplied per turn by the loop orchestrator. Save exactly one new file per turn into the configured output directory. Do not modify earlier iterations.

## Content Structure

A standalone, self-contained HTML document — no build step, no external bundles. Inline CSS in `<style>` and inline JS in `<script>`. The page should render correctly when opened directly in a browser.

```html
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
```

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

- Single self-contained `.html` file, no external dependencies
- Accessible: keyboard navigation works for every combined function
- Responsive: works on mobile and desktop
- Visually distinct from previous iterations in the output directory
- No console errors when opened in a recent Chromium browser

## Iteration directive

Read `~/.lecoder/loops/active.json` and `~/.lecoder/loops/prompt.txt` for your current iteration number, the recent history, and the creative direction for this iteration band. Generate exactly one new file and end your turn.
