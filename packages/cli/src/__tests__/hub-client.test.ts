/**
 * Tests for hub/HubClient
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRegistration,
  HubClient,
  hubClientFromEnv,
} from '../hub/HubClient.js';

describe('HubClient', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LECODER_')) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    vi.useRealTimers();
  });

  describe('buildRegistration', () => {
    it('uses hostname when no name is provided', () => {
      const reg = buildRegistration({});
      expect(reg.hostname).toBeTruthy();
      expect(reg.name).toBe(reg.hostname);
      expect(reg.platform).toBeTruthy();
      expect(reg.arch).toBeTruthy();
      expect(reg.version).toBeTruthy();
    });

    it('honors a custom runtime name', () => {
      const reg = buildRegistration({ runtimeName: 'workstation' });
      expect(reg.name).toBe('workstation');
    });

    it('trims whitespace and falls back to hostname when blank', () => {
      const reg = buildRegistration({ runtimeName: '   ' });
      expect(reg.name).toBe(reg.hostname);
    });
  });

  describe('start()', () => {
    it('throws when hubUrl is missing', () => {
      expect(() => new HubClient({ hubUrl: '' })).toThrow();
    });

    it('strips trailing slash on hubUrl', async () => {
      const calls: string[] = [];
      const fetchImpl = vi.fn(async (url: string) => {
        calls.push(url);
        return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com/',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      expect(calls[0]).toBe('https://hub.example.com/fleet/register');
      await client.stop();
    });

    it('returns the runtime id on successful registration', async () => {
      const fetchImpl = vi.fn(
        async () => new Response(JSON.stringify({ runtimeId: 'r-42' }), { status: 200 })
      ) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      const reg = await client.start();
      expect(reg.runtimeId).toBe('r-42');
      expect(client.getStatus()).toBe('registered');
      expect(client.getRuntimeId()).toBe('r-42');
      await client.stop();
    });

    it('throws when the hub returns non-200', async () => {
      const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await expect(client.start()).rejects.toThrow(/401/);
      expect(client.getStatus()).toBe('error');
    });

    it('throws when the hub response lacks runtimeId', async () => {
      const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await expect(client.start()).rejects.toThrow(/runtimeId/);
    });

    it('sends Authorization header when token provided', async () => {
      const init: RequestInit[] = [];
      const fetchImpl = vi.fn(async (_url: string, opts: RequestInit) => {
        init.push(opts);
        return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        hubToken: 'sekret',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      const headers = init[0].headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer sekret');
      await client.stop();
    });

    it('is idempotent — second start() returns same runtime', async () => {
      let calls = 0;
      const fetchImpl = vi.fn(async () => {
        calls++;
        return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      await client.start();
      expect(calls).toBe(1);
      await client.stop();
    });
  });

  describe('heartbeat()', () => {
    it('POSTs to /fleet/:id/heartbeat', async () => {
      const calls: Array<{ url: string; method?: string }> = [];
      const fetchImpl = vi.fn(async (url: string, opts: RequestInit) => {
        calls.push({ url, method: opts.method });
        if (url.endsWith('/register')) {
          return new Response(JSON.stringify({ runtimeId: 'r-7' }), { status: 200 });
        }
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      await client.heartbeat();
      expect(calls.some((c) => c.url.endsWith('/fleet/r-7/heartbeat'))).toBe(true);
      await client.stop();
    });

    it('re-registers on 404 (hub forgot us)', async () => {
      let registerCount = 0;
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.endsWith('/register')) {
          registerCount++;
          return new Response(JSON.stringify({ runtimeId: `r-${registerCount}` }), { status: 200 });
        }
        if (url.endsWith('/heartbeat')) {
          return new Response(null, { status: 404 });
        }
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      await client.heartbeat();
      expect(registerCount).toBe(2);
      await client.stop();
    });
  });

  describe('pollTasks()', () => {
    it('returns empty array on 204', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.endsWith('/register')) {
          return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
        }
        return new Response(null, { status: 204 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      await client.start();
      const tasks = await client.pollTasks();
      expect(tasks).toEqual([]);
      await client.stop();
    });

    it('forwards delivered tasks to handlers', async () => {
      const tasks = [{ id: 't-1', title: 'fix a bug' }];
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.endsWith('/register')) {
          return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
        }
        return new Response(JSON.stringify({ tasks }), { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
      });
      const received: string[] = [];
      client.onTask((t) => received.push(t.id));
      await client.start();
      await client.pollTasks();
      expect(received).toEqual(['t-1']);
      await client.stop();
    });

    it('continues running when one handler throws', async () => {
      const tasks = [{ id: 't-1', title: 'a' }];
      const fetchImpl = vi.fn(async (url: string) => {
        if (url.endsWith('/register')) {
          return new Response(JSON.stringify({ runtimeId: 'r-1' }), { status: 200 });
        }
        return new Response(JSON.stringify({ tasks }), { status: 200 });
      }) as unknown as typeof fetch;

      const client = new HubClient({
        hubUrl: 'https://hub.example.com',
        fetchImpl,
        heartbeatMs: 0,
        pollMs: 0,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      });

      let secondCalled = false;
      client.onTask(() => {
        throw new Error('boom');
      });
      client.onTask(() => {
        secondCalled = true;
      });

      await client.start();
      await client.pollTasks();
      expect(secondCalled).toBe(true);
      await client.stop();
    });
  });

  describe('hubClientFromEnv()', () => {
    beforeEach(() => {
      delete process.env.LECODER_HUB_URL;
      delete process.env.LECODER_HUB_TOKEN;
      delete process.env.LECODER_RUNTIME_NAME;
    });

    it('returns null when no env var', () => {
      expect(hubClientFromEnv()).toBeNull();
    });

    it('returns a HubClient when LECODER_HUB_URL is set', () => {
      process.env.LECODER_HUB_URL = 'https://hub.example.com';
      const client = hubClientFromEnv();
      expect(client).not.toBeNull();
    });
  });
});
