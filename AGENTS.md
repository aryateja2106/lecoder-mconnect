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

# [mconnect] recent context, 2026-05-07 11:50am PDT

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 32 obs (11,216t read) | 592,886t work | 98% savings

### May 3, 2026
4059 11:37a 🔵 mconnect project missing .claude/settings.json
S888 Fix apple-platform-build-tools plugin installation by correcting marketplace configuration (May 3 at 11:37 AM)
S886 Install apple-platform-build-tools-claude-code-plugin locally in mconnect project (May 3 at 11:37 AM)
4060 11:40a 🔴 Fixed apple-platform-build-tools plugin installation via custom marketplace
S890 Fix apple-platform-build-tools plugin configuration after discovering stale marketplace references (May 3 at 11:40 AM)
4061 11:43a 🔵 Plugin configuration state after restart shows disabled status
4062 11:44a 🔵 Plugin directory exists in project .claude folder
4113 1:45p 🔵 MConnect project migration from Claude Code to Codex initiated
4114 1:46p 🔵 migrate-to-codex script requires Python 3.11+ for tomllib module
4115 1:47p ✅ mconnect project migrated from Claude Code to Codex using Python 3.12
4116 " 🔵 Apple platform build tools plugin detected in mconnect project local settings
### May 4, 2026
4164 6:08p 🟣 Installed hatch-pet skill from OpenAI skills repository
4165 6:09p 🟣 Meeseeks custom pet creation initiated
4166 " 🔵 Codex bundled Python runtime resolved PIL dependency issue
4167 " 🟣 Meeseeks pet run initialized with base job ready
4170 " 🔵 Hatch-pet sprite generation uses specialized agent dispatch
4171 " 🔵 Sprite row prompts enforce standardized frame counts and artifact constraints
4172 " 🟣 Meeseeks digital pet idle animation row generated
4168 6:11p 🔵 Pet generation job queue uses dependency-based execution with base sprite as canonical reference
4169 " 🔵 Base pet prompt specifies pixel-art-adjacent style with magenta chroma-key output
4174 6:23p 🟣 Created Meeseeks pet character with idle and running animations
4176 6:25p 🔵 Agent pool timeout during hatch-pet run
4177 " 🟣 Spawned agent Faraday to generate running animation for meeseeks pet
4173 6:27p 🟣 Generated jumping animation row for meeseeks hatch-pet
4175 " 🟣 Failed state sprite row generation for Meeseeks hatch-pet
4186 6:37p 🟣 Meeseeks Pet Jumping Animation Sprite Sheet Generated
4184 6:41p 🟣 Review animation row generation requested for meeseeks hatch-pet
4185 6:49p 🟣 Generated running-left animation row for meeseeks hatch-pet
### May 7, 2026
4300 11:23a 🔵 MConnect codebase structure mapped
4301 11:24a ✅ Simulator switched and MConnect iOS app build initiated
4302 " 🔴 MConnect iOS build failed with missing types and duplicate parameter errors
4303 " 🔵 MConnect iOS app builds successfully for simulator
4312 11:31a 🔵 Screen feature built in worktrees but not integrated to main
S994 User invoked /worktree command to spawn parallel feature worktrees (May 7 at 11:37 AM)
4314 11:41a 🔵 Code fragmentation across git worktrees blocking screen feature testing
4313 11:43a 🔵 VNC integration documentation exists only in worktree

Access 593k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>