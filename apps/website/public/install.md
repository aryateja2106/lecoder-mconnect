# Installing LeCoder MConnect

> Terminal in your pocket - Control your AI coding agents from your phone.

## Quick Install

```bash
npx lecoder-mconnect
```

That's it! The package will be downloaded and run automatically.

## Prerequisites

Before running MConnect, ensure you have:

### Required

- **Node.js 20+** - [Download from nodejs.org](https://nodejs.org/)
- **cloudflared** - For secure remote access (required for mobile connection)

### Optional

- **tmux** - For server-side visualization

## Installing cloudflared

### macOS

```bash
brew install cloudflared
```

### Linux (Debian/Ubuntu)

```bash
# Add cloudflare gpg key
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

# Add repo
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared focal main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install
sudo apt-get update && sudo apt-get install cloudflared
```

### Other Linux

See [Cloudflare's official downloads page](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

## Global Installation (Optional)

If you prefer to install globally:

```bash
npm install -g lecoder-mconnect

# Then run with:
mconnect
```

## Verify Installation

Check that everything is set up correctly:

```bash
npx lecoder-mconnect doctor
```

This will verify:
- Node.js version
- cloudflared installation
- tmux installation (optional)
- Required permissions

## First Run

1. **Start MConnect**
   ```bash
   npx lecoder-mconnect
   ```

2. **Select Configuration**
   - Choose your agent preset (e.g., "Research + Spec + Tests" for 3 parallel agents)
   - Select guardrails level (default recommended)
   - Confirm working directory

3. **Connect Your Phone**
   - Scan the QR code displayed in terminal
   - Or enter the 6-character pairing code manually

4. **Control Your Agents**
   - View terminal output on your phone
   - Toggle between read-only and interactive mode
   - Send commands, approve/deny dangerous operations

## CLI Commands

```bash
# Interactive setup (recommended for first run)
npx lecoder-mconnect

# Start with specific preset
npx lecoder-mconnect start --preset research-spec-test

# System diagnostics
npx lecoder-mconnect doctor

# List available presets
npx lecoder-mconnect presets
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `-d, --dir <path>` | Working directory | Current directory |
| `-p, --preset <name>` | Agent preset | Interactive selection |
| `-g, --guardrails <level>` | Security level | `default` |
| `--port <number>` | Server port | `8765` |
| `--no-tmux` | Disable tmux | Enabled |

## Agent Presets

| Preset | Agents | Best For |
|--------|--------|----------|
| Shell Session | 1 shell | Getting started |
| Single Agent | 1 AI agent | Simple tasks |
| Research + Spec + Tests | 3 agents | Parallel workflows |
| Dev + Reviewer | 2 agents | Code review |
| Custom | You choose | Advanced setups |

## Troubleshooting

### node-pty installation fails

```bash
# macOS - ensure Xcode CLI tools
xcode-select --install

# Linux - ensure build tools
sudo apt install build-essential python3

# Then reinstall
npm install -g lecoder-mconnect
```

### Tunnel not connecting

```bash
# Verify cloudflared is installed
cloudflared --version

# Test tunnel manually
cloudflared tunnel --url http://localhost:8765
```

### Permission issues

```bash
# Check required permissions
npx lecoder-mconnect doctor
```

## Uninstalling

```bash
# If installed globally
npm uninstall -g lecoder-mconnect
```

## Links

- **GitHub**: https://github.com/aryateja2106/lecoder-mconnect
- **npm**: https://www.npmjs.com/package/lecoder-mconnect
- **Issues**: https://github.com/aryateja2106/lecoder-mconnect/issues
- **LeSearch AI**: https://lesearch.ai

## License

MIT License - Free and open source.
