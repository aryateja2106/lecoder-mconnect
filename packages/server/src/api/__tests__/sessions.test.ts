/**
 * Session API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import type { Session, SessionInfo, ConnectionInfo, AgentType } from '@lecoder/shared';
import { initializeAuthService, resetAuthService, getAuthService } from '../../auth/index.js';
import { initializeDatabase, closeDatabase, getClient } from '../../db/client.js';

// ============================================================================
// Test Setup
// ============================================================================

// Mock database for tests
const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/mconnect_test';

// Test user
const testUser = {
  id: 'test-user-' + crypto.randomUUID().slice(0, 8),
  email: 'test@example.com',
  name: 'Test User',
  provider: 'github' as const,
  providerId: 'github-12345',
  createdAt: new Date(),
};

// Another user for ownership tests
const otherUser = {
  id: 'other-user-' + crypto.randomUUID().slice(0, 8),
  email: 'other@example.com',
  name: 'Other User',
  provider: 'github' as const,
  providerId: 'github-67890',
  createdAt: new Date(),
};

let testAccessToken: string;
let otherAccessToken: string;
let baseUrl: string;

// ============================================================================
// Helper Functions
// ============================================================================

async function createTestToken(user: typeof testUser): Promise<string> {
  const authService = getAuthService();
  const jwt = authService.getJWTService();
  return jwt.createAccessToken(user);
}

async function makeRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
}

async function authenticatedRequest(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return makeRequest(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function cleanup(): Promise<void> {
  try {
    const sql = getClient();
    // Clean up test sessions
    await sql`DELETE FROM sessions WHERE user_id LIKE 'test-user-%' OR user_id LIKE 'other-user-%'`;
    // Clean up test users
    await sql`DELETE FROM users WHERE id LIKE 'test-user-%' OR id LIKE 'other-user-%'`;
  } catch {
    // Table might not exist in unit test mode
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Session API', () => {
  beforeAll(async () => {
    // Check if we're in integration test mode
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;

    if (isIntegrationTest) {
      // Initialize database for integration tests
      await initializeDatabase({ connectionUrl: TEST_DB_URL });
    }

    // Initialize auth service with test secret
    initializeAuthService({
      jwt: {
        secret: 'test-secret-key-that-is-at-least-32-characters-long',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
      },
    });

    // Create test tokens
    testAccessToken = await createTestToken(testUser);
    otherAccessToken = await createTestToken(otherUser);

    // Use test server port
    const port = parseInt(process.env.TEST_PORT ?? '3099', 10);
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await cleanup();
    resetAuthService();
    await closeDatabase();
  });

  describe('POST /sessions', () => {
    it('should require authentication', async () => {
      const response = await makeRequest('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      expect(response.status).toBe(401);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('unauthorized');
    });

    it('should reject invalid Bearer token format', async () => {
      const response = await makeRequest('/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Basic invalid',
        },
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid JWT token', async () => {
      const response = await makeRequest('/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should validate request body', async () => {
      const response = await authenticatedRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('invalid_request');
    });

    it('should validate preset field', async () => {
      const response = await authenticatedRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: '',
          workingDirectory: '/tmp/test',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should validate workingDirectory field', async () => {
      const response = await authenticatedRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '',
        }),
      });

      expect(response.status).toBe(400);
    });

    it('should validate guardrails field values', async () => {
      const response = await authenticatedRequest('/sessions', testAccessToken, {
        method: 'POST',
        body: JSON.stringify({
          preset: 'single',
          workingDirectory: '/tmp/test',
          guardrails: 'invalid',
        }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /sessions', () => {
    it('should require authentication', async () => {
      const response = await makeRequest('/sessions', { method: 'GET' });

      expect(response.status).toBe(401);
    });

    it('should validate state query parameter', async () => {
      const response = await authenticatedRequest(
        '/sessions?state=invalid',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
    });

    it('should validate limit query parameter', async () => {
      const response = await authenticatedRequest(
        '/sessions?limit=0',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
    });

    it('should validate limit max value', async () => {
      const response = await authenticatedRequest(
        '/sessions?limit=101',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /sessions/:id', () => {
    it('should require authentication', async () => {
      const response = await makeRequest('/sessions/550e8400-e29b-41d4-a716-446655440000', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const response = await authenticatedRequest(
        '/sessions/invalid-id',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('invalid_request');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await authenticatedRequest(
        '/sessions/550e8400-e29b-41d4-a716-446655440000',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe('not_found');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('should require authentication', async () => {
      const response = await makeRequest('/sessions/550e8400-e29b-41d4-a716-446655440000', {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const response = await authenticatedRequest(
        '/sessions/invalid-id',
        testAccessToken,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await authenticatedRequest(
        '/sessions/550e8400-e29b-41d4-a716-446655440000',
        testAccessToken,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /sessions/:id/connect', () => {
    it('should require authentication', async () => {
      const response = await makeRequest(
        '/sessions/550e8400-e29b-41d4-a716-446655440000/connect',
        { method: 'GET' }
      );

      expect(response.status).toBe(401);
    });

    it('should validate session ID format', async () => {
      const response = await authenticatedRequest(
        '/sessions/invalid-id/connect',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await authenticatedRequest(
        '/sessions/550e8400-e29b-41d4-a716-446655440000/connect',
        testAccessToken,
        { method: 'GET' }
      );

      expect(response.status).toBe(404);
    });
  });
});

// ============================================================================
// Integration Tests (with Database)
// ============================================================================

describe('Session API Integration', () => {
  let createdSessionId: string;

  beforeAll(async () => {
    // Skip if not in integration test mode
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest) {
      console.log('Skipping integration tests - no database configured');
      return;
    }

    // Initialize database
    await initializeDatabase({ connectionUrl: TEST_DB_URL });

    // Initialize auth service
    initializeAuthService({
      jwt: {
        secret: 'test-secret-key-that-is-at-least-32-characters-long',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
      },
    });

    // Create test tokens
    testAccessToken = await createTestToken(testUser);
    otherAccessToken = await createTestToken(otherUser);

    // Set up base URL
    const port = parseInt(process.env.TEST_PORT ?? '3099', 10);
    baseUrl = `http://localhost:${port}`;

    // Create test users in database
    const sql = getClient();
    await sql`
      INSERT INTO users (id, email, name, provider, provider_id)
      VALUES (${testUser.id}, ${testUser.email}, ${testUser.name}, ${testUser.provider}, ${testUser.providerId})
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO users (id, email, name, provider, provider_id)
      VALUES (${otherUser.id}, ${otherUser.email}, ${otherUser.name}, ${otherUser.provider}, ${otherUser.providerId})
      ON CONFLICT (id) DO NOTHING
    `;
  });

  afterAll(async () => {
    await cleanup();
    resetAuthService();
    await closeDatabase();
  });

  beforeEach(async () => {
    // Skip if not in integration test mode
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest) {
      return;
    }
  });

  it('should create a session successfully', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest) {
      return;
    }

    const response = await authenticatedRequest('/sessions', testAccessToken, {
      method: 'POST',
      body: JSON.stringify({
        preset: 'single',
        workingDirectory: '/tmp/test',
        guardrails: 'default',
      }),
    });

    expect(response.status).toBe(201);
    const session = (await response.json()) as Session;
    expect(session.id).toBeDefined();
    expect(session.state).toBe('running');
    expect(session.workingDirectory).toBe('/tmp/test');
    expect(session.agentConfig.preset).toBe('single');
    expect(session.agentConfig.guardrails).toBe('default');
    expect(session.agentConfig.agents).toHaveLength(1);
    expect(session.agentConfig.agents[0].type).toBe('claude' as AgentType);

    createdSessionId = session.id;
  });

  it('should list sessions for the authenticated user', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest) {
      return;
    }

    const response = await authenticatedRequest('/sessions', testAccessToken, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      sessions: SessionInfo[];
      pagination: { total: number; limit: number; offset: number; hasMore: boolean };
    };
    expect(body.sessions).toBeDefined();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('should filter sessions by state', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest) {
      return;
    }

    const response = await authenticatedRequest('/sessions?state=running', testAccessToken, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { sessions: SessionInfo[] };
    expect(body.sessions.every((s: SessionInfo) => s.state === 'running')).toBe(true);
  });

  it('should get session details', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}`,
      testAccessToken,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);
    const session = (await response.json()) as Session;
    expect(session.id).toBe(createdSessionId);
    expect(session.workingDirectory).toBe('/tmp/test');
  });

  it('should not allow access to another user\'s session', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}`,
      otherAccessToken,
      { method: 'GET' }
    );

    expect(response.status).toBe(404);
  });

  it('should get WebSocket connection info', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}/connect`,
      testAccessToken,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);
    const connectionInfo = (await response.json()) as ConnectionInfo;
    expect(connectionInfo.wsUrl).toBeDefined();
    expect(connectionInfo.wsUrl).toContain('ws');
    expect(connectionInfo.token).toBeDefined();
    expect(connectionInfo.protocolVersion).toBe('3.0');
  });

  it('should terminate a session', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}`,
      testAccessToken,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);

    // Verify session is completed
    const getResponse = await authenticatedRequest(
      `/sessions/${createdSessionId}`,
      testAccessToken,
      { method: 'GET' }
    );

    expect(getResponse.status).toBe(200);
    const session = (await getResponse.json()) as Session;
    expect(session.state).toBe('completed');
  });

  it('should not allow connection to completed session', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}/connect`,
      testAccessToken,
      { method: 'GET' }
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('invalid_state');
  });

  it('should handle deleting already completed session', async () => {
    const isIntegrationTest = process.env.TEST_DATABASE_URL || process.env.CI;
    if (!isIntegrationTest || !createdSessionId) {
      return;
    }

    const response = await authenticatedRequest(
      `/sessions/${createdSessionId}`,
      testAccessToken,
      { method: 'DELETE' }
    );

    // Should succeed idempotently
    expect(response.status).toBe(204);
  });
});
