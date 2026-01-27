# LeCoder Roadmap

> What's coming to MConnect and the LeCoder ecosystem.

---

## Current Release: v0.1.x

**Status**: Available now

```bash
npx lecoder-mconnect
```

### What's Working

- Multi-agent parallel execution
- QR code + secure URL access
- Cloudflare Tunnel encryption
- Read-only mode by default
- Command guardrails for safety
- Mobile-first touch interface
- Works with Claude Code, Gemini CLI, Cursor Agent, Aider, Codex

---

## Q1 2025: Foundation

### Container Isolation
> Run each agent in its own sandbox

- Docker container per agent session
- DevContainer spec support
- Resource limits (CPU, memory)
- Network isolation options
- Clean environment per task

**Why it matters**: Enterprises need isolation. One rogue agent can't affect others.

### Git Worktrees
> Parallel work without conflicts

- Automatic worktree creation per agent
- Branch isolation
- Merge conflict prevention
- Easy cleanup after completion

**Why it matters**: Multiple agents working on the same repo simultaneously.

---

## Q2 2025: Collaboration

### Real-time Sessions
> Multiple humans + AI agents together

- Share session links with teammates
- Live cursor positions
- Typing indicators
- Chat alongside terminal
- Presence awareness

**Built on**: Supabase Realtime

**Why it matters**: Teams reviewing AI agent work together.

### Permission Workflows
> Manager approvals for sensitive operations

- Customizable approval rules
- Slack/Teams notifications
- Audit trail
- Role-based access

**Why it matters**: Enterprises need oversight without friction.

---

## Q3 2025: Local AI

### Ollama Integration
> Run AI locally, no cloud required

- Connect local models to MConnect
- Zero data leaves your machine
- Support for Code Llama, DeepSeek, Mistral
- Custom model support

**Why it matters**: Data-sensitive companies can use AI agents without cloud dependency.

### Natural Language Shell
> Type what you want, not how to do it

- "Show me large files in this folder"
- "Find and replace across all JS files"
- Context-aware suggestions
- Learning from your patterns

**Why it matters**: Lower barrier to entry, faster workflows.

---

## Q4 2025: Enterprise

### Self-Hosted Deployment
> Run LeCoder on your infrastructure

- Helm charts for Kubernetes
- Docker Compose for simpler setups
- Air-gapped installation support
- Custom auth integration

### SSO & SAML
> Enterprise identity management

- Okta, Azure AD, Google Workspace
- SAML 2.0 support
- SCIM provisioning
- Group-based permissions

### Audit & Compliance
> Everything logged, nothing lost

- Full session recordings
- Command history with timestamps
- Export to SIEM systems
- SOC 2 Type II certification path

---

## Future Ideas

These are being considered but not scheduled:

- **Native mobile apps** (iOS/Android)
- **Desktop app** (Electron/Tauri)
- **VS Code extension**
- **Browser extension** for quick access
- **Voice commands** for hands-free control
- **Custom agent templates**
- **Marketplace** for agent configurations
- **Usage analytics dashboard**

---

## Installation Methods

| Method | Status | Target |
|--------|--------|--------|
| npm/npx | ✅ Available | Now |
| curl \| bash | 🔜 Coming | Q1 2025 |
| Homebrew | 🔜 Coming | Q1 2025 |
| bun | 🔜 Coming | Q1 2025 |
| Cargo (Rust) | 📋 Planned | Q3 2025 |

---

## How to Influence

- **GitHub Issues**: Feature requests welcome
- **Discord**: Join discussions (coming soon)
- **Twitter/X**: @lecoder_ai (coming soon)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

---

<p align="center">
  <b>>_<</b> Built by developers, for developers
</p>
