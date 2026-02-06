/**
 * Session API Unit Tests
 *
 * Tests the session route handlers directly without a running server.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { initializeAuthService, resetAuthService, getAuthService } from '../../auth/index.js';
import {
  handleCreateSession,
  handleListSessions,
  handleGetSession,
  handleDeleteSession,
  handleGetConnectionInfo,
  handleSessionRoutes,
} from '../sessions.js';

// ============================================================================
// Test Setup
// ============================================================================

// Test user
const testUser = {
  id: 'test-user-' + crypto.randomUUID().slice(0, 8),
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

function createAuthRequest(
  path: string,
  token: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Request {
  return createRequest(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Session API Unit Tests', () => {
  beforeAll(async () => {
    // Initialize auth service with test secret
    initializeAuthService({
      jwt: {
        secret: 'test-secret-key-that-is-at-least-32-characters-long',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
      },
    });

    // Create test token
    testAccessToken = await createTestToken(testUser);
  });

  afterAll(() => {
    resetAuthService();
  });

  describe('handleSessionRoutes', () => {
    it('should return null for unmatched routes', async () => {
      const request = createAuthRequest('/unknown', testAccessToken);
      const response = await handleSessionRoutes(request, '/unknown');
      expect(response).toBeNull();
    });

    it('should route POST /sessions to handleCreateSession', async () => {
      const request = createAuthRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await handleSessionRoutes(request, '/sessions');
      expect(response).not.toBeNull();
      // Will return 400 because body is empty, but that's fine - it's routing correctly
      expect(response?.status).toBe(400);
    });

    it('should route GET /sessions to handleListSessions', async () => {
      const request = createRequest('/sessions', { method: 'GET' });
      const response = await handleSessionRoutes(request, '/sessions');
      expect(response).not.toBeNull();
      // Will return 401 because no auth, but that's fine - it's routing correctly
      expect(response?.status).toBe(401);
    });
  });

  describe('handleCreateSession', () => {
    it('should require authentication', async () => {
      const request = createRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      const response = await handleCreateSession(request);

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('unauthorized');
    });

    it('should reject invalid Bearer token format', async () => {
      const request = createRequest('/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Basic invalid',
        },
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(401);
    });

    it('should reject invalid JWT token', async () => {
      const request = createRequest('/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const request = createAuthRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await handleCreateSession(request);

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('invalid_request');
    });

    it('should validate preset field', async () => {
      const request = createAuthRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: '',
          workingDirectory: '/tmp/test',
        }),
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(400);
    });

    it('should validate workingDirectory field', async () => {
      const request = createAuthRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '',
        }),
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(400);
    });

    it('should validate guardrails field values', async () => {
      const request = createAuthRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
          guardrails: 'invalid',
        }),
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(400);
    });

    it('should reject invalid JSON body', async () => {
      const request = new Request('http://localhost:3001/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testAccessToken}`,
        },
        body: 'not valid json',
      });

      const response = await handleCreateSession(request);
      expect(response.status).toBe(400);
      const body = (await response.json()) as { error_description: string };
      expect(body.error_description).toContain('Invalid JSON');
    });
  });

  describe('handleListSessions', () => {
    it('should require authentication', async () => {
      const request = createRequest('/sessions', { method: 'GET' });

      const response = await handleListSessions(request);

      expect(response.status).toBe(401);
    });

    it('should validate state query parameter', async () => {
      const request = createAuthRequest('/sessions?state=invalid', testAccessToken, {
        method: 'GET',
      });

      const response = await handleListSessions(request);

      expect(response.status).toBe(400);
    });

    it('should validate limit query parameter', async () => {
      const request = createAuthRequest('/sessions?limit=0', testAccessToken, {
        method: 'GET',
      });

      const response = await handleListSessions(request);

      expect(response.status).toBe(400);
    });

    it('should validate limit max value', async () => {
      const request = createAuthRequest('/sessions?limit=101', testAccessToken, {
        method: 'GET',
      });

      const response = await handleListSessions(request);

      expect(response.status).toBe(400);
    });

    it('should accept valid state values', async () => {
      const states = ['running', 'paused', 'completed'];
      for (const state of states) {
        const request = createAuthRequest(`/sessions?state=${state}`, testAccessToken, {
          method: 'GET',
        });

        const response = await handleListSessions(request);
        // Will fail with 500 because no database, but that's fine - validation passed
        expect(response.status).not.toBe(400);
      }
    });

    it('should accept valid limit values', async () => {
      const limits = [1, 50, 100];
      for (const limit of limits) {
        const request = createAuthRequest(`/sessions?limit=${limit}`, testAccessToken, {
          method: 'GET',
        });

        const response = await handleListSessions(request);
        // Will fail with 500 because no database, but that's fine - validation passed
        expect(response.status).not.toBe(400);
      }
    });
  });

  describe('handleGetSession', () => {
    it('should require authentication', async () => {
      const request = createRequest('/sessions/550e8400-e29b-41d4-a716-446655440000', {
        method: 'GET',
      });

      const response = await handleGetSession(request, '550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const request = createAuthRequest('/sessions/invalid-id', testAccessToken, {
        method: 'GET',
      });

      const response = await handleGetSession(request, 'invalid-id');

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('invalid_request');
    });

    it('should accept valid UUID format', async () => {
      const request = createAuthRequest(
        '/sessions/550e8400-e29b-41d4-a716-446655440000',
        testAccessToken,
        { method: 'GET' }
      );

      const response = await handleGetSession(request, '550e8400-e29b-41d4-a716-446655440000');

      // Will fail with 500 because no database, but validation passed
      expect(response.status).not.toBe(400);
    });
  });

  describe('handleDeleteSession', () => {
    it('should require authentication', async () => {
      const request = createRequest('/sessions/550e8400-e29b-41d4-a716-446655440000', {
        method: 'DELETE',
      });

      const response = await handleDeleteSession(request, '550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const request = createAuthRequest('/sessions/invalid-id', testAccessToken, {
        method: 'DELETE',
      });

      const response = await handleDeleteSession(request, 'invalid-id');

      expect(response.status).toBe(400);
    });
  });

  describe('handleGetConnectionInfo', () => {
    it('should require authentication', async () => {
      const request = createRequest('/sessions/550e8400-e29b-41d4-a716-446655440000/connect', {
        method: 'GET',
      });

      const response = await handleGetConnectionInfo(
        request,
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const request = createAuthRequest('/sessions/invalid-id/connect', testAccessToken, {
        method: 'GET',
      });

      const response = await handleGetConnectionInfo(request, 'invalid-id');

      expect(response.status).toBe(400);
    });
  });
});
