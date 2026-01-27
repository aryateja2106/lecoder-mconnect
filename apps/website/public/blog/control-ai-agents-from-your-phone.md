# How to Control AI Coding Agents from Your Phone

*A practical guide to mobile-first AI development with LeCoder MConnect*

---

You're running Claude Code on your laptop. It's working through a complex refactoring task. You need to step away—grab coffee, take a meeting, go for a walk. But you want to monitor progress. Maybe send a quick instruction if it gets stuck.

This is exactly what LeCoder MConnect does.

## The Problem with Current AI Agent Workflows

Today's AI coding assistants are powerful but tethered:

- **Claude Code** runs in your terminal
- **Gemini CLI** needs an active session
- **Cursor** requires the app open
- **Aider** is command-line only

If you close your laptop, the session dies. If you're on your phone, you can't interact. You're stuck at your desk watching text scroll.

## The Solution: MConnect

MConnect creates a secure bridge between your AI agents and any device with a browser.

```
Your Machine (AI Agents) ←→ Cloudflare Tunnel ←→ Your Phone (Browser)
```

No port forwarding. No VPN. No accounts. Just a QR code.

## Quick Start

### 1. Install Prerequisites

```bash
# macOS
brew install cloudflared

# Ubuntu/Debian
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

### 2. Run MConnect

```bash
npx lecoder-mconnect
```

You'll see:

```
╔═══════════════════════════════════════╗
║         LeCoder MConnect v0.1.4       ║
╠═══════════════════════════════════════╣
║  Local:  http://localhost:3456        ║
║  Remote: https://abc123.trycloudflare.com ║
╠═══════════════════════════════════════╣
║  Scan QR code to connect:             ║
║                                       ║
║      [QR CODE APPEARS HERE]           ║
║                                       ║
╚═══════════════════════════════════════╝
```

### 3. Scan from Your Phone

Point your phone camera at the QR code. It opens the terminal interface in your mobile browser.

### 4. Start an AI Agent

Now start your AI agent in the terminal:

```bash
claude
```

Watch it appear on your phone in real-time.

## Real-World Workflows

### Workflow 1: Monitor Long Tasks

You've asked Claude to refactor a large codebase. It'll take 30 minutes.

```bash
# Start MConnect with Claude
npx lecoder-mconnect --preset single
```

Scan the QR, then walk away. Check progress from your phone whenever you want. If Claude asks a question, type your response from your phone.

### Workflow 2: Parallel Agents

You want Claude for implementation and Gemini for research, running simultaneously.

```bash
npx lecoder-mconnect --preset custom --agents '[
  {"type":"claude","name":"Implement"},
  {"type":"gemini","name":"Research"}
]'
```

On your phone, you'll see two terminal panes. Switch between them with a tap.

### Workflow 3: Safe Monitoring

You want to watch but not accidentally send commands.

```bash
npx lecoder-mconnect --read-only
```

Read-only mode by default. You can see everything but can't type until you explicitly enable input.

### Workflow 4: Team Sharing

Share the tunnel URL with a teammate. They can watch the same session from their device.

```
https://abc123.trycloudflare.com
```

Coming soon: Real-time cursors and chat alongside the terminal.

## Mobile UI Features

The MConnect mobile interface is designed for touch:

- **Smooth scrolling**: Native-feeling scroll through terminal history
- **Pinch to zoom**: Make text larger or smaller
- **Tap to focus**: Select which agent to interact with
- **Pull to refresh**: Reconnect if connection drops
- **Landscape mode**: Full-width terminal on tablets

## Security

Every feature was designed with security in mind:

| Feature | How It Works |
|---------|--------------|
| No accounts | No signup, no login, no data stored |
| Encrypted tunnel | All traffic through Cloudflare TLS |
| Ephemeral URLs | New URL each time, expires when you stop |
| Token auth | Unique token per session |
| Read-only default | Must explicitly enable input |
| Guardrails | Block dangerous commands |

## Common Use Cases

### Developer on the Go
Run AI agents on your desktop while commuting. Review and guide from your phone.

### Pair Programming
Share your tunnel URL with a colleague. They can watch and suggest improvements.

### Long-Running Tasks
Start a complex generation, go to a meeting, check progress during breaks.

### Home Lab Setup
Run MConnect on a Raspberry Pi. Control from your iPad anywhere in the house.

### Demo and Teaching
Share your AI workflow with students or clients through the tunnel URL.

## Troubleshooting

### QR code won't scan
- Ensure good lighting
- Try zooming in on the terminal
- Use the URL directly instead

### Connection drops
- Check your internet connection
- Cloudflare tunnels reconnect automatically
- If persistent, restart MConnect

### Slow on mobile
- MConnect streams efficiently but large outputs take bandwidth
- On slow connections, use read-only mode to reduce data

### Agent not starting
- Ensure the AI tool is installed (`claude`, `gemini`, etc.)
- Check you have valid API keys configured
- Try `--preset shell-only` first

## What's Coming

We're actively building:

- **Container isolation**: Each agent in its own sandbox
- **Git worktrees**: Parallel branches per agent
- **Ollama support**: Local AI with no cloud dependency
- **Team features**: Shared sessions with roles and permissions

## Try It Now

```bash
npx lecoder-mconnect
```

No installation needed. Just Node.js 20+ and cloudflared.

Start small: run a shell, scan the QR, type a command from your phone. Once you feel the power of mobile control, you'll never want to be tethered to your desk again.

---

## Links

- **GitHub**: [github.com/aryateja2106/lecoder-mconnect](https://github.com/aryateja2106/lecoder-mconnect)
- **npm**: [npmjs.com/package/lecoder-mconnect](https://www.npmjs.com/package/lecoder-mconnect)
- **Twitter**: [@r_aryateja](https://twitter.com/r_aryateja)

---

*Built by LeSearch AI · Open Source · MIT License*
