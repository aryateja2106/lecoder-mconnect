# LeCoder AgentOS - Product Requirements Document

> **Version**: 1.0 Draft
> **Last Updated**: January 2026
> **Status**: Implementation-Ready Specification
> **Product URL**: `lecoder.lesearch.ai`

---

## Document Navigation

1. [Executive Summary](#1-executive-summary)
2. [Vision & Strategy](#2-vision--strategy)
3. [User Personas & Stories](#3-user-personas--stories)
4. [Product Architecture](#4-product-architecture)
5. [Feature Specifications](#5-feature-specifications)
6. [Data Models & API Design](#6-data-models--api-design)
7. [Technical Requirements](#7-technical-requirements)
8. [Security & Privacy](#8-security--privacy)
9. [Collaboration & Sync Protocol](#9-collaboration--sync-protocol)
10. [Business Model](#10-business-model)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Success Metrics](#12-success-metrics)
13. [Appendices](#13-appendices)

---

## 1. Executive Summary

### 1.1 Product Vision

**LeCoder AgentOS** is a lightweight, secure, cross-platform operating environment for AI coding agents. It enables developers to orchestrate multiple AI agents in parallel, collaborate in real-time with teammates, and maintain complete control over their data through a local-first architecture.

Think of it as: **"Notion meets Replit meets tmux — but for AI coding agents"**

### 1.2 Problem Statement

Modern developers face significant friction when working with AI coding agents:

| Problem | Impact |
|---------|--------|
| **Fragmented Tools** | Each agent (Claude, Gemini, Codex) runs in isolation with its own terminal |
| **Wasted Subscriptions** | Cannot maximize usage across multiple Pro/Max plans |
| **No Collaboration** | Cannot share agent sessions with colleagues for pair programming or review |
| **Security Risks** | Agents have unrestricted access to sensitive files and system resources |
| **No Memory** | Agents don't share context, leading to inconsistent and non-deterministic outputs |
| **Environment Pollution** | Tools installed by agents affect the host system |
| **Device Lock-in** | Sessions tied to single machine, no cross-device continuity |

### 1.3 Solution

LeCoder AgentOS provides:

| Solution | Benefit |
|----------|---------|
| **Unified Orchestration** | Run 5+ agents in parallel from a single interface |
| **Real-Time Collaboration** | Share sessions with Notion-like permissions (view, comment, edit) |
| **Secure Sandboxing** | Layered isolation: Git worktrees → Dev containers → Docker |
| **Shared Memory Layer** | Git-based context sync for deterministic outputs |
| **Local-First Sync** | Own your data, sync across devices without cloud dependency |
| **Cross-Platform** | Desktop (macOS/Linux), TUI, CLI, and Web |
| **Open Core** | Free self-hosted, premium features for teams |

### 1.4 Key Differentiators

| Feature | AgentOS | Cursor | Windsurf | Replit |
|---------|---------|--------|----------|--------|
| Multi-agent orchestration | ✅ Native | ❌ | ❌ | ❌ |
| Real-time collaboration | ✅ Notion-like | ❌ | ❌ | ✅ |
| Local-first / self-hosted | ✅ | ❌ | ❌ | ❌ |
| Agent sandboxing | ✅ Layered | ❌ | ❌ | Partial |
| Cross-device sync | ✅ P2P | ❌ | ❌ | Cloud only |
| Open source core | ✅ MIT | ❌ | ❌ | ❌ |

### 1.5 Target Platforms (v1.0)

- **macOS** (Apple Silicon + Intel)
- **Linux** (x64, arm64)
- **Web** (Modern browsers)
- *Windows: v1.1*

---

## 2. Vision & Strategy

### 2.1 Mission Statement

> Empower every developer to harness the full potential of AI coding agents through secure, collaborative, and efficient orchestration — without sacrificing privacy or control.

### 2.2 Strategic Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│                    LECODER AGENTOS                               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   EFFICIENCY    │    SECURITY     │      COLLABORATION          │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • Multi-agent   │ • Sandboxing    │ • Real-time sharing         │
│ • Parallel exec │ • File policies │ • Permission levels         │
│ • Resource mgmt │ • Audit logs    │ • Cross-device sync         │
│ • Memory layer  │ • E2E encrypt   │ • Team workspaces           │
└─────────────────┴─────────────────┴─────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   LOCAL-FIRST     │
                    │   ARCHITECTURE    │
                    └───────────────────┘
```

### 2.3 Design Principles

1. **Local-First, Cloud-Optional**
   - Core functionality works 100% offline
   - Sync is opt-in, not required
   - Users own and control their data

2. **Lightweight & Efficient**
   - Memory target: < 50MB idle, < 200MB active (5 agents)
   - Startup time: < 2 seconds
   - Minimal dependencies

3. **Security by Default**
   - Sandboxed agents cannot access host system by default
   - Explicit permission grants for file/network access
   - All remote sync is end-to-end encrypted

4. **Progressive Disclosure**
   - Simple defaults that "just work" for beginners
   - Full configurability for power users
   - No mandatory configuration

5. **Collaboration-Native**
   - Sharing is a first-class feature, not an afterthought
   - Permissions are granular and intuitive
   - Real-time presence and awareness

6. **Plugin-First Architecture**
   - Agents are plugins, not hardcoded
   - Easy to add new agents
   - Community contribution friendly

### 2.4 Competitive Landscape

```
                    High Collaboration
                           │
              Replit       │      AgentOS
              (cloud)      │      (local-first)
                           │
    Single Agent ──────────┼────────── Multi-Agent
                           │
              Cursor       │      tmux/screen
              Windsurf     │      (manual)
                           │
                    Low Collaboration
```

---

## 3. User Personas & Stories

### 3.1 Primary Personas

#### Persona 1: Alex - The Power Developer

**Demographics**: Senior engineer, 8+ years experience, startup environment
**Behavior**: Uses Claude Code Max + Gemini Pro + GitHub Copilot
**Pain Points**:
- Constantly switching between terminals for different agents
- Hitting rate limits on one agent while another has capacity
- Cannot share agent sessions with junior developers for mentoring
**Goals**:
- Maximize productivity across all agent subscriptions
- Mentor team members by sharing live sessions
- Keep sensitive company code isolated from agents

#### Persona 2: Sam - The Team Lead

**Demographics**: Engineering manager, 12-person team, enterprise company
**Behavior**: Reviews PRs, coordinates sprints, occasional coding
**Pain Points**:
- No visibility into how team uses AI agents
- Security concerns about agents accessing proprietary code
- Difficult to standardize agent configurations across team
**Goals**:
- Provide team with secure, standardized AI tooling
- Monitor agent usage patterns
- Enable collaboration without security risks

#### Persona 3: Jordan - The Indie Hacker

**Demographics**: Solo developer, bootstrapped projects, cost-conscious
**Behavior**: Uses free tiers of multiple agents, works from multiple devices
**Pain Points**:
- Cannot continue work seamlessly across laptop and desktop
- No budget for expensive cloud sync services
- Agents make inconsistent decisions across sessions
**Goals**:
- Sync sessions between devices for free (using home server)
- Get consistent agent behavior through shared memory
- Collaborate occasionally with freelance contractors

#### Persona 4: Taylor - The Open Source Contributor

**Demographics**: Community contributor, works on multiple projects
**Behavior**: Contributes to various repos, needs isolated environments
**Pain Points**:
- Each project needs different tooling/runtime
- Agents pollute global environment with installed packages
- Hard to reproduce issues reported by others
**Goals**:
- Isolated dev containers per project
- Easily share reproducible environments
- Contribute agent configurations back to projects

### 3.2 User Stories

#### Epic 1: Agent Orchestration

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| AO-1 | As Alex, I want to run multiple agents in parallel so I can maximize my subscription limits | P0 | Can run 5+ agents simultaneously; each in separate terminal pane |
| AO-2 | As Alex, I want to create an agent with one command so I can start working quickly | P0 | `agentos create my-task --agent claude` creates and attaches in <3s |
| AO-3 | As Jordan, I want to switch between agents mid-task so I can use the best tool for each subtask | P1 | Can detach from one agent and attach to another without losing state |
| AO-4 | As Alex, I want agents to share a task list so I can coordinate complex work | P1 | Git-based task tracking visible to all agents in workspace |
| AO-5 | As Sam, I want to set resource limits per agent so one runaway agent doesn't affect others | P2 | CPU, memory, and network quotas per agent |

#### Epic 2: Real-Time Collaboration

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| CO-1 | As Alex, I want to share my agent session with a colleague so they can see what I'm working on | P0 | Generate shareable link; recipient sees real-time terminal output |
| CO-2 | As Sam, I want to set permission levels (view/comment/edit) so I control what collaborators can do | P0 | Three permission levels work correctly; can change mid-session |
| CO-3 | As Taylor, I want to see who's viewing my session so I know when help has arrived | P1 | Presence indicators show connected users with avatars/names |
| CO-4 | As Jordan, I want collaborators to leave comments on specific lines so we can discuss async | P1 | Notion-style inline comments on terminal output |
| CO-5 | As Alex, I want to hand over control to a colleague so they can drive while I watch | P1 | "Request control" / "Grant control" flow works seamlessly |

#### Epic 3: Secure Sandboxing

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| SB-1 | As Sam, I want agents to run in isolated environments so they cannot access sensitive files | P0 | Default sandbox blocks access to ~/.ssh, ~/.aws, etc. |
| SB-2 | As Taylor, I want each project to have its own dev container so dependencies don't conflict | P0 | devcontainer.json in project root is auto-detected and used |
| SB-3 | As Alex, I want to grant specific folder access to an agent so it can work on my code | P1 | Explicit allow-list for file paths; denied by default |
| SB-4 | As Sam, I want audit logs of all file operations so I can review agent behavior | P1 | Every file read/write/delete logged with timestamp |
| SB-5 | As Jordan, I want to run untrusted code in Docker so my host system stays safe | P2 | `--sandbox=docker` flag spawns agent inside container |

#### Epic 4: Cross-Device Sync

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| SY-1 | As Jordan, I want to continue a session on my other computer so I can work from anywhere | P0 | Session state syncs via local network or home server |
| SY-2 | As Jordan, I want to run a sync server on my home machine so I don't need cloud services | P0 | Docker container or background service mode available |
| SY-3 | As Alex, I want sync to be encrypted so no one can intercept my sessions | P0 | E2E encryption with device-specific keys |
| SY-4 | As Taylor, I want to sync only specific workspaces so I control what's shared | P1 | Per-workspace sync enable/disable |
| SY-5 | As Sam, I want cloud sync for the team so we don't need to manage infrastructure | P2 | Optional paid cloud relay service |

#### Epic 5: Memory & Context Layer

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| ME-1 | As Alex, I want agents to share context so they make consistent decisions | P0 | `.agentos/memory/` directory synced across agents |
| ME-2 | As Taylor, I want to define project-level agent instructions so all agents behave consistently | P0 | `AGENTS.md` file respected by all agents |
| ME-3 | As Alex, I want a decision log so I can understand why agents made certain choices | P1 | Append-only decisions.md with timestamps |
| ME-4 | As Jordan, I want task tracking that works with Git so I don't lose progress | P1 | JSONL format, auto-committed on changes |
| ME-5 | As Sam, I want to review and approve agent decisions so I maintain oversight | P2 | Decision approval workflow for sensitive operations |

#### Epic 6: User Experience

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| UX-1 | As Jordan, I want a TUI so I can work efficiently in terminal | P0 | Ratatui-based TUI with keyboard navigation |
| UX-2 | As Alex, I want a desktop app so I can use system shortcuts and notifications | P0 | Tauri app with native feel on macOS/Linux |
| UX-3 | As Sam, I want a web UI so team members don't need to install anything | P0 | Next.js web app with full functionality |
| UX-4 | As Taylor, I want CLI commands so I can script my workflows | P0 | Complete CLI with bash completion |
| UX-5 | As Alex, I want keyboard shortcuts so I can navigate quickly | P1 | Customizable vim-style and standard shortcuts |

---

## 4. Product Architecture

### 4.1 System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                                 │
├────────────────┬───────────────┬───────────────┬───────────────────────┤
│  Desktop App   │     TUI       │     CLI       │      Web UI           │
│  (Tauri+React) │  (Ratatui)    │   (Clap)      │    (Next.js)          │
└───────┬────────┴───────┬───────┴───────┬───────┴───────────┬───────────┘
        │                │               │                   │
        └────────────────┴───────┬───────┴───────────────────┘
                                 │ IPC / WebSocket
┌────────────────────────────────▼───────────────────────────────────────┐
│                         AGENTOS DAEMON (Rust)                           │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │    Agent     │  │   Session    │  │ Environment  │  │   Config    │ │
│  │   Manager    │  │   Manager    │  │   Manager    │  │   Manager   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼─────────────────▼──────┐ │
│  │                      CORE ENGINE                                   │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │ │
│  │  │  Memory    │  │  Security  │  │    Sync    │  │    Plugin    │ │ │
│  │  │   Layer    │  │   Module   │  │   Engine   │  │    System    │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  WebSocket   │  │     IPC      │  │    P2P       │  │   Tunnel    │ │
│  │    Hub       │  │   Server     │  │   Network    │  │   Manager   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────────┐
│                         ISOLATION LAYER                                 │
├────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Level 1: GIT WORKTREES (Default)                               │   │
│  │  • Branch isolation per agent/task                              │   │
│  │  • Shared repo, separate working directories                    │   │
│  │  • Fast creation (<1s), minimal overhead                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Level 2: DEV CONTAINERS (Project-based)                        │   │
│  │  • devcontainer.json spec compatible                            │   │
│  │  • Pre-configured toolchains and runtimes                       │   │
│  │  • Persistent volumes for caches                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Level 3: DOCKER SANDBOX (High Security)                        │   │
│  │  • Full OS-level isolation                                      │   │
│  │  • Network policy enforcement                                   │   │
│  │  • Resource limits (CPU, memory, disk)                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼───────────────────────────────────────┐
│                         STORAGE LAYER                                   │
├─────────────────┬──────────────────┬───────────────────────────────────┤
│    SQLite       │      Git         │           Files                    │
│  (Sessions,     │  (Memory,        │      (Workspaces,                  │
│   Registry)     │   Tasks,         │       Environments)                │
│                 │   Decisions)     │                                    │
└─────────────────┴──────────────────┴───────────────────────────────────┘
```

### 4.2 Component Descriptions

#### 4.2.1 AgentOS Daemon

The central background service that manages all operations:

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENTOS DAEMON                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Responsibilities:                                           │
│  • Agent lifecycle (spawn, monitor, terminate)               │
│  • Session persistence and recovery                          │
│  • Real-time collaboration coordination                      │
│  • Sync engine for cross-device                              │
│  • Security policy enforcement                               │
│                                                              │
│  Communication:                                              │
│  • Unix socket (local): /tmp/agentos.sock                    │
│  • WebSocket (remote): wss://localhost:7890                  │
│  • P2P (sync): libp2p or custom protocol                     │
│                                                              │
│  Memory Target: <30MB idle, <100MB with 5 agents             │
│  Startup Time: <500ms                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Agent Manager

Handles agent lifecycle and plugin system:

```rust
// Conceptual structure
pub struct AgentManager {
    agents: HashMap<AgentId, AgentHandle>,
    registry: AgentRegistry,      // Plugin registry
    resource_limits: ResourcePolicy,
    event_bus: EventBus,
}

impl AgentManager {
    pub async fn create(&self, config: AgentConfig) -> Result<AgentId>;
    pub async fn attach(&self, id: AgentId) -> Result<AgentStream>;
    pub async fn detach(&self, id: AgentId) -> Result<()>;
    pub async fn destroy(&self, id: AgentId) -> Result<()>;
    pub async fn list(&self) -> Vec<AgentInfo>;
    pub async fn health_check(&self, id: AgentId) -> HealthStatus;
}
```

#### 4.2.3 Session Manager

Handles collaboration and persistence:

```rust
pub struct SessionManager {
    store: SessionStore,          // SQLite
    active_sessions: HashMap<SessionId, Session>,
    collaborators: CollaboratorRegistry,
}

pub struct Session {
    id: SessionId,
    owner: UserId,
    agents: Vec<AgentId>,
    permissions: PermissionSet,
    connected_users: Vec<ConnectedUser>,
    scrollback: ScrollbackBuffer,
}

pub enum Permission {
    View,       // Read-only, can see terminal output
    Comment,    // Can leave inline comments
    Edit,       // Full interaction with terminal
}
```

#### 4.2.4 Environment Manager

Handles isolation layers:

```rust
pub struct EnvironmentManager {
    worktree_manager: WorktreeManager,
    devcontainer_manager: DevContainerManager,
    docker_manager: DockerManager,
}

pub enum IsolationLevel {
    None,           // Direct host access (trusted)
    Worktree,       // Git worktree (default)
    DevContainer,   // devcontainer.json
    Docker,         // Full container isolation
}

pub struct Environment {
    level: IsolationLevel,
    working_dir: PathBuf,
    allowed_paths: Vec<PathBuf>,
    env_vars: HashMap<String, String>,
    resource_limits: Option<ResourceLimits>,
}
```

#### 4.2.5 Sync Engine

Handles cross-device synchronization:

```rust
pub struct SyncEngine {
    local_node: LocalNode,
    peer_discovery: PeerDiscovery,
    sync_state: SyncState,
    encryption: E2EEncryption,
}

pub enum SyncMode {
    LocalNetwork,   // mDNS/Bonjour discovery
    HomeServer,     // Self-hosted relay
    CloudRelay,     // Premium feature
}

pub struct SyncState {
    vector_clock: VectorClock,
    pending_changes: Vec<Change>,
    peer_states: HashMap<PeerId, PeerState>,
}
```

### 4.3 Data Flow Diagrams

#### 4.3.1 Agent Creation Flow

```
User                    CLI/UI              Daemon              Environment
  │                       │                   │                     │
  │ create agent          │                   │                     │
  │──────────────────────>│                   │                     │
  │                       │ CreateAgent(cfg)  │                     │
  │                       │──────────────────>│                     │
  │                       │                   │ determine isolation │
  │                       │                   │────────────────────>│
  │                       │                   │                     │
  │                       │                   │<────────────────────│
  │                       │                   │     env_ready       │
  │                       │                   │                     │
  │                       │                   │ spawn_agent(env)    │
  │                       │                   │────────────────────>│
  │                       │                   │                     │
  │                       │<──────────────────│                     │
  │                       │   AgentCreated    │                     │
  │<──────────────────────│                   │                     │
  │   session_attached    │                   │                     │
```

#### 4.3.2 Collaboration Flow

```
Owner                   Daemon              Collaborator
  │                       │                     │
  │ share_session(perms)  │                     │
  │──────────────────────>│                     │
  │                       │                     │
  │<──────────────────────│                     │
  │   share_link          │                     │
  │                       │                     │
  │          ─ ─ ─ ─ (link shared out of band) ─ ─ ─ >│
  │                       │                     │
  │                       │    join(link)       │
  │                       │<────────────────────│
  │                       │                     │
  │                       │ verify_permissions  │
  │                       │────────────────────>│
  │                       │                     │
  │ presence_update       │<────────────────────│
  │<──────────────────────│                     │
  │                       │                     │
  │                       │ terminal_stream     │
  │                       │────────────────────>│
  │                       │                     │
  │ input (if Edit)       │ input (if Edit)     │
  │──────────────────────>│<────────────────────│
  │                       │                     │
```

#### 4.3.3 Cross-Device Sync Flow

```
Device A               Home Server           Device B
  │                       │                     │
  │ register_peer         │                     │
  │──────────────────────>│                     │
  │                       │                     │
  │                       │    register_peer    │
  │                       │<────────────────────│
  │                       │                     │
  │ push_changes(δ)       │                     │
  │──────────────────────>│                     │
  │                       │                     │
  │                       │  notify_change      │
  │                       │────────────────────>│
  │                       │                     │
  │                       │  pull_changes       │
  │                       │<────────────────────│
  │                       │                     │
  │                       │  send_changes(δ)    │
  │                       │────────────────────>│
  │                       │                     │
  │<─ ─ ─ ─ (end-to-end encrypted) ─ ─ ─ ─ ─ ─>│
```

### 4.4 Workspace Hierarchy

```
~/.agentos/                              # User-level (global)
├── config.toml                          # User preferences
├── daemon.pid                           # Daemon PID file
├── daemon.sock                          # Unix socket
├── keys/                                # Encryption keys
│   ├── device.key                       # Device private key
│   └── identity.pub                     # User identity
├── agents/                              # Agent plugin configs
│   ├── claude.toml
│   ├── gemini.toml
│   └── codex.toml
├── templates/                           # Environment templates
│   ├── devcontainer/
│   └── docker/
├── cache/                               # Sync cache
│   └── peers.db
├── logs/                                # Daemon logs
│   └── agentos.log
└── registry.db                          # SQLite: sessions, sync state

/path/to/project/                        # Project-level
├── .agentos/                            # Project config (git-tracked)
│   ├── config.toml                      # Project overrides
│   ├── agents.md                        # Agent instructions
│   ├── memory/                          # Shared memory (git-tracked)
│   │   ├── context.md                   # Persistent context
│   │   ├── tasks.jsonl                  # Task tracking
│   │   └── decisions.md                 # Decision log
│   ├── environments/                    # Environment definitions
│   │   └── devcontainer.json
│   └── skills/                          # Custom agent skills
│       └── review.md
├── .shards/                             # Worktree storage (git-ignored)
│   ├── claude-feature-auth/             # Agent 1 worktree
│   ├── gemini-refactor-db/              # Agent 2 worktree
│   └── codex-write-tests/               # Agent 3 worktree
└── ... (project files)
```

---

## 5. Feature Specifications

### 5.1 Agent Orchestration

#### 5.1.1 Supported Agents (v1.0)

| Agent | Command | Plugin ID | Status |
|-------|---------|-----------|--------|
| Claude Code | `claude` | `claude-code` | Core |
| Gemini CLI | `gemini` | `gemini-cli` | Core |
| OpenAI Codex | `codex` | `openai-codex` | Core |
| Aider | `aider` | `aider` | Plugin |
| GitHub Copilot | `gh copilot` | `gh-copilot` | Plugin |
| AMP Code | `amp` | `amp-code` | Plugin |
| OpenCode | `opencode` | `opencode` | Plugin |
| Shell (generic) | `bash`/`zsh` | `shell` | Core |
| Custom | user-defined | `custom/*` | Core |

#### 5.1.2 Agent Configuration

```toml
# ~/.agentos/agents/claude.toml
[agent]
id = "claude-code"
name = "Claude Code"
command = "claude"
args = []

[agent.detection]
# How to detect if agent is installed
check_command = "claude --version"
install_url = "https://claude.ai/code"

[agent.defaults]
# Default environment settings
isolation = "worktree"
memory_limit = "2GB"
network = true

[agent.hooks]
# Lifecycle hooks
on_start = []
on_exit = []
```

#### 5.1.3 Agent Presets

```toml
# Preset: research-spec-test
[preset]
name = "research-spec-test"
description = "Three agents: research, spec writing, testing"

[[preset.agents]]
name = "researcher"
agent = "claude-code"
instruction = "Focus on researching and understanding the problem"

[[preset.agents]]
name = "spec-writer"
agent = "gemini-cli"
instruction = "Write detailed specifications based on research"

[[preset.agents]]
name = "test-writer"
agent = "codex"
instruction = "Write comprehensive tests based on specs"
```

#### 5.1.4 CLI Commands

```bash
# Agent lifecycle
agentos create <name> [--agent <type>] [--preset <preset>] [--isolation <level>]
agentos list [--all] [--json]
agentos attach <name>
agentos detach
agentos destroy <name> [--force]
agentos restart <name>

# Session management
agentos session list
agentos session save <name>
agentos session restore <name>

# Configuration
agentos config get <key>
agentos config set <key> <value>
agentos config edit

# Daemon
agentos daemon start [--foreground]
agentos daemon stop
agentos daemon status
agentos daemon logs [--follow]

# Collaboration
agentos share <session> [--permission <level>]
agentos join <link>
agentos leave

# Sync
agentos sync status
agentos sync enable [--workspace <path>]
agentos sync disable
agentos server start [--port <port>]
```

### 5.2 Real-Time Collaboration

#### 5.2.1 Permission Model

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION LEVELS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  VIEW (Observer)                                             │
│  ├─ See terminal output in real-time                         │
│  ├─ See which agents are running                             │
│  ├─ See file tree (read-only)                                │
│  └─ See other collaborators (presence)                       │
│                                                              │
│  COMMENT (Reviewer)                                          │
│  ├─ Everything in VIEW                                       │
│  ├─ Add inline comments on terminal output                   │
│  ├─ React to output (emoji reactions)                        │
│  └─ Request control (owner must approve)                     │
│                                                              │
│  EDIT (Collaborator)                                         │
│  ├─ Everything in COMMENT                                    │
│  ├─ Send input to terminal                                   │
│  ├─ Start/stop agents                                        │
│  └─ Modify shared memory files                               │
│                                                              │
│  OWNER (Creator)                                             │
│  ├─ Everything in EDIT                                       │
│  ├─ Change permissions of others                             │
│  ├─ Kick collaborators                                       │
│  ├─ Delete session                                           │
│  └─ Transfer ownership                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.2 Sharing Mechanism

```
Share Link Format:
agentos://<session-id>/<one-time-token>?p=<permission>

Example:
agentos://a1b2c3d4/xYz789AbC?p=view

Alternative (web):
https://lecoder.lesearch.ai/join/a1b2c3d4?t=xYz789AbC&p=view
```

#### 5.2.3 Presence & Awareness

```typescript
interface Presence {
  userId: string;
  name: string;
  avatar?: string;
  permission: Permission;
  cursor?: CursorPosition;  // If editing
  lastSeen: Timestamp;
  device: DeviceInfo;
}

interface CollaborationState {
  session: SessionId;
  owner: UserId;
  collaborators: Presence[];
  activeWriter?: UserId;  // Who has input focus
  comments: Comment[];
}
```

#### 5.2.4 Inline Comments (Notion-style)

```typescript
interface Comment {
  id: CommentId;
  author: UserId;
  content: string;
  anchor: CommentAnchor;
  createdAt: Timestamp;
  replies: Comment[];
  resolved: boolean;
}

interface CommentAnchor {
  type: 'line' | 'range' | 'output-block';
  // For terminal output
  scrollbackLine?: number;
  // For file content
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
}
```

### 5.3 Secure Sandboxing

#### 5.3.1 Isolation Levels

| Level | Isolation | Performance | Use Case |
|-------|-----------|-------------|----------|
| None | No isolation | Fastest | Trusted local development |
| Worktree | Git-level | Fast | Default for most work |
| DevContainer | Container | Medium | Project-specific tooling |
| Docker | Full OS | Slower | Untrusted code, CI/CD |

#### 5.3.2 Default Security Policy

```toml
# Default security policy (can be overridden per-project)
[security]
# Files agents cannot access (glob patterns)
blocked_paths = [
  "~/.ssh/*",
  "~/.aws/*",
  "~/.gnupg/*",
  "~/.config/agentos/keys/*",
  "**/.*credentials*",
  "**/*.pem",
  "**/*.key",
  "**/secrets.*",
  "**/.env",
  "**/.env.*",
]

# Network restrictions
[security.network]
allow_outbound = true
blocked_hosts = []
allowed_hosts = []  # Empty = allow all (except blocked)

# Resource limits
[security.resources]
max_memory = "4GB"
max_cpu_percent = 80
max_disk_write = "10GB"
max_processes = 50
```

#### 5.3.3 Audit Logging

```typescript
interface AuditEvent {
  timestamp: Timestamp;
  sessionId: SessionId;
  agentId: AgentId;
  userId?: UserId;
  action: AuditAction;
  details: Record<string, any>;
  outcome: 'allowed' | 'blocked' | 'error';
}

type AuditAction =
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'network_request'
  | 'process_spawn'
  | 'env_access'
  | 'permission_change';
```

### 5.4 Cross-Device Sync

#### 5.4.1 Sync Architecture (any-sync inspired)

```
┌─────────────────────────────────────────────────────────────┐
│                    SYNC ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Local-First Principles:                                     │
│  • All data stored locally first                             │
│  • Sync is asynchronous and eventual                         │
│  • Offline-capable by default                                │
│  • Conflicts resolved via CRDT                               │
│                                                              │
│  Sync Modes:                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Local Network │  │ Home Server  │  │ Cloud Relay  │       │
│  │   (mDNS)     │  │  (Docker)    │  │  (Premium)   │       │
│  │    FREE      │  │    FREE      │  │    PAID      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  Data Encrypted:                                             │
│  • Device-specific keys                                      │
│  • Content encrypted at rest                                 │
│  • E2E encryption in transit                                 │
│  • Server cannot read content                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.4.2 What Syncs

| Data Type | Sync? | Storage | Conflict Resolution |
|-----------|-------|---------|---------------------|
| Session state | ✅ | SQLite | Last-write-wins |
| Terminal scrollback | ✅ | Append-only | Merge |
| Memory files | ✅ | Git | Git merge |
| Agent configs | ✅ | TOML | Last-write-wins |
| Comments | ✅ | JSONL | CRDT set |
| User preferences | ✅ | TOML | Last-write-wins |
| Audit logs | ✅ | Append-only | Merge |
| Credentials/keys | ❌ | Local only | N/A |

#### 5.4.3 Home Server Mode

```bash
# Start sync server
agentos server start --port 8765

# Or via Docker
docker run -d \
  --name agentos-server \
  -p 8765:8765 \
  -v agentos-data:/data \
  lecoder/agentos-server:latest

# Connect from another device
agentos sync connect <server-ip>:8765
```

#### 5.4.4 Peer Discovery

```
Local Network Discovery (mDNS):
Service: _agentos._tcp.local
TXT Records:
  - version=1.0
  - deviceId=<uuid>
  - capabilities=sync,collab
```

### 5.5 Memory & Context Layer

#### 5.5.1 Memory Structure

```
.agentos/memory/
├── context.md              # Persistent context (AGENTS.md equivalent)
├── tasks.jsonl             # Task tracking (beads-inspired)
├── decisions.md            # Decision log
├── knowledge/              # Extracted knowledge
│   ├── api-patterns.md
│   └── codebase-map.md
└── checkpoints/            # State snapshots
    └── 2026-01-23.json
```

#### 5.5.2 Task Tracking (JSONL)

```jsonl
{"id":"task-a1b2","type":"task","title":"Implement auth","status":"in_progress","agent":"claude","created":"2026-01-23T10:00:00Z"}
{"id":"task-c3d4","type":"task","title":"Write tests","status":"pending","blocks":["task-a1b2"],"created":"2026-01-23T10:05:00Z"}
{"id":"task-a1b2","type":"update","status":"completed","completed":"2026-01-23T11:30:00Z"}
```

#### 5.5.3 Decision Log Format

```markdown
# Decision Log

## 2026-01-23T10:15:00Z - Authentication Approach
**Agent**: claude
**Decision**: Use JWT with refresh tokens
**Reasoning**: Better for stateless API, industry standard
**Alternatives Considered**: Session cookies, OAuth only
**Approved By**: auto (no sensitive impact)

## 2026-01-23T11:00:00Z - Database Choice
**Agent**: gemini
**Decision**: PostgreSQL with Prisma ORM
**Reasoning**: Team familiarity, good TypeScript support
**Alternatives Considered**: MongoDB, SQLite
**Approved By**: user (infrastructure decision)
```

---

## 6. Data Models & API Design

### 6.1 Core Data Models

#### 6.1.1 Agent

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: AgentId,
    pub name: String,
    pub agent_type: AgentType,
    pub status: AgentStatus,
    pub pid: Option<u32>,
    pub environment: Environment,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentType {
    ClaudeCode,
    GeminiCli,
    Codex,
    Aider,
    Shell,
    Custom { command: String, args: Vec<String> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentStatus {
    Starting,
    Running,
    Idle,
    Waiting,  // Waiting for user input
    Paused,
    Exited { code: i32 },
    Error { message: String },
}
```

#### 6.1.2 Session

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: SessionId,
    pub name: String,
    pub owner: UserId,
    pub agents: Vec<AgentId>,
    pub workspace: PathBuf,
    pub isolation: IsolationLevel,
    pub permissions: SessionPermissions,
    pub sync_enabled: bool,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionPermissions {
    pub default: Permission,
    pub users: HashMap<UserId, Permission>,
    pub share_links: Vec<ShareLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareLink {
    pub id: String,
    pub token: String,
    pub permission: Permission,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_uses: Option<u32>,
    pub uses: u32,
}
```

#### 6.1.3 User & Identity

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: UserId,
    pub name: String,
    pub email: Option<String>,
    pub avatar: Option<String>,
    pub public_key: PublicKey,
    pub devices: Vec<Device>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: DeviceId,
    pub name: String,
    pub platform: Platform,
    pub last_seen: DateTime<Utc>,
    pub sync_enabled: bool,
}
```

#### 6.1.4 Environment

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub level: IsolationLevel,
    pub working_dir: PathBuf,
    pub worktree: Option<WorktreeInfo>,
    pub container: Option<ContainerInfo>,
    pub env_vars: HashMap<String, String>,
    pub allowed_paths: Vec<PathBuf>,
    pub blocked_paths: Vec<PathBuf>,
    pub resource_limits: ResourceLimits,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub path: PathBuf,
    pub branch: String,
    pub base_branch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub image: String,
    pub devcontainer_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub memory: Option<ByteSize>,
    pub cpu_percent: Option<u8>,
    pub disk_write: Option<ByteSize>,
    pub network_bandwidth: Option<ByteSize>,
    pub max_processes: Option<u32>,
}
```

### 6.2 WebSocket Protocol (v3)

#### 6.2.1 Message Format

```typescript
interface Message {
  type: MessageType;
  id: string;           // Unique message ID
  timestamp: number;    // Unix timestamp ms
  payload: any;
}

type MessageType =
  // Connection
  | 'auth'
  | 'auth_response'
  | 'ping'
  | 'pong'

  // Agent lifecycle
  | 'agent_create'
  | 'agent_created'
  | 'agent_attach'
  | 'agent_attached'
  | 'agent_detach'
  | 'agent_destroy'
  | 'agent_status'

  // Terminal I/O
  | 'terminal_input'
  | 'terminal_output'
  | 'terminal_resize'

  // Collaboration
  | 'session_join'
  | 'session_leave'
  | 'presence_update'
  | 'permission_change'
  | 'control_request'
  | 'control_grant'
  | 'control_revoke'

  // Comments
  | 'comment_add'
  | 'comment_reply'
  | 'comment_resolve'
  | 'comment_delete'

  // Sync
  | 'sync_request'
  | 'sync_response'
  | 'sync_push'
  | 'sync_pull'

  // Errors
  | 'error';
```

#### 6.2.2 Binary Protocol (Terminal Output)

For efficiency, terminal output uses a binary protocol:

```
+--------+--------+--------+--------+--------+--------+
| Type   | Agent  | Length          | Payload...     |
| 1 byte | 1 byte | 4 bytes (BE)    | N bytes        |
+--------+--------+--------+--------+--------+--------+

Type:
  0x01 = stdout
  0x02 = stderr
  0x03 = control sequence
  0x04 = resize
```

### 6.3 REST API (Web UI)

```yaml
openapi: 3.0.0
info:
  title: AgentOS API
  version: 1.0.0

paths:
  /api/sessions:
    get:
      summary: List sessions
      responses:
        200:
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Session'
    post:
      summary: Create session
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'

  /api/sessions/{id}:
    get:
      summary: Get session details
    delete:
      summary: Delete session

  /api/sessions/{id}/agents:
    get:
      summary: List agents in session
    post:
      summary: Create agent in session

  /api/sessions/{id}/share:
    post:
      summary: Create share link
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                permission:
                  type: string
                  enum: [view, comment, edit]
                expiresIn:
                  type: integer
                  description: Expiration in seconds

  /api/join/{token}:
    post:
      summary: Join session via share link

  /api/sync/status:
    get:
      summary: Get sync status

  /api/sync/peers:
    get:
      summary: List connected peers
```

### 6.4 IPC Protocol (Local)

```rust
// Unix socket: /tmp/agentos.sock

#[derive(Debug, Serialize, Deserialize)]
pub enum IpcRequest {
    // Daemon control
    Status,
    Shutdown,

    // Session operations
    CreateSession(CreateSessionParams),
    ListSessions,
    GetSession(SessionId),
    DeleteSession(SessionId),

    // Agent operations
    CreateAgent(SessionId, CreateAgentParams),
    ListAgents(SessionId),
    AttachAgent(AgentId),
    DetachAgent(AgentId),
    DestroyAgent(AgentId),

    // Sync operations
    SyncStatus,
    SyncEnable(PathBuf),
    SyncDisable(PathBuf),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum IpcResponse {
    Ok,
    Error(String),
    Status(DaemonStatus),
    Session(Session),
    Sessions(Vec<Session>),
    Agent(Agent),
    Agents(Vec<Agent>),
    SyncStatus(SyncStatus),
}
```

---

## 7. Technical Requirements

### 7.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daemon idle memory | < 30MB | RSS |
| Daemon with 5 agents | < 150MB | RSS |
| Startup time (daemon) | < 500ms | Cold start |
| Startup time (CLI) | < 100ms | Warm start |
| Agent creation | < 3s | Time to interactive |
| Terminal latency (local) | < 10ms | Input to output |
| Terminal latency (remote) | < 200ms | Best effort |
| Sync latency (local network) | < 100ms | Change propagation |
| WebSocket throughput | > 10MB/s | Terminal output |

### 7.2 Scalability Targets

| Metric | Target |
|--------|--------|
| Concurrent agents | 10+ per session |
| Concurrent sessions | 20+ per daemon |
| Concurrent collaborators | 10+ per session |
| Terminal scrollback | 100,000 lines |
| Sync peers | 10+ devices |

### 7.3 Reliability Requirements

| Requirement | Target |
|-------------|--------|
| Daemon uptime | 99.9% (< 8.7h downtime/year) |
| Session recovery | Automatic on daemon restart |
| Data durability | No data loss on crash |
| Graceful degradation | Offline mode functional |

### 7.4 Technology Stack

#### 7.4.1 Core (Rust)

```toml
[dependencies]
# Async runtime
tokio = { version = "1.35", features = ["full"] }

# CLI
clap = { version = "4.4", features = ["derive", "env"] }

# TUI
ratatui = "0.25"
crossterm = "0.27"

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
toml = "0.8"

# WebSocket
tokio-tungstenite = "0.21"

# Git
git2 = "0.18"

# Database
rusqlite = { version = "0.30", features = ["bundled"] }

# PTY
portable-pty = "0.8"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Crypto
ring = "0.17"
base64 = "0.21"

# System
sysinfo = "0.30"
nix = { version = "0.27", features = ["process", "signal"] }

# Docker
bollard = "0.15"

# Network
reqwest = { version = "0.11", features = ["json"] }
libp2p = { version = "0.53", optional = true }

# mDNS
mdns-sd = "0.10"
```

#### 7.4.2 Desktop (Tauri + React)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "@xterm/xterm": "^5.4.0",
    "@xterm/addon-fit": "^0.9.0",
    "@xterm/addon-web-links": "^0.10.0",
    "lucide-react": "^0.300.0",
    "tailwindcss": "^3.4.0"
  }
}
```

#### 7.4.3 Web (Next.js)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.5.0",
    "@xterm/xterm": "^5.4.0",
    "socket.io-client": "^4.7.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### 7.5 Build & Distribution

#### 7.5.1 Binary Targets

| Platform | Architecture | Format |
|----------|--------------|--------|
| macOS | x64 | .tar.gz, .dmg |
| macOS | arm64 | .tar.gz, .dmg |
| Linux | x64 | .tar.gz, .deb, .rpm, AppImage |
| Linux | arm64 | .tar.gz, .deb |

#### 7.5.2 Installation Methods

```bash
# Homebrew (macOS/Linux)
brew install lecoder/tap/agentos

# Shell script
curl -fsSL https://lecoder.lesearch.ai/install.sh | sh

# Cargo
cargo install agentos

# NPM (CLI wrapper)
npm install -g @lecoder/agentos

# Docker (server only)
docker pull lecoder/agentos-server
```

---

## 8. Security & Privacy

### 8.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Malicious agent code | Sandboxing, file access policies |
| Data exfiltration | Network policies, audit logging |
| Credential theft | Blocked paths, no access to ~/.ssh etc |
| Man-in-the-middle | E2E encryption for sync |
| Unauthorized access | Token auth, permission model |
| Session hijacking | Cryptographic session tokens |

### 8.2 Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: Authentication                                     │
│  ├─ Device identity (Ed25519 keypair)                        │
│  ├─ Session tokens (256-bit random)                          │
│  └─ Share link tokens (one-time, expiring)                   │
│                                                              │
│  Layer 2: Authorization                                      │
│  ├─ Permission model (view/comment/edit/owner)               │
│  ├─ File access policies (allow/block lists)                 │
│  └─ Network policies (host allow/block)                      │
│                                                              │
│  Layer 3: Isolation                                          │
│  ├─ Git worktrees (filesystem separation)                    │
│  ├─ Dev containers (process isolation)                       │
│  └─ Docker sandbox (full OS isolation)                       │
│                                                              │
│  Layer 4: Encryption                                         │
│  ├─ At rest: AES-256-GCM (local database)                    │
│  ├─ In transit: TLS 1.3 (WebSocket)                          │
│  └─ E2E: X25519 + ChaCha20-Poly1305 (sync)                   │
│                                                              │
│  Layer 5: Audit                                              │
│  ├─ All file operations logged                               │
│  ├─ All network requests logged                              │
│  └─ All permission changes logged                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Encryption Details

#### 8.3.1 Device Identity

```rust
// On first run, generate device keypair
pub struct DeviceIdentity {
    pub id: DeviceId,
    pub private_key: Ed25519PrivateKey,  // Never leaves device
    pub public_key: Ed25519PublicKey,    // Shared with peers
}

impl DeviceIdentity {
    pub fn generate() -> Self;
    pub fn sign(&self, data: &[u8]) -> Signature;
    pub fn verify(&self, data: &[u8], sig: &Signature) -> bool;
}
```

#### 8.3.2 Sync Encryption

```rust
// Per-workspace encryption key derived from user secret
pub fn derive_workspace_key(
    user_secret: &[u8],
    workspace_id: &WorkspaceId,
) -> SymmetricKey {
    // HKDF with workspace_id as context
}

// E2E encryption for sync
pub fn encrypt_sync_message(
    key: &SymmetricKey,
    plaintext: &[u8],
) -> Vec<u8> {
    // ChaCha20-Poly1305 AEAD
}
```

### 8.4 Privacy Principles

1. **Data Minimization**: Only collect what's needed
2. **Local Storage**: All data stored locally by default
3. **User Control**: Users can export/delete all data
4. **No Telemetry**: No analytics without explicit opt-in
5. **Transparency**: Open source, auditable code

---

## 9. Collaboration & Sync Protocol

### 9.1 Real-Time Collaboration Protocol

#### 9.1.1 State Synchronization

```
                    ┌─────────────────┐
                    │  Session State  │
                    │   (Source of    │
                    │     Truth)      │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Owner UI     │ │ Collaborator 1  │ │ Collaborator 2  │
│                 │ │     (View)      │ │     (Edit)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘

State Updates Flow:
1. Owner input → Daemon → All connected clients
2. Collaborator (Edit) input → Daemon → Verify permission → All clients
3. Terminal output → Daemon → Broadcast to all clients
```

#### 9.1.2 Operational Transform (for comments)

```typescript
// Comments use CRDT for conflict-free editing
interface CommentCRDT {
  id: string;
  lamportClock: number;
  operations: CommentOperation[];
}

type CommentOperation =
  | { type: 'insert'; position: number; char: string; }
  | { type: 'delete'; position: number; }
  | { type: 'resolve'; resolved: boolean; };
```

### 9.2 Cross-Device Sync Protocol

#### 9.2.1 Sync Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    SYNC PROTOCOL FLOW                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. DISCOVERY                                                 │
│     Device A ──── mDNS query ────> Local Network              │
│     Device A <─── mDNS response ── Device B                   │
│                                                               │
│  2. HANDSHAKE                                                 │
│     Device A ──── public_key ────> Device B                   │
│     Device A <─── public_key ────  Device B                   │
│     (Verify via out-of-band confirmation)                     │
│                                                               │
│  3. KEY EXCHANGE                                              │
│     Derive shared secret via X25519 ECDH                      │
│     Derive session keys via HKDF                              │
│                                                               │
│  4. SYNC STATE                                                │
│     Device A ──── vector_clock ──> Device B                   │
│     Device A <─── vector_clock ──  Device B                   │
│     Compare, identify deltas                                  │
│                                                               │
│  5. DATA TRANSFER                                             │
│     Device A ──── encrypted_delta ──> Device B                │
│     Device A <─── encrypted_delta ──  Device B                │
│     Apply changes, update clocks                              │
│                                                               │
│  6. CONTINUOUS SYNC                                           │
│     Subscribe to changes                                      │
│     Push deltas as they occur                                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### 9.2.2 Conflict Resolution

```rust
pub enum ConflictResolution {
    // For non-critical data (preferences)
    LastWriteWins {
        timestamp: DateTime<Utc>,
        device_id: DeviceId,
    },

    // For structured data (tasks)
    Merge {
        base: Value,
        ours: Value,
        theirs: Value,
    },

    // For Git-tracked files
    GitMerge {
        strategy: MergeStrategy,
    },

    // For append-only logs
    AppendAll,
}
```

### 9.3 Home Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HOME SERVER (Docker)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 agentos-server                        │    │
│  │                                                       │    │
│  │  • Sync relay (encrypted pass-through)               │    │
│  │  • Peer discovery registry                           │    │
│  │  • Connection broker (NAT traversal)                 │    │
│  │  • Optional: data backup (encrypted)                 │    │
│  │                                                       │    │
│  │  Memory: < 50MB                                       │    │
│  │  Storage: Minimal (only relay, no content storage)    │    │
│  │                                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Ports:                                                      │
│  • 8765: WebSocket (sync)                                   │
│  • 8766: HTTP (API, optional web UI)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Business Model

### 10.1 Open Core Model

```
┌─────────────────────────────────────────────────────────────┐
│                    OPEN CORE MODEL                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FREE (MIT License)                        PREMIUM           │
│  ──────────────────                        ───────           │
│  • All core features                       • Cloud sync      │
│  • CLI, TUI, Desktop, Web                  • Team workspace  │
│  • Multi-agent orchestration               • Priority support│
│  • Sandboxing (all levels)                 • SLA guarantee   │
│  • Local network sync                      • Advanced audit  │
│  • Home server (self-hosted)               • SSO/SAML        │
│  • Collaboration (real-time)               • Admin dashboard │
│  • Plugin system                           • Custom branding │
│  • All agent integrations                  • Compliance      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 10.2 Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Community** | Free | All core features, self-hosted sync |
| **Pro** | $10/mo | Cloud sync, 5 devices, priority support |
| **Team** | $20/user/mo | Team workspace, admin dashboard, SSO |
| **Enterprise** | Custom | On-prem, compliance, dedicated support |

### 10.3 Revenue Projections

| Milestone | Timeline | Target |
|-----------|----------|--------|
| Launch | Month 1 | 1,000 downloads |
| Traction | Month 3 | 5,000 users, $5k MRR |
| Growth | Month 6 | 20,000 users, $25k MRR |
| Scale | Year 1 | 100,000 users, $150k MRR |

---

## 11. Implementation Roadmap

### 11.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PHASES                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PHASE 1: Foundation (Weeks 1-2)                             │
│  ├─ Rust workspace setup                                     │
│  ├─ Core types and traits                                    │
│  ├─ Basic CLI (create, list, attach, destroy)                │
│  ├─ Agent runner (Claude, Gemini, Codex)                     │
│  └─ Simple TUI (session list)                                │
│                                                              │
│  PHASE 2: Isolation (Weeks 3-4)                              │
│  ├─ Git worktree integration                                 │
│  ├─ Dev container support                                    │
│  ├─ Security policies                                        │
│  └─ Audit logging                                            │
│                                                              │
│  PHASE 3: Collaboration (Weeks 5-6)                          │
│  ├─ WebSocket protocol v3                                    │
│  ├─ Share links and permissions                              │
│  ├─ Real-time presence                                       │
│  └─ Inline comments                                          │
│                                                              │
│  PHASE 4: Sync (Weeks 7-8)                                   │
│  ├─ Local network discovery                                  │
│  ├─ Sync protocol implementation                             │
│  ├─ Home server mode                                         │
│  └─ E2E encryption                                           │
│                                                              │
│  PHASE 5: Polish (Weeks 9-10)                                │
│  ├─ Desktop app (Tauri)                                      │
│  ├─ Web UI (Next.js)                                         │
│  ├─ Documentation                                            │
│  └─ Website launch                                           │
│                                                              │
│  PHASE 6: Launch (Weeks 11-12)                               │
│  ├─ Beta testing                                             │
│  ├─ Bug fixes                                                │
│  ├─ Performance optimization                                 │
│  └─ v1.0 release                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Detailed Task Breakdown

#### Phase 1: Foundation (Weeks 1-2)

**Week 1: Core Infrastructure**

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P1-001 | Initialize Rust workspace with 3 crates | 2h | None |
| P1-002 | Define core types (Agent, Session, etc.) | 4h | P1-001 |
| P1-003 | Implement config loading (TOML) | 3h | P1-002 |
| P1-004 | Set up SQLite database schema | 3h | P1-002 |
| P1-005 | Implement daemon lifecycle | 4h | P1-003 |
| P1-006 | Add Unix socket IPC | 4h | P1-005 |
| P1-007 | Implement PTY management | 6h | P1-005 |
| P1-008 | Basic agent spawning | 4h | P1-007 |

**Week 2: CLI & TUI**

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P1-009 | CLI command structure (clap) | 3h | P1-006 |
| P1-010 | Implement `create` command | 3h | P1-008, P1-009 |
| P1-011 | Implement `list` command | 2h | P1-009 |
| P1-012 | Implement `attach` command | 4h | P1-010 |
| P1-013 | Implement `destroy` command | 2h | P1-010 |
| P1-014 | Basic TUI layout (ratatui) | 4h | P1-011 |
| P1-015 | Session list view | 3h | P1-014 |
| P1-016 | Terminal pane in TUI | 6h | P1-012, P1-015 |
| P1-017 | Claude Code plugin | 2h | P1-008 |
| P1-018 | Gemini CLI plugin | 2h | P1-008 |
| P1-019 | Codex plugin | 2h | P1-008 |

#### Phase 2: Isolation (Weeks 3-4)

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P2-001 | Git worktree creation | 4h | Phase 1 |
| P2-002 | Worktree cleanup on destroy | 2h | P2-001 |
| P2-003 | Branch naming conventions | 2h | P2-001 |
| P2-004 | Dev container detection | 3h | Phase 1 |
| P2-005 | Dev container lifecycle | 6h | P2-004 |
| P2-006 | Volume mounting | 4h | P2-005 |
| P2-007 | Security policy parser | 3h | Phase 1 |
| P2-008 | File access enforcement | 6h | P2-007 |
| P2-009 | Network policy enforcement | 4h | P2-007 |
| P2-010 | Audit log implementation | 4h | P2-008 |
| P2-011 | Docker sandbox mode | 6h | P2-005 |

#### Phase 3: Collaboration (Weeks 5-6)

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P3-001 | WebSocket server setup | 4h | Phase 1 |
| P3-002 | Protocol v3 message types | 4h | P3-001 |
| P3-003 | Binary terminal protocol | 4h | P3-002 |
| P3-004 | Authentication flow | 4h | P3-002 |
| P3-005 | Share link generation | 3h | P3-004 |
| P3-006 | Permission verification | 4h | P3-005 |
| P3-007 | Presence tracking | 4h | P3-004 |
| P3-008 | Presence broadcast | 3h | P3-007 |
| P3-009 | Control request/grant | 4h | P3-006 |
| P3-010 | Comment data model | 3h | Phase 1 |
| P3-011 | Comment CRDT | 6h | P3-010 |
| P3-012 | Comment WebSocket messages | 4h | P3-011 |

#### Phase 4: Sync (Weeks 7-8)

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P4-001 | Peer discovery (mDNS) | 6h | Phase 1 |
| P4-002 | Device identity generation | 4h | Phase 1 |
| P4-003 | Key exchange (X25519) | 4h | P4-002 |
| P4-004 | Sync message encryption | 4h | P4-003 |
| P4-005 | Vector clock implementation | 4h | Phase 1 |
| P4-006 | Delta calculation | 6h | P4-005 |
| P4-007 | Conflict resolution | 6h | P4-006 |
| P4-008 | Sync state persistence | 4h | P4-006 |
| P4-009 | Home server Docker image | 4h | P3-001 |
| P4-010 | Server relay mode | 4h | P4-009 |

#### Phase 5: Polish (Weeks 9-10)

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P5-001 | Tauri project setup | 4h | Phase 3 |
| P5-002 | React UI shell | 6h | P5-001 |
| P5-003 | Session management UI | 6h | P5-002 |
| P5-004 | Terminal component | 8h | P5-002 |
| P5-005 | Collaboration UI | 6h | P5-004 |
| P5-006 | Next.js project setup | 4h | Phase 3 |
| P5-007 | Web terminal | 6h | P5-006 |
| P5-008 | Web collaboration | 6h | P5-007 |
| P5-009 | Landing page design | 8h | None |
| P5-010 | Documentation site | 6h | None |
| P5-011 | Installation scripts | 4h | Phase 4 |

#### Phase 6: Launch (Weeks 11-12)

| Task | Description | Estimate | Dependencies |
|------|-------------|----------|--------------|
| P6-001 | Beta user recruitment | 4h | Phase 5 |
| P6-002 | Beta testing coordination | 20h | P6-001 |
| P6-003 | Bug triage and fixes | 40h | P6-002 |
| P6-004 | Performance profiling | 8h | Phase 5 |
| P6-005 | Memory optimization | 8h | P6-004 |
| P6-006 | Release automation | 6h | Phase 5 |
| P6-007 | v1.0 release | 4h | P6-003 |
| P6-008 | Launch announcement | 4h | P6-007 |

### 11.3 Acceptance Criteria

#### P1: Foundation

```gherkin
Feature: Agent Lifecycle
  Scenario: Create and attach to Claude Code agent
    Given the daemon is running
    When I run "agentos create my-task --agent claude"
    Then a new agent should be created within 3 seconds
    And I should be attached to the agent's terminal
    And I should see Claude Code's prompt

  Scenario: List running agents
    Given I have 3 agents running
    When I run "agentos list"
    Then I should see all 3 agents with their status
    And each agent should show name, type, status, and uptime
```

#### P2: Isolation

```gherkin
Feature: Git Worktree Isolation
  Scenario: Agent runs in isolated worktree
    Given I am in a Git repository
    When I create an agent with worktree isolation
    Then a new worktree should be created in .shards/
    And the agent should be working in the worktree
    And changes should not affect the main branch

Feature: Security Policies
  Scenario: Agent cannot access blocked paths
    Given an agent is running with default security policy
    When the agent tries to read ~/.ssh/id_rsa
    Then the read should be blocked
    And an audit log entry should be created
```

#### P3: Collaboration

```gherkin
Feature: Session Sharing
  Scenario: Share session with view permission
    Given I have an active session
    When I run "agentos share my-session --permission view"
    Then I should receive a share link
    And when a collaborator uses the link
    Then they should see my terminal in real-time
    But they should not be able to send input

Feature: Inline Comments
  Scenario: Add comment to terminal output
    Given I am viewing a shared session with comment permission
    When I select a line of output and add a comment
    Then the session owner should see the comment
    And the comment should be anchored to that line
```

#### P4: Sync

```gherkin
Feature: Cross-Device Sync
  Scenario: Continue session on another device
    Given I have a session on Device A
    And sync is enabled
    When I open AgentOS on Device B
    Then I should see the same session
    And terminal scrollback should be synchronized

Feature: Home Server
  Scenario: Devices sync through home server
    Given I am running agentos-server in Docker
    And Device A is connected to the server
    And Device B is connected to the server
    When I make changes on Device A
    Then Device B should receive the changes
    And all data should be encrypted end-to-end
```

---

## 12. Success Metrics

### 12.1 Launch Metrics (Month 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Downloads | 1,000 | GitHub releases |
| GitHub stars | 500 | Repository |
| Active users | 300 | DAU (daemon ping) |
| Agents created | 5,000 | Aggregate |
| Documentation views | 10,000 | Analytics |

### 12.2 Growth Metrics (Month 3)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly active users | 3,000 | MAU |
| Collaboration sessions | 500/week | Created |
| Pro subscribers | 100 | Stripe |
| Community plugins | 10 | Published |
| Discord members | 500 | Server |

### 12.3 Scale Metrics (Year 1)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Monthly active users | 50,000 | MAU |
| Pro subscribers | 2,000 | MRR target: $20k |
| Team workspaces | 100 | Organizations |
| Community plugins | 50 | Published |
| GitHub contributors | 30 | Unique |

### 12.4 Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Crash rate | < 0.1% | Sessions |
| P95 latency (local) | < 50ms | Terminal I/O |
| Memory usage | < 150MB | With 5 agents |
| MTTR (issues) | < 48h | GitHub |
| Test coverage | > 80% | Core crate |

---

## 13. Appendices

### Appendix A: Naming Conventions

#### A.1 Code Conventions

```rust
// Crate names: lowercase with hyphens
agentos-core
agentos-cli
agentos-tui

// Module names: lowercase with underscores
agent_manager
session_store

// Types: PascalCase
pub struct AgentConfig { }
pub enum AgentStatus { }

// Functions: snake_case
pub fn create_agent() { }
pub async fn attach_to_session() { }

// Constants: SCREAMING_SNAKE_CASE
const MAX_AGENTS: usize = 10;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
```

#### A.2 File Conventions

```
~/.agentos/              # User config directory
.agentos/                # Project config directory
.shards/                 # Worktree storage
agentos.sock             # Unix socket
agentos.pid              # PID file
agentos.log              # Log file
```

#### A.3 CLI Conventions

```bash
# Command structure
agentos <command> [subcommand] [options] [arguments]

# Common flags
--verbose, -v           # Increase verbosity
--quiet, -q             # Suppress output
--json                  # Output as JSON
--help, -h              # Show help
--version, -V           # Show version

# Environment variables
AGENTOS_HOME            # Config directory
AGENTOS_LOG_LEVEL       # Log verbosity
AGENTOS_SOCKET          # Socket path
```

### Appendix B: Error Codes

| Code | Name | Description |
|------|------|-------------|
| E001 | DAEMON_NOT_RUNNING | Daemon is not running |
| E002 | SESSION_NOT_FOUND | Session does not exist |
| E003 | AGENT_NOT_FOUND | Agent does not exist |
| E004 | AGENT_SPAWN_FAILED | Failed to spawn agent |
| E005 | WORKTREE_CREATE_FAILED | Failed to create worktree |
| E006 | PERMISSION_DENIED | Insufficient permissions |
| E007 | AUTH_FAILED | Authentication failed |
| E008 | SYNC_CONFLICT | Sync conflict detected |
| E009 | NETWORK_ERROR | Network operation failed |
| E010 | CONFIG_INVALID | Configuration is invalid |

### Appendix C: Configuration Reference

```toml
# ~/.agentos/config.toml

[daemon]
socket_path = "/tmp/agentos.sock"
log_level = "info"
log_file = "~/.agentos/logs/agentos.log"

[session]
default_isolation = "worktree"
scrollback_lines = 10000
auto_save_interval = 60

[security]
blocked_paths = [
  "~/.ssh/*",
  "~/.aws/*",
  "~/.gnupg/*",
]

[security.resources]
max_memory = "4GB"
max_cpu_percent = 80

[collaboration]
default_permission = "view"
max_collaborators = 10

[sync]
enabled = false
mode = "local_network"  # local_network | home_server | cloud

[sync.home_server]
address = ""
port = 8765

[ui]
theme = "dark"
font_family = "JetBrains Mono"
font_size = 14

[agents.claude]
command = "claude"
args = []

[agents.gemini]
command = "gemini"
args = []

[agents.codex]
command = "codex"
args = []
```

### Appendix D: Acknowledgments & Inspirations

| Project | Inspiration | License |
|---------|-------------|---------|
| [Ferrite](https://github.com/OlaProeis/Ferrite) | Lightweight Rust architecture, memory optimization | MIT |
| [Shards](https://github.com/Wirasm/shards) | Git worktree isolation, module structure | MIT |
| [Agent of Empires](https://github.com/njbrake/agent-of-empires) | tmux integration, TUI patterns | MIT |
| [Beads](https://github.com/steveyegge/beads) | JSONL task tracking, Git-based memory | MIT |
| [any-sync](https://github.com/anyproto/any-sync) | P2P sync protocol, E2E encryption | MIT |
| [Notion](https://notion.so) | Collaboration UX, permission model | Proprietary |
| [Replit](https://replit.com) | Real-time collaboration on code | Proprietary |

---

*This PRD is a living document. Version history is tracked in Git.*

**Document Version**: 1.0.0
**Last Updated**: January 2026
**Authors**: LeCoder Team
**Status**: Ready for Implementation
