# MConnect V2 - Product Requirements Document

## Document Info
- **Version:** 1.0
- **Created:** 2026-02-05
- **Status:** Draft for Review

---

## 1. Executive Summary

MConnect V2 is a complete rebuild of the MConnect terminal-in-your-pocket platform, introducing a native iOS application, containerized agent runtime, MCP protocol support, and enterprise-grade observability. This document defines the requirements for the V2 platform architecture.

---

## 2. Problem Statement

### 2.1 Current V1 Limitations

MConnect V1 (v0.1.7) has proven the core concept but has fundamental limitations preventing enterprise adoption:

| Category | Limitation | Impact |
|----------|-----------|--------|
| **Client** | Web-only mobile client (xterm.js embedded HTML) | No offline support, limited native integration, poor keyboard experience on iOS |
| **Architecture** | Single-machine server model | No distributed execution, no session migration, no team features |
| **Security** | Simple token-based auth | No SSO integration, no fine-grained permissions, no audit compliance |
| **Observability** | File-based logging only | No metrics, no tracing, no centralized monitoring |
| **Agent Runtime** | Shell-first, optional Docker | No standardized agent interface, no MCP protocol, no agent-to-agent communication |
| **Protocol** | Custom WebSocket v1/v2 protocol | Not standardized, no schema validation, no versioning strategy |
| **Daemon** | Incomplete v0.2 alpha | Session management stubbed, no supervision, no hot reload |

### 2.2 Why Rebuild vs Iterate

V1's architecture assumes a local, single-user deployment model. The fundamental changes required for V2 (iOS native client, OAuth, MCP, distributed sessions) would require rewriting core subsystems:

- **WebSocket Hub:** Needs complete redesign for MCP protocol
- **Session Management:** Needs distributed backend (not SQLite)
- **Agent Manager:** Needs container orchestration, not just Docker exec
- **Security:** Token system incompatible with OAuth flows

A clean V2 implementation allows:
1. Proper domain modeling from the ground up
2. No backwards-compatibility constraints
3. Modern tech stack (Bun, SwiftUI, MCP)
4. Clean API contracts from day one

### 2.3 Target User Personas

#### Persona 1: Solo Developer (Primary - V1 user base)
- **Profile:** Individual developer using AI coding agents on laptop
- **Goal:** Control agents from phone while AFK (coffee break, commute monitoring)
- **Pain Points:** Web client keyboard issues, no persistent sessions, can't monitor agents without phone screen
- **V2 Value:** Native iOS app with great keyboard, background notifications, Siri/Shortcuts integration

#### Persona 2: Development Team Lead
- **Profile:** Team of 3-10 developers using shared agent infrastructure
- **Goal:** Oversee team's agent usage, approve dangerous operations, ensure compliance
- **Pain Points:** No multi-user support, no audit trail, no approval workflows
- **V2 Value:** Multi-tenant sessions, approval queue, activity dashboard

#### Persona 3: Enterprise Security/Platform Engineer
- **Profile:** Responsible for AI tooling security and compliance
- **Goal:** Enforce guardrails, integrate with SSO, audit all agent operations
- **Pain Points:** No OAuth, no centralized logging, no policy enforcement
- **V2 Value:** OAuth integration, Opik tracing, policy-as-code guardrails

---

## 3. Product Vision

**Vision Statement:** MConnect V2 is the control plane for AI coding agents - providing secure, observable, multi-platform access to containerized agent runtimes.

### 3.1 Core Principles

1. **Native First:** iOS app with platform-native UX, not a wrapped web view
2. **Secure by Default:** OAuth, E2E encryption, minimal permissions
3. **Observable:** Every agent operation traced and auditable
4. **Agent Agnostic:** Works with any MCP-compatible agent (Claude Code, Gemini CLI, custom)
5. **Container Isolated:** Agents run in sandboxed containers with resource limits

### 3.2 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| iOS App Responsiveness | <100ms input latency | End-to-end input roundtrip |
| Connection Reliability | 99.9% uptime | Session success rate |
| Auth Flow | <10s complete flow | OAuth + connection time |
| Agent Startup | <5s cold start | Container creation to ready |
| Trace Latency | <50ms overhead | Opik event submission |

---

## 4. Scope Definition

### 4.1 In Scope (V2.0 Release)

1. **iOS Native Application**
   - SwiftUI-based terminal interface
   - Keychain-based secret storage (Vault)
   - Host profile management
   - Agent dashboard with real-time status
   - OAuth 2.0 authentication
   - Background session monitoring
   - Push notifications for agent events

2. **MConnect Server**
   - Bun runtime for performance
   - Native Bun WebSocket server
   - Docker MCP Gateway integration
   - OAuth 2.0 + JWT authentication
   - Session management with distributed state
   - Guardrails engine (V1 logic migrated)

3. **Agent Runtime**
   - Container orchestration layer
   - MCP protocol support
   - Opik tracing integration
   - Resource limits and isolation
   - Multi-agent session support

4. **Observability**
   - Opik SDK integration
   - Trace collection for all agent operations
   - Metrics export (Prometheus-compatible)
   - Grafana dashboard templates

5. **API & Protocol**
   - OpenAPI 3.1 specification
   - WebSocket protocol v3.0 specification
   - MCP transport layer

### 4.2 Out of Scope (Future Versions)

1. **Android App** - V2.1 planned
2. **Web Client Update** - V1 web client deprecated, not replaced
3. **Team/Multi-tenant** - V2.1 planned
4. **Self-hosted Registry** - V2.2 planned
5. **Agent Marketplace** - Future consideration
6. **Desktop Native App** - Future consideration

### 4.3 Assumptions

1. iOS 17.0+ is an acceptable minimum (SwiftUI 5.0 features)
2. Users have Docker Desktop or compatible container runtime
3. Cloudflare Tunnel remains available for free tier
4. Opik cloud tier is available (or self-hosted option exists)
5. OAuth providers (GitHub, Google) are acceptable for initial release

### 4.4 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Server Runtime | Bun | 2-3x faster WebSocket, native TypeScript |
| iOS Framework | SwiftUI | Modern, declarative, better performance |
| Auth Protocol | OAuth 2.0 + PKCE | Secure mobile flow, no client secrets |
| Container Runtime | Docker + MCP Gateway | MCP standard, container isolation |
| Tracing | Opik | Purpose-built for LLM observability |
| Database | TBD (PostgreSQL/SQLite) | To be determined in technical spec |

---

## 5. Functional Requirements

### 5.1 iOS Application

#### 5.1.1 Vault (Secret Management)
| ID | Requirement | Priority |
|----|-------------|----------|
| IOS-VAULT-001 | Store credentials in iOS Keychain with biometric protection | P0 |
| IOS-VAULT-002 | Support for OAuth tokens with automatic refresh | P0 |
| IOS-VAULT-003 | Support for SSH keys (for future jump host feature) | P1 |
| IOS-VAULT-004 | Secure export/import for device migration | P2 |

#### 5.1.2 Hosts (Connection Profiles)
| ID | Requirement | Priority |
|----|-------------|----------|
| IOS-HOST-001 | Create/edit host connection profiles | P0 |
| IOS-HOST-002 | Store host: address, port, tunnel preference, auth method | P0 |
| IOS-HOST-003 | QR code scanning for quick host setup | P0 |
| IOS-HOST-004 | Host health check / connection test | P1 |
| IOS-HOST-005 | iCloud sync for host profiles (opt-in) | P2 |

#### 5.1.3 Terminal (SwiftUI)
| ID | Requirement | Priority |
|----|-------------|----------|
| IOS-TERM-001 | Full terminal emulation (xterm-256color) | P0 |
| IOS-TERM-002 | Touch-optimized input with custom keyboard extension | P0 |
| IOS-TERM-003 | Shortcut bar (Ctrl, Esc, Tab, arrows, etc.) | P0 |
| IOS-TERM-004 | Multi-agent tab interface | P0 |
| IOS-TERM-005 | Scrollback buffer with search | P1 |
| IOS-TERM-006 | Text selection and copy | P1 |
| IOS-TERM-007 | Font size adjustment (pinch to zoom) | P1 |
| IOS-TERM-008 | Haptic feedback for key events | P2 |

#### 5.1.4 Agent Dashboard
| ID | Requirement | Priority |
|----|-------------|----------|
| IOS-AGENT-001 | List all agents in current session | P0 |
| IOS-AGENT-002 | Agent status display (running, paused, exited) | P0 |
| IOS-AGENT-003 | Create new agent from preset | P1 |
| IOS-AGENT-004 | Kill/restart agent controls | P1 |
| IOS-AGENT-005 | Resource usage display (CPU, memory) | P2 |

#### 5.1.5 Notifications & Background
| ID | Requirement | Priority |
|----|-------------|----------|
| IOS-NOTIF-001 | Push notification for agent completion/errors | P1 |
| IOS-NOTIF-002 | Background WebSocket keepalive | P1 |
| IOS-NOTIF-003 | Siri Shortcuts integration (start agent, check status) | P2 |

### 5.2 MConnect Server

#### 5.2.1 Authentication
| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-AUTH-001 | OAuth 2.0 authorization code flow with PKCE | P0 |
| SRV-AUTH-002 | Support GitHub as OAuth provider | P0 |
| SRV-AUTH-003 | JWT token issuance and validation | P0 |
| SRV-AUTH-004 | Token refresh endpoint | P0 |
| SRV-AUTH-005 | Support Google as OAuth provider | P1 |
| SRV-AUTH-006 | Local development mode (bypass OAuth) | P0 |

#### 5.2.2 Session Management
| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-SESS-001 | Create session with unique ID | P0 |
| SRV-SESS-002 | Attach client to session (multi-client support) | P0 |
| SRV-SESS-003 | Session state persistence (survive server restart) | P1 |
| SRV-SESS-004 | Session timeout and cleanup | P0 |
| SRV-SESS-005 | Session transfer between clients | P2 |

#### 5.2.3 WebSocket Hub
| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-WS-001 | Protocol v3.0 message handling | P0 |
| SRV-WS-002 | Agent output multiplexing | P0 |
| SRV-WS-003 | Input routing with arbitration | P0 |
| SRV-WS-004 | Client presence tracking | P0 |
| SRV-WS-005 | Heartbeat and reconnection handling | P0 |
| SRV-WS-006 | Rate limiting per client | P1 |

#### 5.2.4 Docker MCP Gateway
| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-MCP-001 | MCP protocol message routing | P0 |
| SRV-MCP-002 | Container lifecycle management | P0 |
| SRV-MCP-003 | Tool registration and discovery | P1 |
| SRV-MCP-004 | Custom MCP server support | P2 |

#### 5.2.5 Guardrails
| ID | Requirement | Priority |
|----|-------------|----------|
| SRV-GUARD-001 | Command filtering (migrate V1 patterns) | P0 |
| SRV-GUARD-002 | 4-tier guardrail levels | P0 |
| SRV-GUARD-003 | Custom rule definition (regex) | P1 |
| SRV-GUARD-004 | Approval queue for blocked commands | P2 |

### 5.3 Agent Runtime

#### 5.3.1 Container Orchestration
| ID | Requirement | Priority |
|----|-------------|----------|
| AGT-CONT-001 | Create agent containers on demand | P0 |
| AGT-CONT-002 | Workspace volume mounting | P0 |
| AGT-CONT-003 | Resource limits (CPU, memory, disk) | P1 |
| AGT-CONT-004 | Container health checks | P1 |
| AGT-CONT-005 | Automatic cleanup on session end | P0 |

#### 5.3.2 MCP Support
| ID | Requirement | Priority |
|----|-------------|----------|
| AGT-MCP-001 | MCP stdio transport | P0 |
| AGT-MCP-002 | MCP SSE transport | P1 |
| AGT-MCP-003 | Tool calling protocol | P0 |
| AGT-MCP-004 | Resource protocol | P1 |
| AGT-MCP-005 | Sampling protocol | P2 |

#### 5.3.3 Agent Types
| ID | Requirement | Priority |
|----|-------------|----------|
| AGT-TYPE-001 | Claude Code agent preset | P0 |
| AGT-TYPE-002 | Gemini CLI agent preset | P1 |
| AGT-TYPE-003 | Custom agent configuration | P1 |
| AGT-TYPE-004 | Shell-only agent (no AI) | P0 |

### 5.4 Observability

#### 5.4.1 Opik Integration
| ID | Requirement | Priority |
|----|-------------|----------|
| OBS-OPIK-001 | Initialize Opik SDK on server startup | P0 |
| OBS-OPIK-002 | Trace all agent operations | P0 |
| OBS-OPIK-003 | Trace LLM calls with token counts | P0 |
| OBS-OPIK-004 | Custom spans for MConnect operations | P1 |
| OBS-OPIK-005 | User attribution in traces | P1 |

#### 5.4.2 Metrics & Dashboards
| ID | Requirement | Priority |
|----|-------------|----------|
| OBS-METR-001 | Expose Prometheus metrics endpoint | P1 |
| OBS-METR-002 | Grafana dashboard template | P2 |
| OBS-METR-003 | Key metrics: latency, errors, agent count | P1 |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Requirement | Target |
|-------------|--------|
| WebSocket latency (server processing) | <10ms |
| Terminal input-to-display roundtrip | <100ms |
| Agent container cold start | <5s |
| iOS app launch to ready | <2s |
| Memory per agent container | <512MB default |

### 6.2 Reliability

| Requirement | Target |
|-------------|--------|
| Server uptime | 99.9% |
| Reconnection success rate | 99% within 5s |
| Session persistence | Survive server restart |
| Data loss on crash | Zero (last 10s max) |

### 6.3 Security

| Requirement | Description |
|-------------|-------------|
| Authentication | OAuth 2.0 + PKCE (no client secrets on mobile) |
| Authorization | JWT with scoped claims |
| Transport | TLS 1.3 required |
| Secrets | iOS Keychain, server-side encrypted at rest |
| Container Isolation | Namespace, cgroup, seccomp profiles |
| Audit | All operations logged to Opik |

### 6.4 Scalability

| Dimension | Initial Target | Notes |
|-----------|---------------|-------|
| Concurrent sessions | 100 | Per server instance |
| Agents per session | 10 | Soft limit |
| Clients per session | 5 | iOS + additional devices |
| Trace events/sec | 1000 | To Opik |

### 6.5 Compatibility

| Platform | Minimum Version |
|----------|----------------|
| iOS | 17.0 |
| macOS (server) | 13.0 (Ventura) |
| Linux (server) | Ubuntu 22.04 / Debian 12 |
| Docker | 24.0+ |
| Node.js (fallback) | 20.0+ |
| Bun | 1.1+ |

---

## 7. User Stories

### 7.1 Solo Developer Stories

**US-001: Quick Connect from iPhone**
> As a solo developer, I want to scan a QR code on my laptop and immediately connect my iPhone to my running agent session, so I can monitor progress while making coffee.

**Acceptance Criteria:**
- QR code displayed on server start
- iOS app camera integration
- Connection established in <3 seconds
- Read-only mode by default

**US-002: Type Commands from Phone**
> As a solo developer, I want to type commands on my iPhone's keyboard and have them execute on my laptop's agent, so I can intervene when something goes wrong.

**Acceptance Criteria:**
- Tap terminal to activate keyboard
- Special keys available (Ctrl+C, etc.)
- Input arrives in <100ms
- Visual feedback on key press

**US-003: Get Notified When Agent Finishes**
> As a solo developer, I want to receive a push notification when my agent completes its task or encounters an error, so I don't have to keep checking.

**Acceptance Criteria:**
- Push notification within 5s of event
- Notification shows agent name and status
- Tap opens relevant session

### 7.2 Team Lead Stories

**US-004: View Agent Activity Dashboard**
> As a team lead, I want to see an overview of all running agents and their status, so I can ensure the team is productive.

**Acceptance Criteria:**
- Dashboard shows all agents in session
- Real-time status updates
- Resource usage visible
- Filter by agent type

**US-005: Approve Dangerous Commands**
> As a team lead, I want to receive approval requests for dangerous commands (rm -rf, force push), so I can prevent accidents.

**Acceptance Criteria:**
- Blocked command triggers approval flow
- Notification sent to approvers
- Approve/deny from mobile app
- Timeout with deny default

### 7.3 Platform Engineer Stories

**US-006: Integrate with SSO**
> As a platform engineer, I want users to authenticate with our existing GitHub org, so we can manage access centrally.

**Acceptance Criteria:**
- OAuth flow with GitHub
- Org membership validation
- Token refresh works seamlessly
- Revocation propagates immediately

**US-007: Audit Agent Operations**
> As a platform engineer, I want all agent operations traced to Opik, so I can audit usage and debug issues.

**Acceptance Criteria:**
- All operations have trace ID
- User attribution in traces
- Searchable by session/user/time
- Retention configurable

---

## 8. Dependencies

### 8.1 External Services

| Service | Purpose | Required |
|---------|---------|----------|
| Opik (Comet) | Tracing and observability | Yes |
| GitHub OAuth | Authentication | Yes (one required) |
| Google OAuth | Authentication | Optional |
| Cloudflare Tunnel | Remote access | Optional |
| Docker Hub | Base images | Yes |

### 8.2 Third-Party Libraries

**iOS:**
- SwiftUI (Apple)
- Keychain Services (Apple)
- URLSession/WebSocket (Apple)
- Terminal emulation library (TBD - evaluate SwiftTerm)

**Server:**
- Bun runtime
- @modelcontextprotocol/sdk
- opik-sdk
- jose (JWT)
- zod (validation)

### 8.3 Internal Dependencies

| Component | Depends On |
|-----------|-----------|
| iOS App | Server API (OpenAPI contract) |
| Server | Docker runtime |
| Agent Runtime | MCP protocol |
| Observability | Opik cloud/self-hosted |

---

## 9. Milestones & Phases

### Phase 1: Foundation (Weeks 1-4)
- Server skeleton with Bun
- OAuth 2.0 flow (GitHub)
- Basic WebSocket protocol v3
- Container lifecycle (create/destroy)
- Opik SDK initialization

### Phase 2: Agent Runtime (Weeks 5-8)
- MCP protocol support
- Agent presets (Claude, shell)
- Guardrails migration
- Tracing integration
- Session persistence

### Phase 3: iOS App Core (Weeks 9-12)
- SwiftUI terminal view
- Keychain integration
- Host management
- WebSocket client
- Basic agent dashboard

### Phase 4: Polish & Integration (Weeks 13-16)
- Push notifications
- Background modes
- Reconnection handling
- Performance optimization
- Documentation

---

## 10. Open Questions

These items need team discussion and decision:

1. **Database Choice:** PostgreSQL for distributed, or SQLite for simplicity? Recommend PostgreSQL for session sharing.

2. **Web Client Fate:** Deprecate entirely, or maintain minimal version? Recommend deprecation with v2.1 optional web view.

3. **Self-Hosted Opik:** Support self-hosted Opik from day one, or cloud-only initially? Recommend cloud-first, self-hosted v2.1.

4. **Agent Image Registry:** Use Docker Hub public, or require private registry? Recommend public for default images, configurable for custom.

5. **Offline Mode:** Should iOS app have any offline functionality (view cached sessions)? Recommend minimal offline (read-only cache) for v2.0.

---

## 11. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Bun compatibility issues | Medium | High | Maintain Node.js fallback |
| iOS terminal performance | Medium | Medium | Benchmark SwiftTerm alternatives |
| Opik availability | Low | High | Local trace buffer, retry queue |
| OAuth complexity on mobile | Low | Medium | Deep linking, fallback to web auth |
| Docker startup latency | Medium | Medium | Pre-warm containers, image caching |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| MCP | Model Context Protocol - Standard for AI tool integration |
| Opik | LLM observability platform by Comet |
| PKCE | Proof Key for Code Exchange - OAuth extension for mobile |
| PTY | Pseudo-terminal - Virtual terminal for process I/O |
| Guardrails | Command filtering and approval system |
| Session | Server-side container of agents and state |
| Host | iOS app's saved connection profile |
| Vault | iOS app's Keychain-backed secret store |

---

## Appendix A: V1 to V2 Migration

### Components to Migrate
- Guardrails patterns (`guardrails.ts`)
- Agent presets (`agents/types.ts`)
- DevContainer parsing logic (`container/devcontainer.ts`)

### Components to Replace
- WebSocket protocol (v1/v2 → v3)
- Session management (SQLite → distributed)
- PTY manager (node-pty → container stdin/stdout)
- Web client (deprecated)

### Components to Keep
- Tunnel integration concept (Cloudflare)
- QR code pairing UX
- Input arbitration state machine

---

## Appendix B: Related Documents

- Technical Specification: `.zenflow/tasks/new-task-bcba/spec.md` (to be created)
- Implementation Plan: `.zenflow/tasks/new-task-bcba/plan.md`
- AGENTS.MD: Project context and conventions
