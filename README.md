# LeCoder MConnect

<div align="center">

**📱 Terminal in your pocket**

Control your AI coding agents from anywhere with your phone.

[![npm version](https://img.shields.io/npm/v/lecoder-mconnect.svg)](https://www.npmjs.com/package/lecoder-mconnect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux-blue.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)

</div>

---

## What is MConnect?

MConnect lets you monitor and control long-running AI coding agents (Claude Code, Gemini CLI, Cursor Agent, etc.) from your phone. Run multiple AI agents simultaneously on your laptop and manage them remotely - perfect for when you step away but want to keep an eye on your agents.

<div align="center">

### 📸 Mobile Screenshots

| Claude Code | Cursor Agent | Gemini CLI |
|:---:|:---:|:---:|
| <img src="apps/web/public/mobile-view-ss/claude-code-view.PNG" width="250" alt="Claude Code"> | <img src="apps/web/public/mobile-view-ss/cursor-agent-view.PNG" width="250" alt="Cursor Agent"> | <img src="apps/web/public/mobile-view-ss/gemini-cli-view.PNG" width="250" alt="Gemini CLI"> |

*Control Claude Code, Cursor Agent, Gemini CLI and more from your phone*

</div>

## ✨ Features

### Core Features
- **🤖 Multi-Agent Support** - Run Claude Code, Gemini CLI, Cursor Agent, Codex, Aider in parallel
- **📱 Native iOS App** - SwiftUI app with Keychain security and push notifications (V2)
- **🔒 OAuth 2.0 + PKCE** - Secure authentication with GitHub, token rotation (V2)
- **🐳 Container Isolation** - Docker-based agent runtime with resource limits (V2)
- **📡 WebSocket Protocol v3** - Real-time bidirectional communication with input arbitration (V2)
- **🔍 Opik Observability** - LLM tracing, token counting, and performance metrics (V2)
- **🛡️ Guardrails** - 4-tier command filtering (none, permissive, default, strict)
- **📷 QR Code Connect** - Scan to connect instantly
- **🌐 Secure Remote Access** - Cloudflare Tunnel (no port forwarding needed)

### New in v0.1.7
- **🐳 Container Isolation** - Run agents in Docker containers for safety and reproducibility
- **📦 Dev Container Support** - Use standard `.devcontainer/devcontainer.json` configurations
- **🖥️ Direct Input Mode** - Tap terminal to type directly on mobile
- **🌍 IME Support** - International input (Chinese, Japanese, Korean, etc.)
- **📴 Offline Queue** - Commands queued when disconnected, sent on reconnect
- **🔐 Exclusive Control** - 5-minute mobile control window with PC notifications
- **📲 PWA Support** - Install as app on your phone

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** (required)
- **Python 3** (for node-pty compilation)
- **C++ compiler** (Xcode CLI tools on macOS, build-essential on Linux)
- **cloudflared** (for remote access)
- **Docker** (optional, for container isolation)
- **tmux** (optional, for server-side visualization)

### Installation

```bash
# Install cloudflared (required for remote access)
# macOS
brew install cloudflared

# Linux - see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Install MConnect globally
npm install -g lecoder-mconnect

# Or run directly with npx
npx lecoder-mconnect

# Verify all dependencies
mconnect doctor

# Start MConnect
mconnect
```

### First Run

1. Run `mconnect` in your terminal
2. Select your agent configuration (e.g., "Research + Spec + Tests" for 3 parallel agents)
3. Choose guardrails level (default recommended)
4. Confirm working directory
5. **Scan the QR code** with your phone
6. Control your agents from anywhere!

## 🎮 Usage

### CLI Commands

```bash
# Start a new session (interactive)
mconnect

# Start with specific preset
mconnect start --preset research-spec-test

# Run system diagnostics (checks Docker too)
mconnect doctor

# List available presets
mconnect presets
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir <path>` | Working directory | Current directory |
| `-p, --preset <name>` | Agent preset | Interactive selection |
| `-g, --guardrails <level>` | Security level | `default` |
| `--port <number>` | Server port | `8765` |
| `--no-tmux` | Disable tmux | Enabled |

### Agent Presets

| Preset | Agents | Best For |
|--------|--------|----------|
| **Shell Session** | 1 shell | Getting started |
| **Single Agent** | 1 AI agent | Simple tasks |
| **Research + Spec + Tests** | 3 agents | Parallel workflows |
| **Dev + Reviewer** | 2 agents | Code review |
| **Container Dev** | 1 containerized shell | Isolated development |
| **Custom** | You choose | Advanced setups |

## 🐳 Container Support

Run agents in isolated Docker containers for safety and reproducibility.

### Quick Start with Containers

```bash
# Check Docker is available
mconnect doctor

# Select "Container Dev" preset in the wizard
mconnect
```

### Dev Container Configuration

MConnect supports the standard [Dev Container spec](https://containers.dev/). Create a `.devcontainer/devcontainer.json`:

```json
{
  "name": "My Project",
  "image": "node:22-bookworm",
  "workspaceFolder": "/workspace",
  "postCreateCommand": "npm install",
  "remoteUser": "node"
}
```

### Built-in Dockerfile Templates

| Template | Base | Best For |
|----------|------|----------|
| **Default** | Ubuntu 22.04 | General development (Node.js + Python) |
| **Minimal** | Alpine 3.19 | Raspberry Pi, resource-constrained |
| **Node.js** | node:22-bookworm | Node.js projects |
| **Python** | python:3.12-bookworm | Python projects |

### Container Features

- **Auto-detection** - Detects project type and suggests appropriate template
- **ARM64 Support** - Pre-tested images for Raspberry Pi
- **Variable Interpolation** - Supports `${localWorkspaceFolder}`, `${localEnv:VAR}`, etc.
- **Lifecycle Hooks** - `postCreateCommand`, `onCreateCommand` support
- **Port Forwarding** - Expose container ports to host
- **Volume Mounts** - Mount host directories into container
- **Auto-cleanup** - Containers removed on session exit

## 📱 Mobile UI

### Direct Mode (New!)

Tap the terminal to activate your phone's keyboard and type directly. No more switching between input fields.

### Input Modes

| Mode | Description |
|------|-------------|
| **Direct Mode** | Tap terminal → keyboard appears → type directly |
| **Input Bar** | Use the input field at bottom for commands |
| **Read-Only** | View output without accidental input |

### Touch Controls

- **Scroll** - Swipe up/down in terminal
- **Enter** - Send command or newline
- **Ctrl+C** - Kill/interrupt current process
- **Tab** - Autocomplete
- **Arrow Keys** - Navigate history/cursor

### Exclusive Control

When you take control on mobile, PC input is paused for 5 minutes. The PC user sees a notification and countdown timer.

## 🛡️ Security

MConnect takes security seriously:

| Feature | Description |
|---------|-------------|
| **OAuth 2.0 + PKCE** | Industry-standard authentication (V2) |
| **JWT with Rotation** | 15-min access tokens, 30-day refresh with rotation (V2) |
| **Container Isolation** | Private PID/IPC namespaces, capability dropping (V2) |
| **iOS Keychain** | Biometric-protected credential storage (V2) |
| **Rate Limiting** | Per-client input rate limiting (100 chars/sec) |
| **Guardrails** | 4-tier configurable command blocking |
| **Tunnel Encryption** | All traffic encrypted via Cloudflare |
| **No Persistence** | Sessions are ephemeral |
| **Container Isolation** | Docker sandboxing with private namespaces |

### Guardrail Levels

| Level | Blocked Commands | Requires Approval |
|-------|-----------------|-------------------|
| **Default** | `rm -rf /`, fork bombs | Force push, npm publish |
| **Strict** | All destructive ops | Any rm, all git push |
| **Permissive** | Only catastrophic | Force push only |
| **None** | Nothing | Nothing |

## 🏗️ Architecture

### V2 Architecture (Current)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          iOS App (Swift)                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │   Vault    │  │   Hosts    │  │  Terminal  │  │   Agents   │    │
│  │ (Keychain) │  │ (Profiles) │  │  (SwiftUI) │  │ (Dashboard)│    │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │
│        └───────────────┴───────────────┴───────────────┘            │
│                                │                                     │
│                    ┌───────────┴───────────┐                        │
│                    │   WebSocket Client    │                        │
│                    │   (Protocol v3.0)     │                        │
│                    └───────────┬───────────┘                        │
└────────────────────────────────┼────────────────────────────────────┘
                                 │ wss:// (TLS 1.3)
┌────────────────────────────────┼────────────────────────────────────┐
│                         MConnect Server (Bun)                        │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │                      WebSocket Hub (v3)                        │  │
│  │  • Input arbitration (PC priority)  • MCP message routing      │  │
│  │  • Heartbeat & reconnection         • Guardrails               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│           │                    │                    │                │
│  ┌────────┴────────┐  ┌───────┴───────┐  ┌────────┴────────┐      │
│  │   Auth Service  │  │Session Manager│  │  Agent Manager  │      │
│  │  • OAuth 2.0    │  │  • PostgreSQL │  │  • Containers   │      │
│  │  • JWT + PKCE   │  │  • Scrollback │  │  • MCP Gateway  │      │
│  └─────────────────┘  └───────────────┘  └────────┬────────┘      │
│                                                    │                │
│  ┌─────────────────────────────────────────────────┴──────────┐    │
│  │                 Docker Container Runtime                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │    │
│  │  │  Claude  │  │  Gemini  │  │  Custom  │                 │    │
│  │  │  Code    │  │   CLI    │  │  Agents  │                 │    │
│  │  └──────────┘  └──────────┘  └──────────┘                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Observability (Opik)                     │    │
│  │  • Trace all operations  • Token counting  • User metrics  │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### V1 Architecture (CLI)

```
┌──────────────────────────────────┐     ┌──────────────────────────┐
│  MConnect CLI (Node.js)          │     │  Mobile Web UI (Phone)   │
│  ┌──────────┐  ┌──────────────┐  │     │  ┌──────────────────┐   │
│  │PTY Mgr   │  │  WebSocket   │──┼─────┼──│  xterm.js Term   │   │
│  │(node-pty)│  │  Hub         │  │     │  └──────────────────┘   │
│  └──────────┘  └──────────────┘  │     └──────────────────────────┘
└──────────────────────────────────┘
         via Cloudflare Tunnel
```

## 🤖 Supported AI Agents

| Agent | Status | Notes |
|-------|--------|-------|
| Claude Code | ✅ Tested | Full TUI support |
| Gemini CLI | ✅ Tested | Full TUI support |
| Cursor Agent | ✅ Tested | Full TUI support |
| OpenAI Codex | ✅ Supported | Shell mode |
| Aider | ✅ Supported | Shell mode |
| Custom | ✅ Supported | Any CLI tool |

## 📦 Project Structure

```
lecoder-mconnect/
├── packages/
│   ├── server/          # Bun server (V2) - OAuth, WebSocket v3, containers
│   ├── shared/          # Shared types, protocol definitions, guardrails
│   ├── cli/             # CLI tool (V1) - node-pty, Cloudflare tunnel
│   └── ios-app/         # Native iOS app (V2) - SwiftUI, Keychain
├── apps/
│   └── website/         # Next.js marketing site
├── docs/
│   ├── api/             # OpenAPI 3.1 specification
│   └── protocol/        # WebSocket protocol v3 spec
└── docker-compose.yml   # PostgreSQL for local development
```

See individual package READMEs for detailed documentation:
- [Server](packages/server/README.md) - API endpoints, environment variables, setup
- [iOS App](packages/ios-app/README.md) - Xcode setup, build instructions
- [API Spec](docs/api/openapi.yaml) - OpenAPI 3.1 specification
- [Protocol v3](docs/protocol/v3.md) - WebSocket message format

## 🔧 Development

```bash
# Clone
git clone https://github.com/aryateja2106/lecoder-mconnect.git
cd lecoder-mconnect

# Install dependencies
npm install

# --- V2 Server (Bun) ---
# Start PostgreSQL
docker compose up -d

# Start server with hot reload
cd packages/server && bun run dev

# Run server tests
cd packages/server && bun test

# --- V1 CLI (Node.js) ---
# Build CLI
npm run build --workspace=lecoder-mconnect

# Start CLI development
cd packages/cli && npm run dev

# --- All packages ---
# Run all tests
npm run test

# Build everything
npm run build
```

### Project Structure

```
lecoder-mconnect/
├── packages/
│   └── cli/              # Main CLI package
│       └── src/
│           ├── agents/   # Agent management
│           ├── container/# Docker/DevContainer support
│           ├── pty/      # PTY management
│           └── server/   # WebSocket server
├── apps/
│   ├── web/              # Mobile web UI
│   └── website/          # Landing page
└── docs/                 # Documentation
```

## 🐛 Troubleshooting

### `posix_spawnp failed` error

Fixed in v0.1.2 with shell-first architecture. Make sure you're using the latest version:
```bash
npm install -g lecoder-mconnect@latest
mconnect doctor
```

### node-pty installation fails

```bash
# macOS - ensure Xcode CLI tools
xcode-select --install

# Linux - ensure build tools
sudo apt install build-essential python3

# Then reinstall
npm install -g lecoder-mconnect
```

### Docker not detected

```bash
# Check Docker is installed and running
docker --version
docker ps

# Run diagnostics
mconnect doctor
```

### Check all dependencies

```bash
mconnect doctor
```

### Tunnel not connecting

Ensure cloudflared is installed and accessible:
```bash
cloudflared --version
```

## 🔒 Privacy

- **No accounts** - No signup required
- **No cloud storage** - All data stays on your machine
- **Ephemeral sessions** - URLs expire when CLI stops
- **No telemetry** - We don't track anything

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 👤 Author

**Arya Teja Rudraraju** ([@aryateja2106](https://github.com/aryateja2106))

Part of the [LeCoder](https://github.com/aryateja2106/lecoder) project.

---

<div align="center">

**⭐ Star this repo if you find it useful!**

[Report Bug](https://github.com/aryateja2106/lecoder-mconnect/issues) · [Request Feature](https://github.com/aryateja2106/lecoder-mconnect/issues)

</div>
