/**
 * Session REST API Routes
 *
 * Handles session management endpoints:
 * - POST /sessions - Create new session
 * - GET /sessions - List user sessions
 * - GET /sessions/:id - Get session details
 * - DELETE /sessions/:id - Terminate session
 * - GET /sessions/:id/connect - Get WebSocket connection info
 */

import type {
  ConnectionInfo,
  AccessTokenClaims,
  AgentConfig,
  GuardrailLevel,
} from '@lecoder/shared';
import { z } from 'zod';
import { getAuthService, AuthError } from '../auth/index.js';
import { sessionRepository } from '../db/repositories/index.js';
import { resolvePreset } from '../agents/presets/index.js';

// ============================================================================
// Request Validation Schemas
// ============================================================================

const createSessionSchema = z.object({
  preset: z.string().min(1).max(50),
  workingDirectory: z.string().min(1).max(500),
  guardrails: z.enum(['none', 'permissive', 'default', 'strict']).optional(),
});

const listSessionsQuerySchema = z.object({
  state: z.enum(['running', 'paused', 'completed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const sessionIdParamSchema = z.string().uuid();

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Extract and validate JWT from Authorization header
 *
 * @returns Token claims if valid, null if missing/invalid
 */
async function extractAuth(request: Request): Promise<AccessTokenClaims | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const authService = getAuthService();
    const claims = await authService.validateAccessToken(token);
    return claims;
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
}

/**
 * Require authentication - returns 401 response if not authenticated
 */
async function requireAuth(request: Request): Promise<AccessTokenClaims | Response> {
  const claims = await extractAuth(request);

  if (!claims) {
    return Response.json(
      {
        error: 'unauthorized',
        error_description: 'Valid Bearer token required',
      },
      { status: 401 }
    );
  }

  return claims;
}

// ============================================================================
// Preset Resolution
// ============================================================================

/**
 * Resolve a preset name to agent configurations.
 *
 * Uses the preset registry from agents/presets. Unknown presets
 * return a 400 error response instead of silently defaulting.
 */
function resolvePresetForSession(
  presetName: string,
  workingDirectory: string,
): AgentConfig[] | null {
  const agents = resolvePreset(presetName, { cwd: workingDirectory });
  return agents ?? null;
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Handle POST /sessions
 *
 * Create a new session for the authenticated user.
 *
 * Request Body:
 * - preset: string - Preset name (e.g., 'single', 'dev-review')
 * - workingDirectory: string - Working directory path
 * - guardrails?: 'none' | 'permissive' | 'default' | 'strict'
 */
export async function handleCreateSession(request: Request): Promise<Response> {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const claims = authResult;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid JSON body',
      },
      { status: 400 }
    );
  }

  const parseResult = createSessionSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      },
      { status: 400 }
    );
  }

  const { preset, workingDirectory, guardrails } = parseResult.data;

  try {
    // Resolve preset to agent configurations
    const agents = resolvePresetForSession(preset, workingDirectory);
    if (!agents) {
      return Response.json(
        {
          error: 'invalid_request',
          error_description: `Unknown preset '${preset}'. Use GET /presets to list available presets.`,
        },
        { status: 400 }
      );
    }

    // Create session
    const session = await sessionRepository.create({
      userId: claims.sub,
      agentConfig: {
        preset,
        agents,
        guardrails: guardrails as GuardrailLevel | undefined,
      },
      workingDirectory,
    });

    return Response.json(session, { status: 201 });
  } catch (error) {
    console.error('Failed to create session:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'Failed to create session',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /sessions
 *
 * List sessions for the authenticated user.
 *
 * Query Parameters:
 * - state?: 'running' | 'paused' | 'completed' - Filter by state
 * - limit?: number - Max results (default: 50, max: 100)
 * - offset?: number - Pagination offset
 */
export async function handleListSessions(request: Request): Promise<Response> {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const claims = authResult;

  // Parse query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  const parseResult = listSessionsQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      },
      { status: 400 }
    );
  }

  const { state, limit = 50, offset = 0 } = parseResult.data;

  try {
    // Get sessions with agent count
    const sessions = await sessionRepository.listInfo({
      userId: claims.sub,
      state: state,
      limit,
      offset,
    });

    // Get total count for pagination
    const total = await sessionRepository.count({
      userId: claims.sub,
      state: state,
    });

    return Response.json({
      sessions,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + sessions.length < total,
      },
    });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'Failed to list sessions',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /sessions/:id
 *
 * Get details of a specific session.
 */
export async function handleGetSession(
  request: Request,
  sessionId: string
): Promise<Response> {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const claims = authResult;

  // Validate session ID format
  const idResult = sessionIdParamSchema.safeParse(sessionId);
  if (!idResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid session ID format',
      },
      { status: 400 }
    );
  }

  try {
    // Get session with ownership check
    const session = await sessionRepository.findByIdForUser(sessionId, claims.sub);

    if (!session) {
      return Response.json(
        {
          error: 'not_found',
          error_description: 'Session not found',
        },
        { status: 404 }
      );
    }

    return Response.json(session);
  } catch (error) {
    console.error('Failed to get session:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'Failed to get session',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE /sessions/:id
 *
 * Terminate a session. Sets state to 'completed' and marks completion time.
 */
export async function handleDeleteSession(
  request: Request,
  sessionId: string
): Promise<Response> {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const claims = authResult;

  // Validate session ID format
  const idResult = sessionIdParamSchema.safeParse(sessionId);
  if (!idResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid session ID format',
      },
      { status: 400 }
    );
  }

  try {
    // Verify ownership first
    const session = await sessionRepository.findByIdForUser(sessionId, claims.sub);

    if (!session) {
      return Response.json(
        {
          error: 'not_found',
          error_description: 'Session not found',
        },
        { status: 404 }
      );
    }

    // If already completed, just return success
    if (session.state === 'completed') {
      return new Response(null, { status: 204 });
    }

    // Terminate by setting state to completed
    await sessionRepository.updateState(sessionId, 'completed');

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Failed to terminate session:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'Failed to terminate session',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET /sessions/:id/connect
 *
 * Get WebSocket connection info for a session.
 * Returns a URL and one-time token for WebSocket connection.
 */
export async function handleGetConnectionInfo(
  request: Request,
  sessionId: string
): Promise<Response> {
  // Authenticate
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) {
    return authResult;
  }
  const claims = authResult;

  // Validate session ID format
  const idResult = sessionIdParamSchema.safeParse(sessionId);
  if (!idResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid session ID format',
      },
      { status: 400 }
    );
  }

  try {
    // Verify ownership
    const session = await sessionRepository.findByIdForUser(sessionId, claims.sub);

    if (!session) {
      return Response.json(
        {
          error: 'not_found',
          error_description: 'Session not found',
        },
        { status: 404 }
      );
    }

    // Cannot connect to completed sessions
    if (session.state === 'completed') {
      return Response.json(
        {
          error: 'invalid_state',
          error_description: 'Cannot connect to completed session',
        },
        { status: 400 }
      );
    }

    // Generate connection token
    // This is a simple token for now - in production, this would be
    // a signed token with expiration that the WebSocket hub validates
    const connectionToken = crypto.randomUUID();

    // Build WebSocket URL
    const host = request.headers.get('Host') ?? 'localhost:3001';
    const protocol = request.headers.get('X-Forwarded-Proto') === 'https' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${host}/ws`;

    const connectionInfo: ConnectionInfo = {
      wsUrl,
      token: connectionToken,
      protocolVersion: '3.0',
    };

    // TODO: Store connection token for WebSocket hub to validate
    // For now, we just generate it. The WebSocket step will implement
    // proper token validation.

    return Response.json(connectionInfo);
  } catch (error) {
    console.error('Failed to get connection info:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'Failed to get connection info',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Extract session ID from path
 *
 * Handles paths like /sessions/abc-123 or /sessions/abc-123/connect
 */
function extractSessionId(pathname: string): string | null {
  const match = pathname.match(/^\/sessions\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Handle session routes
 *
 * @param request - HTTP request
 * @param pathname - URL pathname
 * @returns Response or null if route not matched
 */
export async function handleSessionRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  // POST /sessions - Create session
  if (pathname === '/sessions' && request.method === 'POST') {
    return handleCreateSession(request);
  }

  // GET /sessions - List sessions
  if (pathname === '/sessions' && request.method === 'GET') {
    return handleListSessions(request);
  }

  // Routes with session ID
  const sessionId = extractSessionId(pathname);
  if (sessionId) {
    // GET /sessions/:id/connect - Get connection info
    if (pathname === `/sessions/${sessionId}/connect` && request.method === 'GET') {
      return handleGetConnectionInfo(request, sessionId);
    }

    // GET /sessions/:id - Get session details
    if (pathname === `/sessions/${sessionId}` && request.method === 'GET') {
      return handleGetSession(request, sessionId);
    }

    // DELETE /sessions/:id - Terminate session
    if (pathname === `/sessions/${sessionId}` && request.method === 'DELETE') {
      return handleDeleteSession(request, sessionId);
    }
  }

  return null;
}

export default handleSessionRoutes;
