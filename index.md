# LeCoder

> Terminal in your pocket. Control AI coding agents from anywhere.

---

## Overview

**LeCoder** is an open-source platform for managing AI coding agents remotely. Our flagship product, **MConnect**, lets developers and teams monitor, control, and collaborate on AI agent sessions from any device.

### Why LeCoder?

AI coding agents (Claude Code, Gemini CLI, Cursor Agent, Aider, Codex) run long tasks—sometimes 30+ minutes. You shouldn't be stuck watching your terminal. LeCoder lets you:

- **Monitor** agents from your phone while in meetings
- **Intervene** when agents need approval or get stuck
- **Collaborate** with teammates on agent sessions in real-time
- **Secure** your development environment with enterprise-grade isolation

---

## Products

### MConnect (Current)

Mobile terminal control for AI agents.

```bash
npx lecoder-mconnect
```

**Current Features (v0.1.3):**
- Multi-agent parallel execution
- QR code + secure URL access
- Cloudflare Tunnel encryption
- Read-only mode by default
- Guardrails for dangerous commands
- Mobile-first touch UI

**Coming Soon:**
- Container isolation per agent
- Git worktrees for parallel work
- Real-time collaboration
- Local AI support (Ollama)
- Natural language to shell

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR MACHINE                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  MConnect CLI                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │ PTY Manager │  │ Agent       │  │ Container       │   │  │
│  │  │ (node-pty)  │  │ Manager     │  │ Manager (soon)  │   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘   │  │
│  │         └────────────────┴──────────────────┘             │  │
│  │                          │                                 │  │
│  │              ┌───────────┴───────────┐                    │  │
│  │              │   WebSocket Hub       │                    │  │
│  │              │   (multiplexed)       │                    │  │
│  │              └───────────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ Cloudflare Tunnel (encrypted)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  YOUR PHONE / BROWSER                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Mobile Web UI (xterm.js)                                  │  │
│  │  - Touch-optimized terminal                                │  │
│  │  - Agent tabs                                              │  │
│  │  - Keyboard shortcuts                                      │  │
│  │  - Real-time collaboration (coming soon)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure (Monorepo)

```
lecoder-ai/lecoder-mconnect/
├── apps/
│   ├── cli/                 # MConnect CLI (npm package)
│   │   ├── src/
│   │   │   ├── commands/    # CLI commands
│   │   │   ├── services/    # PTY, WebSocket, Tunnel
│   │   │   └── ui/          # Terminal UI (blessed)
│   │   └── package.json
│   │
│   ├── web/                 # Mobile web UI
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   └── lib/         # Utilities
│   │   └── package.json
│   │
│   └── website/             # Landing page
│       ├── src/app/
│       └── package.json
│
├── packages/
│   ├── core/                # Shared business logic
│   ├── ui/                  # Shared UI components
│   └── config/              # Shared configs (ESLint, TS)
│
├── brand-assets/            # Logo, wordmark, icons
│   ├── Logo/
│   ├── Wordmark/
│   └── Wordmark Simple/
│
├── docs/                    # Documentation
│   ├── getting-started.md
│   ├── configuration.md
│   └── enterprise.md
│
├── specs/                   # Technical specifications
│
├── index.md                 # This file
├── STYLE.md                 # Brand guidelines
├── ROADMAP.md               # Public roadmap
├── AGENTS.md                # AI agent integration
└── package.json             # Root workspace config
```

---

## Installation

### npm (Current)
```bash
npm install -g lecoder-mconnect
# or
npx lecoder-mconnect
```

### Coming Soon
```bash
# curl
curl -fsSL https://lecoder.ai/install | bash

# brew
brew install lecoder-ai/tap/mconnect

# bun
bun add -g lecoder-mconnect

# cargo (Rust rewrite)
cargo install lecoder-mconnect
```

---

## Target Audiences

### 1. Individual Developers (Current)
- Run AI agents on laptop
- Monitor from phone
- Personal productivity

### 2. Teams (v1.0)
- Share sessions with colleagues
- Real-time collaboration
- Manager visibility

### 3. Enterprises (v1.1+)
- Self-hosted deployment
- Container isolation
- SSO/SAML integration
- Audit logs
- Resource monitoring

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| CLI | TypeScript, Node.js |
| Terminal | node-pty, blessed |
| Web UI | React, xterm.js, Tailwind |
| Website | Next.js 15, Tailwind 4 |
| Tunnel | Cloudflare Tunnel |
| Real-time | Supabase Realtime (planned) |
| Containers | Docker, DevContainers (planned) |

---

## Links

- **Website**: https://lecoder.lesearch.ai
- **npm**: https://npmjs.com/package/lecoder-mconnect
- **GitHub**: https://github.com/lecoder-ai/lecoder-mconnect

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE)

---

<p align="center">
  <b>>_<</b> Built with care by <a href="https://github.com/aryateja2106">Arya Teja</a>
</p>
