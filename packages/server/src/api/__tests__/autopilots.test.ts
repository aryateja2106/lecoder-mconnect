/**
 * Autopilot API tests.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import {
  initializeAuthService,
  resetAuthService,
  getAuthService,
} from '../../auth/index.js';
import { resetAutopilotSchedulerForTests, getAutopilotScheduler } from '../../scheduler/Autopilot.js';
import { resetTaskStoreForTests } from '../../tasks/TaskStore.js';
import { handleAutopilotRoutes } from '../autopilots.js';

const testUser = {
  id: 'ap-user-1',
  email: 'ap@example.com',
  name: 'AP User',
  provider: 'github' as const,
  providerId: 'github-ap',
  createdAt: new Date(),
};

let userToken: string;

function userReq(
  path: string,
  options: { method?: string; body?: string } = {}
): Request {
  return new Request(`http://localhost:3001${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
    body: options.body,
  });
}

describe('Autopilot API', () => {
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
  });

  beforeEach(() => {
    resetAutopilotSchedulerForTests();
    resetTaskStoreForTests();
  });

  describe('POST /autopilots', () => {
    it('creates an autopilot with valid schedule', async () => {
      const res = await handleAutopilotRoutes(
        userReq('/autopilots', {
          method: 'POST',
          body: JSON.stringify({
            name: 'standup',
            schedule: 'every 10m',
            task: { title: 'morning standup' },
          }),
        }),
        '/autopilots'
      );
      expect(res?.status).toBe(201);
      const data = (await res!.json()) as { autopilot: { id: string; ownerUserId?: string } };
      expect(data.autopilot.id).toBeTruthy();
      expect(data.autopilot.ownerUserId).toBe(testUser.id);
    });

    it('rejects bad schedule', async () => {
      const res = await handleAutopilotRoutes(
        userReq('/autopilots', {
          method: 'POST',
          body: JSON.stringify({
            name: 'broken',
            schedule: 'sometimes',
            task: { title: 'x' },
          }),
        }),
        '/autopilots'
      );
      expect(res?.status).toBe(400);
    });

    it('rejects without auth', async () => {
      const res = await handleAutopilotRoutes(
        new Request('http://localhost:3001/autopilots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'x', schedule: 'every 1m', task: { title: 'x' } }),
        }),
        '/autopilots'
      );
      expect(res?.status).toBe(401);
    });
  });

  describe('GET /autopilots', () => {
    it('lists only autopilots owned by the caller', async () => {
      const scheduler = getAutopilotScheduler();
      scheduler.create({
        ownerUserId: testUser.id,
        name: 'mine',
        schedule: 'every 1m',
        task: { title: 'x' },
      });
      scheduler.create({
        ownerUserId: 'someone-else',
        name: 'theirs',
        schedule: 'every 1m',
        task: { title: 'y' },
      });

      const res = await handleAutopilotRoutes(userReq('/autopilots'), '/autopilots');
      const data = (await res!.json()) as { autopilots: Array<{ name: string }> };
      expect(data.autopilots.length).toBe(1);
      expect(data.autopilots[0].name).toBe('mine');
    });
  });

  describe('PATCH /autopilots/:id', () => {
    it('updates the schedule', async () => {
      const ap = getAutopilotScheduler().create({
        ownerUserId: testUser.id,
        name: 'a',
        schedule: 'every 10m',
        task: { title: 'x' },
      });
      const res = await handleAutopilotRoutes(
        userReq(`/autopilots/${ap!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ schedule: 'every 1h' }),
        }),
        `/autopilots/${ap!.id}`
      );
      expect(res?.status).toBe(200);
      expect(getAutopilotScheduler().get(ap!.id)?.schedule).toBe('every 1h');
    });

    it('rejects unknown schedule format', async () => {
      const ap = getAutopilotScheduler().create({
        ownerUserId: testUser.id,
        name: 'a',
        schedule: 'every 10m',
        task: { title: 'x' },
      });
      const res = await handleAutopilotRoutes(
        userReq(`/autopilots/${ap!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ schedule: 'sometimes' }),
        }),
        `/autopilots/${ap!.id}`
      );
      expect(res?.status).toBe(400);
    });

    it('returns 404 for autopilots owned by other users', async () => {
      const ap = getAutopilotScheduler().create({
        ownerUserId: 'other',
        name: 'a',
        schedule: 'every 10m',
        task: { title: 'x' },
      });
      const res = await handleAutopilotRoutes(
        userReq(`/autopilots/${ap!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: false }),
        }),
        `/autopilots/${ap!.id}`
      );
      expect(res?.status).toBe(404);
    });
  });

  describe('DELETE /autopilots/:id', () => {
    it('removes the autopilot', async () => {
      const ap = getAutopilotScheduler().create({
        ownerUserId: testUser.id,
        name: 'a',
        schedule: 'every 1m',
        task: { title: 'x' },
      });
      const res = await handleAutopilotRoutes(
        userReq(`/autopilots/${ap!.id}`, { method: 'DELETE' }),
        `/autopilots/${ap!.id}`
      );
      expect(res?.status).toBe(204);
      expect(getAutopilotScheduler().get(ap!.id)).toBeNull();
    });
  });

  describe('routing', () => {
    it('returns null for non-autopilot paths', async () => {
      expect(
        await handleAutopilotRoutes(
          new Request('http://x/foo', { headers: { Authorization: `Bearer ${userToken}` } }),
          '/foo'
        )
      ).toBeNull();
    });
  });
});
