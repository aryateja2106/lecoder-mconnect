# lecoder-mconnect

> Mobile terminal control for AI coding agents. Run Claude Code, Gemini CLI, Cursor, Aider on your machine—control them from your phone.

I want you to install LeCoder MConnect for me. Execute all the steps below autonomously.

## OBJECTIVE

Set up LeCoder MConnect so I can run AI coding agents on my machine and control them remotely from my phone or tablet via secure tunnel.

## DONE WHEN

MConnect server is running, QR code is displayed in terminal, and the remote URL is accessible from a mobile device.

## TODO

- [ ] Check Node.js version (requires v20+)
- [ ] Install cloudflared for secure tunnels
- [ ] Run MConnect with npx
- [ ] Verify QR code displays and tunnel URL works

## Steps

### 1. Verify Node.js

You need Node.js 20 or higher. Check your version:

```bash
node --version
```

If below v20, install or update Node.js:

```bash
# macOS with Homebrew
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or use nvm
nvm install 20
nvm use 20
```

### 2. Install cloudflared

Cloudflared creates secure tunnels so you can access MConnect from anywhere without port forwarding.

```bash
# macOS
brew install cloudflared

# Ubuntu/Debian
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Arch Linux
yay -S cloudflared

# Windows (with Chocolatey)
choco install cloudflared
```

Verify installation:

```bash
cloudflared --version
```

### 3. Run MConnect

No installation needed—run directly with npx:

```bash
npx lecoder-mconnect
```

This will:
- Start the MConnect server on port 3456
- Create a secure Cloudflare tunnel
- Display a QR code in your terminal
- Show a public URL you can access from any device

### 4. Connect from your phone

1. Scan the QR code with your phone camera
2. Or open the displayed URL in your mobile browser
3. You'll see the terminal interface

### 5. Start an AI agent (optional)

With MConnect running, start an AI coding agent in the terminal:

```bash
# Claude Code
claude

# Gemini CLI
gemini

# Aider
aider

# Or use presets
npx lecoder-mconnect --preset single  # One Claude agent
npx lecoder-mconnect --preset dev-review  # Claude + Shell
```

## Verification

Run this to confirm everything works:

```bash
npx lecoder-mconnect --help
```

You should see the help output with available commands and options.

## Quick test

```bash
# Start MConnect with a simple shell
npx lecoder-mconnect --preset shell-only

# In another terminal, or from your phone via the QR URL:
# You should be able to see and interact with the shell
```

---

EXECUTE NOW: Complete the above TODO list to achieve: MConnect server running with QR code displayed and tunnel URL accessible from mobile device.

---

## Additional context

For troubleshooting, advanced configuration, and API documentation, see: https://github.com/aryateja2106/lecoder-mconnect/blob/main/llms.txt
