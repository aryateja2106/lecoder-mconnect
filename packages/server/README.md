# @lecoder/server

MConnect V2 Server - Bun-based backend for AI agent orchestration.

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment (see Environment Variables below)
cp .env.example .env

# Start development server
bun run dev
```

## Environment Variables

Create a `.env` file with the following variables:

### Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `HOST` | `0.0.0.0` | Server host |

### Database (PostgreSQL)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection URL |

### Authentication (JWT)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | **Required.** Secret key for JWT signing |
| `JWT_ACCESS_EXPIRES` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES` | `30d` | Refresh token expiry |
| `DEV_AUTH_BYPASS` | `false` | Enable dev auth bypass (never in prod) |

### OAuth Providers

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITHUB_REDIRECT_URI` | Callback URL (e.g., `http://localhost:3001/auth/github/callback`) |

### Opik Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `OPIK_API_KEY` | - | Opik API key from [Comet](https://www.comet.com/account-settings/apiKeys) |
| `OPIK_PROJECT_NAME` | `mconnect` | Project name for traces |
| `OPIK_WORKSPACE_NAME` | - | Workspace name (optional) |
| `OPIK_URL_OVERRIDE` | Comet cloud | API URL for self-hosted Opik |
| `OPIK_ENABLED` | `true` | Enable/disable observability |

## Scripts

```bash
# Development
bun run dev          # Start with hot reload
bun run start        # Start production server

# Testing
bun test             # Run tests (skip integration)
bun test:integration # Run integration tests
bun test:db          # Run database tests

# Code Quality
bun run lint         # Lint code
bun run lint:fix     # Fix lint issues
bun run format       # Format code
bun run typecheck    # TypeScript type checking

# Database
bun run db:migrate   # Run migrations
bun run db:reset     # Reset database
```

## Architecture

```
src/
├── api/              # REST API routes
├── auth/             # OAuth + JWT authentication
├── db/               # PostgreSQL database layer
├── ws/               # WebSocket hub (protocol v3)
├── agents/           # Agent container runtime
├── mcp/              # MCP protocol bridge
├── session/          # Session management
├── observability/    # Opik tracing integration
└── index.ts          # Server entry point
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Server info |
| `GET` | `/health` | Health check |
| `GET` | `/auth/github` | Start GitHub OAuth flow |
| `GET` | `/auth/github/callback` | OAuth callback |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/sessions` | Create session |
| `GET` | `/sessions` | List user sessions |
| `GET` | `/sessions/:id` | Get session details |
| `DELETE` | `/sessions/:id` | Terminate session |
| `WS` | `/ws` | WebSocket endpoint |

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
