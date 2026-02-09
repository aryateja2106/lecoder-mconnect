# MConnect Opik Dashboard Setup Guide

## Step 1: Generate Scored Data First

Before setting up widgets, run the eval script to get feedback scores into Opik:

```bash
# From repo root:
npx tsx packages/cli/scripts/eval-guardrails.ts

# OR from packages/cli/:
npx tsx scripts/eval-guardrails.ts
```

This creates:
- 4 evaluation traces (one per guardrail level: default, strict, permissive, none)
- 100 spans total (25 test commands × 4 levels)
- Feedback scores: `command_safety`, `correctness`, `guardrail_accuracy`, `avg_safety_score`
- A dataset called "guardrail-test-commands" with 25 items

After this, also run MConnect normally (`mconnect start`) to generate session traces with `session_health`, `agent_coordination`, and `agent_tool_selection` scores.

## Step 2: Dashboard Layout

Save your dashboard as **"MConnect Observability"** (click "Save as new dashboard").

### Section 1: "Application Health" (rename from "Project overview")

Keep the default 5-widget row but **modify them**:

| Widget | Type | Source | Metric | Why |
|--------|------|--------|--------|-----|
| Sessions | Project statistics | Traces statistics | Total trace count | How many MConnect sessions have run |
| Spans | Project statistics | Spans statistics | Total span count | Total observable events across all sessions |
| Errors | Project statistics | Traces statistics | Total error count | Keep — shows system reliability |
| Avg Duration | Project statistics | Traces statistics | P50 duration | Keep — shows typical session length |
| Guardrails Triggered | Project statistics | Spans statistics | Total span count, **filtered** by `name = guardrail_check` | How many commands hit the guardrail |

For the guardrails widget: click "+ Add filter" → Column: `name`, Operator: `=`, Value: `guardrail_check`

### Section 2: "Command Safety & Guardrails" (new section)

Click "+ Add section" and name it. Add these widgets:

| Widget | Type | Source | Metric | Filter | Description |
|--------|------|--------|--------|--------|-------------|
| Safety Score Trend | Project metrics (chart) | Spans statistics | Span metrics → `command_safety` | none | Shows how command safety scores trend over time |
| Guardrail Accuracy | Project metrics (chart) | Traces statistics | Trace metrics → `guardrail_accuracy` | none | Evaluation accuracy per guardrail level over time |
| Blocked Commands | Project statistics (number) | Spans statistics | Total span count | `name = guardrail_check` AND `output.blocked = true` | Count of blocked dangerous commands |
| Correctness | Project metrics (chart) | Spans statistics | Span metrics → `correctness` | none | Whether guardrails made the right call |

**Note:** The feedback scores (`command_safety`, `correctness`, etc.) appear under "Span metrics" in the Metric dropdown after the eval script has run. If you don't see them yet, run the eval script first and refresh.

### Section 3: "Agent Performance" (new section)

| Widget | Type | Source | Metric | Filter |
|--------|------|--------|--------|--------|
| Agent Spawns | Project statistics | Spans statistics | Total span count | `name = agent_spawn` |
| Agent Tool Selection | Project metrics (chart) | Spans statistics | Span metrics → `agent_tool_selection` | none |
| Session Health | Project metrics (chart) | Traces statistics | Trace metrics → `session_health` | none |
| Agent Coordination | Project metrics (chart) | Traces statistics | Trace metrics → `agent_coordination` | none |

### Section 4: "Session Analytics" (rename "Duration & Latency")

| Widget | Type | Source | Metric |
|--------|------|--------|--------|
| Session Duration | Project metrics (chart) | Traces statistics | Trace duration |
| Span Duration | Project metrics (chart) | Spans statistics | Span duration |
| Number of Spans per Session | Project metrics (chart) | Traces statistics | Number of spans |
| Traces Over Time | Project metrics (chart) | Traces statistics | Number of traces |

### Section 5: "System Overview" (Markdown widget)

Add a Markdown text widget with this content:

```
## LeCoder MConnect — Observability Dashboard

MConnect is a mobile-first terminal controller for AI coding agents. This dashboard tracks every session, agent interaction, and guardrail decision through Opik.

**Custom Evaluation Metrics:**
- **Command Safety** — scores each guardrail decision (blocks, approvals, false positives)
- **Agent Tool Selection** — measures if the right agent handles each command
- **Session Health** — composite score across security, containers, auth, and PTY
- **Agent Coordination** — tracks multi-agent utilization and transfer efficiency

**Evaluation Dataset:** 25 test commands across 4 categories (safe, dangerous, risky, edge cases), evaluated across all 4 guardrail levels (strict, default, permissive, none).
```

## Step 3: Remove Unused Sections

Delete these sections that show "No data to show":
- **Quality overview** (Thread quality / Trace quality) — we don't use threads
- **Threads and traces volume** → keep "Number of traces", delete "Number of threads"

## Step 4: Quick Filter Tips

When adding filters to widgets:
- `name` column filters by span name (e.g., `guardrail_check`, `agent_spawn`, `command_execution`, `container_lifecycle`, `pty_spawn`, `security_event`)
- You can filter traces by metadata fields too
- Use "Override dashboard default data source" toggle if you have multiple projects

## What Judges Will See

After running the eval script + a few real MConnect sessions, your dashboard tells this story:

1. **Scale** — How many sessions, spans, and events MConnect has processed
2. **Safety** — Real-time command safety scores proving the guardrails work
3. **Accuracy** — Evaluation data showing guardrail correctness across levels
4. **Agent Intelligence** — Whether the right agents handle the right tasks
5. **Health** — Composite session health tracking system reliability
6. **Coordination** — Multi-agent collaboration efficiency metrics

This covers Opik's key features: tracing, feedback scores, datasets, and dashboards.
