# MConnect — Control your AI agents from your phone

## 1-Line Pitch

MConnect: Mobile command center for AI coding agents

## What does your company do?

MConnect turns idle machines into a distributed, multi-agent software factory — controlled entirely from your iPhone.

Here's the problem: AI coding agents (Claude Code, Gemini CLI, Aider) now run autonomously for hours, building code without human oversight. Meanwhile, you're away from your laptop. You can't see what's happening. You can't approve the `npm publish` before it ships. You can't kill a runaway agent loop.

MConnect solves this with a three-layer platform:

**1. Mobile control wedge.** Native iOS app over WebSocket. Kick off an agent task on your Mac, then pocket your phone. Get a notification when the agent needs approval (deploy, git push, delete files). Tap to approve or reject. No cloud account. No mandatory telemetry.

**2. Trust layer.** Agents write and execute code — dangerous by default. MConnect bundles three hardening systems:
- **Lockshell vault** (audit-passed secret broker): agents can't read raw API keys or secrets; they request them via audit log.
- **Skill Lab gate** (coming Q2): every Claude Code skill installed via MConnect goes through a prompt-injection / data-exfiltration / token-bloat scanner before activation. "App Store for agent skills, but secure by default."
- **CLI tunnel hardening**: no inbound ports, ephemeral Cloudflare Tunnels, per-session TLS, timeout enforcement.

**3. One ecosystem, not four projects.** MConnect + Lockshell + Skill Lab gate + tunnel hardening = single moat: verifiable trust in remote agent infrastructure. Not a collection of tools. A platform.

## Why now?

Andrej Karpathy: "I haven't typed code since December." Autonomous agents are here, building real software.

The bottleneck is human control. Agents running 6+ hours need real-time oversight: a mobile control plane that's fast, trustworthy, and untethered.

Every builder with idle hardware and agents faces this gap. Move first.

## Traction

- **npm live**: `lecoder-mconnect@0.1.7` published, 40+ commits public
- **iOS TestFlight live**: [App ID 6759892293](https://testflight.apple.com/join/pB2TbMrX), App Store review in progress
- **Lockshell audit-passed**: template-allowlist policy + redaction scan complete (aryateja2106/lockshell, v0.1.4, MIT, ready to ship)
- **Website live**: [mconnect-flax.vercel.app](https://mconnect-flax.vercel.app)
- **CI/CD public**: merged feat(protocol): Phase 0A1 CLI v3 + v3.1 capability negotiation scaffolding

## Founder

**Arya Teja Rudraraju** — Solo technical founder. Shipping production code daily across four active OSS projects (MConnect, Lockshell, CloudAGI marketplace, NL2Shell). Protocol design + mobile native + CLI infrastructure + security audit experience all at once. The hard part — the trust layer — is where competitors will cut corners.

## What's hard / Why this team?

Mobile orchestration + CLI runtime + protocol negotiation + cryptographic secret broking — few touch this stack simultaneously.

Most agent companies stop at dashboards. The trust layer requires crypto, terminal I/O, iOS internals, and threat modeling. That's the moat.

Solo founder, shipping daily. Vision maps directly to code. Product evolves from usage.

## Demo links (placeholders)

- **TestFlight invite**: [https://testflight.apple.com/join/pB2TbMrX](https://testflight.apple.com/join/pB2TbMrX)
- **60-second demo video**: [link TBD — screen record: kick off agent task → approve via phone → task completes]
- **Live tunnel**: [mconnect-flax.vercel.app](https://mconnect-flax.vercel.app) (web UI paired to tunnel-running CLI)

## What we are NOT

- **Not enterprise MDM.** We're not managing IT infrastructure or enforcing corporate policies. We're empowering builders.
- **Not RDP/VNC for sysadmins.** We're not a generic remote desktop tool. (We do include a VNC viewer as a power feature for agents that need visual introspection, but it's not the wedge.)

---

**Coded**: April 2026  
**Word count**: 462 (excluding headers and meta) | 584 total  
**Status**: Ready for YC application  
