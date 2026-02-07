# MConnect V2 - Technical Specification

## Document Info
- **Version:** 1.0
- **Created:** 2026-02-05
- **Status:** Draft
- **PRD Reference:** `.zenflow/tasks/new-task-bcba/requirements.md`

---

## 1. Technical Context

### 1.1 Technology Stack

| Layer | V1 Technology | V2 Technology | Rationale |
|-------|---------------|---------------|-----------|
| **Server Runtime** | Node.js 20+ | Bun 1.1+ | 2-3x faster WebSocket, native TypeScript, smaller footprint |
| **Server Language** | TypeScript | TypeScript | Consistency, type safety |
| **WebSocket** | `ws` npm package | Native Bun WebSocket | Better performance, fewer dependencies |
| **Database** | SQLite (better-sqlite3) | PostgreSQL 16+ | Distributed sessions, better concurrency |
| **Container Orchestration** | Docker CLI exec | Docker API + MCP Gateway | Programmatic control, MCP integration |
| **iOS Client** | Embedded HTML/xterm.js | Native SwiftUI | Platform-native UX, Keychain, background modes |
| **Authentication** | Simple token | OAuth 2.0 + JWT | SSO integration, mobile-friendly PKCE flow |
| **Observability** | File logging | Opik SDK | Purpose-built LLM tracing |

### 1.2 Dependencies

**Server (packages/server)**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "opik": "^1.0.0",
    "jose": "^5.0.0",
    "zod": "^3.23.0",
    "postgres": "^3.4.0",
    "dockerode": "^4.0.0"
  },
  "devDependencies": {
    "bun-types": "^1.1.0",
    "@types/dockerode": "^3.3.0",
    "vitest": "^2.0.0"
  }
}
```

**iOS App**
- Swift 5.9+
- SwiftUI 5.0 (iOS 17+)
- Keychain Services (Security.framework)
- URLSession/WebSocket (Foundation)
- SwiftTerm (terminal emulation library - to be evaluated)

### 1.3 V1 Code Migration

| Component | Migration Strategy | Source File |
|-----------|-------------------|-------------|
| **Guardrails** | Direct port, TypeScript types | `src/guardrails.ts` |
| **Agent Types** | Port presets, add MCP types | `src/agents/types.ts` |
| **Container Config** | Port DevContainer parser | `src/container/devcontainer.ts` |
| **Input Arbiter** | Port state machine | `src/input/InputArbiter.ts` |
| **Tunnel Manager** | Reuse as-is | `src/tunnel.ts` |

### 1.4 Project Structure (V2)

```
lecoder-mconnect/
├── packages/
│   ├── server/                    # Bun server (NEW - V2)
│   │   ├── src/
│   │   │   ├── auth/              # OAuth + JWT
│   │   │   ├── ws/                # WebSocket v3 protocol
│   │   │   ├── mcp/               # MCP Gateway integration
│   │   │   ├── agents/            # Agent runtime
│   │   │   ├── session/           # Session management
│   │   │   ├── observability/     # Opik integration
│   │   │   └── db/                # PostgreSQL models
│   │   └── tests/
│   ├── cli/                       # Existing CLI (refactored)
│   │   └── src/                   # Commands: start, attach, daemon
│   ├── shared/                    # Shared types and utilities
│   │   └── src/
│   │       ├── types/             # Shared TypeScript types
│   │       ├── protocol/          # Protocol definitions
│   │       └── guardrails/        # Guardrails (ported from V1)
│   └── ios-app/                   # Swift iOS app (NEW)
│       ├── MConnect/
│       │   ├── App/
│       │   ├── Views/
│       │   │   ├── Terminal/
│       │   │   ├── Hosts/
│       │   │   ├── Agents/
│       │   │   └── Vault/
│       │   ├── Services/
│       │   │   ├── WebSocket/
│       │   │   ├── Keychain/
│       │   │   └── Auth/
│       │   └── Models/
│       └── MConnect.xcodeproj
├── apps/
│   └── website/                   # Existing Next.js site
└── docs/
    ├── api/                       # OpenAPI specs
    └── protocol/                  # Protocol specs
```

---

## 2. System Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              iOS App (Swift)                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │   Vault    │  │   Hosts    │  │  Terminal  │  │   Agents   │            │
│  │ (Keychain) │  │ (Profiles) │  │  (SwiftUI) │  │ (Dashboard)│            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
│        └───────────────┴───────────────┴───────────────┘                    │
│                                │                                             │
│                    ┌───────────┴───────────┐                                │
│                    │   WebSocket Client    │                                │
│                    │   (Protocol v3.0)     │                                │
│                    └───────────┬───────────┘                                │
└────────────────────────────────┼────────────────────────────────────────────┘
                                 │ wss:// (TLS 1.3)
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│                         MConnect Server (Bun)                                │
│  ┌─────────────────────────────┴─────────────────────────────────┐          │
│  │                      WebSocket Hub (v3)                        │          │
│  │  • Protocol negotiation (v1 compat, v2 compat, v3 native)     │          │
│  │  • MCP message routing                                         │          │
│  │  • Input arbitration (PC priority)                             │          │
│  │  • Heartbeat & reconnection                                    │          │
│  └───────────────────────────────────────────────────────────────┘          │
│           │                    │                    │                        │
│  ┌────────┴────────┐  ┌───────┴───────┐  ┌────────┴────────┐               │
│  │   Auth Service  │  │Session Manager│  │  Agent Manager  │               │
│  │  • OAuth 2.0    │  │  • PostgreSQL │  │  • Containers   │               │
│  │  • JWT tokens   │  │  • State sync │  │  • MCP Gateway  │               │
│  │  • PKCE flow    │  │  • Scrollback │  │  • Lifecycle    │               │
│  └────────┬────────┘  └───────┬───────┘  └────────┬────────┘               │
│           │                    │                    │                        │
│  ┌────────┴────────────────────┴────────────────────┴────────┐              │
│  │                    Observability (Opik)                    │              │
│  │  • Trace all operations      • Token counting              │              │
│  │  • User attribution          • Custom spans                │              │
│  └────────────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────────────────┐
│                    Docker MCP Gateway                                        │
│  ┌─────────────────────────────┴─────────────────────────────────┐          │
│  │                    Container Orchestration                     │          │
│  │  • Container lifecycle (create, start, stop, remove)          │          │
│  │  • Resource limits (CPU, memory, disk)                        │          │
│  │  • Namespace/cgroup isolation                                  │          │
│  └───────────────────────────────────────────────────────────────┘          │
│           │                    │                    │                        │
│  ┌────────┴────────┐  ┌───────┴───────┐  ┌────────┴────────┐               │
│  │  Claude Code    │  │  Gemini CLI   │  │  Custom Agent   │               │
│  │  Container      │  │  Container    │  │  Container      │               │
│  └─────────────────┘  └───────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

#### 2.2.1 Auth Service

**Responsibilities:**
- OAuth 2.0 authorization code flow with PKCE
- JWT token issuance, validation, and refresh
- Provider integration (GitHub, Google)
- Local development bypass mode

**Key Files:**
- `packages/server/src/auth/oauth.ts` - OAuth flow handlers
- `packages/server/src/auth/jwt.ts` - JWT token management
- `packages/server/src/auth/providers/` - Provider implementations

**Interface:**
```typescript
interface AuthService {
  // OAuth flow
  getAuthorizationUrl(provider: 'github' | 'google', state: string, codeVerifier: string): string;
  exchangeCode(provider: string, code: string, codeVerifier: string): Promise<TokenPair>;

  // JWT management
  validateToken(token: string): Promise<TokenClaims | null>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  revokeToken(token: string): Promise<void>;

  // Development mode
  createDevToken(userId: string): TokenPair;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TokenClaims {
  sub: string;      // User ID
  email: string;
  name: string;
  provider: string;
  iat: number;
  exp: number;
}
```

#### 2.2.2 Session Manager

**Responsibilities:**
- Session lifecycle (create, attach, detach, terminate)
- Distributed state in PostgreSQL
- Scrollback buffer persistence
- Client presence tracking

**Key Files:**
- `packages/server/src/session/SessionManager.ts`
- `packages/server/src/session/SessionStore.ts` (PostgreSQL)
- `packages/server/src/session/ScrollbackBuffer.ts`

**Interface:**
```typescript
interface SessionManager {
  // Lifecycle
  createSession(config: SessionConfig): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  terminateSession(id: string): Promise<void>;

  // Client management
  attachClient(sessionId: string, clientId: string, clientType: ClientType): Promise<Client>;
  detachClient(clientId: string): Promise<void>;
  getSessionClients(sessionId: string): Promise<Client[]>;

  // Scrollback
  appendOutput(sessionId: string, data: string): void;
  getScrollback(sessionId: string, fromLine: number, count: number): Promise<string[]>;

  // State
  updateState(sessionId: string, state: SessionState): Promise<void>;
}
```

#### 2.2.3 Agent Manager

**Responsibilities:**
- Container lifecycle via Docker API
- MCP protocol handling
- Agent preset management
- Resource limit enforcement

**Key Files:**
- `packages/server/src/agents/AgentManager.ts`
- `packages/server/src/agents/ContainerRuntime.ts`
- `packages/server/src/agents/MCPBridge.ts`

**Interface:**
```typescript
interface AgentManager {
  // Lifecycle
  createAgent(sessionId: string, config: AgentConfig): Promise<Agent>;
  startAgent(agentId: string): Promise<void>;
  stopAgent(agentId: string, signal?: string): Promise<void>;

  // I/O
  writeToAgent(agentId: string, data: string): void;
  onAgentOutput(agentId: string, callback: (data: string) => void): void;

  // MCP
  sendMCPMessage(agentId: string, message: MCPMessage): Promise<MCPResponse>;
  registerTool(agentId: string, tool: MCPTool): void;

  // Status
  getAgentStatus(agentId: string): AgentStatus;
  getAllAgents(sessionId: string): Agent[];
}
```

#### 2.2.4 WebSocket Hub

**Responsibilities:**
- Protocol negotiation (v1/v2/v3 compatibility)
- Message routing and multiplexing
- Input arbitration (PC priority)
- Heartbeat and reconnection

**Key Files:**
- `packages/server/src/ws/WSHub.ts`
- `packages/server/src/ws/Protocol.ts`
- `packages/server/src/ws/InputArbiter.ts` (ported from V1)

**Interface:**
```typescript
interface WSHub {
  // Connection management
  handleConnection(ws: WebSocket, request: Request): void;
  disconnect(clientId: string): void;

  // Messaging
  sendToClient(clientId: string, message: ServerMessage): void;
  broadcastToSession(sessionId: string, message: ServerMessage, exclude?: string): void;

  // Input arbitration
  processInput(clientId: string, input: string): InputResult;
  requestExclusiveControl(clientId: string): boolean;
  releaseControl(clientId: string): void;

  // Status
  getClientInfo(clientId: string): ClientInfo | null;
  getSessionClients(sessionId: string): ClientInfo[];
}
```

#### 2.2.5 Observability Service

**Responsibilities:**
- Opik SDK initialization
- Trace all agent operations
- LLM call tracing with token counts
- User attribution

**Key Files:**
- `packages/server/src/observability/OpikService.ts`
- `packages/server/src/observability/TracingMiddleware.ts`

**Interface:**
```typescript
interface ObservabilityService {
  // Initialization
  initialize(config: OpikConfig): Promise<void>;

  // Tracing
  startTrace(operation: string, metadata?: Record<string, unknown>): TraceContext;
  endTrace(ctx: TraceContext, result?: unknown, error?: Error): void;

  // Spans
  startSpan(ctx: TraceContext, name: string): SpanContext;
  endSpan(span: SpanContext): void;

  // LLM-specific
  logLLMCall(ctx: TraceContext, call: LLMCallData): void;

  // Metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>): void;
}
```

---

## 3. Data Models

### 3.1 PostgreSQL Schema

```sql
-- Users (from OAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(provider, provider_id)
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL DEFAULT 'running',
  agent_config JSONB NOT NULL,
  working_directory TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CHECK (state IN ('running', 'paused', 'completed'))
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_state ON sessions(state);

-- Agents
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'starting',
  container_id VARCHAR(64),
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  exit_code INTEGER,
  CHECK (status IN ('starting', 'running', 'idle', 'waiting', 'exited', 'error'))
);

CREATE INDEX idx_agents_session_id ON agents(session_id);

-- Clients (connected devices)
CREATE TABLE clients (
  id VARCHAR(64) PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  client_type VARCHAR(20) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  user_agent TEXT,
  ip_address INET,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (client_type IN ('pc', 'mobile')),
  CHECK (priority IN ('exclusive', 'high', 'normal', 'low', 'observer'))
);

CREATE INDEX idx_clients_session_id ON clients(session_id);

-- Scrollback buffer (partitioned by session for efficient cleanup)
CREATE TABLE scrollback (
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, line_number)
);

-- Input audit log
CREATE TABLE input_log (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  input TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  reject_reason VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_input_log_session_id ON input_log(session_id);
CREATE INDEX idx_input_log_created_at ON input_log(created_at);

-- OAuth tokens (for server-side storage)
CREATE TABLE oauth_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refresh tokens (for JWT rotation)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

### 3.2 TypeScript Types

```typescript
// packages/shared/src/types/models.ts

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'github' | 'google';
  providerId: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export type SessionState = 'running' | 'paused' | 'completed';

export interface Session {
  id: string;
  userId: string;
  state: SessionState;
  agentConfig: AgentSessionConfig;
  workingDirectory: string;
  createdAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
}

export interface AgentSessionConfig {
  preset: string;
  agents: AgentConfig[];
  guardrails?: GuardrailLevel;
}

export type AgentType = 'claude' | 'gemini' | 'codex' | 'aider' | 'shell' | 'custom';
export type AgentStatus = 'starting' | 'running' | 'idle' | 'waiting' | 'exited' | 'error';

export interface AgentConfig {
  type: AgentType;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  container?: ContainerConfig;
  mcp?: MCPConfig;
}

export interface Agent {
  id: string;
  sessionId: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  containerId?: string;
  config: AgentConfig;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  exitCode?: number;
}

export type ClientType = 'pc' | 'mobile';
export type Priority = 'exclusive' | 'high' | 'normal' | 'low' | 'observer';

export interface Client {
  id: string;
  sessionId: string;
  userId?: string;
  clientType: ClientType;
  priority: Priority;
  userAgent?: string;
  ipAddress?: string;
  connectedAt: Date;
  lastHeartbeatAt: Date;
}

export interface ContainerConfig {
  image: string;
  workDir?: string;
  volumes?: string[];
  ports?: string[];
  env?: Record<string, string>;
  network?: string;
  privileged?: boolean;
  user?: string;
  resourceLimits?: {
    cpuShares?: number;
    memoryMB?: number;
    diskMB?: number;
  };
}

export interface MCPConfig {
  transport: 'stdio' | 'sse';
  tools?: MCPToolConfig[];
  resources?: MCPResourceConfig[];
}
```

---

## 4. API Specification

### 4.1 REST API (OpenAPI 3.1)

```yaml
openapi: 3.1.0
info:
  title: MConnect V2 API
  version: 2.0.0
  description: API for MConnect mobile terminal control

servers:
  - url: https://api.mconnect.local
    description: Local development

paths:
  /auth/authorize:
    get:
      summary: Start OAuth flow
      parameters:
        - name: provider
          in: query
          required: true
          schema:
            type: string
            enum: [github, google]
        - name: redirect_uri
          in: query
          required: true
          schema:
            type: string
            format: uri
        - name: code_challenge
          in: query
          required: true
          schema:
            type: string
        - name: code_challenge_method
          in: query
          required: true
          schema:
            type: string
            enum: [S256]
      responses:
        '302':
          description: Redirect to OAuth provider

  /auth/callback:
    get:
      summary: OAuth callback
      parameters:
        - name: code
          in: query
          required: true
          schema:
            type: string
        - name: state
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'

  /auth/refresh:
    post:
      summary: Refresh access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                refresh_token:
                  type: string
              required: [refresh_token]
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'

  /sessions:
    get:
      summary: List user sessions
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Session list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Session'

    post:
      summary: Create new session
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'
      responses:
        '201':
          description: Session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

  /sessions/{sessionId}:
    get:
      summary: Get session details
      security:
        - bearerAuth: []
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Session details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

    delete:
      summary: Terminate session
      security:
        - bearerAuth: []
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Session terminated

  /sessions/{sessionId}/agents:
    get:
      summary: List session agents
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Agent list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Agent'

    post:
      summary: Create new agent
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateAgentRequest'
      responses:
        '201':
          description: Agent created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Agent'

  /sessions/{sessionId}/connect:
    get:
      summary: Get WebSocket connection info
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Connection info
          content:
            application/json:
              schema:
                type: object
                properties:
                  wsUrl:
                    type: string
                    format: uri
                  token:
                    type: string
                  protocolVersion:
                    type: string

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    TokenResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        expires_in:
          type: integer
        token_type:
          type: string
          enum: [Bearer]

    Session:
      type: object
      properties:
        id:
          type: string
          format: uuid
        state:
          type: string
          enum: [running, paused, completed]
        agentConfig:
          $ref: '#/components/schemas/AgentSessionConfig'
        workingDirectory:
          type: string
        createdAt:
          type: string
          format: date-time
        lastActivityAt:
          type: string
          format: date-time

    CreateSessionRequest:
      type: object
      properties:
        preset:
          type: string
        workingDirectory:
          type: string
        guardrails:
          type: string
          enum: [none, permissive, default, strict]

    Agent:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [claude, gemini, codex, aider, shell, custom]
        name:
          type: string
        status:
          type: string
          enum: [starting, running, idle, waiting, exited, error]
        createdAt:
          type: string
          format: date-time

    CreateAgentRequest:
      type: object
      properties:
        type:
          type: string
        name:
          type: string
        command:
          type: string
        container:
          type: object
```

---

## 5. WebSocket Protocol v3.0

### 5.1 Protocol Overview

Protocol v3.0 extends v2.0 with:
- MCP message routing
- OAuth token authentication (not query param)
- Structured error responses with retry hints
- Binary message support for large outputs

**Connection URL:** `wss://{host}/ws`

**Authentication:** Bearer token in first message (not URL param)

### 5.2 Message Format

All messages are JSON unless binary flag is set.

```typescript
// Base message structure
interface BaseMessage {
  type: string;
  id?: string;        // Optional message ID for request/response correlation
  timestamp?: number; // Unix timestamp (server messages always include)
}
```

### 5.3 Client → Server Messages

```typescript
// Authentication (must be first message)
interface AuthMessage {
  type: 'auth';
  token: string;           // JWT access token
  protocolVersion: '3.0';
  clientType: 'pc' | 'mobile';
}

// Session operations
interface SessionAttachMessage {
  type: 'session_attach';
  sessionId: string;
}

interface SessionDetachMessage {
  type: 'session_detach';
}

// Terminal input
interface TerminalInputMessage {
  type: 'terminal_input';
  agentId: string;
  data: string;
}

// Terminal resize
interface ResizeMessage {
  type: 'resize';
  agentId: string;
  cols: number;
  rows: number;
}

// Control requests
interface ControlRequestMessage {
  type: 'control_request';
  action: 'exclusive' | 'release';
}

// Scrollback request
interface ScrollbackRequestMessage {
  type: 'scrollback_request';
  sessionId: string;
  fromLine: number;
  count: number;
}

// MCP message (forwarded to agent)
interface MCPForwardMessage {
  type: 'mcp_forward';
  agentId: string;
  message: MCPMessage;
}

// Heartbeat acknowledgment
interface HeartbeatAckMessage {
  type: 'heartbeat_ack';
  timestamp: number;
}

// Ping
interface PingMessage {
  type: 'ping';
}
```

### 5.4 Server → Client Messages

```typescript
// Authentication result
interface AuthSuccessMessage {
  type: 'auth_success';
  clientId: string;
  protocolVersion: '3.0';
  clientType: 'pc' | 'mobile';
  userId: string;
  timestamp: number;
}

interface AuthFailedMessage {
  type: 'auth_failed';
  reason: 'invalid_token' | 'expired_token' | 'missing_token';
  retryable: boolean;
  timestamp: number;
}

// Session state
interface SessionListMessage {
  type: 'session_list';
  sessions: SessionInfo[];
  timestamp: number;
}

interface SessionStateMessage {
  type: 'session_state';
  sessionId: string;
  state: 'running' | 'paused' | 'completed';
  lastActivity: number;
  timestamp: number;
}

// Terminal output
interface TerminalOutputMessage {
  type: 'terminal_output';
  agentId: string;
  data: string;
  timestamp: number;
}

// Agent status
interface AgentStatusMessage {
  type: 'agent_status';
  agentId: string;
  status: 'starting' | 'running' | 'idle' | 'waiting' | 'exited' | 'error';
  timestamp: number;
}

interface AgentListMessage {
  type: 'agent_list';
  agents: AgentInfo[];
  timestamp: number;
}

// Control status
interface ControlStatusMessage {
  type: 'control_status';
  sessionId: string;
  state: 'pc_active' | 'pc_idle' | 'pc_disconnected' | 'mobile_exclusive';
  activeClient?: string;
  exclusiveExpires?: number;
  lastPcActivity?: number;
  timestamp: number;
}

interface ControlResponseMessage {
  type: 'control_response';
  granted: boolean;
  reason?: string;
  expiresAt?: number;
  timestamp: number;
}

// Input rejection
interface InputRejectedMessage {
  type: 'input_rejected';
  reason: 'pc_typing' | 'other_exclusive' | 'rate_limited' | 'read_only' | 'guardrail_blocked';
  command?: string;
  timestamp: number;
}

// Scrollback response
interface ScrollbackResponseMessage {
  type: 'scrollback_response';
  sessionId: string;
  lines: string[];
  fromLine: number;
  totalLines: number;
  timestamp: number;
}

// MCP response
interface MCPResponseMessage {
  type: 'mcp_response';
  agentId: string;
  message: MCPMessage;
  timestamp: number;
}

// Client presence
interface ClientJoinedMessage {
  type: 'client_joined';
  client: {
    id: string;
    clientType: 'pc' | 'mobile';
    priority: string;
  };
  timestamp: number;
}

interface ClientLeftMessage {
  type: 'client_left';
  clientId: string;
  timestamp: number;
}

// Heartbeat
interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
  serverTime: number;
}

// Pong
interface PongMessage {
  type: 'pong';
  timestamp: number;
}

// Error
interface ErrorMessage {
  type: 'error';
  message: string;
  code: ErrorCode;
  retryable: boolean;
  retryAfterMs?: number;
  timestamp: number;
}

type ErrorCode =
  | 'AUTH_FAILED'
  | 'AUTH_EXPIRED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_COMPLETED'
  | 'NOT_ATTACHED'
  | 'RATE_LIMITED'
  | 'GUARDRAIL_BLOCKED'
  | 'INTERNAL_ERROR';
```

### 5.5 Protocol Flow

```
Client                                  Server
  |                                       |
  |------ auth (JWT token) ------------->|
  |<----- auth_success ------------------|
  |<----- session_list ------------------|
  |                                       |
  |------ session_attach --------------->|
  |<----- session_state -----------------|
  |<----- scrollback_response -----------|
  |<----- control_status ----------------|
  |<----- agent_list --------------------|
  |                                       |
  |------ terminal_input --------------->|
  |<----- terminal_output ---------------|
  |                                       |
  |<----- heartbeat (every 30s) ---------|
  |------ heartbeat_ack ---------------->|
  |                                       |
```

### 5.6 Rate Limits

```typescript
const RATE_LIMITS = {
  inputCharsPerSecond: 100,
  controlRequestsPerWindow: 1,
  controlRequestWindowMs: 10000,
  scrollbackRequestsPerSecond: 10,
  mcpMessagesPerSecond: 20,
  reconnectionAttemptsPerMinute: 5,
};
```

---

## 6. Security Model

### 6.1 Authentication Flow (OAuth 2.0 + PKCE)

```
┌─────────┐                 ┌──────────┐                 ┌──────────┐
│ iOS App │                 │ MConnect │                 │  GitHub  │
│         │                 │  Server  │                 │  OAuth   │
└────┬────┘                 └────┬─────┘                 └────┬─────┘
     │                            │                            │
     │ 1. Generate code_verifier  │                            │
     │    + code_challenge        │                            │
     │                            │                            │
     │ 2. GET /auth/authorize     │                            │
     │    ?provider=github        │                            │
     │    &code_challenge=...     │                            │
     ├───────────────────────────>│                            │
     │                            │                            │
     │ 3. 302 Redirect            │                            │
     │<───────────────────────────┤                            │
     │                            │                            │
     │ 4. Open in Safari          │                            │
     │─────────────────────────────────────────────────────────>│
     │                            │                            │
     │ 5. User authorizes         │                            │
     │<─────────────────────────────────────────────────────────┤
     │                            │                            │
     │ 6. Redirect to app         │                            │
     │   mconnect://callback      │                            │
     │   ?code=...&state=...      │                            │
     │                            │                            │
     │ 7. POST /auth/callback     │                            │
     │    {code, code_verifier}   │                            │
     ├───────────────────────────>│                            │
     │                            │ 8. Exchange code           │
     │                            │    with code_verifier      │
     │                            ├───────────────────────────>│
     │                            │                            │
     │                            │ 9. Access token            │
     │                            │<───────────────────────────┤
     │                            │                            │
     │ 10. {access_token,         │                            │
     │      refresh_token}        │                            │
     │<───────────────────────────┤                            │
     │                            │                            │
```

### 6.2 JWT Token Structure

```typescript
// Access Token Claims
interface AccessTokenClaims {
  iss: 'mconnect';
  sub: string;        // User UUID
  email: string;
  name: string;
  provider: 'github' | 'google';
  iat: number;        // Issued at
  exp: number;        // Expires (15 minutes)
  jti: string;        // Unique token ID
}

// Refresh Token Claims
interface RefreshTokenClaims {
  iss: 'mconnect';
  sub: string;        // User UUID
  iat: number;
  exp: number;        // Expires (30 days)
  jti: string;
}
```

### 6.3 iOS Keychain Storage

```swift
// Keychain items stored by the iOS app

struct KeychainItems {
    // OAuth tokens (encrypted by Keychain)
    static let accessToken = "com.mconnect.accessToken"
    static let refreshToken = "com.mconnect.refreshToken"

    // User info (for offline display)
    static let userProfile = "com.mconnect.userProfile"

    // Host profiles (connection settings)
    static let hostProfiles = "com.mconnect.hostProfiles"

    // SSH keys (future)
    static let sshKeys = "com.mconnect.sshKeys"
}

// Keychain access control
let accessControl = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    .biometryCurrentSet,  // Require Face ID / Touch ID
    nil
)
```

### 6.4 Container Isolation

```typescript
// Security profile for agent containers
interface ContainerSecurityProfile {
  // Namespace isolation
  pid: 'private';      // Own PID namespace
  network: 'bridge';   // Isolated network (configurable)
  ipc: 'private';      // Own IPC namespace

  // Resource limits
  memory: '512m';      // Default memory limit
  cpus: '1.0';         // Default CPU limit
  pids: 100;           // Max processes

  // Filesystem
  readOnlyRootfs: false;
  noNewPrivileges: true;

  // Capabilities (drop all except minimal)
  capDrop: ['ALL'];
  capAdd: ['CHOWN', 'DAC_OVERRIDE', 'FOWNER', 'SETGID', 'SETUID'];

  // Seccomp profile
  seccompProfile: 'default';
}
```

### 6.5 Guardrails (Ported from V1)

```typescript
// packages/shared/src/guardrails/index.ts

export type GuardrailLevel = 'none' | 'permissive' | 'default' | 'strict';

export interface GuardrailConfig {
  level: GuardrailLevel;
  blockedPatterns: RegExp[];
  approvalPatterns: RegExp[];
}

// Default blocked patterns (dangerous, never allow)
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[/~]/i,    // rm -rf on root or home
  /rm\s+-rf?\s+\.\/?$/i,                 // rm -rf .
  /mkfs/i,                               // Format disk
  /dd\s+if=/i,                           // Direct disk write
  /:\(\)\{\s*:\|:&\s*\};:/,              // Fork bomb
  /chmod\s+-R\s+777/i,                   // Dangerous permissions
  />\s*\/dev\/sd/i,                      // Write to disk device
];

// Default approval patterns (require confirmation)
const APPROVAL_PATTERNS = {
  default: [
    /git\s+push\s+.*--force/i,  // Force push
    /git\s+reset\s+--hard/i,    // Hard reset
    /rm\s+-rf?\s+/i,            // rm -rf (not root)
    /npm\s+publish/i,           // npm publish
    /DROP\s+TABLE/i,            // SQL drop
  ],
  strict: [
    /rm\s/i,                    // Any rm command
    /git\s+push/i,              // All git push
    /git\s+reset/i,             // All git reset
    /docker\s+rm/i,             // docker remove
    /kubectl\s+delete/i,        // k8s delete
  ],
};
```

---

## 7. iOS App Architecture

### 7.1 App Structure

```
MConnect/
├── App/
│   ├── MConnectApp.swift          # App entry point
│   ├── AppDelegate.swift          # Background/push notification setup
│   └── Router.swift               # Navigation coordinator
├── Views/
│   ├── Terminal/
│   │   ├── TerminalView.swift     # Main terminal view
│   │   ├── TerminalEmulator.swift # SwiftTerm wrapper
│   │   └── KeyboardBar.swift      # Custom shortcut bar
│   ├── Hosts/
│   │   ├── HostListView.swift     # Host profile list
│   │   ├── HostDetailView.swift   # Edit host
│   │   └── QRScannerView.swift    # QR code scanner
│   ├── Agents/
│   │   ├── AgentDashboard.swift   # Agent overview
│   │   └── AgentDetailView.swift  # Agent controls
│   └── Vault/
│       ├── VaultView.swift        # Credentials list
│       └── VaultItemView.swift    # Edit credential
├── Services/
│   ├── WebSocket/
│   │   ├── WSClient.swift         # WebSocket client
│   │   ├── Protocol.swift         # Message types
│   │   └── InputArbiter.swift     # Client-side arbitration
│   ├── Keychain/
│   │   ├── KeychainService.swift  # Keychain wrapper
│   │   └── BiometricAuth.swift    # Face ID / Touch ID
│   ├── Auth/
│   │   ├── AuthService.swift      # OAuth flow
│   │   └── TokenManager.swift     # JWT storage/refresh
│   └── Notifications/
│       └── PushService.swift      # Push notification handling
├── Models/
│   ├── Host.swift
│   ├── Session.swift
│   ├── Agent.swift
│   └── VaultItem.swift
└── Resources/
    ├── Assets.xcassets
    └── Info.plist
```

### 7.2 Key SwiftUI Components

```swift
// Terminal View
struct TerminalView: View {
    @StateObject private var viewModel: TerminalViewModel
    @State private var showKeyboard = false

    var body: some View {
        VStack(spacing: 0) {
            // Terminal content
            TerminalEmulatorView(terminal: viewModel.terminal)
                .onTapGesture { showKeyboard.toggle() }

            // Shortcut bar (Ctrl, Esc, Tab, arrows)
            if showKeyboard {
                KeyboardBarView(onKey: viewModel.sendKey)
            }
        }
        .toolbar {
            ToolbarItem(placement: .principal) {
                AgentPicker(agents: viewModel.agents,
                           selected: $viewModel.activeAgent)
            }
        }
    }
}

// Host List View
struct HostListView: View {
    @StateObject private var viewModel = HostListViewModel()

    var body: some View {
        NavigationStack {
            List {
                ForEach(viewModel.hosts) { host in
                    HostRow(host: host)
                        .onTapGesture { viewModel.connect(to: host) }
                }
            }
            .navigationTitle("Hosts")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Scan QR Code") { viewModel.showScanner = true }
                        Button("Add Manually") { viewModel.showAddHost = true }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .sheet(isPresented: $viewModel.showScanner) {
            QRScannerView { url in
                viewModel.handleQRCode(url)
            }
        }
    }
}
```

### 7.3 WebSocket Client (Swift)

```swift
// services/WebSocket/WSClient.swift

class WSClient: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var currentSession: Session?
    @Published var agents: [Agent] = []

    private var webSocket: URLSessionWebSocketTask?
    private var heartbeatTimer: Timer?

    func connect(to host: Host) async throws {
        let url = URL(string: "wss://\(host.address):\(host.port)/ws")!
        webSocket = URLSession.shared.webSocketTask(with: url)
        webSocket?.resume()

        // Authenticate
        let authMessage = AuthMessage(
            type: "auth",
            token: try await TokenManager.shared.getAccessToken(),
            protocolVersion: "3.0",
            clientType: "mobile"
        )
        try await send(authMessage)

        // Start receive loop
        startReceiving()
        startHeartbeat()
    }

    func sendInput(_ text: String, to agentId: String) async throws {
        let message = TerminalInputMessage(
            type: "terminal_input",
            agentId: agentId,
            data: text
        )
        try await send(message)
    }

    private func startReceiving() {
        Task {
            while let message = try? await webSocket?.receive() {
                switch message {
                case .data(let data):
                    handleBinaryMessage(data)
                case .string(let text):
                    handleTextMessage(text)
                @unknown default:
                    break
                }
            }
        }
    }
}
```

---

## 8. Delivery Phases

### 8.1 Phase 1: Foundation (Core Server)

**Objective:** Basic server with OAuth and session management

**Deliverables:**
1. Bun server skeleton with WebSocket
2. OAuth 2.0 flow (GitHub provider)
3. JWT token management
4. PostgreSQL schema and migrations
5. Basic session CRUD
6. Opik SDK initialization

**Verification:**
- `bun test` passes all auth tests
- OAuth flow works with mobile Safari
- JWT tokens validate correctly
- Database migrations run cleanly

**Exit Criteria:**
- Can authenticate via GitHub OAuth
- Can create/list/terminate sessions via API
- Opik receives test events

### 8.2 Phase 2: Agent Runtime

**Objective:** Containerized agent execution with MCP

**Deliverables:**
1. Docker API integration
2. Container lifecycle (create/start/stop)
3. MCP stdio transport
4. Agent presets (Claude, shell)
5. Guardrails migration from V1
6. Tracing integration for agent ops

**Verification:**
- `bun test` passes agent tests
- Container creates and runs commands
- MCP messages route correctly
- Guardrails block dangerous commands

**Exit Criteria:**
- Can create Claude Code agent in container
- Agent output streams to WebSocket
- Guardrails block `rm -rf /`

### 8.3 Phase 3: iOS App Core

**Objective:** Native iOS app with terminal and connection

**Deliverables:**
1. SwiftUI terminal view (SwiftTerm integration)
2. Keychain service for credentials
3. Host profile management
4. WebSocket client (Protocol v3)
5. QR code scanner
6. Basic agent dashboard

**Verification:**
- Xcode builds without warnings
- UI tests pass
- Terminal renders correctly
- WebSocket connects and authenticates

**Exit Criteria:**
- Can scan QR code and connect
- Can type commands and see output
- Can switch between agents

### 8.4 Phase 4: Polish & Integration

**Objective:** Production-ready release

**Deliverables:**
1. Push notifications (agent events)
2. Background WebSocket keepalive
3. Reconnection handling
4. Performance optimization
5. Error handling improvements
6. Documentation

**Verification:**
- Performance benchmarks meet targets
- Background mode works correctly
- Reconnection handles network changes
- All P0 requirements verified

**Exit Criteria:**
- <100ms input latency
- Reconnects within 5s
- App Store ready

---

## 9. Verification Approach

### 9.1 Test Strategy

| Test Type | Tool | Coverage Target |
|-----------|------|-----------------|
| Unit Tests | Vitest (server), XCTest (iOS) | 80% line coverage |
| Integration Tests | Vitest + Docker | All API endpoints |
| E2E Tests | Playwright (web), XCUITest (iOS) | Critical user flows |
| Load Tests | k6 | 100 concurrent sessions |

### 9.2 Commands

```bash
# Server tests
cd packages/server
bun test                    # Unit tests
bun test:integration        # Integration tests (requires Docker)
bun test:coverage           # Coverage report

# iOS tests
xcodebuild test -project MConnect.xcodeproj -scheme MConnect -destination 'platform=iOS Simulator,name=iPhone 15'

# Lint
bun run lint                # Biome linting
bun run typecheck           # TypeScript type checking

# Build
bun run build               # Production build
```

### 9.3 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  server:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
      - run: bun run typecheck

  ios:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.0'
      - run: xcodebuild test -project packages/ios-app/MConnect.xcodeproj -scheme MConnect -destination 'platform=iOS Simulator,name=iPhone 15'
```

### 9.4 Performance Targets

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| WebSocket latency (server) | <10ms | Internal timing |
| Input-to-display roundtrip | <100ms | E2E test with timestamps |
| Container cold start | <5s | Agent creation time |
| iOS app launch | <2s | XCUITest measurement |
| Memory per container | <512MB | Docker stats |

---

## 10. Open Technical Decisions

### 10.1 Resolved (in this spec)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | PostgreSQL | Distributed sessions, better concurrency |
| Container API | dockerode | Programmatic control, no shell injection |
| iOS Terminal | SwiftTerm | Active maintenance, good performance |
| Protocol Auth | Bearer in message | More secure than URL params |

### 10.2 To Be Decided During Implementation

| Decision | Options | Deciding Factor |
|----------|---------|-----------------|
| Push Notification Service | APNs direct vs Firebase | Team familiarity, cost |
| iOS State Management | Observable + @Published vs TCA | Complexity of flows |
| Opik Deployment | Cloud vs self-hosted | Privacy requirements |
| SSH Key Support | P1 | User demand |

---

## Appendix A: V1 → V2 Migration Checklist

### Code to Port
- [ ] `src/guardrails.ts` → `packages/shared/src/guardrails/`
- [ ] `src/agents/types.ts` → `packages/shared/src/types/agents.ts`
- [ ] `src/container/devcontainer.ts` → `packages/server/src/agents/devcontainer.ts`
- [ ] `src/input/InputArbiter.ts` → `packages/server/src/ws/InputArbiter.ts`
- [ ] `src/tunnel.ts` → `packages/server/src/tunnel/`

### Code to Rewrite
- [ ] WebSocket protocol (v1/v2 → v3)
- [ ] Session management (SQLite → PostgreSQL)
- [ ] Authentication (token → OAuth)
- [ ] Container management (CLI exec → Docker API)

### Code to Deprecate
- [ ] Web client (embedded HTML)
- [ ] V1 protocol handlers (after migration period)
- [ ] SQLite session store

---

## Appendix B: Environment Variables

```bash
# .env.example

# Server
PORT=8765
NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost:5432/mconnect

# OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# JWT
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

# Opik
OPIK_API_KEY=
OPIK_PROJECT_NAME=mconnect

# Docker
DOCKER_HOST=unix:///var/run/docker.sock

# Development
DEV_AUTH_BYPASS=false
DEV_USER_ID=dev-user-123
```

---

## Appendix C: Related Documents

- PRD: `.zenflow/tasks/new-task-bcba/requirements.md`
- Implementation Plan: `.zenflow/tasks/new-task-bcba/plan.md`
- API Spec (full): `docs/api/openapi.yaml` (to be generated)
- Protocol Spec: `docs/protocol/v3.md` (to be generated)
