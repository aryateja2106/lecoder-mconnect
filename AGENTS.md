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
