/**
 * Device Token API Unit Tests
 *
 * Tests the device token route handlers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initializeAuthService, resetAuthService, getAuthService } from '../../auth/index.js';
import {
  handleRegisterToken,
  handleRemoveToken,
  handleDeviceRoutes,
} from '../devices.js';

// ============================================================================
// Test Setup
// ============================================================================

const testUser = {
  id: `test-user-${crypto.randomUUID().slice(0, 8)}`,
  email: 'test@example.com',
  name: 'Test User',
  provider: 'github' as const,
  providerId: 'github-12345',
  createdAt: new Date(),
};

let testAccessToken: string;

// ============================================================================
// Helper Functions
// ============================================================================

async function createTestToken(user: typeof testUser): Promise<string> {
  const authService = getAuthService();
  const jwt = authService.getJWTService();
  return jwt.createAccessToken(user);
}

function createRequest(
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Request {
  return new Request(`http://localhost:3001${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Device Token API', () => {
  beforeAll(async () => {
    // Initialize auth for token creation
    process.env.DEV_AUTH_BYPASS = 'true';
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';

    initializeAuthService({
      jwt: {
        secret: 'test-secret-at-least-32-characters-long',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
      },
    });

    testAccessToken = await createTestToken(testUser);
  });

  afterAll(() => {
    resetAuthService();
  });

  describe('POST /devices/token', () => {
    it('should return 401 without auth token', async () => {
      const request = createRequest('/devices/token', {
        method: 'POST',
        body: JSON.stringify({ token: 'a'.repeat(64), platform: 'ios' }),
      });

      const response = await handleRegisterToken(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 without token in body', async () => {
      const request = createRequest('/devices/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        body: JSON.stringify({ platform: 'ios' }),
      });

      const response = await handleRegisterToken(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid token format', async () => {
      const request = createRequest('/devices/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        body: JSON.stringify({ token: 'invalid-not-hex', platform: 'ios' }),
      });

      const response = await handleRegisterToken(request);
      expect(response.status).toBe(400);

      const body = await response.json() as { error: string };
      expect(body.error).toBe('Invalid device token format');
    });

    it('should return 400 for invalid platform', async () => {
      const request = createRequest('/devices/token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        body: JSON.stringify({ token: 'a'.repeat(64), platform: 'windows' }),
      });

      const response = await handleRegisterToken(request);
      expect(response.status).toBe(400);

      const body = await response.json() as { error: string };
      expect(body.error).toBe('Invalid platform');
    });
  });

  describe('DELETE /devices/token', () => {
    it('should return 401 without auth token', async () => {
      const request = createRequest('/devices/token', {
        method: 'DELETE',
        body: JSON.stringify({ token: 'a'.repeat(64) }),
      });

      const response = await handleRemoveToken(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 without token in body', async () => {
      const request = createRequest('/devices/token', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${testAccessToken}` },
        body: JSON.stringify({}),
      });

      const response = await handleRemoveToken(request);
      expect(response.status).toBe(400);
    });
  });

  describe('handleDeviceRoutes', () => {
    it('should route POST /devices/token', async () => {
      const request = createRequest('/devices/token', {
        method: 'POST',
        body: JSON.stringify({ token: 'a'.repeat(64), platform: 'ios' }),
      });

      const response = await handleDeviceRoutes(request, '/devices/token');
      expect(response).not.toBeNull();
      expect(response!.status).toBe(401); // No auth
    });

    it('should route DELETE /devices/token', async () => {
      const request = createRequest('/devices/token', {
        method: 'DELETE',
        body: JSON.stringify({ token: 'a'.repeat(64) }),
      });

      const response = await handleDeviceRoutes(request, '/devices/token');
      expect(response).not.toBeNull();
      expect(response!.status).toBe(401); // No auth
    });

    it('should return null for unmatched routes', async () => {
      const request = createRequest('/devices/other', { method: 'GET' });

      const response = await handleDeviceRoutes(request, '/devices/other');
      expect(response).toBeNull();
    });
  });
});
