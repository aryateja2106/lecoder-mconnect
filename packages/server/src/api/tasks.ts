/**
 * Task REST API
 *
 * User-facing:
 *   POST   /tasks                    create
 *   GET    /tasks                    list (filtered by status, assignee)
 *   GET    /tasks/:id                detail (incl. runs and comments)
 *   PATCH  /tasks/:id                update status / assignee / metadata
 *   DELETE /tasks/:id                cancel
 *   POST   /tasks/:id/comments       add a comment
 *
 * Daemon-facing:
 *   POST   /runtimes/:id/tasks/claim claim oldest queued task
 *   POST   /tasks/:id/runs           start a run
 *   PATCH  /tasks/:id/runs/:runId    update run status / exit code
 */

import { z } from 'zod';
import type { AccessTokenClaims } from '@lecoder/shared';
import { getAuthService, AuthError } from '../auth/index.js';
import { getRuntimeRegistry } from '../fleet/RuntimeRegistry.js';
import { getTaskStore } from '../tasks/TaskStore.js';
import type { Task, TaskComment, TaskRun, TaskStatus } from '../tasks/types.js';

// ============================================================================
// Validation
// ============================================================================

const createTaskSchema = z.object({
  title: z.string().min(1).max(280),
  body: z.string().max(20_000).optional(),
  provider: z.string().max(40).optional(),
  assigneeRuntimeId: z.string().max(80).optional(),
  workingDirectory: z.string().max(500).optional(),
  loopMaxIterations: z.number().int().min(1).max(100).optional(),
  parentTaskId: z.string().max(80).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateTaskSchema = z.object({
  status: z.enum(['queued', 'dispatched', 'running', 'completed', 'failed', 'cancelled']).optional(),
  assigneeRuntimeId: z.string().max(80).optional(),
  worktreePath: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['queued', 'dispatched', 'running', 'completed', 'failed', 'cancelled']).optional(),
  runtime: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const commentSchema = z.object({
  body: z.string().min(1).max(20_000),
  authorKind: z.enum(['human', 'agent', 'system']).optional(),
});

const startRunSchema = z.object({
  runtimeId: z.string().max(80).optional(),
  agentId: z.string().max(80).optional(),
  worktreePath: z.string().max(500).optional(),
  iteration: z.number().int().min(1).max(100).optional(),
});

const updateRunSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled']).optional(),
  exitCode: z.number().int().optional(),
  logUrl: z.string().max(500).optional(),
});

// ============================================================================
// Auth helpers (same model as fleet.ts)
// ============================================================================

async function extractUser(request: Request): Promise<AccessTokenClaims | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);

  const sharedToken = process.env.LECODER_HUB_SHARED_TOKEN;
  if (sharedToken && token === sharedToken) {
    return { sub: 'shared-hub-token' } as AccessTokenClaims;
  }

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

function ownsTask(claims: AccessTokenClaims, task: Task): boolean {
  if (isSharedToken(claims)) return true;
  if (!task.ownerUserId) return true;
  return task.ownerUserId === claims.sub;
}

function serializeTask(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    ownerUserId: task.ownerUserId,
    title: task.title,
    body: task.body,
    status: task.status,
    provider: task.provider,
    assigneeRuntimeId: task.assigneeRuntimeId,
    workingDirectory: task.workingDirectory,
    worktreePath: task.worktreePath,
    loopMaxIterations: task.loopMaxIterations,
    parentTaskId: task.parentTaskId,
    metadata: task.metadata,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };
}

function serializeRun(run: TaskRun): Record<string, unknown> {
  return { ...run };
}

function serializeComment(comment: TaskComment): Record<string, unknown> {
  return { ...comment };
}

// ============================================================================
// Handlers
// ============================================================================

export async function handleCreateTask(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  // If an assignee runtime is set, validate it exists and the user can see it.
  if (parsed.data.assigneeRuntimeId) {
    const runtime = getRuntimeRegistry().get(parsed.data.assigneeRuntimeId);
    if (!runtime) return jsonError(400, 'invalid_request', 'Unknown assigneeRuntimeId');
    if (!isSharedToken(claims) && runtime.ownerUserId && runtime.ownerUserId !== claims.sub) {
      return jsonError(400, 'invalid_request', 'Unknown assigneeRuntimeId');
    }
  }

  const ownerUserId = isSharedToken(claims) ? undefined : claims.sub;
  const task = getTaskStore().createTask({ ...parsed.data, ownerUserId });
  return Response.json({ task: serializeTask(task) }, { status: 201 });
}

export async function handleListTasks(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const ownerUserId = isSharedToken(claims) ? undefined : claims.sub;
  const tasks = getTaskStore().listTasks({
    ownerUserId,
    status: parsed.data.status as TaskStatus | undefined,
    assigneeRuntimeId: parsed.data.runtime,
    limit: parsed.data.limit ?? 50,
  });
  return Response.json({ tasks: tasks.map(serializeTask) });
}

export async function handleGetTask(request: Request, taskId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const store = getTaskStore();
  const task = store.getTask(taskId);
  if (!task) return jsonError(404, 'not_found', 'Task not found');
  if (!ownsTask(claims, task)) return jsonError(404, 'not_found', 'Task not found');

  return Response.json({
    task: serializeTask(task),
    runs: store.listRunsForTask(taskId).map(serializeRun),
    comments: store.listCommentsForTask(taskId).map(serializeComment),
  });
}

export async function handleUpdateTask(request: Request, taskId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const store = getTaskStore();
  const existing = store.getTask(taskId);
  if (!existing) return jsonError(404, 'not_found', 'Task not found');
  if (!ownsTask(claims, existing)) return jsonError(404, 'not_found', 'Task not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const updated = store.updateTask(taskId, parsed.data);
  return Response.json({ task: serializeTask(updated!) });
}

export async function handleCancelTask(request: Request, taskId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const store = getTaskStore();
  const existing = store.getTask(taskId);
  if (!existing) return jsonError(404, 'not_found', 'Task not found');
  if (!ownsTask(claims, existing)) return jsonError(404, 'not_found', 'Task not found');

  if (existing.status === 'completed' || existing.status === 'failed' || existing.status === 'cancelled') {
    return new Response(null, { status: 204 });
  }
  store.updateTask(taskId, { status: 'cancelled' });
  return new Response(null, { status: 204 });
}

export async function handleAddComment(request: Request, taskId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  const store = getTaskStore();
  const existing = store.getTask(taskId);
  if (!existing) return jsonError(404, 'not_found', 'Task not found');
  if (!ownsTask(claims, existing)) return jsonError(404, 'not_found', 'Task not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }
  const authorUserId = isSharedToken(claims) ? undefined : claims.sub;
  const authorKind = parsed.data.authorKind ?? (isSharedToken(claims) ? 'agent' : 'human');
  const comment = store.createComment({
    taskId,
    body: parsed.data.body,
    authorUserId,
    authorKind,
  });
  return Response.json({ comment: serializeComment(comment) }, { status: 201 });
}

// ---- Runtime / daemon endpoints --------------------------------------

export async function handleClaimNextTask(request: Request, runtimeId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims && process.env.LECODER_HUB_SHARED_TOKEN) {
    return jsonError(401, 'unauthorized', 'Bearer token required');
  }

  if (!getRuntimeRegistry().get(runtimeId)) {
    return jsonError(404, 'not_found', 'Unknown runtime');
  }

  const claimed = getTaskStore().claimNextQueuedTask(runtimeId);
  if (!claimed) return new Response(null, { status: 204 });
  return Response.json({ task: serializeTask(claimed) });
}

export async function handleStartRun(request: Request, taskId: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims && process.env.LECODER_HUB_SHARED_TOKEN) {
    return jsonError(401, 'unauthorized', 'Bearer token required');
  }

  const store = getTaskStore();
  const task = store.getTask(taskId);
  if (!task) return jsonError(404, 'not_found', 'Task not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const parsed = startRunSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const run = store.createRun({ taskId, ...parsed.data });
  store.updateTask(taskId, { status: 'running' });
  return Response.json({ run: serializeRun(run) }, { status: 201 });
}

export async function handleUpdateRun(
  request: Request,
  taskId: string,
  runId: string
): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims && process.env.LECODER_HUB_SHARED_TOKEN) {
    return jsonError(401, 'unauthorized', 'Bearer token required');
  }

  const store = getTaskStore();
  const task = store.getTask(taskId);
  if (!task) return jsonError(404, 'not_found', 'Task not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = updateRunSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  const updates = { ...parsed.data, endedAt: parsed.data.status && parsed.data.status !== 'running' ? Date.now() : undefined };
  const updated = store.updateRun(runId, updates);
  if (!updated) return jsonError(404, 'not_found', 'Run not found');

  // Roll the parent task status forward when the run ends.
  if (parsed.data.status && parsed.data.status !== 'running') {
    const next: TaskStatus =
      parsed.data.status === 'completed'
        ? 'completed'
        : parsed.data.status === 'failed'
          ? 'failed'
          : 'cancelled';
    store.updateTask(taskId, { status: next });
  }

  return Response.json({ run: serializeRun(updated) });
}

// ============================================================================
// Routing
// ============================================================================

const TASK_PATH = /^\/tasks\/([^/]+)(\/.*)?$/;
const RUNTIME_CLAIM_PATH = /^\/runtimes\/([^/]+)\/tasks\/claim$/;

export async function handleTaskRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  if (pathname === '/tasks' && request.method === 'POST') return handleCreateTask(request);
  if (pathname === '/tasks' && request.method === 'GET') return handleListTasks(request);

  const claimMatch = pathname.match(RUNTIME_CLAIM_PATH);
  if (claimMatch && request.method === 'POST') {
    return handleClaimNextTask(request, claimMatch[1]);
  }

  const match = pathname.match(TASK_PATH);
  if (!match) return null;
  const taskId = match[1];
  const sub = match[2] ?? '';

  if (sub === '' && request.method === 'GET') return handleGetTask(request, taskId);
  if (sub === '' && request.method === 'PATCH') return handleUpdateTask(request, taskId);
  if (sub === '' && request.method === 'DELETE') return handleCancelTask(request, taskId);
  if (sub === '/comments' && request.method === 'POST') return handleAddComment(request, taskId);
  if (sub === '/runs' && request.method === 'POST') return handleStartRun(request, taskId);

  const runMatch = sub.match(/^\/runs\/([^/]+)$/);
  if (runMatch && request.method === 'PATCH') {
    return handleUpdateRun(request, taskId, runMatch[1]);
  }

  return null;
}

export default handleTaskRoutes;
