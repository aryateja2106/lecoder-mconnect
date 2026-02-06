# MConnect V2 - Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/new-task-bcba`
- **Requirements**: `requirements.md`
- **Technical Spec**: `spec.md`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: 0e0942e8-bda7-4c57-b627-7779eca39320 -->

Create a Product Requirements Document (PRD) based on the feature description.

### [x] Step: Technical Specification
<!-- chat-id: aca5c009-b583-48a3-a327-81093ef0682d -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

### [x] Step: Planning
<!-- chat-id: 1a4ddce4-245c-47ff-b9ab-2fb7eb3cf716 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

---

# Phase 1: Foundation (Core Server)

### [x] Step: Create packages/server scaffold with Bun
<!-- chat-id: f819e6fb-e835-4093-a1fd-b658feb5281f -->

Create the new `packages/server` package with Bun runtime.

- [x] Create `packages/server/package.json` with Bun dependencies (zod, jose, postgres, dockerode, opik)
- [x] Create `packages/server/tsconfig.json` for strict TypeScript
- [x] Create `packages/server/biome.json` extending root config
- [x] Create basic directory structure: `src/{auth,ws,mcp,agents,session,observability,db}`
- [x] Create `packages/server/src/index.ts` with basic Bun HTTP server
- [x] Add `bun test` and `bun run dev` scripts
- [x] Verify: `bun install && bun run dev` starts server

### [x] Step: Create packages/shared for common types
<!-- chat-id: 38ccb2a9-ebc5-4970-9497-738a2e8c0104 -->

Create shared package for types and utilities used by both server and CLI.

- [x] Create `packages/shared/package.json`
- [x] Port types from `packages/cli/src/agents/types.ts` to `packages/shared/src/types/agents.ts`
- [x] Create `packages/shared/src/types/models.ts` with User, Session, Agent, Client interfaces (from spec §3.2)
- [x] Create `packages/shared/src/protocol/messages.ts` with WebSocket v3 message types (from spec §5.3-5.4)
- [x] Port guardrails from `packages/cli/src/guardrails.ts` to `packages/shared/src/guardrails/`
- [x] Verify: `bun run typecheck` passes

### [x] Step: Implement PostgreSQL database layer
<!-- chat-id: 4f62b7ef-5a36-4e56-af24-88738c9b9d21 -->

Set up PostgreSQL connection and schema.

- [x] Create `packages/server/src/db/client.ts` with postgres connection (using `postgres` package)
- [x] Create `packages/server/src/db/migrations/001_initial.sql` with schema from spec §3.1
- [x] Create `packages/server/src/db/migrate.ts` migration runner
- [x] Create `packages/server/src/db/repositories/{user,session,agent,client}.ts` with CRUD operations
- [x] Add `docker-compose.yml` with PostgreSQL for local dev
- [x] Write tests for repositories
- [x] Verify: `bun test src/db` passes

### [ ] Step: Implement OAuth 2.0 with GitHub provider
<!-- chat-id: 67b16401-69fc-48e5-85f1-ee8c9f2a4283 -->

Implement OAuth flow with PKCE for mobile.

- [ ] Create `packages/server/src/auth/oauth.ts` with AuthService interface (spec §2.2.1)
- [ ] Implement `getAuthorizationUrl()` with PKCE code_challenge generation
- [ ] Implement `exchangeCode()` for token exchange
- [ ] Create `packages/server/src/auth/providers/github.ts` provider implementation
- [ ] Create `/auth/authorize` and `/auth/callback` HTTP endpoints
- [ ] Write tests for OAuth flow (mock GitHub responses)
- [ ] Verify: `bun test src/auth` passes

### [ ] Step: Implement JWT token management

Implement JWT issuance, validation, and refresh.

- [ ] Create `packages/server/src/auth/jwt.ts` with token functions (using `jose`)
- [ ] Implement `createTokenPair()` returning access + refresh tokens
- [ ] Implement `validateToken()` with expiry checking
- [ ] Implement `refreshToken()` with rotation
- [ ] Store refresh tokens in PostgreSQL (hashed)
- [ ] Create `/auth/refresh` endpoint
- [ ] Create dev bypass mode (`DEV_AUTH_BYPASS=true`)
- [ ] Write tests for JWT operations
- [ ] Verify: `bun test src/auth` passes

### [ ] Step: Implement basic WebSocket hub with protocol v3

Create WebSocket server with authentication.

- [ ] Create `packages/server/src/ws/WSHub.ts` implementing interface from spec §2.2.4
- [ ] Implement Bun native WebSocket server
- [ ] Implement auth message handling (first message must be `type: 'auth'`)
- [ ] Implement `sendToClient()` and `broadcastToSession()`
- [ ] Implement heartbeat mechanism (30s interval)
- [ ] Port InputArbiter from `packages/cli/src/input/InputArbiter.ts`
- [ ] Write tests for WebSocket hub
- [ ] Verify: `bun test src/ws` passes

### [ ] Step: Implement session CRUD via REST API

Create REST endpoints for session management.

- [ ] Create `packages/server/src/api/sessions.ts` with session routes
- [ ] Implement `POST /sessions` - create session
- [ ] Implement `GET /sessions` - list user sessions
- [ ] Implement `GET /sessions/:id` - get session details
- [ ] Implement `DELETE /sessions/:id` - terminate session
- [ ] Implement `GET /sessions/:id/connect` - get WebSocket connection info
- [ ] Add JWT auth middleware to all routes
- [ ] Write integration tests
- [ ] Verify: `bun test src/api` passes

### [ ] Step: Initialize Opik SDK integration

Set up Opik for observability.

- [ ] Install `opik` package
- [ ] Create `packages/server/src/observability/OpikService.ts` implementing interface from spec §2.2.5
- [ ] Implement `initialize()` with config from env vars
- [ ] Implement `startTrace()`, `endTrace()`, `startSpan()`, `endSpan()`
- [ ] Add environment variables to `.env.example` (OPIK_API_KEY, OPIK_PROJECT_NAME)
- [ ] Create test to verify Opik connection
- [ ] Verify: Can send test events to Opik dashboard

---

# Phase 2: Agent Runtime

### [ ] Step: Implement Docker API container lifecycle

Create container management using Docker API.

- [ ] Create `packages/server/src/agents/ContainerRuntime.ts` using dockerode
- [ ] Implement `createContainer()` with security profile from spec §6.4
- [ ] Implement `startContainer()`, `stopContainer()`, `removeContainer()`
- [ ] Implement `attachToContainer()` for stdin/stdout streams
- [ ] Implement resource limit enforcement (CPU, memory, pids)
- [ ] Write tests with Docker integration
- [ ] Verify: `bun test:integration src/agents` passes

### [ ] Step: Implement Agent Manager

Create agent lifecycle management.

- [ ] Create `packages/server/src/agents/AgentManager.ts` implementing interface from spec §2.2.3
- [ ] Implement `createAgent()` with container provisioning
- [ ] Implement `startAgent()`, `stopAgent()`
- [ ] Implement I/O methods: `writeToAgent()`, `onAgentOutput()`
- [ ] Implement status tracking and database persistence
- [ ] Wire agent output to WebSocket hub
- [ ] Write tests for agent lifecycle
- [ ] Verify: `bun test src/agents` passes

### [ ] Step: Implement MCP stdio transport

Add MCP protocol support.

- [ ] Create `packages/server/src/mcp/MCPBridge.ts` for MCP message handling
- [ ] Implement stdio transport using container attach
- [ ] Implement `sendMCPMessage()` and response correlation
- [ ] Implement tool registration from container
- [ ] Add MCP message routing through WebSocket
- [ ] Write tests for MCP communication
- [ ] Verify: `bun test src/mcp` passes

### [ ] Step: Create agent presets (Claude, Shell)

Define agent preset configurations.

- [ ] Create `packages/server/src/agents/presets/claude.ts` with Claude Code container config
- [ ] Create `packages/server/src/agents/presets/shell.ts` for shell-only agent
- [ ] Create `packages/server/src/agents/presets/index.ts` preset registry
- [ ] Support custom agent configuration via API
- [ ] Write tests for preset loading
- [ ] Verify: Can create Claude Code agent in container

### [ ] Step: Migrate guardrails from V1

Port and enhance command filtering.

- [ ] Enhance `packages/shared/src/guardrails/` with approval patterns from spec §6.5
- [ ] Implement `filterCommand()` with blocked/approval pattern matching
- [ ] Implement 4-tier guardrail levels (none, permissive, default, strict)
- [ ] Integrate guardrails into agent input path
- [ ] Add `input_rejected` WebSocket message for blocked commands
- [ ] Write tests for all guardrail levels
- [ ] Verify: `rm -rf /` is blocked, `rm -rf ./temp` requires approval on default level

### [ ] Step: Add tracing to agent operations

Integrate Opik tracing throughout agent lifecycle.

- [ ] Add trace spans to AgentManager operations
- [ ] Add trace spans to MCP message routing
- [ ] Add user attribution to all traces
- [ ] Implement token counting for LLM calls
- [ ] Create TracingMiddleware for automatic span creation
- [ ] Verify: Agent operations visible in Opik dashboard

---

# Phase 3: iOS App Core

### [ ] Step: Create Xcode project structure

Initialize iOS app with SwiftUI.

- [ ] Create `packages/ios-app/MConnect.xcodeproj`
- [ ] Set up SwiftUI app with iOS 17.0 minimum
- [ ] Create directory structure from spec §7.1
- [ ] Configure app signing and capabilities (Keychain, Push Notifications)
- [ ] Set up Info.plist with URL scheme (`mconnect://`)
- [ ] Verify: Xcode builds without errors

### [ ] Step: Implement Keychain service

Create secure credential storage.

- [ ] Create `MConnect/Services/Keychain/KeychainService.swift`
- [ ] Implement `save()`, `load()`, `delete()` for Keychain items
- [ ] Configure access control with biometric protection
- [ ] Create `BiometricAuth.swift` for Face ID / Touch ID prompts
- [ ] Write unit tests for Keychain operations
- [ ] Verify: XCTest passes

### [ ] Step: Implement OAuth and token management

Create iOS authentication flow.

- [ ] Create `MConnect/Services/Auth/AuthService.swift`
- [ ] Implement PKCE code_challenge generation
- [ ] Implement `startOAuthFlow()` opening Safari
- [ ] Handle `mconnect://callback` URL scheme
- [ ] Create `TokenManager.swift` for token storage in Keychain
- [ ] Implement automatic token refresh
- [ ] Write tests for auth flow
- [ ] Verify: XCTest passes

### [ ] Step: Implement WebSocket client

Create protocol v3 WebSocket client.

- [ ] Create `MConnect/Services/WebSocket/WSClient.swift` (from spec §7.3)
- [ ] Implement `connect()` with auth message
- [ ] Implement message type handling for all v3 messages
- [ ] Implement `sendInput()` for terminal input
- [ ] Implement heartbeat handling
- [ ] Implement automatic reconnection on disconnect
- [ ] Write tests for WebSocket client
- [ ] Verify: XCTest passes

### [ ] Step: Create Host management views

Build host profile UI.

- [ ] Create `MConnect/Views/Hosts/HostListView.swift`
- [ ] Create `MConnect/Views/Hosts/HostDetailView.swift` for add/edit
- [ ] Create `MConnect/Views/Hosts/QRScannerView.swift` using AVFoundation
- [ ] Create `MConnect/Models/Host.swift` with Codable
- [ ] Persist hosts in Keychain
- [ ] Write UI tests for host management
- [ ] Verify: XCUITest passes

### [ ] Step: Implement terminal view

Create SwiftUI terminal emulator.

- [ ] Evaluate SwiftTerm library for terminal emulation
- [ ] Create `MConnect/Views/Terminal/TerminalView.swift` wrapper
- [ ] Create `TerminalEmulatorView` using UIViewRepresentable
- [ ] Create `KeyboardBarView.swift` with special keys (Ctrl, Esc, Tab, arrows)
- [ ] Implement `TerminalViewModel` for WebSocket integration
- [ ] Handle terminal output rendering and scrollback
- [ ] Write UI tests for terminal interaction
- [ ] Verify: XCUITest passes

### [ ] Step: Create agent dashboard views

Build agent monitoring UI.

- [ ] Create `MConnect/Views/Agents/AgentDashboard.swift`
- [ ] Create `MConnect/Views/Agents/AgentDetailView.swift`
- [ ] Create `MConnect/Models/Agent.swift` and `Session.swift`
- [ ] Implement agent status badges (running, idle, exited)
- [ ] Implement agent tab switching in terminal
- [ ] Write UI tests
- [ ] Verify: XCUITest passes

---

# Phase 4: Polish & Integration

### [ ] Step: Implement push notifications

Add APNs for agent events.

- [ ] Configure APNs capability in Xcode
- [ ] Create `MConnect/Services/Notifications/PushService.swift`
- [ ] Implement device token registration with server
- [ ] Create server-side push notification sending
- [ ] Implement notification payloads for agent events
- [ ] Handle notification taps to open relevant session
- [ ] Test push notifications on device
- [ ] Verify: Notifications arrive for agent completion

### [ ] Step: Implement background WebSocket keepalive

Enable background session monitoring.

- [ ] Configure Background Modes capability
- [ ] Implement `beginBackgroundTask` for WebSocket maintenance
- [ ] Handle app backgrounding/foregrounding transitions
- [ ] Implement connection restoration on foreground
- [ ] Test background behavior
- [ ] Verify: Connection survives app backgrounding

### [ ] Step: Implement reconnection handling

Add robust reconnection logic.

- [ ] Implement exponential backoff in WebSocket client
- [ ] Handle network status changes (Reachability)
- [ ] Restore session state on reconnect
- [ ] Show connection status indicator in UI
- [ ] Test reconnection scenarios
- [ ] Verify: Reconnects within 5s of network recovery

### [ ] Step: Performance optimization

Optimize for latency targets.

- [ ] Profile WebSocket message latency
- [ ] Optimize terminal rendering performance
- [ ] Implement scrollback buffer limits
- [ ] Profile and optimize iOS app launch time
- [ ] Benchmark against spec §9.4 targets
- [ ] Verify: Input latency <100ms, app launch <2s

### [ ] Step: Create documentation

Write user and developer documentation.

- [ ] Create `docs/api/openapi.yaml` from spec
- [ ] Create `docs/protocol/v3.md` with message format
- [ ] Update `packages/server/README.md` with setup instructions
- [ ] Update `packages/ios-app/README.md` with build instructions
- [ ] Update root `README.md` with V2 overview
- [ ] Create `.env.example` with all environment variables

### [ ] Step: CI/CD pipeline

Set up automated testing.

- [ ] Create `.github/workflows/ci.yml` per spec §9.3
- [ ] Add server test job with PostgreSQL service
- [ ] Add iOS test job on macos-14 runner
- [ ] Add linting and typecheck jobs
- [ ] Configure test coverage reporting
- [ ] Verify: All CI jobs pass on push

---

## Verification Commands

```bash
# Server tests
cd packages/server && bun test && bun run typecheck

# Shared tests
cd packages/shared && bun test && bun run typecheck

# iOS tests
xcodebuild test -project packages/ios-app/MConnect.xcodeproj \
  -scheme MConnect -destination 'platform=iOS Simulator,name=iPhone 15'

# Integration tests
cd packages/server && bun test:integration

# Lint all
bun run lint
```

---

## Exit Criteria per Phase

**Phase 1:**
- Can authenticate via GitHub OAuth
- Can create/list/terminate sessions via API
- Opik receives test events

**Phase 2:**
- Can create Claude Code agent in container
- Agent output streams to WebSocket
- Guardrails block `rm -rf /`

**Phase 3:**
- Can scan QR code and connect
- Can type commands and see output
- Can switch between agents

**Phase 4:**
- Input latency <100ms
- Reconnects within 5s
- App Store ready
