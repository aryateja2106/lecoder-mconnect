# Spec: Observability & Telemetry (OpenTelemetry)

## Objective
Replace the current opaque Opik integration with a standard, vendor-neutral OpenTelemetry (OTel) observability layer. This will provide tracing, metrics, and logging across the Multi-Machine AI Fleet without vendor lock-in. Success means Opik is completely removed, OTel is instrumented in both CLI and Server, and agents can be traced end-to-end securely.

## Tech Stack
- Node.js (CLI) / Bun (Server)
- `@opentelemetry/sdk-node`
- `@opentelemetry/api`
- `@opentelemetry/exporter-trace-otlp-http`

## Commands
Build: `npm run build --workspaces`
Lint: `npm run lint --workspaces` (if applicable)

## Project Structure
`packages/shared/src/observability/` -> Shared OpenTelemetry types and config.
`packages/cli/src/observability/` -> OpenTelemetry instrumentation for the Node CLI.
`packages/server/src/observability/` -> OpenTelemetry instrumentation for the Bun Hub.
**To Delete:** `packages/cli/src/opik/` and `packages/cli/src/observability/opik.ts`.

## Code Style
```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('mconnect-cli');

export async function runAgentCommand(command: string) {
  return tracer.startActiveSpan('runAgentCommand', async (span) => {
    try {
      span.setAttribute('command.name', command);
      // ... logic
      span.addEvent('command_executed');
    } catch (e) {
      span.recordException(e as Error);
      throw e;
    } finally {
      span.end();
    }
  });
}
```

## Testing Strategy
- Ensure compilation passes after replacing the observability layer (`tsc --noEmit`).
- Verify that no Opik-specific logic or keys remain.

## Boundaries
- **Always:** Use `@opentelemetry/api` for creating spans and adding events.
- **Ask first:** Before changing the structure of the agent PTY management.
- **Never:** Leave broken TypeScript imports after removing Opik.

## Success Criteria
1. `packages/cli/src/opik` is completely deleted.
2. `packages/cli/src/observability/opik.ts` is deleted.
3. OTel SDK setup is created in `packages/cli/src/observability/telemetry.ts`.
4. `package.json` files have `opik` removed and OTel packages added.
5. No `opik` imports remain in the codebase.
6. The CLI and Server build successfully without Opik.
