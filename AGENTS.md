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

## Cursor Cloud specific instructions

### Services overview

| Service | Location | Dev command | Port |
|---------|----------|-------------|------|
| CLI | `packages/cli` | `npm run dev:cli` (interactive) or build+run via `npm run build:cli && node packages/cli/dist/index.js` | 8765 (WebSocket) |
| Web Dashboard | `apps/web` | `npm run dev` (from root) | 3000 |
| Marketing Website | `apps/website` | `cd apps/website && npm run dev` | 3000 |
| Shared types | `packages/shared` | `cd packages/shared && npx tsc` (build) | N/A |
| V2 Server | `packages/server` | `bun run dev` (requires PostgreSQL + Bun) | 3001 |

### Gotchas

- **zsh required**: The PTY manager tests (`pty-manager.test.ts`) default to `/bin/zsh`. Install it with `sudo apt-get install -y zsh` or 19 tests will fail with "Shell not found: /bin/zsh".
- **Lint warnings are pre-existing**: `npm run lint` reports biome warnings/errors in `packages/cli` (opik.ts `any` types, unused vars) and `packages/server`. These are known and not blocking.
- **Website lint needs ESLint**: `apps/website` uses `next lint` which requires ESLint to be installed separately (`npm install --save-dev eslint` in that workspace). This is a known gap.
- **CLI `start` is interactive**: The `mconnect start` command uses `@clack/prompts` and always prompts for working directory confirmation, even with `--preset` and `--guardrails` flags. Use `doctor` or `presets` subcommands for non-interactive verification.
- **node-pty native module**: Already compiled during `npm install`. If you see spawn-helper permission warnings in tests, they're harmless. Run `npm rebuild node-pty` only if PTY spawn actually fails.
- **Bun for V2 packages**: `packages/shared` and `packages/server` use Bun. Bun is installed at `~/.bun/bin/bun` and added to PATH via `~/.bashrc`. Build shared types before server: `cd packages/shared && npx tsc`.
- **Port conflicts**: If port 3000 is already in use, Next.js auto-selects the next available port. Check terminal output for the actual port.
