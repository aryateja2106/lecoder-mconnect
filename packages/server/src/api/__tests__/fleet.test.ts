/**
 * Fleet API tests
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import {
  initializeAuthService,
  resetAuthService,
  getAuthService,
} from '../../auth/index.js';
import {
  getRuntimeRegistry,
  resetRuntimeRegistryForTests,
} from '../../fleet/RuntimeRegistry.js';
import { handleFleetRoutes } from '../fleet.js';

const testUser = {
  id: 'fleet-user-1',
  email: 'fleet@example.com',
  name: 'Fleet User',
  provider: 'github' as const,
  providerId: 'github-fleet-1',
  createdAt: new Date(),
};

let userToken: string;

function createRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Request {
  return new Request(`http://localhost:3001${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body,
  });
}

describe('Fleet API', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    initializeAuthService({
      jwt: {
        secret: 'test-secret-at-least-32-characters-long',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
      },
    });
    userToken = await getAuthService().getJWTService().createAccessToken(testUser);
  });

  afterAll(() => {
    resetAuthService();
    delete process.env.LECODER_HUB_SHARED_TOKEN;
  });

  beforeEach(() => {
    resetRuntimeRegistryForTests();
    delete process.env.LECODER_HUB_SHARED_TOKEN;
  });

  // ----------------- Daemon-facing -----------------

  describe('POST /fleet/register', () => {
    const validBody = JSON.stringify({
      name: 'laptop',
      hostname: 'macbook.local',
      platform: 'darwin',
      arch: 'arm64',
      user: 'arya',
      version: '0.2.0',
    });

    it('returns 201 with runtimeId when no shared token is configured (open mode)', async () => {
      const res = await handleFleetRoutes(
        createRequest('/fleet/register', { method: 'POST', body: validBody }),
        '/fleet/register'
      );
      expect(res?.status).toBe(201);
      const data = (await res!.json()) as { runtimeId: string };
      expect(data.runtimeId).toBeTruthy();
    });

    it('returns 401 when shared token is configured but not provided', async () => {
      process.env.LECODER_HUB_SHARED_TOKEN = 'sekret';
      const res = await handleFleetRoutes(
        createRequest('/fleet/register', { method: 'POST', body: validBody }),
        '/fleet/register'
      );
      expect(res?.status).toBe(401);
    });

    it('accepts the shared token via Authorization header', async () => {
      process.env.LECODER_HUB_SHARED_TOKEN = 'sekret';
      const res = await handleFleetRoutes(
        createRequest('/fleet/register', {
          method: 'POST',
          headers: { Authorization: 'Bearer sekret' },
          body: validBody,
        }),
        '/fleet/register'
      );
      expect(res?.status).toBe(201);
    });

    it('returns 400 on invalid body', async () => {
      const res = await handleFleetRoutes(
        createRequest('/fleet/register', { method: 'POST', body: '{}' }),
        '/fleet/register'
      );
      expect(res?.status).toBe(400);
    });
  });

  describe('POST /fleet/:id/heartbeat', () => {
    it('returns 204 for known runtime', async () => {
      const r = getRuntimeRegistry().register({
        name: 'l',
        hostname: 'h',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}/heartbeat`, { method: 'POST', body: '{}' }),
        `/fleet/${r.id}/heartbeat`
      );
      expect(res?.status).toBe(204);
    });

    it('returns 404 for unknown runtime', async () => {
      const res = await handleFleetRoutes(
        createRequest('/fleet/nope/heartbeat', { method: 'POST', body: '{}' }),
        '/fleet/nope/heartbeat'
      );
      expect(res?.status).toBe(404);
    });
  });

  describe('GET /fleet/:id/tasks/next', () => {
    it('returns 204 when queue empty', async () => {
      const r = getRuntimeRegistry().register({
        name: 'l',
        hostname: 'h',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}/tasks/next`),
        `/fleet/${r.id}/tasks/next`
      );
      expect(res?.status).toBe(204);
    });

    it('returns queued tasks and drains them', async () => {
      const r = getRuntimeRegistry().register({
        name: 'l',
        hostname: 'h',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
      });
      getRuntimeRegistry().enqueueTask(r.id, { id: 't-1', title: 'do thing' });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}/tasks/next`),
        `/fleet/${r.id}/tasks/next`
      );
      expect(res?.status).toBe(200);
      const data = (await res!.json()) as { tasks: Array<{ id: string }> };
      expect(data.tasks[0].id).toBe('t-1');
      expect(getRuntimeRegistry().queueDepth(r.id)).toBe(0);
    });

    it('returns 404 for unknown runtime', async () => {
      const res = await handleFleetRoutes(
        createRequest('/fleet/nope/tasks/next'),
        '/fleet/nope/tasks/next'
      );
      expect(res?.status).toBe(404);
    });
  });

  // ----------------- User-facing -----------------

  describe('GET /fleet', () => {
    it('returns 401 without auth', async () => {
      const res = await handleFleetRoutes(createRequest('/fleet'), '/fleet');
      expect(res?.status).toBe(401);
    });

    it('returns runtimes scoped to the authenticated user', async () => {
      getRuntimeRegistry().register({
        name: 'mine',
        hostname: 'm',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      getRuntimeRegistry().register({
        name: 'theirs',
        hostname: 't',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: 'someone-else',
      });

      const res = await handleFleetRoutes(
        createRequest('/fleet', { headers: { Authorization: `Bearer ${userToken}` } }),
        '/fleet'
      );
      expect(res?.status).toBe(200);
      const data = (await res!.json()) as { runtimes: Array<{ name: string }> };
      expect(data.runtimes.length).toBe(1);
      expect(data.runtimes[0].name).toBe('mine');
    });
  });

  describe('GET /fleet/:id', () => {
    it('returns the runtime when owner matches', async () => {
      const r = getRuntimeRegistry().register({
        name: 'mine',
        hostname: 'm',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}`, { headers: { Authorization: `Bearer ${userToken}` } }),
        `/fleet/${r.id}`
      );
      expect(res?.status).toBe(200);
    });

    it('returns 404 for runtime owned by another user', async () => {
      const r = getRuntimeRegistry().register({
        name: 'theirs',
        hostname: 't',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: 'someone-else',
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}`, { headers: { Authorization: `Bearer ${userToken}` } }),
        `/fleet/${r.id}`
      );
      expect(res?.status).toBe(404);
    });
  });

  describe('POST /fleet/:id/tasks', () => {
    it('returns 202 with taskId on enqueue', async () => {
      const r = getRuntimeRegistry().register({
        name: 'mine',
        hostname: 'm',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}/tasks`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ title: 'fix flaky test' }),
        }),
        `/fleet/${r.id}/tasks`
      );
      expect(res?.status).toBe(202);
      expect(getRuntimeRegistry().queueDepth(r.id)).toBe(1);
    });

    it('rejects empty title', async () => {
      const r = getRuntimeRegistry().register({
        name: 'mine',
        hostname: 'm',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      const res = await handleFleetRoutes(
        createRequest(`/fleet/${r.id}/tasks`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ title: '' }),
        }),
        `/fleet/${r.id}/tasks`
      );
      expect(res?.status).toBe(400);
    });
  });

  describe('routing', () => {
    it('returns null for non-fleet paths', async () => {
      expect(await handleFleetRoutes(createRequest('/'), '/')).toBeNull();
    });
  });
});
