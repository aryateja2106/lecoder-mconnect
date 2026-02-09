# Copilot Instructions for LeCoder MConnect

## Project Overview

**LeCoder MConnect** is a mobile-first terminal control system for AI coding agents. Developers monitor and control CLI-based AI agents (Claude Code, Gemini CLI, Cursor Agent, Aider, Codex) remotely from their phone via a secure WebSocket connection through Cloudflare Tunnel.

- **Published package**: `lecoder-mconnect` on npm (v0.1.7, public)
- **CLI binaries**: `mconnect`, `lecoder-mconnect`
- **Repository**: https://github.com/aryateja2106/lecoder-mconnect

## Monorepo Structure

Root orchestration uses **npm workspaces** (`packages/*`, `apps/*`). There is no `turbo.json` — Turborepo is not currently configured.

| Package | npm Name | Version | Runtime | Purpose |
|---------|----------|---------|---------|---------|
| `packages/cli/` | `lecoder-mconnect` | 0.1.7 | **Node.js 20+** | Main CLI — terminal control, published to npm |
| `packages/server/` | `@lecoder/server` | 0.1.0 | **Bun 1.1+** | V2 backend — AI agent orchestration, PostgreSQL |
| `packages/shared/` | `@lecoder/shared` | 0.1.0 | **Bun 1.1+** | Shared types, protocols, guardrails (Zod schemas) |
| `packages/ios-app/` | N/A | N/A | Xcode/Swift | Native iOS client (SwiftUI, MVVM, iOS 17+) |
| `apps/web/` | `@lecoder/web` | 0.1.0 | Node.js | Mobile PWA terminal (Next.js 16.1.2, xterm.js) |
| `apps/website/` | `@lecoder/website` | 1.0.0 | Node.js | Marketing landing page (Next.js 15.1.x, Framer Motion) |

### Runtime Split

- **npm** — Root-level orchestration, CI installs (`npm ci`), CLI package scripts
- **Bun** — Runtime only for `packages/server` and `packages/shared` (scripts use `bun run`, `bun test`, `bun build`)

## Development Commands

```bash
# Root (npm workspaces)
npm install                  # Install all dependencies
npm run dev:cli              # CLI dev mode (tsx watch)
npm run dev                  # Web app dev server
npm run build                # Build all packages
npm run build:cli            # Build CLI only (tsup → dist/)
npm run test                 # Run all tests
npm run test:cli             # CLI tests only (Vitest)
npm run lint                 # Lint all packages
npm run typecheck            # Typecheck CLI
npm run clean                # Remove build artifacts

# Server (Bun — run from packages/server/)
bun run dev                  # Watch mode
bun test                     # Unit tests
bun run test:integration     # Integration tests (needs PostgreSQL)
bun run db:migrate           # Run migrations

# Shared (Bun — run from packages/shared/)
bun run build                # tsc
bun test                     # Tests
```

## CLI Architecture

```
CLI Entry (Commander.js) → Session Manager → PTY Manager + Agent Manager
                                                  ↓
                                            WebSocket Hub (multiplexed, protocol v2.0)
                                                  ↓
                                            Cloudflare Tunnel → Mobile UI (PWA)
```

### Key Modules (`packages/cli/src/`)

| Module | Purpose |
|--------|---------|
| `index.ts` | CLI entry point (Commander.js) |
| `session.ts` | Core session orchestration |
| `agents/` | Agent lifecycle, spawns shells per agent |
| `pty/` | node-pty wrapper, PTY I/O |
| `ws/` | WebSocket hub, protocol v2.0, client registry |
| `input/` | Multi-client input arbitration, idle detection, priority queue |
| `session/` | SessionManager, ScrollbackBuffer, SessionStore (SQLite) |
| `daemon/` | Background daemon, process management, signals |
| `container/` | Container manager, devcontainer, Dockerfile support |
| `tmux/` | tmux integration |
| `hooks/` | Hook receiver, normalizer |
| `observability/` | Opik tracing integration |
| `guardrails.ts` | Command safety filtering |
| `tunnel.ts` | Cloudflare Tunnel setup |
| `security.ts` | Token generation, auth |
| `web/` | Serves embedded web client |

### Build Tooling

- **tsup** — Bundles CLI to single ESM file with `.dts` (`tsup src/index.ts --format esm --dts --clean`)
- **tsx** — Dev mode with watch (`tsx watch src/index.ts`)
- **ESM only** — `"type": "module"` throughout

## Code Conventions

### Naming
- **Files**: kebab-case (`pty-manager.ts`, `web-client.ts`)
- **Classes**: PascalCase (`AgentManager`, `InputArbiter`)
- **Functions**: camelCase (`startSession`, `createTunnel`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`, `AGENT_TYPES`)
- **Components**: PascalCase (`FeatureCard`, `AgentBadge`)

### Formatting (Biome — canonical config at `packages/cli/biome.json`)
- Indent: 2 spaces
- Line width: 100
- Single quotes, semicolons always, trailing commas ES5
- Organize imports enabled

### TypeScript
- **Strict mode** in all packages
- ES2022 target, ESNext module, bundler moduleResolution
- Server/shared have extra strict flags (`noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`)
- Avoid `any` (Biome warns on `noExplicitAny`)

### Linting Rules (Biome)
- `noUnusedVariables`: error
- `noUnusedImports`: error
- `noExplicitAny`: warn
- `useConst`: error

## Testing

| Package | Runner | Config | Pattern |
|---------|--------|--------|---------|
| CLI | **Vitest** | `packages/cli/vitest.config.ts` | `src/__tests__/**/*.test.ts` |
| Server | **Bun test** | Package scripts | `*.test.ts`, `*.integration.test.ts` |
| Shared | **Bun test** | Package scripts | `*.test.ts` |
| iOS | **XCTest** | Xcode project | `MConnectTests/*.swift` |

### CLI Test Config
- Pool: `forks` with `singleFork: true` (native module cleanup)
- Timeout: 15 seconds
- `SKIP_NATIVE_TESTS=true` skips node-pty/SQLite tests (used in CI on Linux)
- Coverage thresholds: **35% statements, 55% branches, 50% functions, 35% lines**

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCONNECT_PORT` | WebSocket port | `8765` |
| `MCONNECT_TOKEN` | Auth token | Auto-generated |
| `MCONNECT_HOME` | Config directory | — |
| `OPIK_API_KEY` | Opik observability API key | — |
| `OPIK_PROJECT_NAME` | Opik project name | `mconnect` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection (server) | — |
| `JWT_SECRET` | JWT signing key (server) | — |
| `DEV_AUTH_BYPASS` | Skip auth in dev (server) | — |

## Brand Guidelines

- **Design**: True monochrome (black/white/grays only) — no colors for emphasis
- **Font**: JetBrains Mono
- **Emphasis**: Bold text, borders, boxes — never color
- **Logo**: Pixelated "L" (see `brand-assets/`)
- Full guidelines: `STYLE.md`

## Planned Migration

The following are **planned but not yet implemented**:
- **Turborepo** — For build orchestration across the monorepo
- **Bun everywhere** — Currently only server/shared use Bun; CLI uses Node.js
- **Rust components** — Performance-critical runtime modules (referenced in `LECODER-AGENT-HUB-PLAN.md`)

Do not reference these as existing in the codebase.

## Subagents

| Agent | File | Purpose |
|-------|------|---------|
| Plan | `.github/agents/plan.md` | Research and multi-step implementation plans |
| CLI Dev | `.github/agents/cli-dev.md` | CLI commands, PTY, terminal, WebSocket |
| Web Dev | `.github/agents/web-dev.md` | React, Next.js, mobile PWA, landing page |
| Test | `.github/agents/test.md` | Tests, debugging, coverage, CI |
