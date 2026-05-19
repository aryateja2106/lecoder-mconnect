# AGENTS.md

> Context file for AI coding agents working on this project.

## Vision

Make AI coding agents accessible, secure, and manageable for everyone - from solo developers to enterprise teams.

## Mission

Build the productivity layer for AI agents. As AI coding assistants multiply (Claude Code, Gemini CLI, Cursor, Aider, Codex, and more), teams need tools to orchestrate, monitor, and secure them. LeCoder MConnect is that tool.

## Target Customers

1. **Solo Developers** - Run AI agents on desktop, monitor from phone while AFK
2. **Development Teams** - Collaborative AI agent sessions with oversight
3. **Enterprises** - Security, compliance, audit trails for AI-assisted development

## Key Value Proposition

- **Control from anywhere**: Mobile-first interface for AI coding agents
- **Security by default**: Read-only mode, guardrails, encrypted tunnels
- **Agent-agnostic**: Works with any CLI-based AI tool
- **Zero config**: One command to start, QR code to connect

---

## Project Structure

```
lecoder-mconnect/
├── packages/
│   └── cli/                    # Main CLI package (published to npm)
│       ├── src/
│       │   ├── cli/commands/   # CLI commands (start, attach, daemon)
│       │   ├── pty/            # PTY management for terminal sessions
│       │   ├── web/            # Web client serving
│       │   ├── input/          # Input arbitration & idle detection
│       │   ├── tunnel.ts       # Cloudflare tunnel integration
│       │   ├── session.ts      # Session management
│       │   └── guardrails.ts   # Command safety filters
│       └── dist/               # Compiled output
├── apps/
│   └── website/                # Next.js marketing site
│       └── src/app/            # App router pages
├── brand-assets/               # Logo SVGs (dark/light modes)
├── ROADMAP.md                  # Feature roadmap
├── STYLE.md                    # Brand guidelines
└── index.md                    # Project overview
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| CLI | TypeScript, Commander.js |
| Terminal | node-pty, xterm.js |
| Networking | WebSocket, Cloudflare Tunnel |
| Website | Next.js 15, Tailwind CSS, Lucide icons |
| Package Manager | npm workspaces |
| Testing | Vitest |

## Naming Conventions

- **Package names**: `@lecoder/*` for scoped packages, `lecoder-mconnect` for main CLI
- **Files**: kebab-case (`pty-manager.ts`, `web-client.ts`)
- **Components**: PascalCase (`FeatureCard`, `AgentBadge`)
- **Functions**: camelCase (`startSession`, `createTunnel`)
- **Constants**: UPPER_SNAKE_CASE (`AGENT_TYPES`, `DEFAULT_PORT`)

## Key Files

| File | Purpose |
|------|---------|
| `packages/cli/src/index.ts` | CLI entry point |
| `packages/cli/src/session.ts` | Core session logic |
| `packages/cli/src/tunnel.ts` | Cloudflare tunnel setup |
| `packages/cli/src/guardrails.ts` | Command filtering |
| `apps/website/src/app/page.tsx` | Landing page |

## Development Commands

```bash
# Install dependencies
npm install

# Run CLI in dev mode
npm run dev:cli

# Run website
cd apps/website && npm run dev

# Build everything
npm run build

# Run tests
npm run test
```

## Brand Guidelines

- **Primary font**: JetBrains Mono
- **Design**: True monochrome (black/white/grays only)
- **Emphasis**: Use bold text, borders, boxes - not colors
- **Mascot**: Dolphin (intelligent, playful, communicative)
- **Logo**: Pixelated "L" inspired by OpenCode's style

See `STYLE.md` for full brand guidelines.

## Current State

- **v0.1.3** - Stable CLI with multi-agent support
- **Working**: QR connect, Cloudflare tunnels, guardrails, mobile UI
- **In Progress**: Enterprise features, container isolation, collaboration

## Links

- **Repo**: https://github.com/aryateja2106/lecoder-mconnect
- **npm**: https://www.npmjs.com/package/lecoder-mconnect
- **Issues**: https://github.com/aryateja2106/lecoder-mconnect/issues


<claude-mem-context>
# Memory Context

# [mconnect/sequential-jingling-noodle] recent context, 2026-05-02 8:42pm PDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,926t read) | 3,301,064t work | 99% savings

### May 2, 2026
3946 7:35p 🔵 mconnect v2 planning initiated — researching 6 reference projects
3947 " 🔵 Paseo architecture analyzed — client-daemon model with voice control and cross-device access
3948 " 🔵 Multica agent lifecycle management — task assignment, autonomous execution, skill compounding
3949 " 🔵 Orchestrator git worktree isolation — 10 concurrent agents without file conflicts
3950 " ⚖️ ralplan mode activated for mconnect v2 feature extraction
3951 " 🔵 mconnect current state: multi-agent mobile terminal control with Opik tracing
3953 7:41p ⚖️ Multi-agent consensus planning workflow established with 6-phase task pipeline
3954 7:45p ⚖️ MConnect v0.2.0 architecture plan locked: Tauri desktop additive approach
3955 7:46p ⚖️ MConnect v0.2.0 architectural consensus plan under review
3956 " 🔵 Protocol version mismatch between plan assumptions and current codebase
S865 MConnect v0.2.0 consensus planning - Codex Architect review complete, Codex Critic review in progress (May 2 at 7:47 PM)
S866 Protocol version mismatch confirmed via source code verification while awaiting Codex Critic deliberate-mode verdict (May 2 at 7:50 PM)
3957 7:50p ⚖️ mconnect v0.2.0 release plan: desktop-anchored session architecture
S868 MConnect v0.2.0 consensus planning iteration 2: Architect v1 and Critic v1 reviews of revised plan (May 2 at 7:52 PM)
3958 7:53p 🔵 Protocol version mismatch discovered during mconnect v0.2.0 plan review
3959 " 🔵 Codex Critic REJECT verdict: plan not executable due to stale protocol assumptions and overloaded scope
3961 " ⚖️ MConnect v0.2.0 plan revised to v1 after Codex Critic REJECT verdict
S869 MConnect v0.2.0 consensus planning iteration 2 continuation: awaiting Critic v1 review while Architect v1 REVISE verdict pending (May 2 at 7:53 PM)
S867 MConnect v0.2.0 Consensus Plan Revision — Planner v1 response to Codex Critic REJECT verdict (May 2 at 7:59 PM)
3960 8:00p ⚖️ Architect v1 consensus review requested for mconnect v0.2.0 plan
3962 8:01p 🔵 MConnect v0.2.0 plan v1 architectural review validation findings
3963 8:02p 🔵 iOS app protocol v3.0 silent drop behavior and missing Phase 0-3 deliverables confirmed
S870 Observer session monitoring MConnect v0.2.0 plan v2 refinements post-Critic round 2 (May 2 at 8:02 PM)
3964 8:03p 🔵 MConnect Protocol Version Split-Brain Confirmed
3965 " 🔵 MConnect Database Schema Missing Fork/FTS Columns
3966 " 🔵 MConnect OAuth Provider Registry Single-Provider State
3967 " 🔵 MConnect Package Version Topology Verified
3968 " 🔵 MConnect CI Infrastructure Missing Cross-Platform Build Matrix
S871 Observer session monitoring MConnect v0.2.0 plan refinement (RALPLAN-DR deliberate consensus mode) — plan v2 surgical fixes after Architect + Critic round 2 REVISE verdicts (May 2 at 8:07 PM)
S872 MConnect v0.2.0 plan v2 review via RALPLAN-DR consensus process (Architect + Critic dual review after v1 surgical fixes applied) (May 2 at 8:09 PM)
S873 MConnect v0.2.0 major improvement initiative using reference projects (Switchboard, jcode, smfs, Paseo, Multica, Orchestrator) - dispatched Codex Architect to review plan v3 after v2 rejection (May 2 at 8:10 PM)
3969 8:12p ⚖️ MConnect v0.2.0 Plan v2 Architectural Revision
3970 8:15p 🔵 Protocol version split confirmed across mconnect codebase
3971 " 🔵 CLI flag verification confirms plan v2 accuracy
3972 " 🔵 OAuth provider registration limited to GitHub only
3973 " 🔵 Migration infrastructure gap and Phase 0A deliverables confirmed as new work
3974 " 🔵 Desktop and worktree packages confirmed as greenfield work
3975 " 🔵 Coverage threshold differentiation between existing CLI and new packages verified
3976 8:21p ⚖️ MConnect v0.2.0 plan adds mechanically executable iOS-desktop continuity test harness
3983 8:23p 🔵 Plan v3 structure and architectural exception verification
3984 " ✅ Plan v3 final corrections before Architect review
3985 " 🔵 Architect v3 REVISE verdict - shared JWT validator non-existent, AC19 not mechanically executable, Phase 0 under-budgeted
3990 " 🔵 RALPLAN v3 Architect Review Identified Shared JWT Validator Gap
3991 " 🔵 AC19 Mobile-First Wedge Test Harness Not Mechanically Executable
3992 " 🔵 Migration Runner Design Incompatible with SessionStore Runtime Paths
3993 " ⚖️ RALPLAN v3 Rejected After Iteration 4 - Two Critical Blockers Remain
3977 8:24p 🔵 Protocol version split: CLI v2.0, Server/iOS v3.0
3978 " 🔵 JWT validation machinery exists in server auth module
3979 " 🔵 CLI migration runner does not exist; SessionStore applies 001 directly
3980 " 🔵 Vitest config excludes all src/ws/** from coverage
3981 " 🔵 CI workflows: only ci.yml exists, no soak or ios-continuity
3982 " 🔵 iOS app implements v3.0 protocol with capability for unknown message types
3986 8:28p 🔵 MConnect v0.2.0 plan review: JWT validation architecture gap identified
3987 8:30p 🔵 Shared package lacks JWT validation functionality
3988 " 🔵 CI lacks Windows runners for desktop testing
3989 " 🔵 Daemon IPC session operations stubbed as TODOs
S874 Plan v3 Architect and Critic reviews - iteration 4 consensus check after addressing v2 CRITICAL blockers with architectural exceptions and 14-week schedule (May 2 at 8:30 PM)
3994 8:34p ⚖️ Plan v4 Pivots Auth Architecture to local_pairing_auth Message
3996 " 🔵 Architect v4 review blocked mconnect v2 plan on auth security and iOS test harness
3995 8:37p 🔵 mconnect v0.2.0 plan v4 code-grounded review initiated

Access 3301k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>