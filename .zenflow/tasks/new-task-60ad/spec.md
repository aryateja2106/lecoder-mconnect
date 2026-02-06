# Technical Specification: MConnect Hackathon Demo Deployment

**Version**: 1.0
**Date**: 2026-02-05
**Based on**: `requirements.md` PRD
**Status**: Ready for Implementation

---

## 1. Technical Context

### 1.1 Current Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **CLI** | Node.js + TypeScript | 20+, 5.x |
| **CLI Framework** | Commander.js | 12.0.0 |
| **PTY** | node-pty | 1.1.0 |
| **WebSocket** | ws | 8.16.0 |
| **Web App** | Next.js (App Router) | 16.1.2 |
| **React** | React | 19.2.3 |
| **Terminal** | xterm.js | 6.0.0 |
| **Styling** | Tailwind CSS | 4.0.0 |
| **Package Manager** | npm workspaces | - |

### 1.2 Current Architecture

```
lecoder-mconnect/
├── packages/
│   └── cli/                    # Core CLI (lecoder-mconnect on npm)
│       ├── src/
│       │   ├── index.ts        # CLI entry, wizard
│       │   ├── session.ts      # Session orchestration
│       │   ├── agents/         # Agent lifecycle (agent-manager.ts)
│       │   ├── pty/            # PTY management
│       │   ├── ws/             # WebSocket hub (ws-hub.ts, protocol.ts)
│       │   ├── web/            # Built-in web client HTML
│       │   ├── guardrails.ts   # Command safety
│       │   └── security.ts     # Token + pairing codes
│       └── package.json
├── apps/
│   ├── web/                    # Next.js mobile UI
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx    # Main app
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   └── terminal/
│   │   │   │       ├── TerminalView.tsx
│   │   │   │       └── ControlBar.tsx
│   │   │   └── hooks/
│   │   │       └── useWebSocket.ts
│   │   └── package.json
│   └── website/                # Marketing landing page
└── package.json                # Workspace root
```

### 1.3 Key Existing Patterns

**WebSocket Protocol (v1.0):**
```typescript
// Client → Server
interface TerminalInputMessage { type: 'terminal_input'; data: string; agentId?: string; }
interface ModeChangeMessage { type: 'mode_change'; readOnly: boolean; }
interface ApprovalResponseMessage { type: 'approval_response'; approved: boolean; }

// Server → Client
interface OutputMessage { type: 'output'; agentId: string; data: string; }
interface SessionInfoMessage { type: 'session_info'; sessionId: string; isReadOnly: boolean; agents: AgentInfo[]; }
interface ApprovalRequestMessage { type: 'approval_request'; command: string; reason: string; }
```

**Connection URL Pattern:**
```
wss://<host>?token=<session-token>&v=1.0&clientType=mobile
```

---

## 2. Implementation Approach

### 2.1 Strategy Overview

The demo deployment follows **Option 1: Web App Only** from the PRD, with three parallel workstreams:

1. **Demo Mode System** - Mock WebSocket and pre-recorded data in `apps/web`
2. **Opik Integration** - Tracing module in `packages/cli`
3. **Project Deliverables** - HACKATHON.md and deployment config

### 2.2 Design Principles

1. **Minimal Invasive Changes**: Demo mode wraps existing components, doesn't modify core logic
2. **Environment-Driven**: `NEXT_PUBLIC_DEMO_MODE=true` controls behavior
3. **Graceful Fallback**: Real connection attempted first, demo mode on failure (optional)
4. **Reusable Patterns**: Mock WebSocket mirrors real protocol exactly

---

## 3. Source Code Structure Changes

### 3.1 New Files to Create

```
apps/web/
├── src/
│   ├── context/
│   │   └── DemoContext.tsx         # Demo mode provider
│   ├── data/
│   │   └── demo-session.ts         # Pre-recorded terminal data
│   ├── lib/
│   │   └── mock-websocket.ts       # Mock WebSocket class
│   └── app/
│       └── api/
│           └── health/
│               └── route.ts        # Health check endpoint

packages/cli/
├── src/
│   └── opik/
│       ├── index.ts                # Opik tracer module
│       └── types.ts                # Span types

/ (root)
├── HACKATHON.md                    # Project submission
└── apps/web/vercel.json            # Deployment config
```

### 3.2 Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/app/page.tsx` | Wrap with DemoProvider, conditional WebSocket |
| `apps/web/src/app/layout.tsx` | Add demo mode banner |
| `apps/web/src/hooks/useWebSocket.ts` | Accept mock WebSocket injection |
| `packages/cli/src/session.ts` | Add Opik tracer hooks |
| `packages/cli/src/agents/agent-manager.ts` | Add Opik span for agent lifecycle |
| `packages/cli/package.json` | Add opik dependency |

---

## 4. Data Model / API / Interface Changes

### 4.1 Demo Session Data Model

```typescript
// apps/web/src/data/demo-session.ts

export interface DemoFrame {
  /** Milliseconds from session start */
  timestamp: number;
  /** Frame type */
  type: 'output' | 'input' | 'approval' | 'status' | 'agent_info';
  /** Terminal content or status message */
  content: string;
  /** Optional metadata */
  metadata?: {
    approved?: boolean;
    sessionId?: string;
    agentId?: string;
    isReadOnly?: boolean;
  };
}

export interface DemoSession {
  id: string;
  name: string;
  preset: string;
  agentType: 'claude' | 'gemini' | 'shell';
  duration: number;
  frames: DemoFrame[];
}

export interface DemoScenario {
  sessions: DemoSession[];
  /** Initial session to display */
  defaultSessionId: string;
}
```

### 4.2 Mock WebSocket Interface

```typescript
// apps/web/src/lib/mock-websocket.ts

export interface MockWebSocketOptions {
  /** Demo scenario data */
  scenario: DemoScenario;
  /** Playback speed multiplier (default: 1.0) */
  playbackSpeed?: number;
  /** Loop when reaching end (default: true) */
  loop?: boolean;
  /** Callback for approval request interaction */
  onApprovalRequest?: (command: string) => void;
}

export class MockWebSocket {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState: number;

  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;

  constructor(url: string, options?: MockWebSocketOptions);

  /** Start playback */
  connect(): void;

  /** Handle user input (approval responses) */
  send(data: string): void;

  /** Stop playback and close */
  close(code?: number, reason?: string): void;

  /** Pause playback */
  pause(): void;

  /** Resume playback */
  resume(): void;

  /** Seek to specific timestamp */
  seek(timestamp: number): void;
}
```

### 4.3 Demo Context Interface

```typescript
// apps/web/src/context/DemoContext.tsx

export interface DemoContextValue {
  /** Is demo mode active */
  isDemoMode: boolean;
  /** Current playback state */
  playbackState: 'playing' | 'paused' | 'ended';
  /** Current timestamp in playback */
  currentTimestamp: number;
  /** Total duration */
  totalDuration: number;
  /** Available sessions in demo */
  sessions: DemoSession[];
  /** Currently active session */
  activeSessionId: string;
  /** Control functions */
  play: () => void;
  pause: () => void;
  restart: () => void;
  switchSession: (sessionId: string) => void;
  /** Respond to approval request */
  respondToApproval: (approved: boolean) => void;
}
```

### 4.4 Health Check API

```typescript
// apps/web/src/app/api/health/route.ts

// GET /api/health
interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  mode: 'demo' | 'live';
  timestamp: string;
}
```

### 4.5 Opik Tracer Interface

```typescript
// packages/cli/src/opik/types.ts

export interface OpikConfig {
  apiKey: string;
  project: string;
  environment?: string;
}

export interface SessionSpan {
  spanName: 'mconnect.session.start' | 'mconnect.session.end';
  attributes: {
    sessionId: string;
    preset: string;
    guardrails: string;
    timestamp: number;
  };
}

export interface AgentSpan {
  spanName: 'mconnect.agent.spawn' | 'mconnect.agent.exit';
  attributes: {
    sessionId: string;
    agentId: string;
    preset: string;
    workDir: string;
    exitCode?: number;
    duration?: number;
  };
}

export interface CommandSpan {
  spanName: 'mconnect.command.execute';
  attributes: {
    sessionId: string;
    agentId: string;
    command: string;
    source: 'pc' | 'mobile';
    blocked: boolean;
  };
}

export interface ApprovalSpan {
  spanName: 'mconnect.approval.request' | 'mconnect.approval.response';
  attributes: {
    sessionId: string;
    command: string;
    reason?: string;
    approved?: boolean;
    responseTime?: number;
  };
}

// packages/cli/src/opik/index.ts

export class OpikTracer {
  constructor(config: OpikConfig);

  /** Start a new trace for session */
  startSession(sessionId: string, preset: string, guardrails: string): void;

  /** End session trace */
  endSession(sessionId: string): void;

  /** Record agent lifecycle */
  agentSpawn(sessionId: string, agentId: string, preset: string, workDir: string): void;
  agentExit(sessionId: string, agentId: string, exitCode: number): void;

  /** Record command execution */
  commandExecute(sessionId: string, agentId: string, command: string, source: 'pc' | 'mobile', blocked: boolean): void;

  /** Record approval flow */
  approvalRequest(sessionId: string, command: string, reason: string): void;
  approvalResponse(sessionId: string, command: string, approved: boolean, responseTime: number): void;

  /** Flush pending spans */
  flush(): Promise<void>;
}
```

---

## 5. Delivery Phases

### Phase 1: Demo Mode Core (P0)

**Goal**: Web app functions in demo mode without real CLI connection

**Tasks**:
1. Create `DemoContext.tsx` with demo state management
2. Implement `MockWebSocket` class mirroring real protocol
3. Create demo session data with realistic Claude Code activity
4. Modify `page.tsx` to use mock WebSocket in demo mode
5. Add demo mode banner to layout

**Verification**:
- `npm run dev` in `apps/web` with `NEXT_PUBLIC_DEMO_MODE=true`
- Terminal shows pre-recorded output
- Approval modal appears after ~10 seconds
- User can approve/deny (simulated response)

### Phase 2: Vercel Deployment (P0)

**Goal**: Live URL accessible by judges

**Tasks**:
1. Create `apps/web/vercel.json` with build config
2. Add environment variables to Vercel project
3. Create `/api/health` endpoint
4. Deploy to Vercel
5. Test on iOS Safari, Android Chrome, Desktop

**Verification**:
- `https://<vercel-url>/api/health` returns `{ status: 'ok', mode: 'demo' }`
- Mobile devices load < 3 seconds
- No console errors
- All interactions work

### Phase 3: Project Description (P0)

**Goal**: Compelling hackathon submission document

**Tasks**:
1. Create `HACKATHON.md` with structured content
2. Hook (50 words) - problem statement
3. Solution (100 words) - MConnect value prop
4. Opik Integration (100 words) - tracing details
5. Technical Highlights (100 words) - key achievements
6. Impact (50 words) - why it matters

**Verification**:
- Word count 380-420
- Clear problem → solution narrative
- Opik integration prominently featured

### Phase 4: Opik Integration (P1)

**Goal**: Real tracing in CLI for demo screenshots

**Tasks**:
1. Add `opik` dependency to `packages/cli`
2. Create `src/opik/` module with tracer class
3. Integrate into `session.ts` for session lifecycle
4. Integrate into `agent-manager.ts` for agent lifecycle
5. Integrate into `guardrails.ts` for approval tracking
6. Generate traces for demo, capture screenshots

**Verification**:
- Run `mconnect start` locally with Opik configured
- Traces appear in Opik dashboard
- All span types visible with correct attributes

### Phase 5: Polish (P2)

**Goal**: Enhanced demo experience

**Tasks**:
1. Add "Try Locally" section to demo page
2. Create multi-session demo (switch between agents)
3. Record demo video
4. Configure custom domain (if available)

**Verification**:
- "Try Locally" shows npm install command
- Session switcher works in demo mode
- Video captures full flow

---

## 6. Verification Approach

### 6.1 Unit Tests (Phase 1)

```bash
# Run from apps/web
npm run test

# Test files to create:
# - src/lib/__tests__/mock-websocket.test.ts
# - src/context/__tests__/DemoContext.test.tsx
```

### 6.2 Integration Tests

```bash
# Run from root
npm run test:integration

# Tests to verify:
# - Demo mode activates with env var
# - Mock WebSocket sends messages on schedule
# - Approval flow completes
```

### 6.3 Manual Testing Checklist

**Desktop:**
- [ ] Demo loads in Chrome
- [ ] Demo loads in Firefox
- [ ] Terminal output streams
- [ ] Approval modal appears
- [ ] Approve/Deny buttons work
- [ ] No console errors

**Mobile:**
- [ ] iOS Safari - page loads
- [ ] iOS Safari - terminal visible
- [ ] iOS Safari - touch controls work
- [ ] Android Chrome - page loads
- [ ] Android Chrome - terminal visible
- [ ] Android Chrome - touch controls work
- [ ] Portrait mode works
- [ ] Landscape mode works

**Performance:**
- [ ] Initial load < 3 seconds (4G)
- [ ] Time to interactive < 5 seconds
- [ ] No layout shift after load

### 6.4 Lint & Type Check

```bash
# Run from root
npm run lint
npm run typecheck

# Expected: 0 errors, warnings acceptable
```

---

## 7. Environment Variables

### 7.1 Web App (Vercel)

```bash
# Required for demo mode
NEXT_PUBLIC_DEMO_MODE=true

# App URL (for QR codes, meta tags)
NEXT_PUBLIC_APP_URL=https://mconnect-demo.vercel.app

# Optional analytics
NEXT_PUBLIC_ANALYTICS_ID=
```

### 7.2 CLI (Local Development)

```bash
# Opik configuration
OPIK_API_KEY=<your-api-key>
OPIK_PROJECT=mconnect-demo
OPIK_ENVIRONMENT=production
```

---

## 8. Deployment Configuration

### 8.1 Vercel Configuration

```json
// apps/web/vercel.json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "env": {
    "NEXT_PUBLIC_DEMO_MODE": "true"
  }
}
```

### 8.2 Build Commands

```bash
# Local development with demo mode
cd apps/web
NEXT_PUBLIC_DEMO_MODE=true npm run dev

# Production build
npm run build

# Type check
npm run typecheck
```

---

## 9. Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Vercel deployment fails | Test build locally first, have Netlify as backup |
| Demo data looks fake | Base on actual CLI session recording |
| Opik API unavailable | Demo mode works independently, Opik is bonus |
| Mobile UI bugs | Test early on real devices, not just simulators |
| Last-minute breaks | Code freeze 2 hours before submission |

---

## 10. Dependencies

### 10.1 No New Dependencies for Web App

Demo mode implementation uses:
- Existing React 19 context API
- Existing TypeScript
- Native `setTimeout`/`setInterval` for playback
- No additional npm packages needed

### 10.2 CLI New Dependency

```bash
cd packages/cli
npm install opik
```

---

## 11. Success Criteria

| Criteria | Target |
|----------|--------|
| Demo URL accessible | ✓ Working URL |
| Mobile responsive | ✓ iOS + Android |
| Zero console errors | ✓ Clean console |
| Load time | < 3 seconds |
| Approval flow works | ✓ Modal + buttons |
| HACKATHON.md complete | 380-420 words |
| Opik traces visible | ✓ Dashboard screenshot |

---

## 12. Implementation Order

1. **Create demo session data** (`apps/web/src/data/demo-session.ts`)
2. **Implement MockWebSocket** (`apps/web/src/lib/mock-websocket.ts`)
3. **Create DemoContext** (`apps/web/src/context/DemoContext.tsx`)
4. **Modify page.tsx** to use demo mode
5. **Add health endpoint** (`apps/web/src/app/api/health/route.ts`)
6. **Create vercel.json**
7. **Deploy to Vercel**
8. **Write HACKATHON.md**
9. **Add Opik to CLI** (if time permits)
10. **Capture screenshots**

---

## 13. Appendix: Demo Session Script

The pre-recorded demo session follows this script (from PRD):

```
Scene 1: Agent Start (0-5s)
─────────────────────────
$ mconnect start --preset single
🐬 MConnect v0.1.7
📱 Scan QR code to connect from mobile
[QR CODE DISPLAYED]
🔗 Or visit: https://demo.mconnect.dev?token=abc123
✅ Mobile connected from iPhone

Scene 2: Claude Code Working (5-30s)
────────────────────────────────────
claude> Create a simple REST API with Express

📝 I'll create a REST API with Express. Let me start...

Creating: src/index.ts
[Syntax highlighted TypeScript code appears]

Creating: src/routes/users.ts
[More code appears]

Installing dependencies...
$ npm install express @types/express

Scene 3: Approval Request (30-40s)
──────────────────────────────────
⚠️ APPROVAL REQUIRED

Command: git push origin main
Reason: Push to protected branch

[APPROVE] [DENY] [VIEW DIFF]

Scene 4: Resolution (40-50s)
────────────────────────────
✅ Approved by mobile user
$ git push origin main
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Writing objects: 100% (10/10), 2.14 KiB | 2.14 MiB/s, done.
```

This script translates to approximately 25-30 DemoFrame objects with timestamps spread across 50 seconds of playback.
