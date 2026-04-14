# lecoder-mconnect

[![npm version](https://img.shields.io/npm/v/lecoder-mconnect.svg)](https://www.npmjs.com/package/lecoder-mconnect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux-blue.svg)]()

**Mobile terminal control for AI coding agents - Terminal in your pocket**

Control your AI coding agents (Claude Code, Gemini CLI, Cursor Agent, etc.) from your phone. Run multiple AI agents simultaneously on your laptop and manage them remotely.

---

## Quick Start

```bash
# Run directly (no install needed)
npx lecoder-mconnect

# Or install globally
npm install -g lecoder-mconnect
mconnect
```

1. A QR code appears in your terminal
2. Scan it with your phone's camera
3. You land on the **session list** showing all active MConnect sessions
4. Tap a session or hit **Terminal** to open the live terminal view

---

## Requirements

| Requirement | Version | Required | Notes |
|-------------|---------|----------|-------|
| **Node.js** | 20.0.0+ | Yes | LTS recommended |
| **Python** | 3.x | Yes | For node-pty compilation |
| **C++ Compiler** | - | Yes | Xcode CLI tools (macOS) or build-essential (Linux) |
| **cloudflared** | Latest | No | For secure remote access (auto-detected) |
| **tmux** | 3.x+ | No | Optional server-side visualization |

### macOS

```bash
xcode-select --install
brew install cloudflared   # optional, for remote access
brew install tmux          # optional
```

### Linux (Ubuntu/Debian)

```bash
sudo apt install -y build-essential python3
# cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

---

## CLI Commands

### `mconnect start`

Start a new session. This is the default command (`mconnect` alone does the same thing).

```bash
mconnect start [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--port <number>` | HTTP/WebSocket server port | `8765` |
| `--timeout <minutes>` | Auto-expire session after N minutes (0 = never) | `0` |
| `--guardrails <level>` | Security level: `default`, `strict`, `permissive`, `none` | `default` |
| `--tunnel` | Force Cloudflare tunnel creation | auto-detect |
| `--json` | Output session info as JSON (for scripts/agents) | off |
| `-y` | Skip interactive prompts, use defaults | off |

```bash
# Start with strict guardrails on port 9000
mconnect start --port 9000 --guardrails strict

# Start non-interactively with JSON output (for automation)
mconnect start -y --json

# Auto-expire after 2 hours
mconnect start --timeout 120
```

### `mconnect ps`

List all registered MConnect sessions (active and dead).

```bash
mconnect ps
```

Shows session ID, working directory, URL, PID, and whether the process is still alive.

### `mconnect info`

Show connection details for the current session (reads `.mconnect-session.json` in the working directory).

```bash
mconnect info
```

### `mconnect stop`

Stop a running session by ID.

```bash
mconnect stop <sessionId>
```

### `mconnect doctor`

Run system diagnostics to verify all dependencies are installed.

```bash
mconnect doctor
```

---

## Web UI

When you open the MConnect URL on your phone, you get two views:

### Session List (Home)

The landing page after pairing. Shows:

- **Active Sessions** with green "online" dots — tap to open any session
- **Previous Sessions** with grey "last seen X ago" dots — for context only
- **Terminal** button at the bottom to jump straight to the current session's terminal

The session list auto-refreshes every 10 seconds.

### Terminal View

The full terminal interface with:

- Touch-optimized xterm.js terminal
- Direct mode for native keyboard input
- Shortcut bar (Ctrl+C, Tab, arrows, etc.)
- Read-only / read-write mode toggle
- Fullscreen toggle

### Pairing

If you open the URL without a token, you see a pairing code entry screen. Enter the 6-character code shown in your terminal to authenticate.

---

## Guardrails

| Level | Description | Blocked | Requires Approval |
|-------|-------------|---------|-------------------|
| `default` | Balanced security | `rm -rf /`, fork bombs | Force push, npm publish |
| `strict` | Maximum security | All destructive ops | Any rm, all git push |
| `permissive` | Minimal restrictions | Only catastrophic | Force push only |
| `none` | No restrictions | Nothing | Nothing |

---

## Security

| Feature | Description |
|---------|-------------|
| **Token Authentication** | Cryptographically secure session tokens |
| **Pairing Codes** | 6-character codes, valid for 5 minutes |
| **Rate Limiting** | Protection against connection flooding |
| **Input Sanitization** | Blocks command injection attacks |
| **Guardrails System** | Configurable command blocking and approval |
| **Tunnel Encryption** | All traffic encrypted via Cloudflare Tunnel |
| **Ephemeral Sessions** | No persistent data, sessions end when CLI stops |

- No accounts required, no cloud storage, no telemetry
- Tunnel URLs are ephemeral and expire when the CLI stops

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  YOUR LAPTOP                                  │
│  ┌──────────────────────────────────────────┐│
│  │  MConnect CLI                              ││
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐  ││
│  │  │PTY Manager│  │Agent Mgr │  │ Tmux   │  ││
│  │  │(node-pty) │  │          │  │(visual)│  ││
│  │  └─────┬─────┘  └────┬─────┘  └───┬────┘  ││
│  │        └──────────────┴────────────┘       ││
│  │                    │                        ││
│  │        ┌───────────┴───────────┐            ││
│  │        │   WebSocket Hub       │            ││
│  │        │   (multiplexed)       │            ││
│  │        └───────────────────────┘            ││
│  └──────────────────────────────────────────┘│
└───────────────────┬──────────────────────────┘
                    │ Cloudflare Tunnel (encrypted)
                    ▼
┌──────────────────────────────────────────────┐
│  YOUR PHONE                                    │
│  ┌──────────────────────────────────────────┐│
│  │  Session List → Terminal View              ││
│  │  - Active/previous sessions                ││
│  │  - Touch-optimized xterm.js                ││
│  │  - Agent tabs + guardrails                 ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

---

## Supported AI Agents

| Agent | Status | Notes |
|-------|--------|-------|
| Claude Code | Tested | Full TUI support |
| Gemini CLI | Tested | Full TUI support |
| Cursor Agent | Tested | Full TUI support |
| OpenAI Codex | Supported | Shell mode |
| Aider | Supported | Shell mode |
| Custom CLI | Supported | Any terminal application |

---

## Troubleshooting

### node-pty issues

```bash
# Rebuild native module
npm rebuild node-pty

# Or reinstall
npm uninstall -g lecoder-mconnect && npm install -g lecoder-mconnect
```

### Tunnel not connecting

```bash
cloudflared --version   # verify installed
```

MConnect works without cloudflared (local-only mode). Install it for remote access.

### Run diagnostics

```bash
mconnect doctor
```

---

## Development

```bash
git clone https://github.com/aryateja2106/lecoder-mconnect.git
cd lecoder-mconnect/packages/cli
npm install
npm run dev          # watch mode
npm run build        # production build
npm run test         # run tests
npm run typecheck    # tsc --noEmit
npm run lint         # biome lint
```

---

## License

MIT - see [LICENSE](https://github.com/aryateja2106/lecoder-mconnect/blob/main/LICENSE)

## Author

**Arya Teja Rudraraju** ([@aryateja2106](https://github.com/aryateja2106))

- [GitHub](https://github.com/aryateja2106/lecoder-mconnect)
- [npm](https://www.npmjs.com/package/lecoder-mconnect)
