# MConnect v0.1.2 - Multi-Agent Terminal Control

## Vision

**"Spin up multiple AI agents, go for a walk, and manage them from your phone"**

### User Story
1. Navigate to knowledge base folder
2. Spin up 3 agents (Research, Spec Writer, Test Writer)
3. Go on a walk
4. Monitor progress, provide input when needed
5. Come home, consolidate outputs, build POC

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     MConnect Server                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Session Manager                        ││
│  │  - Creates/manages tmux sessions                        ││
│  │  - Spawns agents in separate panes/windows              ││
│  │  - Routes I/O via node-pty                              ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   WebSocket Hub                          ││
│  │  - Multiplexes terminal streams                         ││
│  │  - Handles authentication                               ││
│  │  - Routes messages to correct agent                     ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Agent 1     │ │ Agent 2     │ │ Agent 3     │           │
│  │ (Research)  │ │ (Spec)      │ │ (Tests)     │           │
│  │ node-pty    │ │ node-pty    │ │ node-pty    │           │
│  │ tmux pane 0 │ │ tmux pane 1 │ │ tmux pane 2 │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Cloudflare Tunnel
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mobile Web Client                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Agent Tabs: [Research] [Spec] [Tests] [+]              ││
│  ├─────────────────────────────────────────────────────────┤│
│  │                                                          ││
│  │              xterm.js Terminal View                      ││
│  │              (Full PTY emulation)                        ││
│  │                                                          ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  [Ctrl] [Tab] [Esc] [↑] [↓] [←] [→] [^C] [^D] [^Z]     ││
│  │  [$_________________________] [Run]                      ││
│  │  [Read-Only] [INPUT]                    [KILL ^C]       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. PTY Manager (`pty-manager.ts`)
- Uses `node-pty` for true PTY emulation
- Creates PTY instances for each agent
- Handles resize, input/output streaming
- Manages PTY lifecycle

### 2. Tmux Integration (`tmux-manager.ts`)
- Creates tmux session for the MConnect instance
- Manages windows/panes for multiple agents
- Enables session persistence (survives disconnects)
- Provides split-view on server terminal

### 3. Agent Manager (`agent-manager.ts`)
- Spawns AI agents (Claude, Gemini, Aider, etc.)
- Tracks agent state (running, idle, waiting for input)
- Handles agent-specific configurations
- Manages agent lifecycle (start, stop, restart)

### 4. WebSocket Hub (`ws-hub.ts`)
- Multiplexes multiple PTY streams
- Routes messages: `{ agentId, type, payload }`
- Handles authentication per connection
- Broadcasts to all clients or specific agent views

### 5. Mobile Web Client (`web-client.ts`)
- Tab-based UI for multiple agents
- Full xterm.js terminal per agent
- Touch-optimized shortcuts
- Status indicators per agent

---

## Implementation Plan

### Phase 1: Core Infrastructure (Priority)

#### 1.1 Setup node-pty properly
```bash
# Requires native compilation - user must have:
# - Node.js with node-gyp
# - Python 3
# - C++ compiler (Xcode on macOS, build-essential on Linux)
```

**Files to create:**
- `packages/cli/src/pty/pty-manager.ts` - PTY wrapper
- `packages/cli/src/pty/types.ts` - Type definitions

#### 1.2 Tmux Integration
**Files to create:**
- `packages/cli/src/tmux/tmux-manager.ts` - Tmux session management
- `packages/cli/src/tmux/types.ts` - Type definitions

**Tmux session structure:**
```
mconnect-{sessionId}
├── window 0: "agents"
│   ├── pane 0: Agent 1 (e.g., claude for research)
│   ├── pane 1: Agent 2 (e.g., claude for spec)
│   └── pane 2: Agent 3 (e.g., claude for tests)
└── window 1: "logs" (optional - server logs)
```

#### 1.3 Agent Manager
**Files to create:**
- `packages/cli/src/agents/agent-manager.ts` - Agent lifecycle
- `packages/cli/src/agents/agent-instance.ts` - Single agent wrapper
- `packages/cli/src/agents/types.ts` - Type definitions

### Phase 2: WebSocket Multiplexing

#### 2.1 WebSocket Hub
**Files to modify/create:**
- `packages/cli/src/ws/ws-hub.ts` - New multiplexed WebSocket server
- `packages/cli/src/ws/types.ts` - Message types

**Message Protocol:**
```typescript
// Client -> Server
{ type: 'input', agentId: string, data: string }
{ type: 'resize', agentId: string, cols: number, rows: number }
{ type: 'create_agent', config: AgentConfig }
{ type: 'kill_agent', agentId: string }
{ type: 'switch_agent', agentId: string }

// Server -> Client
{ type: 'output', agentId: string, data: string }
{ type: 'agent_created', agent: AgentInfo }
{ type: 'agent_exited', agentId: string, code: number }
{ type: 'agent_list', agents: AgentInfo[] }
{ type: 'error', message: string }
```

### Phase 3: Multi-Agent Web Client

#### 3.1 Tab-based UI
**Features:**
- Agent tabs at top (swipeable on mobile)
- Each tab has its own xterm.js instance
- Badge indicators for activity/status
- "+" button to spawn new agent

#### 3.2 Agent Status
- 🟢 Running (actively outputting)
- 🟡 Idle (waiting for input)
- 🔴 Exited
- ⏳ Starting

### Phase 4: CLI Wizard Updates

#### 4.1 Multi-agent wizard flow
```
┌  LeCoder MConnect v0.1.2
│
◇  How many agents do you want to start?
│  ○ 1 (Single agent)
│  ● 3 (Research + Spec + Tests)
│  ○ Custom number
│
◇  Configure Agent 1 (Research):
│  Agent: Claude Code
│  Task prompt: "Research best practices for..."
│
◇  Configure Agent 2 (Spec):
│  Agent: Claude Code
│  Task prompt: "Write a specification for..."
│
◇  Configure Agent 3 (Tests):
│  Agent: Claude Code
│  Task prompt: "Create test cases for..."
│
◇  Working directory: /path/to/project
│
◇  Start session?
│  Yes
```

---

## File Structure (v0.1.2)

```
packages/cli/src/
├── index.ts              # CLI entry point (updated)
├── session.ts            # Session orchestrator (refactored)
├── pty/
│   ├── pty-manager.ts    # NEW: PTY management
│   ├── pty-instance.ts   # NEW: Single PTY wrapper
│   └── types.ts          # NEW: PTY types
├── tmux/
│   ├── tmux-manager.ts   # NEW: Tmux integration
│   └── types.ts          # NEW: Tmux types
├── agents/
│   ├── agent-manager.ts  # NEW: Multi-agent management
│   ├── agent-instance.ts # NEW: Single agent wrapper
│   ├── agents.ts         # EXISTING: Agent configs
│   └── types.ts          # NEW: Agent types
├── ws/
│   ├── ws-hub.ts         # NEW: WebSocket multiplexer
│   └── types.ts          # NEW: WS message types
├── web/
│   ├── web-client.ts     # UPDATED: Multi-tab UI
│   └── components/       # NEW: UI components as strings
├── security/
│   ├── security.ts       # EXISTING
│   └── guardrails.ts     # EXISTING
└── tunnel/
    └── tunnel.ts         # EXISTING
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "node-pty": "^1.0.0"
  }
}
```

**System Requirements:**
- tmux installed (`brew install tmux` / `apt install tmux`)
- node-gyp build tools for node-pty

---

## Migration Path

### From v0.1.1 to v0.1.2:
1. Keep existing security, guardrails, tunnel modules
2. Replace `session.ts` spawn logic with PTY manager
3. Add tmux integration layer
4. Update web client for multi-agent tabs
5. Update CLI wizard for multi-agent setup

---

## Testing Strategy

### Unit Tests:
- PTY manager (mocked node-pty)
- Tmux manager (mocked exec)
- Agent manager
- WebSocket hub message routing

### Integration Tests:
- Full PTY I/O flow
- Multi-agent creation/destruction
- WebSocket multiplexing

### E2E Tests:
- CLI wizard flow
- Mobile web client interaction
- Agent switching

---

## Success Criteria

1. ✅ Can spawn 3+ agents simultaneously
2. ✅ Each agent runs in true PTY (full terminal emulation)
3. ✅ Can switch between agents on mobile
4. ✅ Can send input to specific agent
5. ✅ All agents visible in tmux on server
6. ✅ Session survives temporary disconnects
7. ✅ Works with Claude Code, Aider, shell, etc.

---

## Open Questions

1. **Agent task prompts**: Should we auto-send initial prompts to agents?
2. **Tmux vs separate PTYs**: Use tmux for visual server view, or just separate PTYs?
3. **Session persistence**: Should sessions survive CLI restart?
4. **Resource limits**: Max agents per session?

---

## Implementation Status

### ✅ Completed:
1. [x] **PTY Manager** (`src/pty/pty-manager.ts`) - Wraps node-pty for true terminal emulation
2. [x] **Tmux Manager** (`src/tmux/tmux-manager.ts`) - Server-side visualization
3. [x] **Agent Manager** (`src/agents/agent-manager.ts`) - Multi-agent lifecycle control
4. [x] **WebSocket Hub** (`src/ws/ws-hub.ts`) - Multiplexed message routing
5. [x] **Web Client v2** (`src/web/web-client-v2.ts`) - Tab-based multi-agent UI
6. [x] **CLI v2** (`src/index-v2.ts`) - Multi-agent wizard with presets
7. [x] **Session v2** (`src/session-v2.ts`) - Orchestration layer
8. [x] **Setup script** (`scripts/setup-pty.sh`) - Dependency installer
9. [x] **Type definitions** for all new modules

### ⏳ Pending:
- [ ] Unit tests for new modules
- [ ] Integration tests
- [ ] Documentation updates

---

## Getting Started (On Your Machine)

### macOS Setup:

```bash
# 1. Navigate to project
cd /Users/aryateja/Desktop/Claude-WorkOnMac/Projects-Jan-2026/lecoder-mconnect

# 2. Run the setup script (checks deps, installs node-pty, tmux)
chmod +x scripts/setup-pty.sh
./scripts/setup-pty.sh

# 3. Build v0.1.2
npm run build:v2

# 4. Run v0.1.2
npm run cli:v2
```

### Available Commands:

| Command | Description |
|---------|-------------|
| `npm run setup` | Run setup script (install dependencies) |
| `npm run build:v2` | Build MConnect v0.1.2 |
| `npm run cli:v2` | Run MConnect v0.1.2 |
| `npm run dev:v2` | Dev mode with hot reload |
| `npm run cli` | Run v0.1.1 (single-agent fallback) |
| `npm run test:cli` | Run tests |

### Presets:

| Preset | Agents | Use Case |
|--------|--------|----------|
| `single` | 1 | Quick single agent session |
| `research-spec-test` | 3 | Research + Spec + Tests parallel |
| `dev-review` | 2 | Development + Code Review |
| `shell-only` | 1 | Interactive terminal only |
| `custom` | N | Configure manually |

---

## New File Structure

```
packages/cli/src/
├── index.ts              # v0.1.1 entry (unchanged)
├── index-v2.ts           # v0.1.2 entry (NEW)
├── session.ts            # v0.1.1 session (unchanged)
├── session-v2.ts         # v0.1.2 session (NEW)
├── pty/
│   ├── index.ts
│   ├── pty-manager.ts    # PTY management
│   └── types.ts          # PTY types
├── tmux/
│   ├── index.ts
│   ├── tmux-manager.ts   # Tmux integration
│   └── types.ts          # Tmux types
├── agents/
│   ├── index.ts
│   ├── agent-manager.ts  # Multi-agent management
│   └── types.ts          # Agent types & presets
├── ws/
│   ├── index.ts
│   ├── ws-hub.ts         # WebSocket multiplexer
│   └── types.ts          # Message protocol types
├── web/
│   ├── index.ts
│   └── web-client-v2.ts  # Multi-tab mobile UI
├── security.ts           # (unchanged)
├── guardrails.ts         # (unchanged)
├── tunnel.ts             # (unchanged)
└── web-client.ts         # v0.1.1 web client (unchanged)
```

---

*Plan created: January 15, 2026*
*Implementation completed: January 15, 2026*
*Target: MConnect v0.1.2*
