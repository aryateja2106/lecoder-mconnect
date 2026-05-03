/**
 * Tests for cli/commands/task.ts
 *
 * Same approach as fleet-cli.test.ts: mock fetch and assert request shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTaskCommand } from '../cli/commands/task.js';

describe('task CLI', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const originalExit = process.exit;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  let logged: string[] = [];
  let errored: string[] = [];

  beforeEach(() => {
    process.env.LECODER_HUB_URL = 'https://hub.example.com';
    process.env.LECODER_HUB_TOKEN = 'tk';
    logged = [];
    errored = [];
    console.log = (msg: unknown) => logged.push(String(msg));
    console.error = (msg: unknown) => errored.push(String(msg));
    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LECODER_')) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('new POSTs the title', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({ task: { id: 't-1', title: 'fix', status: 'queued', createdAt: 0, updatedAt: 0 } }),
        { status: 201 }
      );
    }) as unknown as typeof fetch;

    const cmd = createTaskCommand();
    await cmd.parseAsync(['new', 'fix flaky test', '--provider', 'claude'], { from: 'user' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hub.example.com/tasks');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.title).toBe('fix flaky test');
    expect(body.provider).toBe('claude');
  });

  it('ls includes filter query parameters', async () => {
    const calls: Array<{ url: string }> = [];
    globalThis.fetch = vi.fn(async (url: unknown) => {
      calls.push({ url: String(url) });
      return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cmd = createTaskCommand();
    await cmd.parseAsync(['ls', '--status', 'running', '--runtime', 'r-1'], { from: 'user' });
    expect(calls[0].url).toBe('https://hub.example.com/tasks?status=running&runtime=r-1');
  });

  it('view fetches the right path', async () => {
    const calls: Array<{ url: string }> = [];
    globalThis.fetch = vi.fn(async (url: unknown) => {
      calls.push({ url: String(url) });
      return new Response(
        JSON.stringify({
          task: {
            id: 't-1',
            title: 'a',
            status: 'queued',
            createdAt: 0,
            updatedAt: 0,
          },
          runs: [],
          comments: [],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const cmd = createTaskCommand();
    await cmd.parseAsync(['view', 't-1'], { from: 'user' });
    expect(calls[0].url).toBe('https://hub.example.com/tasks/t-1');
  });

  it('cancel issues DELETE', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    const cmd = createTaskCommand();
    await cmd.parseAsync(['cancel', 't-1'], { from: 'user' });
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].url).toBe('https://hub.example.com/tasks/t-1');
  });

  it('comment POSTs body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ comment: { id: 'c-1' } }), { status: 201 });
    }) as unknown as typeof fetch;

    const cmd = createTaskCommand();
    await cmd.parseAsync(['comment', 't-1', 'lgtm'], { from: 'user' });
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.body).toBe('lgtm');
  });

  it('exits non-zero when LECODER_HUB_URL missing', async () => {
    delete process.env.LECODER_HUB_URL;
    const cmd = createTaskCommand();
    await expect(cmd.parseAsync(['ls'], { from: 'user' })).rejects.toThrow(/process\.exit/);
  });
});
