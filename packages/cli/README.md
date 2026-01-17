# lecoder-mconnect

[![npm version](https://img.shields.io/npm/v/lecoder-mconnect.svg)](https://www.npmjs.com/package/lecoder-mconnect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux-blue.svg)]()

**Mobile terminal control for AI coding agents - Terminal in your pocket**

Control your AI coding agents (Claude Code, Gemini CLI, Cursor Agent, etc.) from your phone. Run multiple AI agents simultaneously on your laptop and manage them remotely.

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Commands](#cli-commands)
- [Configuration Options](#configuration-options)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Requirements

### System Requirements

| Requirement | Version | Required | Notes |
|-------------|---------|----------|-------|
| **Node.js** | 20.0.0+ | Yes | LTS recommended |
| **Python** | 3.x | Yes | For node-pty compilation |
| **C++ Compiler** | - | Yes | See platform-specific below |
| **cloudflared** | Latest | Yes | For secure remote access |
| **tmux** | 3.x+ | No | Optional, for server visualization |

### Platform-Specific Requirements

#### macOS

```bash
# 1. Install Xcode Command Line Tools (C++ compiler)
xcode-select --install

# 2. Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. Install cloudflared
brew install cloudflared

# 4. Install tmux (optional)
brew install tmux
```

#### Linux (Ubuntu/Debian)

```bash
# 1. Install build tools and Python
sudo apt update
sudo apt install -y build-essential python3 python3-pip

# 2. Install cloudflared
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# 3. Install tmux (optional)
sudo apt install -y tmux
```

#### Linux (RHEL/CentOS/Fedora)

```bash
# 1. Install build tools
sudo dnf groupinstall "Development Tools"
sudo dnf install python3

# 2. Install cloudflared
# Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# 3. Install tmux (optional)
sudo dnf install tmux
```

---

## Installation

### Step 1: Verify Prerequisites

Before installing, ensure all requirements are met:

```bash
# Check Node.js version (must be 20+)
node --version

# Check Python 3
python3 --version

# Check C++ compiler (macOS)
xcode-select -p

# Check C++ compiler (Linux)
g++ --version

# Check cloudflared
cloudflared --version
```

### Step 2: Install MConnect

```bash
# Install globally (recommended)
npm install -g lecoder-mconnect

# Or run directly with npx (no install needed)
npx lecoder-mconnect
```

### Step 3: Verify Installation

```bash
# Run diagnostics to verify all dependencies
mconnect doctor
```

Expected output:
```
MConnect v0.2.0 - System Diagnostics

  ✓ Node.js: Node.js v20.x.x installed
  ✓ Shell: Default shell: /bin/zsh
  ✓ Python: Python 3.x.x
  ✓ C++ Compiler: Xcode Command Line Tools installed
  ✓ node-pty: Native PTY module loaded
  ✓ tmux: tmux 3.x
  ✓ cloudflared: cloudflared version 2024.x.x

  All checks passed! MConnect is ready to use.
```

---

## Quick Start

### 1. Start MConnect

```bash
mconnect
```

### 2. Select Configuration

The interactive wizard will guide you through:

1. **Agent Configuration** - Choose a preset or custom setup
2. **Guardrails Level** - Security settings for command execution
3. **Working Directory** - Where agents will operate

### 3. Connect from Your Phone

1. A QR code will appear in your terminal
2. Scan it with your phone's camera
3. The web interface opens - you're connected!

### 4. Control Your Agents

- Switch between agent tabs
- View terminal output in real-time
- Send commands (with guardrails protection)
- Monitor long-running tasks remotely

---

## CLI Commands

### `mconnect` or `mconnect start`

Start a new MConnect session (interactive wizard).

```bash
mconnect
```

### `mconnect start` with options

Start with specific configuration:

```bash
# Use a preset
mconnect start --preset research-spec-test

# Specify working directory
mconnect start --dir /path/to/project

# Set guardrails level
mconnect start --guardrails strict

# Custom port
mconnect start --port 9000

# Disable tmux visualization
mconnect start --no-tmux

# Show pairing code (for dev/desktop use)
mconnect start --code
```

By default, `mconnect` shows only a QR code optimized for mobile scanning. Use the `--code` flag to also display a 6-character pairing code for desktop/dev scenarios where you can't scan QR codes.

### `mconnect doctor`

Run system diagnostics to verify all dependencies:

```bash
mconnect doctor
```

### `mconnect presets`

List available agent presets:

```bash
mconnect presets
```

Available presets:
- `shell-only` - Single interactive shell (recommended to start)
- `single` - Single AI agent (Claude Code)
- `research-spec-test` - 3 shells for parallel workflows
- `dev-review` - 2 shells for development workflow
- `custom` - Configure multiple shells manually

---

## Daemon Commands (v0.2.0+)

MConnect v0.2.0 introduces a daemon architecture for persistent sessions that survive disconnects.

### `mconnect daemon start`

Start the MConnect daemon as a background service:

```bash
mconnect daemon start
```

Options:
- `--foreground` - Run in foreground (for systemd/launchd)
- `--port <port>` - WebSocket server port (default: 8765)

### `mconnect daemon stop`

Stop the running daemon:

```bash
mconnect daemon stop
```

### `mconnect daemon status`

Check daemon status:

```bash
mconnect daemon status
```

### `mconnect daemon logs`

View daemon logs:

```bash
# View recent logs
mconnect daemon logs

# Follow logs in real-time
mconnect daemon logs --follow

# Show last N lines
mconnect daemon logs --lines 100
```

### `mconnect daemon install`

Install daemon as a system service:

```bash
# Install as system service (starts on boot)
mconnect daemon install
```

### `mconnect daemon uninstall`

Remove the system service:

```bash
mconnect daemon uninstall
```

---

## Session Commands (v0.2.0+)

Manage persistent sessions with these commands:

### `mconnect session list`

List all sessions:

```bash
mconnect session list
```

### `mconnect session create`

Create a new session:

```bash
mconnect session create --preset single --dir /path/to/project
```

### `mconnect session attach <sessionId>`

Attach to an existing session:

```bash
# Attach to session by ID
mconnect session attach abc12345

# Detach with Ctrl+D
```

### `mconnect session kill <sessionId>`

Terminate a session:

```bash
mconnect session kill abc12345
```

### `mconnect session export <sessionId>`

Export session scrollback to file:

```bash
mconnect session export abc12345 --output session.log
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCONNECT_HOME` | Data directory for sessions and logs | `~/.mconnect` |
| `MCONNECT_PORT` | WebSocket server port | `8765` |
| `MCONNECT_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |
| `MCONNECT_MAX_SESSIONS` | Maximum concurrent sessions | `5` |
| `MCONNECT_NO_TUNNEL` | Disable Cloudflare tunnel | `false` |

---

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir <path>` | Working directory for agents | Current directory |
| `-p, --preset <name>` | Agent preset name | Interactive selection |
| `-g, --guardrails <level>` | Security level | `default` |
| `--port <number>` | WebSocket server port | `8765` |
| `--no-tmux` | Disable tmux server visualization | Enabled |
| `-c, --code` | Show pairing code (for dev/desktop) | QR only |

### Guardrails Levels

| Level | Description | Blocked | Requires Approval |
|-------|-------------|---------|-------------------|
| `default` | Balanced security | `rm -rf /`, fork bombs | Force push, npm publish |
| `strict` | Maximum security | All destructive ops | Any rm, all git push |
| `permissive` | Minimal restrictions | Only catastrophic | Force push only |
| `none` | No restrictions | Nothing | Nothing |

---

## Security

MConnect is designed with security as a priority:

### Built-in Protections

| Feature | Description |
|---------|-------------|
| **Token Authentication** | Cryptographically secure session tokens |
| **Rate Limiting** | Protection against connection flooding |
| **Input Sanitization** | Blocks command injection attacks |
| **Guardrails System** | Configurable command blocking and approval |
| **Tunnel Encryption** | All traffic encrypted via Cloudflare Tunnel |
| **Ephemeral Sessions** | No persistent data, sessions end when CLI stops |

### Security Best Practices

1. **Use Default Guardrails** - Start with `default` level until comfortable
2. **Review Commands** - Check what's being executed before approval
3. **Secure Network** - Use trusted networks when possible
4. **Keep Updated** - Run `npm update -g lecoder-mconnect` regularly
5. **Monitor Sessions** - Don't leave sessions unattended for extended periods

### No Data Collection

- **No accounts required** - No signup, no login
- **No cloud storage** - All data stays on your machine
- **No telemetry** - We don't track anything
- **Ephemeral URLs** - Tunnel URLs expire when CLI stops

---

## Troubleshooting

### "node-pty is not available" Error

This usually means the native module needs to be rebuilt:

```bash
# Rebuild node-pty
npm rebuild node-pty

# If that doesn't work, reinstall
npm uninstall -g lecoder-mconnect
npm install -g lecoder-mconnect
```

### "posix_spawnp failed" Error

Fixed in v0.1.2. Update to the latest version:

```bash
npm update -g lecoder-mconnect
mconnect doctor
```

### node-pty Installation Fails

Ensure you have the required build tools:

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt install build-essential python3
```

### Tunnel Not Connecting

Verify cloudflared is installed and accessible:

```bash
cloudflared --version
```

If not found, install it following the [Requirements](#requirements) section.

### Permission Denied Errors

If you see permission errors during global install:

```bash
# Option 1: Use sudo (not recommended)
sudo npm install -g lecoder-mconnect

# Option 2: Fix npm permissions (recommended)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g lecoder-mconnect
```

### Run Full Diagnostics

For any issues, start with:

```bash
mconnect doctor
```

This will identify missing dependencies and provide fix instructions.

---

## Supported AI Agents

| Agent | Status | Notes |
|-------|--------|-------|
| Claude Code | ✅ Tested | Full TUI support |
| Gemini CLI | ✅ Tested | Full TUI support |
| Cursor Agent | ✅ Tested | Full TUI support |
| OpenAI Codex | ✅ Supported | Shell mode |
| Aider | ✅ Supported | Shell mode |
| Custom CLI | ✅ Supported | Any terminal application |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR LAPTOP                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  MConnect CLI                                            ││
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   ││
│  │  │PTY Manager│  │Agent      │  │Tmux Manager       │   ││
│  │  │(node-pty) │  │Manager    │  │(visualization)    │   ││
│  │  └─────┬─────┘  └─────┬─────┘  └─────────┬─────────┘   ││
│  │        └──────────────┴──────────────────┘              ││
│  │                       │                                  ││
│  │           ┌───────────┴───────────┐                     ││
│  │           │   WebSocket Hub       │                     ││
│  │           │   (multiplexed)       │                     ││
│  │           └───────────────────────┘                     ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────────┘
                           │ Cloudflare Tunnel (encrypted)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  YOUR PHONE                                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Mobile Web UI (xterm.js)                                ││
│  │  - Touch-optimized terminal                              ││
│  │  - Agent tabs                                            ││
│  │  - Command input with guardrails                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Development

```bash
# Clone the repository
git clone https://github.com/aryateja2106/lecoder-mconnect.git
cd lecoder-mconnect

# Install dependencies
npm install

# Run tests
npm run test --workspace=lecoder-mconnect

# Build
npm run build --workspace=lecoder-mconnect

# Development mode (watch)
cd packages/cli && npm run dev
```

---

## Contributing

Contributions are welcome! Please see our [GitHub repository](https://github.com/aryateja2106/lecoder-mconnect) for:

- Issue reporting
- Feature requests
- Pull requests

---

## License

MIT License - see [LICENSE](https://github.com/aryateja2106/lecoder-mconnect/blob/main/LICENSE) for details.

---

## Author

**Arya Teja Rudraraju** ([@aryateja2106](https://github.com/aryateja2106))

---

## Links

- [GitHub Repository](https://github.com/aryateja2106/lecoder-mconnect)
- [npm Package](https://www.npmjs.com/package/lecoder-mconnect)
- [Issue Tracker](https://github.com/aryateja2106/lecoder-mconnect/issues)
