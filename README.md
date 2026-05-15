# MConnect

**Run AI coding agents on any machine. Drive them from your phone.**

[![npm](https://img.shields.io/npm/v/lecoder-mconnect.svg)](https://www.npmjs.com/package/lecoder-mconnect)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TestFlight](https://img.shields.io/badge/iOS-TestFlight-black.svg?logo=apple)](https://testflight.apple.com/join/pB2TbMrX)

MConnect is a mobile-first remote shell for AI coding agents. Install one CLI on each machine you own — laptop, dev VM, home server — and connect to all of them from one place on your phone.

```bash
npx lecoder-mconnect
```

A QR code prints. Scan it with the iOS app (or any phone browser). Your machine is now reachable from your pocket.

---

## What it's for

You step away from your desk. Your agent stalls on an approval prompt. You unlock your phone, see the prompt, tap Approve. The run continues.

Or: you have three machines running different agents — Claude Code reviewing a PR on your laptop, an aider session on your dev VM, a long-running build on a home server. MConnect gives you one screen to see them all and a real terminal you can drive from a phone-sized keyboard.

The goal is to be Jump Desktop for AI coding agents — fast, reliable, mobile-native, no signup.

## Quickstart

**1. Install on the machine you want to control:**

```bash
# macOS / Linux
npx lecoder-mconnect

# or globally
npm install -g lecoder-mconnect
mconnect
```

**2. Pair your phone:**

- Scan the QR code with the [TestFlight build](https://testflight.apple.com/join/pB2TbMrX), or
- Open the printed URL in any phone browser, or
- Type the 6-character pairing code

**3. Pick an agent and go:**

| Preset | What it runs |
|---|---|
| `shell-only` | Just a remote shell. Good for first-time pairing. |
| `single` | One agent — Claude Code, Gemini CLI, Cursor, aider, or codex |
| `dev-review` | A coding agent + a review agent in tmux split |
| `container-dev` | Same as `single` but inside a Docker dev container |

```bash
mconnect --preset single --guardrails default
```

## How it works

```
  Phone (iOS app or browser)
       │
       │  WebSocket over Cloudflare Tunnel
       ▼
  MConnect daemon  ──►  Claude Code / Gemini / aider / shell
  (your machine)        (each agent in its own PTY, optionally Dockerised)
```

- **node-pty** runs each agent in a real pseudo-terminal so TUIs render correctly.
- **WebSocket** ships keystrokes up and screen output down at near-zero latency.
- **Cloudflare Tunnel** gives you a public HTTPS URL with no port-forwarding.
- **Guardrails** filter destructive commands before they reach the shell.

## Repo layout

```
lecoder-mconnect/
├── packages/
│   ├── cli/          # The lecoder-mconnect CLI (Node, what you `npx`)
│   ├── server/       # Bun-based orchestration server
│   ├── shared/       # Shared types, protocol, guardrails
│   └── ios-app/      # Native iOS app (SwiftUI)
├── apps/
│   ├── web/          # Phone-friendly web client (Next.js + xterm.js)
│   └── website/      # Marketing site
└── docs/
    └── design/       # Design specs, including MOBILE-TERMINAL-DESIGN.md
```

## Develop

```bash
git clone https://github.com/aryateja2106/lecoder-mconnect.git
cd lecoder-mconnect
npm install
npm run dev          # apps/web on :3000
npm run dev:cli      # CLI in watch mode
npx lecoder-mconnect doctor  # sanity check
```

Prereqs: Node 20+, Python 3, a C++ toolchain (Xcode CLT on macOS, `build-essential` on Linux), and [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

## Guardrails

Four levels of command filtering — pick when you start a session:

| Level | Blocks | Approval needed |
|---|---|---|
| `default` | `rm -rf /`, fork bombs | force push, `npm publish` |
| `strict` | all destructive ops | any `rm`, all `git push` |
| `permissive` | catastrophic only | force push only |
| `none` | nothing | nothing |

Every approval request shows on your phone with the exact command and a one-tap Approve / Deny.

## Vault — secrets without leaks

Use `{{PLACEHOLDER}}` in any command, opt in with `--vault lockshell`, and the resolved secret never reaches the agent, the WebSocket frame, the Cloudflare tunnel, or your phone screen.

```bash
lockshell register OPENAI_KEY openai-personal token
mconnect --vault lockshell

# On your phone:
# curl -H "Authorization: Bearer {{OPENAI_KEY}}" https://api.openai.com/v1/models
```

[lockshell](https://github.com/aryateja2106/lockshell) ≥ 0.1.4. Strict template policy by default; widen with `--vault-permissive` only if you trust the operator. See `mconnect doctor` for installation status.

## Supported agents

Anything that runs in a terminal. First-class TUI support for Claude Code, Gemini CLI, Cursor Agent, aider, and OpenAI Codex; everything else works in shell mode.

## iOS app

Native SwiftUI client — same protocol as the web client, designed for one-handed use. Sticky session header, full-bleed terminal, sticky-modifier hardware-key bar (`Esc Tab Ctrl Shift Alt Cmd Del` + arrows / `Home End PgUp PgDn`), and long-press copy/paste.

[Join TestFlight](https://testflight.apple.com/join/pB2TbMrX) — App Store review in progress.

## Privacy

No accounts. No cloud storage. No telemetry by default. Sessions are ephemeral — when you stop MConnect the tunnel URL expires and everything is gone. Your code never leaves your machine.

## License

MIT — see [LICENSE](LICENSE).

## Author

[Arya Teja Rudraraju](https://github.com/aryateja2106) · [Sujith Bellam](https://github.com/sujithbellam)
