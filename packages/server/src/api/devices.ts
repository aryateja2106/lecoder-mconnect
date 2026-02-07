/**
 * Device Token API Routes
 *
 * REST endpoints for managing push notification device tokens.
 *
 * Routes:
 * - POST /devices/token - Register a device token
 * - DELETE /devices/token - Remove a device token
 */

import { getJWTService } from '../auth/jwt.js';
import { deviceTokenRepository } from '../db/repositories/device-token.js';
import type { AccessTokenClaims } from '@lecoder/shared';

// ============================================================================
// Rate Limiting
// ============================================================================

/** Max device token registration attempts per user within the window */
const RATE_LIMIT_MAX = 10;
/** Rate limit window in milliseconds (5 minutes) */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a userId has exceeded the device token registration rate limit.
 * Returns true if rate-limited.
 */
export function isDeviceTokenRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * Extract and validate JWT from Authorization header
 */
async function authenticateRequest(request: Request): Promise<AccessTokenClaims | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const jwtService = getJWTService();
    return await jwtService.validateAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * Create an unauthorized response
 */
function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /devices/token - Register a device token for push notifications
 *
 * Body: { token: string, platform?: 'ios' | 'android' | 'web' }
 */
export async function handleRegisterToken(request: Request): Promise<Response> {
  const claims = await authenticateRequest(request);
  if (!claims) return unauthorized();

  if (isDeviceTokenRateLimited(claims.sub)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json() as { token?: string; platform?: string };

    if (!body.token || typeof body.token !== 'string') {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    // Validate token format (hex string, 64+ chars for APNs)
    if (!/^[a-f0-9]{64,}$/i.test(body.token)) {
      return Response.json({ error: 'Invalid device token format' }, { status: 400 });
    }

    const platform = body.platform ?? 'ios';
    if (!['ios', 'android', 'web'].includes(platform)) {
      return Response.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const deviceToken = await deviceTokenRepository.registerToken({
      userId: claims.sub,
      token: body.token,
      platform: platform as 'ios' | 'android' | 'web',
    });

    return Response.json({
      id: deviceToken.id,
      token: deviceToken.token,
      platform: deviceToken.platform,
      registered: true,
    }, { status: 201 });
  } catch (error) {
    console.error('[DeviceAPI] Register token error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /devices/token - Remove a device token
 *
 * Body: { token: string }
 */
export async function handleRemoveToken(request: Request): Promise<Response> {
  const claims = await authenticateRequest(request);
  if (!claims) return unauthorized();

  try {
    const body = await request.json() as { token?: string };

    if (!body.token || typeof body.token !== 'string') {
      return Response.json({ error: 'token is required' }, { status: 400 });
    }

    const removed = await deviceTokenRepository.removeToken(claims.sub, body.token);

    if (!removed) {
      return Response.json({ error: 'Token not found' }, { status: 404 });
    }

    return Response.json({ removed: true });
  } catch (error) {
    console.error('[DeviceAPI] Remove token error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================================================
// Router
// ============================================================================

/**
 * Handle device-related API routes
 */
export async function handleDeviceRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  // POST /devices/token - Register device token
  if (pathname === '/devices/token' && request.method === 'POST') {
    return handleRegisterToken(request);
  }

  // DELETE /devices/token - Remove device token
  if (pathname === '/devices/token' && request.method === 'DELETE') {
    return handleRemoveToken(request);
  }

  return null;
}
