# @lecoder/server

MConnect V2 Server - Bun-based backend for AI agent orchestration.

## Prerequisites

- [Bun](https://bun.sh/) 1.1+
- [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL and agent containers)
- [PostgreSQL 16](https://www.postgresql.org/) (or use the included Docker Compose)

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Install dependencies
bun install

# 3. Set up environment
cp .env.example .env
# Edit .env with your configuration (see Environment Variables below)

# 4. Run database migrations
bun run db:migrate

# 5. Start development server
bun run dev
```

The server starts at `http://localhost:3001`. For development without OAuth, set `DEV_AUTH_BYPASS=true` and use:

```bash
# Get a dev token
curl -X POST http://localhost:3001/auth/dev-token | jq
```

## Environment Variables

Create a `.env` file (see `.env.example` in the repository root).

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `NODE_ENV` | `development` | Environment (`development`, `production`) |

### Database (PostgreSQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/mconnect` | PostgreSQL connection URL |

### Authentication (JWT)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required.** Secret key for JWT signing (min 32 chars) |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES` | `30d` | Refresh token TTL |
| `DEV_AUTH_BYPASS` | `false` | Skip OAuth in development (never in production) |
| `DEV_USER_ID` | auto-generated | User ID when `DEV_AUTH_BYPASS=true` |

### OAuth Providers

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_REDIRECT_URI` | Callback URL (e.g., `http://localhost:3001/auth/callback`) |

### Docker

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker socket path |

### Opik Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `OPIK_API_KEY` | - | Opik API key from [Comet](https://www.comet.com/account-settings/apiKeys) |
| `OPIK_PROJECT_NAME` | `mconnect` | Project name for traces |
| `OPIK_WORKSPACE_NAME` | - | Workspace name (optional) |
| `OPIK_URL_OVERRIDE` | Comet cloud | API URL for self-hosted Opik |
| `OPIK_ENABLED` | `true` | Enable/disable observability |

### Push Notifications (APNs)

| Variable | Description |
|----------|-------------|
| `APNS_KEY_ID` | APNs key ID |
| `APNS_TEAM_ID` | Apple Developer Team ID |
| `APNS_KEY_PATH` | Path to APNs `.p8` key file |
| `APNS_BUNDLE_ID` | App bundle identifier |
| `APNS_PRODUCTION` | `true` for production APNs, `false` for sandbox |

## Scripts

```bash
# Development
bun run dev              # Start with hot reload
bun run start            # Start production server

# Testing
bun test                 # Run unit tests (skip integration)
bun test:integration     # Run integration tests (requires Docker)
bun test:db              # Run database tests

# Code Quality
bun run lint             # Lint code
bun run lint:fix         # Fix lint issues
bun run format           # Format code
bun run typecheck        # TypeScript type checking

# Database
bun run db:migrate       # Run migrations
bun run db:migrate:status # Check migration status
bun run db:reset         # Reset database (destroys data)
```

## Architecture

```
src/
├── index.ts              # Server entry point (Bun.serve)
├── api/                  # REST API routes
│   ├── sessions.ts       # Session CRUD endpoints
│   ├── presets.ts        # Agent preset endpoints
│   └── devices.ts        # Device token endpoints
├── auth/                 # OAuth 2.0 + JWT
│   ├── oauth.ts          # OAuth flow with PKCE
│   ├── jwt.ts            # JWT token management
│   ├── auth-service.ts   # High-level auth service
│   ├── routes.ts         # HTTP auth routes
│   └── providers/        # OAuth provider implementations
│       └── github.ts
├── ws/                   # WebSocket protocol v3
│   ├── WSHub.ts          # Connection management & message routing
│   ├── InputArbiter.ts   # PC priority input arbitration
│   └── LatencyTracker.ts # Performance metrics
├── agents/               # Agent container runtime
│   ├── AgentManager.ts   # Agent lifecycle
│   ├── AgentWSBridge.ts  # WebSocket integration
│   ├── ContainerRuntime.ts # Docker container management
│   └── presets/          # Agent preset definitions
│       ├── claude.ts
│       └── shell.ts
├── mcp/                  # MCP protocol bridge
│   └── MCPBridge.ts      # MCP message routing
├── session/              # Session management
├── db/                   # PostgreSQL database layer
│   ├── client.ts         # Connection pool
│   ├── migrate.ts        # Migration runner
│   ├── migrations/       # SQL migrations
│   └── repositories/     # Data access layer
├── notifications/        # Push notifications
│   ├── PushService.ts    # APNs integration
│   └── NotificationBridge.ts
├── observability/        # Opik tracing
│   ├── OpikService.ts    # Opik SDK wrapper
│   └── TracingMiddleware.ts
└── __tests__/            # Test files
```

## API Endpoints

Full API documentation: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml)

### Infrastructure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | Server info |
| `GET` | `/health` | No | Health check |
| `GET` | `/metrics/latency` | No | WebSocket latency metrics |
| `WS` | `/ws` | Token | WebSocket endpoint (protocol v3) |

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/authorize` | No | Start OAuth PKCE flow |
| `GET` | `/auth/callback` | No | OAuth provider callback |
| `POST` | `/auth/token` | No | Exchange code for tokens |
| `POST` | `/auth/refresh` | No | Refresh access token |
| `POST` | `/auth/revoke` | No | Revoke refresh token |
| `POST` | `/auth/dev-token` | No | Dev token (dev mode only) |

### Sessions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/sessions` | Bearer | Create session |
| `GET` | `/sessions` | Bearer | List user sessions |
| `GET` | `/sessions/:id` | Bearer | Get session details |
| `DELETE` | `/sessions/:id` | Bearer | Terminate session |
| `GET` | `/sessions/:id/connect` | Bearer | Get WebSocket connection info |

### Presets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/presets` | No | List available presets |
| `GET` | `/presets/:name` | No | Get preset details |
| `POST` | `/presets` | No | Register custom preset |
| `DELETE` | `/presets/:name` | No | Remove custom preset |

### Devices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/devices/token` | Bearer | Register APNs device token |
| `DELETE` | `/devices/token` | Bearer | Remove device token |

## WebSocket Protocol

Protocol v3.0 documentation: [`docs/protocol/v3.md`](../../docs/protocol/v3.md)

Connection flow:
1. Connect to `ws://localhost:3001/ws`
2. Send `auth` message with JWT token (within 10 seconds)
3. Receive `auth_success` with client ID
4. Send `session_attach` to join a session
5. Exchange `terminal_input`/`terminal_output` messages

## Observability

The server integrates with [Opik](https://www.comet.com/docs/opik/) for LLM observability:

```typescript
import { traced, getOpikService } from './observability';

// Trace an operation
const result = await traced('agent:create', { sessionId }, async (ctx) => {
  // Your operation here
  return agent;
});

// Manual tracing
const service = getOpikService();
const ctx = service.startTrace('my-operation', { userId });
try {
  // ... operation ...
  service.endTrace(ctx, result);
} catch (error) {
  service.endTrace(ctx, undefined, error);
  throw error;
}
```

## License

MIT
