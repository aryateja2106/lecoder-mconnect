/**
 * Task API tests
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
import { resetTaskStoreForTests, getTaskStore } from '../../tasks/TaskStore.js';
import { handleTaskRoutes } from '../tasks.js';

const testUser = {
  id: 'task-user-1',
  email: 'task@example.com',
  name: 'Task User',
  provider: 'github' as const,
  providerId: 'github-task',
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

function userReq(
  path: string,
  options: { method?: string; body?: string; token?: string } = {}
): Request {
  return createRequest(path, {
    ...options,
    headers: { Authorization: `Bearer ${options.token ?? userToken}` },
  });
}

describe('Task API', () => {
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
    resetTaskStoreForTests();
    resetRuntimeRegistryForTests();
    delete process.env.LECODER_HUB_SHARED_TOKEN;
  });

  describe('POST /tasks', () => {
    it('returns 401 without auth', async () => {
      const res = await handleTaskRoutes(
        createRequest('/tasks', { method: 'POST', body: JSON.stringify({ title: 'x' }) }),
        '/tasks'
      );
      expect(res?.status).toBe(401);
    });

    it('creates a task and assigns ownership to caller', async () => {
      const res = await handleTaskRoutes(
        userReq('/tasks', { method: 'POST', body: JSON.stringify({ title: 'fix flake' }) }),
        '/tasks'
      );
      expect(res?.status).toBe(201);
      const data = (await res!.json()) as { task: { id: string; ownerUserId?: string; status: string } };
      expect(data.task.ownerUserId).toBe(testUser.id);
      expect(data.task.status).toBe('queued');
    });

    it('rejects invalid assignee runtime', async () => {
      const res = await handleTaskRoutes(
        userReq('/tasks', {
          method: 'POST',
          body: JSON.stringify({ title: 'x', assigneeRuntimeId: 'nope' }),
        }),
        '/tasks'
      );
      expect(res?.status).toBe(400);
    });

    it('accepts a runtime owned by the caller', async () => {
      const r = getRuntimeRegistry().register({
        name: 'mine',
        hostname: 'm',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      const res = await handleTaskRoutes(
        userReq('/tasks', {
          method: 'POST',
          body: JSON.stringify({ title: 'x', assigneeRuntimeId: r.id }),
        }),
        '/tasks'
      );
      expect(res?.status).toBe(201);
    });
  });

  describe('GET /tasks', () => {
    it('returns only the caller\u2019s tasks', async () => {
      getTaskStore().createTask({ title: 'mine', ownerUserId: testUser.id });
      getTaskStore().createTask({ title: 'theirs', ownerUserId: 'u-other' });
      const res = await handleTaskRoutes(userReq('/tasks'), '/tasks');
      const data = (await res!.json()) as { tasks: Array<{ title: string }> };
      expect(data.tasks.length).toBe(1);
      expect(data.tasks[0].title).toBe('mine');
    });
  });

  describe('GET /tasks/:id', () => {
    it('returns task with runs and comments', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: testUser.id });
      getTaskStore().createRun({ taskId: t.id });
      getTaskStore().createComment({ taskId: t.id, body: 'note', authorUserId: testUser.id });
      const res = await handleTaskRoutes(userReq(`/tasks/${t.id}`), `/tasks/${t.id}`);
      expect(res?.status).toBe(200);
      const data = (await res!.json()) as {
        task: unknown;
        runs: unknown[];
        comments: unknown[];
      };
      expect(data.runs.length).toBe(1);
      expect(data.comments.length).toBe(1);
    });

    it('returns 404 for tasks belonging to other users', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: 'u-other' });
      const res = await handleTaskRoutes(userReq(`/tasks/${t.id}`), `/tasks/${t.id}`);
      expect(res?.status).toBe(404);
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('updates status', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: testUser.id });
      const res = await handleTaskRoutes(
        userReq(`/tasks/${t.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'running' }) }),
        `/tasks/${t.id}`
      );
      expect(res?.status).toBe(200);
      expect(getTaskStore().getTask(t.id)?.status).toBe('running');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('cancels an active task', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: testUser.id });
      const res = await handleTaskRoutes(
        userReq(`/tasks/${t.id}`, { method: 'DELETE' }),
        `/tasks/${t.id}`
      );
      expect(res?.status).toBe(204);
      expect(getTaskStore().getTask(t.id)?.status).toBe('cancelled');
    });
  });

  describe('POST /tasks/:id/comments', () => {
    it('appends a comment', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: testUser.id });
      const res = await handleTaskRoutes(
        userReq(`/tasks/${t.id}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body: 'lgtm' }),
        }),
        `/tasks/${t.id}/comments`
      );
      expect(res?.status).toBe(201);
      expect(getTaskStore().listCommentsForTask(t.id).length).toBe(1);
    });
  });

  describe('POST /runtimes/:id/tasks/claim', () => {
    it('claims oldest queued task for the runtime', async () => {
      const r = getRuntimeRegistry().register({
        name: 'r',
        hostname: 'h',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
        ownerUserId: testUser.id,
      });
      const t = getTaskStore().createTask({ title: 'do', ownerUserId: testUser.id });

      const res = await handleTaskRoutes(
        userReq(`/runtimes/${r.id}/tasks/claim`, { method: 'POST' }),
        `/runtimes/${r.id}/tasks/claim`
      );
      expect(res?.status).toBe(200);
      const data = (await res!.json()) as { task: { id: string; status: string } };
      expect(data.task.id).toBe(t.id);
      expect(data.task.status).toBe('dispatched');
    });

    it('returns 204 when nothing queued', async () => {
      const r = getRuntimeRegistry().register({
        name: 'r',
        hostname: 'h',
        platform: 'p',
        arch: 'a',
        user: 'u',
        version: 'v',
      });
      const res = await handleTaskRoutes(
        userReq(`/runtimes/${r.id}/tasks/claim`, { method: 'POST' }),
        `/runtimes/${r.id}/tasks/claim`
      );
      expect(res?.status).toBe(204);
    });
  });

  describe('POST /tasks/:id/runs + PATCH /tasks/:id/runs/:runId', () => {
    it('starts a run and rolls task to running, then completed', async () => {
      const t = getTaskStore().createTask({ title: 'a', ownerUserId: testUser.id });

      const start = await handleTaskRoutes(
        userReq(`/tasks/${t.id}/runs`, {
          method: 'POST',
          body: JSON.stringify({ runtimeId: 'r-1' }),
        }),
        `/tasks/${t.id}/runs`
      );
      expect(start?.status).toBe(201);
      const startData = (await start!.json()) as { run: { id: string } };
      const runId = startData.run.id;

      expect(getTaskStore().getTask(t.id)?.status).toBe('running');

      const finish = await handleTaskRoutes(
        userReq(`/tasks/${t.id}/runs/${runId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed', exitCode: 0 }),
        }),
        `/tasks/${t.id}/runs/${runId}`
      );
      expect(finish?.status).toBe(200);
      expect(getTaskStore().getTask(t.id)?.status).toBe('completed');
    });
  });

  describe('routing', () => {
    it('returns null for unrelated paths', async () => {
      expect(await handleTaskRoutes(createRequest('/'), '/')).toBeNull();
    });
  });
});
