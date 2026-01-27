# LeCoder Agent Hub - Project Plan

> **Vision**: A powerful, lightweight, cross-platform multi-agent orchestration platform that enables developers to run, coordinate, and manage multiple AI coding agents securely and efficiently.

**Project Name**: `lecoder-agent-hub` (working title - open to refinement)
**Website**: `lecoder.lesearch.ai`
**License**: MIT (Open Source under LeCoder Initiative)
**Target Release**: MVP in 2-4 weeks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Design](#3-architecture-design)
4. [Technology Stack](#4-technology-stack)
5. [Feature Roadmap](#5-feature-roadmap)
6. [Implementation Phases](#6-implementation-phases)
7. [Project Structure](#7-project-structure)
8. [Acknowledgments & Inspirations](#8-acknowledgments--inspirations)

---

## 1. Executive Summary

### Problem Statement

Developers today have access to multiple AI coding agents (Claude Code, Gemini CLI, Codex, AMP Code, GitHub Copilot, etc.) but face significant challenges:

- **Fragmented Experience**: Each agent runs in isolation with its own terminal
- **Wasted Limits**: Cannot maximize usage across multiple subscriptions (Pro, Max plans)
- **Security Concerns**: Agents have unrestricted access to sensitive files and system resources
- **No Coordination**: Agents cannot collaborate or share context effectively
- **Environment Pollution**: Tools installed by agents affect the host system
- **Inconsistent Outputs**: No standardized memory or configuration across agents

### Solution

LeCoder Agent Hub provides:

1. **Unified Orchestration** - Run multiple agents in parallel from a single interface
2. **Secure Sandboxing** - Dev containers, Git worktrees, and Docker isolation
3. **Shared Memory Layer** - Git-based context sharing for deterministic outputs
4. **Cross-Platform Access** - Desktop (Tauri), TUI, CLI, and Web UI
5. **Plugin Architecture** - Easy integration of new agents
6. **Beginner-Friendly** - Opinionated defaults that "just work"

### Target Users

**Primary**: Power developers who use multiple AI coding agents daily and want to maximize their productivity and subscription limits.

**Secondary**: Teams wanting controlled multi-agent workflows, open source contributors, and AI tool enthusiasts.

---

## 2. Current State Analysis

### Existing MConnect Codebase (v0.2.0)

The current mconnect project provides a solid foundation:

**Strengths**:
- Working QR code pairing and remote terminal access
- Multi-agent support (Claude, Gemini, Codex, Aider)
- WebSocket protocol v2 with session persistence
- Input arbitration between PC and mobile
- Cloudflare tunnel integration
- SQLite-backed session storage
- Comprehensive security (tokens, rate limiting, guardrails)

**Limitations for New Vision**:
- Node.js runtime (not ideal for edge devices)
- No container/sandbox integration
- No Git worktree isolation
- Single-session focus (not multi-agent orchestration)
- No shared memory layer between agents
- Limited cross-platform distribution

### What We Keep

- WebSocket protocol concepts
- Security patterns (tokens, rate limiting)
- Session persistence patterns
- Agent type definitions
- Configuration management approach

### What We Rebuild

- Core runtime → Rust for performance and portability
- Isolation → Dev containers + Git worktrees + Docker
- UI → Tauri (desktop) + Ratatui (TUI) + React/TanStack (Web)
- Distribution → Native binaries for all platforms

---

## 3. Architecture Design

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERFACE LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Desktop App    │    TUI       │    CLI     │    Web UI     │
│  (Tauri+React)  │  (Ratatui)   │   (Clap)   │ (Next.js)     │
└────────┬────────┴──────┬───────┴─────┬──────┴───────┬───────┘
         │               │             │              │
         └───────────────┴──────┬──────┴──────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                      CORE LAYER (Rust)                       │
├─────────────────────────────────────────────────────────────┤
│  Agent Manager    │  Session Manager   │  Environment Mgr   │
│  - Lifecycle      │  - Persistence     │  - Dev Containers  │
│  - Health Check   │  - Recovery        │  - Git Worktrees   │
│  - Plugin System  │  - State Machine   │  - Docker Sandbox  │
├─────────────────────────────────────────────────────────────┤
│  Memory Layer     │  Config Manager    │  Security Module   │
│  - Git-based      │  - Hierarchical    │  - Token Auth      │
│  - Context Sync   │  - TOML/YAML       │  - Rate Limiting   │
│  - Task Tracking  │  - Profiles        │  - Guardrails      │
├─────────────────────────────────────────────────────────────┤
│  IPC Server       │  WebSocket Hub     │  Tunnel Manager    │
│  - Unix Socket    │  - Protocol v3     │  - Cloudflare      │
│  - Named Pipes    │  - Binary frames   │  - ngrok           │
└─────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                    ISOLATION LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  Level 1: Git Worktrees                                      │
│  - Branch isolation per agent                                │
│  - Shared repo, separate working directories                 │
│  - Fast creation/cleanup                                     │
├─────────────────────────────────────────────────────────────┤
│  Level 2: Dev Containers                                     │
│  - devcontainer.json spec compatible                         │
│  - Pre-configured environments                               │
│  - Tool/runtime isolation                                    │
├─────────────────────────────────────────────────────────────┤
│  Level 3: Docker Sandbox                                     │
│  - Full OS-level isolation                                   │
│  - For untrusted code execution                              │
│  - Network policy control                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Request
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   UI/CLI    │────▶│  Core Engine │────▶│  Agent Runner   │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                      │
                           ▼                      ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │ Memory Layer │◀───▶│   Environment   │
                    │   (Git)      │     │   (Container)   │
                    └──────────────┘     └─────────────────┘
```

### Workspace Hierarchy

```
~/.lecoder/                          # Global config (user level)
├── config.toml                      # User preferences
├── agents/                          # Agent plugins
│   ├── claude.toml
│   ├── gemini.toml
│   └── custom/
├── templates/                       # Environment templates
├── logs/                           # Global logs
└── registry.json                   # Session registry

/path/to/project/                   # Project level
├── .lecoder/                       # Project config
│   ├── config.toml                 # Project overrides
│   ├── agents.md                   # Agent instructions
│   ├── memory/                     # Shared memory (git-tracked)
│   │   ├── context.md              # Shared context
│   │   ├── tasks.jsonl             # Task tracking (beads-style)
│   │   └── decisions.md            # Decision log
│   └── environments/               # Environment definitions
│       └── devcontainer.json
├── .shards/                        # Worktree storage
│   ├── claude-feature-x/           # Agent 1 worktree
│   ├── gemini-refactor/            # Agent 2 worktree
│   └── codex-tests/                # Agent 3 worktree
└── ...project files
```

---

## 4. Technology Stack

### Core (Rust)

| Component | Crate | Purpose |
|-----------|-------|---------|
| CLI Framework | `clap` | Command-line parsing |
| Async Runtime | `tokio` | Async I/O |
| Terminal UI | `ratatui` + `crossterm` | TUI interface |
| Git Operations | `git2` | Worktree management |
| WebSocket | `tokio-tungstenite` | Real-time communication |
| Serialization | `serde` + `serde_json` + `toml` | Config and data |
| PTY | `portable-pty` | Terminal spawning |
| Process Mgmt | `nix` (Unix) / `windows-sys` | OS-level control |
| Logging | `tracing` + `tracing-subscriber` | Structured logs |
| Error Handling | `thiserror` + `anyhow` | Error types |
| HTTP Client | `reqwest` | API calls |
| Container | `bollard` | Docker API |
| File Watching | `notify` | Filesystem events |
| System Info | `sysinfo` | Resource monitoring |

### Desktop App (Tauri + React)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Tauri 2.0 | Native desktop wrapper |
| Frontend | React 19 + TanStack | UI framework |
| Styling | Tailwind CSS | Utility-first CSS |
| Terminal | xterm.js | Terminal emulation |
| State | Zustand | State management |
| Icons | Lucide React | Icon library |

### Web UI (Next.js)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 15 | React SSR framework |
| Router | TanStack Router | Type-safe routing |
| Terminal | xterm.js | Terminal emulation |
| Real-time | WebSocket | Live updates |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| Tunneling | Cloudflare Tunnel | Remote access |
| Containers | Docker / Podman | Sandboxing |
| Dev Containers | devcontainer spec | Environment isolation |
| Database | SQLite (embedded) | Local persistence |
| Task Tracking | JSONL (beads-style) | Git-friendly tasks |

---

## 5. Feature Roadmap

### MVP (Weeks 1-2) - Core Agent Orchestration

**Must Have**:
- [ ] Rust CLI with basic commands (`create`, `list`, `attach`, `destroy`)
- [ ] Git worktree isolation per agent
- [ ] Support for Claude Code, Gemini CLI, Codex
- [ ] Simple TUI for session management
- [ ] Local WebSocket server for UI communication
- [ ] Basic config management (TOML)
- [ ] Session persistence (SQLite)

**Documentation**:
- [ ] Landing page at lecoder.lesearch.ai
- [ ] README with installation instructions
- [ ] Quick start guide
- [ ] Agent plugin documentation

### Phase 2 (Weeks 3-4) - Enhanced Features

**Environment Isolation**:
- [ ] Dev container integration
- [ ] Docker sandbox option
- [ ] Environment templates

**Memory Layer**:
- [ ] Git-based shared context
- [ ] Task tracking (beads-style JSONL)
- [ ] Decision logging

**UI Improvements**:
- [ ] Enhanced TUI with multi-pane view
- [ ] Web UI (Next.js)
- [ ] Real-time status updates

### Phase 3 (Month 2) - Desktop & Advanced

**Desktop Application**:
- [ ] Tauri desktop app (macOS, Linux)
- [ ] System tray integration
- [ ] Keyboard shortcuts
- [ ] Native notifications

**Advanced Orchestration**:
- [ ] Master agent controlling worker agents
- [ ] Task distribution algorithms
- [ ] Dependency-aware execution
- [ ] Resource quota management

**Security Enhancements**:
- [ ] File access policies
- [ ] Network isolation rules
- [ ] Audit logging

### Phase 4 (Month 3+) - Ecosystem

**Plugin System**:
- [ ] Agent plugin SDK
- [ ] Custom agent templates
- [ ] Community plugin registry

**Enterprise Features**:
- [ ] Team collaboration
- [ ] Centralized configuration
- [ ] Usage analytics

**Platform Expansion**:
- [ ] Windows support
- [ ] Mobile companion app
- [ ] Cloud deployment option

---

## 6. Implementation Phases

### Phase 1: Foundation (Days 1-5)

**Day 1-2: Project Setup**
```bash
# Create Rust workspace
lecoder-agent-hub/
├── Cargo.toml                 # Workspace root
├── crates/
│   ├── lecoder-core/          # Core library
│   ├── lecoder-cli/           # CLI binary
│   └── lecoder-tui/           # TUI binary
├── apps/
│   ├── desktop/               # Tauri app
│   └── web/                   # Next.js app
├── docs/                      # Documentation
└── website/                   # Landing page
```

**Day 3-4: Core Primitives**
- Session types and state machine
- Git worktree operations
- Agent type definitions
- Configuration loading

**Day 5: Basic CLI**
- `lecoder create <name> --agent <type>`
- `lecoder list`
- `lecoder attach <name>`
- `lecoder destroy <name>`

### Phase 2: Agent Integration (Days 6-10)

**Day 6-7: Agent Runners**
- Claude Code integration
- Gemini CLI integration
- Codex integration
- Generic shell agent

**Day 8-9: Session Management**
- SQLite persistence
- Session recovery
- Health monitoring
- Cleanup routines

**Day 10: TUI Foundation**
- Session list view
- Status indicators
- Keyboard navigation
- Terminal attachment

### Phase 3: Isolation Layer (Days 11-14)

**Day 11-12: Git Worktree Integration**
- Worktree creation/cleanup
- Branch naming conventions
- Conflict detection
- State synchronization

**Day 13-14: Dev Container Support**
- devcontainer.json parsing
- Container lifecycle
- Volume mounting
- Network configuration

### Phase 4: UI & Distribution (Days 15-21)

**Day 15-17: Enhanced TUI**
- Multi-pane layout
- Real-time updates
- Log viewing
- Configuration panel

**Day 18-19: Web UI**
- Next.js setup
- WebSocket integration
- Terminal embedding
- Session selector

**Day 20-21: Website & Release**
- Landing page at lecoder.lesearch.ai
- Binary releases (GitHub)
- Installation scripts
- Documentation

---

## 7. Project Structure

### Rust Workspace Structure

```
lecoder-agent-hub/
├── Cargo.toml                    # Workspace definition
├── Cargo.lock
├── .github/
│   └── workflows/
│       ├── ci.yml               # Build & test
│       └── release.yml          # Binary releases
│
├── crates/
│   ├── lecoder-core/            # Core library (no CLI deps)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── agents/          # Agent management
│   │       │   ├── mod.rs
│   │       │   ├── types.rs     # AgentType, AgentConfig
│   │       │   ├── registry.rs  # Agent plugin registry
│   │       │   ├── runner.rs    # Agent execution
│   │       │   └── backends/    # Agent implementations
│   │       │       ├── claude.rs
│   │       │       ├── gemini.rs
│   │       │       ├── codex.rs
│   │       │       └── shell.rs
│   │       ├── sessions/        # Session lifecycle
│   │       │   ├── mod.rs
│   │       │   ├── types.rs     # Session, SessionState
│   │       │   ├── manager.rs   # SessionManager
│   │       │   ├── store.rs     # SQLite persistence
│   │       │   └── recovery.rs  # Crash recovery
│   │       ├── environments/    # Isolation layer
│   │       │   ├── mod.rs
│   │       │   ├── worktree.rs  # Git worktrees
│   │       │   ├── devcontainer.rs
│   │       │   ├── docker.rs    # Docker sandbox
│   │       │   └── templates.rs
│   │       ├── memory/          # Shared memory layer
│   │       │   ├── mod.rs
│   │       │   ├── context.rs   # Context management
│   │       │   ├── tasks.rs     # Task tracking
│   │       │   └── sync.rs      # Git sync
│   │       ├── config/          # Configuration
│   │       │   ├── mod.rs
│   │       │   ├── types.rs     # Config structs
│   │       │   └── loader.rs    # Hierarchical loading
│   │       ├── ws/              # WebSocket protocol
│   │       │   ├── mod.rs
│   │       │   ├── protocol.rs  # Message types
│   │       │   ├── server.rs    # WS server
│   │       │   └── client.rs    # WS client
│   │       ├── security/        # Security module
│   │       │   ├── mod.rs
│   │       │   ├── tokens.rs
│   │       │   ├── policies.rs
│   │       │   └── audit.rs
│   │       └── errors.rs        # Error types
│   │
│   ├── lecoder-cli/             # CLI binary
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       └── commands/
│   │           ├── mod.rs
│   │           ├── create.rs
│   │           ├── list.rs
│   │           ├── attach.rs
│   │           ├── destroy.rs
│   │           ├── config.rs
│   │           └── daemon.rs
│   │
│   └── lecoder-tui/             # TUI binary
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── app.rs           # App state machine
│           ├── views/
│           │   ├── mod.rs
│           │   ├── dashboard.rs
│           │   ├── sessions.rs
│           │   ├── terminal.rs
│           │   └── logs.rs
│           └── components/
│               ├── mod.rs
│               ├── status_bar.rs
│               ├── session_list.rs
│               └── agent_panel.rs
│
├── apps/
│   ├── desktop/                 # Tauri desktop app
│   │   ├── src-tauri/
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── src/
│   │   │       └── main.rs
│   │   └── src/                 # React frontend
│   │       ├── App.tsx
│   │       ├── components/
│   │       └── hooks/
│   │
│   └── web/                     # Next.js web UI
│       ├── package.json
│       └── src/
│           ├── app/
│           └── components/
│
├── website/                     # Landing page (lecoder.lesearch.ai)
│   ├── package.json
│   └── src/
│
├── docs/                        # Documentation
│   ├── getting-started.md
│   ├── architecture.md
│   ├── agents/
│   │   ├── claude.md
│   │   ├── gemini.md
│   │   └── creating-plugins.md
│   └── api/
│
├── scripts/                     # Build/release scripts
│   ├── install.sh
│   ├── build-release.sh
│   └── publish.sh
│
├── templates/                   # Environment templates
│   ├── devcontainer/
│   │   ├── rust/
│   │   ├── node/
│   │   └── python/
│   └── agents/
│       ├── claude.toml
│       └── gemini.toml
│
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── AGENTS.md                    # Agent instructions for AI
```

### Module Patterns (from Shards)

Each domain module follows this structure:

```rust
// agents/mod.rs
mod types;      // Public types
mod registry;   // Plugin registry
mod runner;     // Execution logic
mod backends;   // Agent implementations

pub use types::*;
pub use registry::AgentRegistry;
pub use runner::AgentRunner;
```

```rust
// agents/types.rs
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AgentType {
    Claude,
    Gemini,
    Codex,
    Shell,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_type: AgentType,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub working_dir: Option<PathBuf>,
}

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("Agent not found: {0}")]
    NotFound(String),
    #[error("Failed to spawn agent: {0}")]
    SpawnFailed(String),
    #[error("Agent crashed: {0}")]
    Crashed(String),
}
```

---

## 8. Acknowledgments & Inspirations

This project draws inspiration from several excellent open-source projects:

### [Ferrite](https://github.com/OlaProeis/Ferrite)
*Fast, lightweight text editor for Markdown, JSON, YAML, TOML*

**Inspirations**:
- Native Rust + egui architecture for lightweight performance
- Multi-encoding support and file format handling
- Custom memory allocators (jemalloc/mimalloc) for efficiency
- Clean modular UI component structure
- Platform-specific optimizations

### [Shards](https://github.com/Wirasm/shards)
*Parallel AI agent management in isolated Git worktrees*

**Inspirations**:
- Three-crate workspace structure (core, cli, ui)
- Git worktree isolation for agent separation
- Session registry pattern (JSON-based persistence)
- Hierarchical configuration (defaults → user → project → CLI)
- "No silent failures" error handling philosophy
- Agent backend abstraction pattern

### [Agent of Empires](https://github.com/njbrake/agent-of-empires)
*tmux-based AI agent session manager*

**Inspirations**:
- tmux as session persistence layer
- Ratatui-based TUI with home view and session tree
- Profile-based workspace isolation
- Status detection for different agent types
- Git worktree + Docker sandbox hybrid approach
- Session caching with TTL for performance

### [Beads](https://github.com/steveyegge/beads)
*Git-based task tracking for AI agents*

**Inspirations**:
- JSONL format for git-friendly task storage
- Hash-based IDs to prevent merge collisions
- Hierarchical task relationships (epic/task/subtask)
- Multi-agent coordination patterns
- Community tools ecosystem structure
- SQLite cache with background sync

### [containers.dev](https://containers.dev/)
*Development Container Specification*

**Inspirations**:
- Standardized dev environment definitions
- Feature system for composable tools
- Template system for common setups
- Integration patterns with various tools/editors

---

## Next Steps

1. **Finalize Project Name** - Confirm "lecoder-agent-hub" or choose alternative
2. **Create GitHub Repository** - Under lecoder organization
3. **Initialize Rust Workspace** - Set up crate structure
4. **Implement Core Types** - Session, Agent, Config types
5. **Build Basic CLI** - create, list, attach, destroy commands
6. **Add Claude Code Integration** - First agent backend
7. **Create Simple TUI** - Session list and status
8. **Write Documentation** - README, getting started guide
9. **Set Up Website** - Landing page at lecoder.lesearch.ai
10. **First Release** - v0.1.0 MVP

---

*This document is a living plan and will be updated as the project evolves.*

**Last Updated**: January 2026
**Author**: LeCoder Team
**Version**: Draft 1.0
