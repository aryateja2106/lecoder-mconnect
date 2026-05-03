/**
 * Autopilot REST API
 *
 *   POST   /autopilots               create
 *   GET    /autopilots               list (caller-scoped)
 *   GET    /autopilots/:id           detail
 *   PATCH  /autopilots/:id           update (schedule, enabled, name, task)
 *   DELETE /autopilots/:id           remove
 *
 * Auth model is identical to /tasks: user JWT or shared hub token.
 */

import { z } from 'zod';
import type { AccessTokenClaims } from '@lecoder/shared';
import { getAuthService, AuthError } from '../auth/index.js';
import {
  type AutopilotSpec,
  getAutopilotScheduler,
  nextRunAt,
} from '../scheduler/Autopilot.js';

const taskSpecSchema = z.object({
  title: z.string().min(1).max(280),
  body: z.string().max(20_000).optional(),
  provider: z.string().max(40).optional(),
  assigneeRuntimeId: z.string().max(80).optional(),
  workingDirectory: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  schedule: z.string().min(1).max(60),
  enabled: z.boolean().optional(),
  task: taskSpecSchema,
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  schedule: z.string().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
  task: taskSpecSchema.optional(),
});

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

function ownsAutopilot(claims: AccessTokenClaims, ap: AutopilotSpec): boolean {
  if (isSharedToken(claims)) return true;
  if (!ap.ownerUserId) return true;
  return ap.ownerUserId === claims.sub;
}

function serializeAutopilot(ap: AutopilotSpec): Record<string, unknown> {
  return { ...ap };
}

export async function handleCreateAutopilot(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  if (nextRunAt(parsed.data.schedule, Date.now()) === null) {
    return jsonError(
      400,
      'invalid_request',
      `Unrecognized schedule "${parsed.data.schedule}". Try "every 1h", "daily 09:00", or "hourly".`
    );
  }

  const ownerUserId = isSharedToken(claims) ? undefined : claims.sub;
  const ap = getAutopilotScheduler().create({
    ownerUserId,
    name: parsed.data.name,
    schedule: parsed.data.schedule,
    enabled: parsed.data.enabled,
    task: parsed.data.task,
  });
  if (!ap) {
    return jsonError(400, 'invalid_request', 'Failed to schedule autopilot');
  }
  return Response.json({ autopilot: serializeAutopilot(ap) }, { status: 201 });
}

export async function handleListAutopilots(request: Request): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');
  const ownerUserId = isSharedToken(claims) ? undefined : claims.sub;
  const aps = getAutopilotScheduler().list({ ownerUserId });
  return Response.json({ autopilots: aps.map(serializeAutopilot) });
}

export async function handleGetAutopilot(request: Request, id: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');
  const ap = getAutopilotScheduler().get(id);
  if (!ap || !ownsAutopilot(claims, ap)) return jsonError(404, 'not_found', 'Autopilot not found');
  return Response.json({ autopilot: serializeAutopilot(ap) });
}

export async function handleUpdateAutopilot(request: Request, id: string): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');
  const ap = getAutopilotScheduler().get(id);
  if (!ap || !ownsAutopilot(claims, ap)) return jsonError(404, 'not_found', 'Autopilot not found');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'invalid_request', 'Invalid JSON body');
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      'invalid_request',
      parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
    );
  }

  if (parsed.data.schedule && nextRunAt(parsed.data.schedule, Date.now()) === null) {
    return jsonError(400, 'invalid_request', `Unrecognized schedule "${parsed.data.schedule}"`);
  }

  const updated = getAutopilotScheduler().update(id, parsed.data);
  return Response.json({ autopilot: serializeAutopilot(updated!) });
}

export async function handleDeleteAutopilot(
  request: Request,
  id: string
): Promise<Response> {
  const claims = await extractUser(request);
  if (!claims) return jsonError(401, 'unauthorized', 'Bearer token required');
  const ap = getAutopilotScheduler().get(id);
  if (!ap || !ownsAutopilot(claims, ap)) return jsonError(404, 'not_found', 'Autopilot not found');
  getAutopilotScheduler().remove(id);
  return new Response(null, { status: 204 });
}

const PATH_RE = /^\/autopilots(?:\/([^/]+))?$/;

export async function handleAutopilotRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  const match = pathname.match(PATH_RE);
  if (!match) return null;
  const id = match[1];

  if (!id && request.method === 'POST') return handleCreateAutopilot(request);
  if (!id && request.method === 'GET') return handleListAutopilots(request);
  if (id && request.method === 'GET') return handleGetAutopilot(request, id);
  if (id && request.method === 'PATCH') return handleUpdateAutopilot(request, id);
  if (id && request.method === 'DELETE') return handleDeleteAutopilot(request, id);

  return null;
}

export default handleAutopilotRoutes;
