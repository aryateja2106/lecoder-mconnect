# Opik Hackathon Submission - LeCoder MConnect

## Project Name
**LeCoder MConnect**

## Tagline
Terminal in your pocket - Control AI coding agents from your phone

## Short Description (for submission form)
LeCoder MConnect lets developers control AI coding agents (Claude Code, Gemini CLI, Cursor Agent) remotely from their phone. Run agents on your laptop, monitor and control them from anywhere via a mobile-optimized web interface. Features multi-agent support, guardrails for dangerous commands, QR code pairing, and secure Cloudflare tunnel connections. Open source and free.

## Longer Description
LeCoder MConnect is an open-source mobile terminal control system for AI coding agents. It solves a real productivity problem: when you're running long-running AI coding tasks on your laptop but need to step away, you no longer have to stay chained to your desk.

### Key Features:
- **Multi-Agent Support**: Run Claude Code, Gemini CLI, Cursor Agent, Codex, Aider in parallel
- **Mobile-First UI**: Touch-optimized terminal with smooth scrolling and responsive controls
- **Guardrails & Security**: Block dangerous commands, require approval for risky operations
- **QR Code Connect**: Scan to connect instantly - no port forwarding needed
- **Read-Only by Default**: Safely monitor without accidental interruption
- **Secure Remote Access**: Cloudflare Tunnel encryption, ephemeral sessions

### How It Works:
1. Run `npx lecoder-mconnect` on your laptop
2. Scan the QR code with your phone
3. Control your AI agents from anywhere

### Target Category
**Productivity & Work Habits** - MConnect helps developers maintain productivity even when away from their primary workstation. It enables monitoring and control of long-running AI agent tasks, reducing context switching and idle time.

### Opik Integration (Planned)
We plan to integrate Opik for:
- Tracking agent performance metrics across sessions
- Evaluating command success rates and response times
- Monitoring guardrail effectiveness
- A/B testing different agent configurations

## Links

- **Code Repository**: https://github.com/aryateja2106/lecoder-mconnect
- **npm Package**: https://www.npmjs.com/package/lecoder-mconnect
- **Demo/Landing Page**: https://lecoder.lesearch.ai (pending deployment)

## Quick Install
```bash
npx lecoder-mconnect
```

## Tech Stack
- TypeScript / Node.js
- Next.js 15 (landing page)
- WebSocket for real-time communication
- xterm.js for terminal emulation
- Cloudflare Tunnel for secure remote access
- node-pty for pseudo-terminal management

## Team
- **Arya Teja Rudraraju** (@r_aryateja on Twitter)
- Part of LeSearch AI

## License
MIT License - Free and open source

---

## Social Proof
- npm package: lecoder-mconnect
- GitHub: aryateja2106/lecoder-mconnect
- Actively maintained
- Works with Claude Code (Anthropic), Gemini CLI (Google), Cursor Agent, and more
