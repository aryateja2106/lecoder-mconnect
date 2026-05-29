/**
 * Tests for cli/commands/fleet.ts
 *
 * The fleet CLI is thin (just hits HTTP) so the only valuable thing to lock
 * in is the request shape. We mock global.fetch and inspect calls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFleetCommand } from '../cli/commands/fleet.js';

describe('fleet CLI', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const originalExit = process.exit;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  let logged: string[] = [];
  let errored: string[] = [];

  beforeEach(() => {
    process.env.LECODER_HUB_URL = 'https://hub.example.com';
    process.env.LECODER_HUB_TOKEN = 'test-token';
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

  it('GET /fleet sends Authorization header', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ runtimes: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cmd = createFleetCommand();
    await cmd.parseAsync(['ls'], { from: 'user' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hub.example.com/fleet');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-token');
  });

  it('renders empty list message when no runtimes', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ runtimes: [] }), { status: 200 })
    ) as unknown as typeof fetch;

    const cmd = createFleetCommand();
    await cmd.parseAsync(['ls'], { from: 'user' });

    expect(logged.some((line) => line.includes('No runtimes registered'))).toBe(true);
  });

  it('--json prints raw JSON for ls', async () => {
    const payload = { runtimes: [{ id: 'r-1', name: 'laptop', status: 'online' }] };
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify(payload), { status: 200 })
    ) as unknown as typeof fetch;

    const cmd = createFleetCommand();
    await cmd.parseAsync(['ls', '--json'], { from: 'user' });

    const joined = logged.join('\n');
    expect(joined).toContain('"runtimes"');
    expect(joined).toContain('r-1');
  });

  it('send POSTs the title and provider', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ taskId: 't-1', queueDepth: 1 }), { status: 202 });
    }) as unknown as typeof fetch;

    const cmd = createFleetCommand();
    await cmd.parseAsync(
      ['send', 'r-1', 'fix flaky test', '--provider', 'claude'],
      { from: 'user' }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://hub.example.com/fleet/r-1/tasks');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.title).toBe('fix flaky test');
    expect(body.provider).toBe('claude');
  });

  it('exits non-zero when LECODER_HUB_URL is unset', async () => {
    delete process.env.LECODER_HUB_URL;

    const cmd = createFleetCommand();
    await expect(cmd.parseAsync(['ls'], { from: 'user' })).rejects.toThrow(
      /process\.exit\(1\)/
    );
    expect(errored.some((l) => l.includes('Hub URL not set'))).toBe(true);
  });

  it('surfaces hub error responses', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('boom', { status: 500, statusText: 'Internal Server Error' })
    ) as unknown as typeof fetch;

    const cmd = createFleetCommand();
    await expect(cmd.parseAsync(['ls'], { from: 'user' })).rejects.toThrow(
      /process\.exit\(1\)/
    );
    expect(errored.some((l) => l.includes('500'))).toBe(true);
  });
});
