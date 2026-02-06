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

### [x] Step: Implement OAuth 2.0 with GitHub provider
<!-- chat-id: 67b16401-69fc-48e5-85f1-ee8c9f2a4283 -->

Implement OAuth flow with PKCE for mobile.

- [x] Create `packages/server/src/auth/oauth.ts` with AuthService interface (spec §2.2.1)
- [x] Implement `getAuthorizationUrl()` with PKCE code_challenge generation
- [x] Implement `exchangeCode()` for token exchange
- [x] Create `packages/server/src/auth/providers/github.ts` provider implementation
- [x] Create `/auth/authorize` and `/auth/callback` HTTP endpoints
- [x] Write tests for OAuth flow (mock GitHub responses)
- [x] Verify: `bun test src/auth` passes

### [x] Step: Implement JWT token management
<!-- chat-id: 6856b949-de04-4e0c-a130-f7531219e915 -->

Implement JWT issuance, validation, and refresh.

- [x] Create `packages/server/src/auth/jwt.ts` with token functions (using `jose`)
- [x] Implement `createTokenPair()` returning access + refresh tokens
- [x] Implement `validateToken()` with expiry checking
- [x] Implement `refreshToken()` with rotation
- [x] Store refresh tokens in PostgreSQL (hashed)
- [x] Create `/auth/refresh` endpoint
- [x] Create dev bypass mode (`DEV_AUTH_BYPASS=true`)
- [x] Write tests for JWT operations
- [x] Verify: `bun test src/auth` passes

### [x] Step: Implement basic WebSocket hub with protocol v3
<!-- chat-id: 480f1181-7356-454f-864a-3de32f8b43cd -->

Create WebSocket server with authentication.

- [x] Create `packages/server/src/ws/WSHub.ts` implementing interface from spec §2.2.4
- [x] Implement Bun native WebSocket server
- [x] Implement auth message handling (first message must be `type: 'auth'`)
- [x] Implement `sendToClient()` and `broadcastToSession()`
- [x] Implement heartbeat mechanism (30s interval)
- [x] Port InputArbiter from `packages/cli/src/input/InputArbiter.ts`
- [x] Write tests for WebSocket hub
- [x] Verify: `bun test src/ws` passes

### [x] Step: Implement session CRUD via REST API
<!-- chat-id: 8e7a59f5-05c9-4c42-bd4c-59b0a952c596 -->

Create REST endpoints for session management.

- [x] Create `packages/server/src/api/sessions.ts` with session routes
- [x] Implement `POST /sessions` - create session
- [x] Implement `GET /sessions` - list user sessions
- [x] Implement `GET /sessions/:id` - get session details
- [x] Implement `DELETE /sessions/:id` - terminate session
- [x] Implement `GET /sessions/:id/connect` - get WebSocket connection info
- [x] Add JWT auth middleware to all routes
- [x] Write integration tests
- [x] Verify: `bun test src/api` passes

### [x] Step: Initialize Opik SDK integration
<!-- chat-id: 7f7d6aa4-b869-4b7e-9202-acacb64ed653 -->

Set up Opik for observability.

- [x] Install `opik` package
- [x] Create `packages/server/src/observability/OpikService.ts` implementing interface from spec §2.2.5
- [x] Implement `initialize()` with config from env vars
- [x] Implement `startTrace()`, `endTrace()`, `startSpan()`, `endSpan()`
- [x] Add environment variables to `.env.example` (OPIK_API_KEY, OPIK_PROJECT_NAME) - documented in README.md
- [x] Create test to verify Opik connection
- [x] Verify: Can send test events to Opik dashboard (integration tests with OPIK_API_KEY)

---

# Phase 2: Agent Runtime

### [x] Step: Implement Docker API container lifecycle
<!-- chat-id: 66876d07-e499-4481-a8d3-08cda1ec0218 -->

Create container management using Docker API.

- [x] Create `packages/server/src/agents/ContainerRuntime.ts` using dockerode
- [x] Implement `createContainer()` with security profile from spec §6.4
- [x] Implement `startContainer()`, `stopContainer()`, `removeContainer()`
- [x] Implement `attachToContainer()` for stdin/stdout streams
- [x] Implement resource limit enforcement (CPU, memory, pids)
- [x] Write tests with Docker integration
- [x] Verify: `bun test:integration src/agents` passes

### [x] Step: Implement Agent Manager
<!-- chat-id: e6ab874f-37e6-4140-872d-4946404568a6 -->

Create agent lifecycle management.

- [x] Create `packages/server/src/agents/AgentManager.ts` implementing interface from spec §2.2.3
- [x] Implement `createAgent()` with container provisioning
- [x] Implement `startAgent()`, `stopAgent()`
- [x] Implement I/O methods: `writeToAgent()`, `onAgentOutput()`
- [x] Implement status tracking and database persistence
- [x] Wire agent output to WebSocket hub
- [x] Write tests for agent lifecycle
- [x] Verify: `bun test src/agents` passes

### [x] Step: Implement MCP stdio transport
<!-- chat-id: 91449367-080d-4d55-a39e-603c6585b0b7 -->

Add MCP protocol support.

- [x] Create `packages/server/src/mcp/MCPBridge.ts` for MCP message handling
- [x] Implement stdio transport using container attach
- [x] Implement `sendMCPMessage()` and response correlation
- [x] Implement tool registration from container
- [x] Add MCP message routing through WebSocket
- [x] Write tests for MCP communication
- [x] Verify: `bun test src/mcp` passes

### [x] Step: Create agent presets (Claude, Shell)
<!-- chat-id: 7afaf3a3-f29d-4387-a325-ddd502714f8f -->

Define agent preset configurations.

- [x] Create `packages/server/src/agents/presets/claude.ts` with Claude Code container config
- [x] Create `packages/server/src/agents/presets/shell.ts` for shell-only agent
- [x] Create `packages/server/src/agents/presets/index.ts` preset registry
- [x] Support custom agent configuration via API
- [x] Write tests for preset loading
- [x] Verify: Can create Claude Code agent in container

### [x] Step: Migrate guardrails from V1
<!-- chat-id: f59230d9-0d0e-4781-b40e-a75424d99491 -->

Port and enhance command filtering.

- [x] Enhance `packages/shared/src/guardrails/` with approval patterns from spec §6.5
- [x] Implement `filterCommand()` with blocked/approval pattern matching
- [x] Implement 4-tier guardrail levels (none, permissive, default, strict)
- [x] Integrate guardrails into agent input path
- [x] Add `input_rejected` WebSocket message for blocked commands
- [x] Write tests for all guardrail levels
- [x] Verify: `rm -rf /` is blocked, `rm -rf ./temp` requires approval on default level

### [x] Step: Add tracing to agent operations
<!-- chat-id: 670da981-c4ae-4bfb-a58c-91e956bea77b -->

Integrate Opik tracing throughout agent lifecycle.

- [x] Add trace spans to AgentManager operations
- [x] Add trace spans to MCP message routing
- [x] Add user attribution to all traces
- [x] Implement token counting for LLM calls
- [x] Create TracingMiddleware for automatic span creation
- [x] Verify: Agent operations visible in Opik dashboard

---

# Phase 3: iOS App Core

### [x] Step: Create Xcode project structure
<!-- chat-id: 996536be-4f3b-4bb5-b7f9-0800b60dc19d -->

Initialize iOS app with SwiftUI.

- [ ] Create `packages/ios-app/MConnect.xcodeproj`
- [ ] Set up SwiftUI app with iOS 17.0 minimum
- [ ] Create directory structure from spec §7.1
- [ ] Configure app signing and capabilities (Keychain, Push Notifications)
- [ ] Set up Info.plist with URL scheme (`mconnect://`)
- [ ] Verify: Xcode builds without errors

### [x] Step: Implement Keychain service
<!-- chat-id: 3a65425c-1ccf-449c-881c-9d9ee26bef43 -->

Create secure credential storage.

- [x] Create `MConnect/Services/Keychain/KeychainService.swift`
- [x] Implement `save()`, `load()`, `delete()` for Keychain items
- [x] Configure access control with biometric protection
- [x] Create `BiometricAuth.swift` for Face ID / Touch ID prompts
- [x] Write unit tests for Keychain operations
- [x] Verify: XCTest passes

### [x] Step: Implement OAuth and token management
<!-- chat-id: 6d4df947-a6d9-4c52-b9b8-8529dd712c3c -->

Create iOS authentication flow.

- [x] Create `MConnect/Services/Auth/AuthService.swift`
- [x] Implement PKCE code_challenge generation
- [x] Implement `startOAuthFlow()` opening Safari
- [x] Handle `mconnect://callback` URL scheme
- [x] Create `TokenManager.swift` for token storage in Keychain
- [x] Implement automatic token refresh
- [x] Write tests for auth flow
- [x] Verify: XCTest passes

### [x] Step: Implement WebSocket client
<!-- chat-id: 61db1f78-93bb-49ba-a898-0f27083cc4e1 -->

Create protocol v3 WebSocket client.

- [x] Create `MConnect/Services/WebSocket/WSClient.swift` (from spec §7.3)
- [x] Implement `connect()` with auth message
- [x] Implement message type handling for all v3 messages
- [x] Implement `sendInput()` for terminal input
- [x] Implement heartbeat handling
- [x] Implement automatic reconnection on disconnect
- [x] Write tests for WebSocket client
- [x] Verify: XCTest passes

### [x] Step: Create Host management views
<!-- chat-id: bcdf4191-743f-484e-a893-90d0a57c1eea -->

Build host profile UI.

- [x] Create `MConnect/Views/Hosts/HostListView.swift`
- [x] Create `MConnect/Views/Hosts/HostDetailView.swift` for add/edit
- [x] Create `MConnect/Views/Hosts/QRScannerView.swift` using AVFoundation
- [x] Create `MConnect/Models/Host.swift` with Codable
- [x] Persist hosts in Keychain
- [x] Write UI tests for host management
- [x] Verify: XCUITest passes

### [x] Step: Implement terminal view
<!-- chat-id: e9599c70-fbb1-42f3-b5ad-48e840d963b7 -->

Create SwiftUI terminal emulator.

- [x] Evaluate SwiftTerm library for terminal emulation
- [x] Create `MConnect/Views/Terminal/TerminalView.swift` wrapper
- [x] Create `TerminalEmulatorView` using UIViewRepresentable
- [x] Create `KeyboardBarView.swift` with special keys (Ctrl, Esc, Tab, arrows)
- [x] Implement `TerminalViewModel` for WebSocket integration
- [x] Handle terminal output rendering and scrollback
- [x] Write UI tests for terminal interaction
- [x] Verify: XCUITest passes

### [x] Step: Create agent dashboard views
<!-- chat-id: c57cb654-b07f-49d3-a7e6-68d9e6af3540 -->

Build agent monitoring UI.

- [x] Create `MConnect/Views/Agents/AgentDashboard.swift`
- [x] Create `MConnect/Views/Agents/AgentDetailView.swift`
- [x] Create `MConnect/Models/Agent.swift` and `Session.swift`
- [x] Implement agent status badges (running, idle, exited)
- [x] Implement agent tab switching in terminal
- [x] Write UI tests
- [x] Verify: XCUITest passes

---

# Phase 4: Polish & Integration

### [x] Step: Implement push notifications
<!-- chat-id: 4f41af5f-3a9b-4889-8306-5bac3e619c1a -->

Add APNs for agent events.

- [x] Configure APNs capability in Xcode
- [x] Create `MConnect/Services/Notifications/PushService.swift`
- [x] Implement device token registration with server
- [x] Create server-side push notification sending
- [x] Implement notification payloads for agent events
- [x] Handle notification taps to open relevant session
- [x] Test push notifications on device
- [x] Verify: Notifications arrive for agent completion

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
