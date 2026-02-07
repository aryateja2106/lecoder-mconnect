# MConnect: Mobile Control for AI Coding Agents

## The Problem

AI coding agents like Claude Code, Gemini CLI, and Cursor Agent are transforming how we write software. But there's a friction point: **you're tethered to your laptop**. Start Claude Code on a complex task, step away for coffee, and return to find it stuck waiting for approval—or worse, it made a mistake 30 minutes ago. The most powerful AI assistants still need a babysitter.

## The Solution

**MConnect puts AI agent control in your pocket.** Run agents on any machine, scan a QR code, and manage everything from your phone:

- **Monitor in real-time** — Watch terminal output stream as your agent works
- **Approve dangerous commands** — Git pushes and destructive operations require explicit approval from anywhere
- **Switch between agents** — Running three parallel agents? Swipe between them like tabs
- **Stay untethered** — Your laptop works; your phone keeps you in control

The workflow is simple: `npm install -g lecoder-mconnect && mconnect start`. A QR code appears. Scan it. You're connected—no accounts, no cloud services, just a secure Cloudflare tunnel between your devices.

## Opik Integration for Observability

We integrated **Opik** for comprehensive tracing of agent behavior. Every meaningful event generates a trace:

- **Session spans** track when users start and end sessions, with preset and guardrail configurations
- **Agent spans** capture the full lifecycle—spawn time, working directory, exit codes, and duration
- **Command spans** record every command executed, whether from laptop or mobile, and whether guardrails blocked it
- **Approval spans** measure the complete approval flow—request reason, user decision, and response latency

This gives developers unprecedented visibility into AI agent operations. How long does your approval flow take? How often do guardrails block dangerous commands? Which presets lead to the most productive sessions? Opik captures it all.

## Technical Highlights

- **Shell-first architecture** — Reliable PTY handling that works with TUI applications
- **WebSocket v2.0 protocol** — Multiplexed real-time terminal streaming
- **Multi-agent orchestration** — Run Claude Code, Gemini CLI, and shell sessions simultaneously
- **Guardrails system** — Configurable command safety with approval workflows
- **Zero-config deployment** — One command to start, QR code to connect

## Impact

MConnect represents the future of AI-assisted development: agents that work autonomously while humans retain meaningful control from anywhere. As AI coding assistants multiply, MConnect becomes essential infrastructure—the control plane for the age of AI developers.

---

**Demo**: https://lecoder-mconnect.vercel.app
**GitHub**: https://github.com/aryateja2106/lecoder-mconnect
**npm**: `npm install -g lecoder-mconnect`
