/**
 * Fleet REST API
 *
 * Endpoints daemons hit (machine-facing):
 *   POST   /fleet/register                   — register a runtime
 *   POST   /fleet/:id/heartbeat              — refresh liveness
 *   GET    /fleet/:id/tasks/next             — drain pending tasks
 *   DELETE /fleet/:id                        — explicit deregister
 *
 * Endpoints clients hit (user-facing):
 *   GET    /fleet                            — list all runtimes
 *   GET    /fleet/:id                        — runtime details
 *   POST   /fleet/:id/tasks                  — enqueue a task for that runtime
 *
 * Auth model:
 *   - Daemon endpoints accept either a hub token (LECODER_HUB_SHARED_TOKEN env)
 *     or a user JWT. When the env var is unset, daemon endpoints are open
 *     (single-user / localhost self-host scenario). User endpoints always
 *     require a JWT in production.
 *   - We deliberately keep the policy lenient by default so the platform stays
 *     "one command to start" — production deployments lock things down with
 *     env vars.
 */

import { z } from 'zod';
import type { AccessTokenClaims } from '@lecoder/shared';
import { getAuthService, AuthError } from '../auth/index.js';
import {
  getRuntimeRegistry,
  type Runtime,
} from '../fleet/RuntimeRegistry.js';

// ============================================================================
// Validation
// ============================================================================

const registerSchema = z.object({
  name: z.string().min(1).max(120),
  hostname: z.string().min(1).max(255),
  platform: z.string().min(1).max(40),
  arch: z.string().min(1).max(40),
  user: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
});

const enqueueTaskSchema = z.object({
  title: z.string().min(1).max(280),
  body: z.string().max(20_000).optional(),
  provider: z.string().max(40).optional(),
  workingDirectory: z.string().max(500).optional(),
});

// ============================================================================
// Auth helpers
// ============================================================================

async function extractUser(request: Request): Promise<AccessTokenClaims | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);

  // First try the shared hub token (machine-to-machine).
  const sharedToken = process.env.LECODER_HUB_SHARED_TOKEN;
  if (sharedToken && token === sharedToken) {
    return { sub: 'shared-hub-token' } as AccessTokenClaims;
  }

  // Fall back to user JWT.
  try {
    return await getAuthService().validateAccessToken(token);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

function isSharedToken(claims: AccessTokenClaims | null): boolean {
  return claims?.sub === 'shared-hub-token';
}

function jsonError(status: number, error: string, description: string): Response {
  return Response.json({ error, error_description: description }, { status });
}

// ============================================================================
// Daemon-facing handlers
// ============================================================================

export async function handleRegisterRuntime(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims && process.env.LECODER_HUB_SHARED_TOKEN) {
    return jsonError(401, 'unauthorized', 'Bearer token required');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const ownerUserId = claims && !isSharedToken(claims) ? claims.sub : undefined;
  const runtime = getRuntimeRegistry().register({ ...parsed.data, ownerUserId });

  return Response.json({ runtimeId: runtime.id, runtime: serializeRuntime(runtime) }, { status: 201 });
}

export async function handleHeartbeat(_request: Request, runtimeId: string): Promise<Response> {
  if (!getRuntimeRegistry().heartbeat(runtimeId)) {
    return jsonError(404, 'not_found', 'Runtime not found — re-register.');
  }
  return new Response(null, { status: 204 });
}

export async function handleTasksNext(_request: Request, runtimeId: string): Promise<Response> {
  const registry = getRuntimeRegistry();
  if (!registry.get(runtimeId)) {
    return jsonError(404, 'not_found', 'Unknown runtime');
  }
  const tasks = registry.drainTasks(runtimeId);
  if (tasks.length === 0) return new Response(null, { status: 204 });
  return Response.json({ tasks });
}

export async function handleDeregister(request: Request, runtimeId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims && process.env.LECODER_HUB_SHARED_TOKEN) {
    return jsonError(401, 'unauthorized', 'Bearer token required');
  }
  const removed = getRuntimeRegistry().remove(runtimeId);
  return new Response(null, { status: removed ? 204 : 404 });
}

// ============================================================================
// User-facing handlers
// ============================================================================

export async function handleListFleet(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const ownerUserId = isSharedToken(claims) ? undefined : claims.sub;
  const runtimes = getRuntimeRegistry().list({ ownerUserId });
  return Response.json({ runtimes: runtimes.map(serializeRuntime) });
}

export async function handleGetRuntime(request: Request, runtimeId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const runtime = getRuntimeRegistry().get(runtimeId);
  if (!runtime) return jsonError(404, 'not_found', 'Runtime not found');

  if (!isSharedToken(claims) && runtime.ownerUserId && runtime.ownerUserId !== claims.sub) {
    return jsonError(404, 'not_found', 'Runtime not found');
  }

  const queueDepth = getRuntimeRegistry().queueDepth(runtimeId);
  return Response.json({ runtime: serializeRuntime(runtime), queueDepth });
}

export async function handleEnqueueTask(request: Request, runtimeId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const registry = getRuntimeRegistry();
  const runtime = registry.get(runtimeId);
  if (!runtime) return jsonError(404, 'not_found', 'Runtime not found');

  if (!isSharedToken(claims) && runtime.ownerUserId && runtime.ownerUserId !== claims.sub) {
    return jsonError(404, 'not_found', 'Runtime not found');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }

  const parsed = enqueueTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const taskId = `task_${crypto.randomUUID()}`;
  registry.enqueueTask(runtimeId, { id: taskId, ...parsed.data });
  return Response.json({ taskId, queueDepth: registry.queueDepth(runtimeId) }, { status: 202 });
}

// ============================================================================
// Routing
// ============================================================================

function serializeRuntime(runtime: Runtime) {
  return {
    id: runtime.id,
    name: runtime.name,
    hostname: runtime.hostname,
    platform: runtime.platform,
    arch: runtime.arch,
    user: runtime.user,
    version: runtime.version,
    status: runtime.status,
    registeredAt: runtime.registeredAt,
    lastHeartbeatAt: runtime.lastHeartbeatAt,
  };
}

const RUNTIME_PATH_RE = /^\/fleet\/([^/]+)(\/.*)?$/;

export async function handleFleetRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  // POST /fleet/register
  if (pathname === '/fleet/register' && request.method === 'POST') {
    return handleRegisterRuntime(request);
  }

  // GET /fleet
  if (pathname === '/fleet' && request.method === 'GET') {
    return handleListFleet(request);
  }

  const match = pathname.match(RUNTIME_PATH_RE);
  if (!match) return null;
  const runtimeId = match[1];
  const sub = match[2] ?? '';

  // POST /fleet/:id/heartbeat
  if (sub === '/heartbeat' && request.method === 'POST') {
    return handleHeartbeat(request, runtimeId);
  }
  // GET /fleet/:id/tasks/next
  if (sub === '/tasks/next' && request.method === 'GET') {
    return handleTasksNext(request, runtimeId);
  }
  // POST /fleet/:id/tasks
  if (sub === '/tasks' && request.method === 'POST') {
    return handleEnqueueTask(request, runtimeId);
  }
  // GET /fleet/:id
  if (sub === '' && request.method === 'GET') {
    return handleGetRuntime(request, runtimeId);
  }
  // DELETE /fleet/:id
  if (sub === '' && request.method === 'DELETE') {
    return handleDeregister(request, runtimeId);
  }

  return null;
}

export default handleFleetRoutes;
