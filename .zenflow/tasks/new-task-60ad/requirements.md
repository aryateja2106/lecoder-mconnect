# Product Requirements Document: MConnect Hackathon Demo Deployment

## Overview

**Product**: MConnect - Mobile Control for AI Coding Agents
**Version**: 0.1.7
**Target**: Hackathon demo deployment with Opik integration
**Date**: 2026-02-05

---

## Problem Statement

AI coding agents (Claude Code, Gemini CLI, Cursor Agent) are powerful but require constant supervision. Developers start a complex task, walk away, and return to find the agent stuck waiting for approval—or worse, it made a mistake hours ago. There's no way to monitor and control these agents remotely.

---

## Solution

MConnect provides mobile-first control for AI coding agents. Run Claude Code on your laptop, scan a QR code, and control everything from your phone. The hackathon demo must showcase this capability with a live, publicly accessible deployment.

---

## Goals

### Primary Goals
1. **Live Demo URL**: Publicly accessible demo that judges can interact with
2. **Opik Integration**: Comprehensive tracing for "Best Use of Opik" track
3. **Project Description**: Compelling 400-word submission highlighting value prop

### Success Metrics
- Demo URL loads in < 3 seconds
- Mobile-responsive UI works on iOS and Android
- Zero console errors during demo
- Opik traces visible in dashboard
- Description clearly articulates problem → solution → Opik integration

---

## Scope

### In Scope

#### 1. Web App Demo Mode
- Deploy `apps/web` to Vercel with demo mode enabled
- Create mock WebSocket data simulating a Claude Code session
- Pre-recorded terminal output showing realistic agent workflow
- Approval request simulation (demonstrates key safety feature)
- Session switching demo (shows multi-agent capability)

#### 2. Opik Integration
- Add Opik SDK to CLI package
- Trace agent lifecycle events:
  - Agent spawn (with preset, configuration)
  - Tool invocations (commands executed)
  - User interactions (input, approvals)
  - Agent completion/termination
- Create demo trace data visible in Opik dashboard
- Document integration for judges

#### 3. Project Description
- 400-word hackathon submission
- Structure: Hook → Solution → Opik Integration → Technical Highlights → Impact
- Emphasize real-world problem and Opik observability value

#### 4. Deployment Configuration
- Vercel deployment for web app
- Environment variables for demo mode
- Custom domain (optional): `demo.mconnect.dev` or similar
- Health check endpoint

### Out of Scope
- Full CLI server deployment to cloud VM
- User authentication system
- Persistent session storage across restarts
- Multi-tenant support
- Payment/billing integration

---

## Functional Requirements

### FR-1: Demo Mode

**FR-1.1**: Web app must detect demo mode via environment variable
```
NEXT_PUBLIC_DEMO_MODE=true
```

**FR-1.2**: In demo mode, app must:
- Connect to mock WebSocket that simulates real protocol
- Display pre-recorded terminal session
- Show approval request after ~10 seconds
- Allow user to approve/deny (simulated)
- Display mode toggle (read-only ↔ read-write)

**FR-1.3**: Demo session must showcase:
- Terminal output with realistic Claude Code activity
- Syntax-highlighted code being written
- Approval request for `git push` command
- Multi-session panel (shows 2-3 mock agents)

**FR-1.4**: Demo must include "Try Locally" section with:
- npm install command: `npm install -g lecoder-mconnect`
- Quick start: `mconnect start`
- Link to full documentation

### FR-2: Opik Integration

**FR-2.1**: Add Opik SDK to `packages/cli`
```bash
npm install opik
```

**FR-2.2**: Create trace spans for:
| Event | Span Name | Attributes |
|-------|-----------|------------|
| Session start | `mconnect.session.start` | preset, guardrails, timestamp |
| Agent spawn | `mconnect.agent.spawn` | agentId, preset, workDir |
| Command execute | `mconnect.command.execute` | command, source (pc/mobile) |
| Approval request | `mconnect.approval.request` | command, reason |
| Approval response | `mconnect.approval.response` | approved, responseTime |
| Agent exit | `mconnect.agent.exit` | exitCode, duration |

**FR-2.3**: Configure Opik project: `mconnect-demo`

**FR-2.4**: Export trace data for demo (if live CLI not available)

### FR-3: Project Description

**FR-3.1**: Create `HACKATHON.md` with submission content

**FR-3.2**: Structure:
```
## Hook (50 words)
The problem statement - AI agents need supervision

## Solution (100 words)
What MConnect does - mobile control

## Opik Integration (100 words)
How we use Opik - comprehensive tracing

## Technical Highlights (100 words)
Key technical achievements

## Impact (50 words)
Why this matters
```

**FR-3.3**: Include:
- Screenshot of mobile UI
- Screenshot of Opik dashboard with traces
- Link to demo URL
- Link to GitHub repo

### FR-4: Deployment

**FR-4.1**: Deploy to Vercel with configuration:
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_DEMO_MODE": "true",
    "NEXT_PUBLIC_APP_URL": "https://demo.mconnect.dev"
  }
}
```

**FR-4.2**: Configure custom domain (if available)

**FR-4.3**: Add health check endpoint: `GET /api/health`
```json
{
  "status": "ok",
  "version": "0.1.7",
  "mode": "demo"
}
```

**FR-4.4**: Test on:
- iOS Safari
- Android Chrome
- Desktop Chrome
- Desktop Firefox

---

## Non-Functional Requirements

### NFR-1: Performance
- Initial load < 3 seconds on 4G connection
- Time to interactive < 5 seconds
- No layout shift after load

### NFR-2: Reliability
- Demo must work 100% of demo time (no live dependencies)
- Graceful fallback if any component fails
- Error boundary with friendly message

### NFR-3: Security
- No secrets exposed in client-side code
- CSP headers configured
- No open redirects

### NFR-4: Accessibility
- Keyboard navigable
- Screen reader compatible
- Color contrast WCAG AA compliant

### NFR-5: Mobile Experience
- Touch-friendly controls (min 44px tap targets)
- Works in landscape and portrait
- PWA installable

---

## Technical Architecture

### Demo Mode Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel Edge                            │
├─────────────────────────────────────────────────────────────┤
│  Next.js App (apps/web)                                     │
│  ┌─────────────────────┐  ┌──────────────────────────────┐ │
│  │    Demo Provider    │──│   Mock WebSocket Context     │ │
│  │  (detects demo env) │  │  (simulates CLI responses)   │ │
│  └─────────────────────┘  └──────────────────────────────┘ │
│            │                         │                       │
│            ▼                         ▼                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Terminal View Component                    ││
│  │  • xterm.js rendering                                   ││
│  │  • Pre-recorded output playback                         ││
│  │  • Simulated input handling                             ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Control Bar + Approval Modal               ││
│  │  • Mode toggle                                          ││
│  │  • Timed approval popup                                 ││
│  │  • Multi-session switcher                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Opik Integration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    MConnect CLI (packages/cli)               │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐    ┌────────────┐ │
│  │  Session.ts    │───▶│  OpikTracer    │───▶│   Opik     │ │
│  │  (orchestrator)│    │  (new module)  │    │   Cloud    │ │
│  └────────────────┘    └────────────────┘    └────────────┘ │
│         │                      │                             │
│         ▼                      ▼                             │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │ AgentManager   │    │ Trace Spans:   │                   │
│  │  (lifecycle)   │    │ • session.start│                   │
│  └────────────────┘    │ • agent.spawn  │                   │
│         │              │ • command.exec │                   │
│         ▼              │ • approval.*   │                   │
│  ┌────────────────┐    │ • agent.exit   │                   │
│  │  Guardrails    │    └────────────────┘                   │
│  │  (approvals)   │                                         │
│  └────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## Demo Script

The demo should showcase this user journey (for pre-recorded data):

### Scene 1: Agent Start (0-5 seconds)
```
$ mconnect start --preset single
🐬 MConnect v0.1.7
📱 Scan QR code to connect from mobile
[QR CODE DISPLAYED]

🔗 Or visit: https://demo.mconnect.dev?token=abc123
✅ Mobile connected from iPhone
```

### Scene 2: Claude Code Working (5-30 seconds)
```
claude> Create a simple REST API with Express

📝 I'll create a REST API with Express. Let me start...

Creating: src/index.ts
[Syntax highlighted TypeScript code appears]

Creating: src/routes/users.ts
[More code appears]

Installing dependencies...
$ npm install express @types/express
```

### Scene 3: Approval Request (30-40 seconds)
```
⚠️ APPROVAL REQUIRED

Command: git push origin main
Reason: Push to protected branch

[APPROVE] [DENY] [VIEW DIFF]
```

*Mobile shows vibration/notification, approval modal appears*

### Scene 4: Resolution (40-50 seconds)
```
✅ Approved by mobile user
$ git push origin main
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Writing objects: 100% (10/10), 2.14 KiB | 2.14 MiB/s, done.
```

---

## Mock Data Specification

### Terminal Output Recording
File: `apps/web/src/data/demo-session.json`

```typescript
interface DemoFrame {
  timestamp: number;      // ms from start
  type: 'output' | 'input' | 'approval' | 'status';
  content: string;        // terminal content or status message
  metadata?: {
    approved?: boolean;
    sessionId?: string;
  };
}

interface DemoSession {
  id: string;
  name: string;
  preset: string;
  frames: DemoFrame[];
  duration: number;
}
```

### Example Recording
```json
{
  "id": "demo-session-1",
  "name": "Claude Code - API Development",
  "preset": "single",
  "duration": 60000,
  "frames": [
    { "timestamp": 0, "type": "output", "content": "$ mconnect start --preset single\n" },
    { "timestamp": 500, "type": "output", "content": "🐬 MConnect v0.1.7\n" },
    { "timestamp": 1000, "type": "status", "content": "connected" },
    ...
  ]
}
```

---

## Environment Variables

### Web App (`apps/web/.env.production`)
```bash
# Demo mode flag
NEXT_PUBLIC_DEMO_MODE=true

# App URL (for QR codes, sharing)
NEXT_PUBLIC_APP_URL=https://demo.mconnect.dev

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=
```

### CLI (`packages/cli/.env`)
```bash
# Opik configuration
OPIK_API_KEY=<api-key>
OPIK_PROJECT=mconnect-demo
OPIK_ENVIRONMENT=production
```

---

## Deliverables

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| Demo Mode Provider | React context for demo state | P0 |
| Mock WebSocket | Simulated WS for demo | P0 |
| Demo Session Data | Pre-recorded terminal output | P0 |
| Opik Tracer Module | Integration with Opik SDK | P0 |
| Vercel Deployment | Live demo URL | P0 |
| HACKATHON.md | Project description | P0 |
| Health Endpoint | `/api/health` route | P1 |
| Opik Dashboard Setup | Project + sample traces | P1 |
| Mobile Screenshots | For submission | P1 |
| Video Recording | Full demo walkthrough | P2 |

---

## Timeline Considerations

Given hackathon constraints, prioritize:

1. **Phase 1 (Critical Path)**
   - Demo mode provider + mock WebSocket
   - Basic demo session data
   - Vercel deployment
   - Project description

2. **Phase 2 (If Time Permits)**
   - Opik integration in CLI
   - Opik dashboard screenshots
   - Polished demo data
   - Video recording

3. **Phase 3 (Nice to Have)**
   - Custom domain
   - Multiple demo scenarios
   - PWA enhancements

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Vercel deployment fails | Low | High | Test locally first, have Netlify backup |
| Demo data looks fake | Medium | Medium | Record real session, edit for length |
| Opik API issues | Medium | Medium | Use mock traces if needed |
| Mobile UI bugs | Medium | High | Extensive device testing |
| Last-minute changes break demo | High | High | Lock code 2 hours before submission |

---

## Assumptions

1. Vercel account available for deployment
2. Opik API key accessible
3. Current web app codebase is stable
4. Target submission deadline allows ~8 hours of work
5. No need for user authentication in demo
6. Mock data acceptable (judges understand demo constraints)

---

## Open Questions

1. **Custom Domain**: Is `demo.mconnect.dev` available and configured?
2. **Opik Dashboard**: Can we share a public link to traces?
3. **Video Platform**: Where should demo video be hosted (YouTube, Loom)?
4. **Submission Format**: Exact character/word limits for description?

---

## Appendix A: Project Description Draft

### MConnect: Mobile Control for AI Coding Agents

**The Problem**

AI coding agents are transforming software development. Claude Code, Gemini CLI, and Cursor Agent can write, refactor, and deploy code autonomously. But they have a critical limitation: they require constant supervision. Start a long-running task, step away for coffee, and you return to find your agent stuck waiting for approval—or worse, it made a costly mistake two hours ago that you could have prevented with a single keystroke.

**The Solution**

MConnect puts AI agent control in your pocket. Install our CLI (`npm install -g lecoder-mconnect`), run any AI coding agent, and scan a QR code with your phone. Now you're connected. Watch terminal output stream in real-time. Get vibration alerts when your agent needs approval for dangerous commands like `rm -rf` or `git push --force`. Approve or deny from anywhere. Switch between multiple agents running different tasks.

Our shell-first architecture means MConnect works with any CLI-based AI tool—no integrations required. WebSocket 2.0 protocol ensures real-time bidirectional communication with sub-100ms latency. Built-in guardrails detect dangerous commands before they execute.

**Opik Integration**

We integrated Opik for comprehensive observability into agent behavior. Every session creates a trace. Every agent lifecycle event—spawn, command execution, approval request, termination—becomes a span with rich metadata. Developers see exactly how their AI agents work: what commands were run, when approvals were needed, how long tasks took.

This observability is crucial for understanding and improving AI-assisted workflows. With Opik, teams can audit agent behavior, identify bottlenecks, and build trust in AI automation.

**Technical Highlights**

- Shell-first architecture for universal agent compatibility
- WebSocket v2.0 with multi-session support
- Guardrails system with configurable security levels
- Input arbitration between PC and mobile control
- Container isolation via DevContainer spec

**Impact**

MConnect is infrastructure for the AI-assisted development era. As AI agents become standard tools, developers need control that doesn't chain them to their desks. We're building that future—one approval from your phone at a time.

---

*Word count: ~380*
