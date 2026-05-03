/**
 * Tests for tasks/CommentInjector
 */

import { describe, expect, it, vi } from 'vitest';
import {
  type AgentWriter,
  type CommentRecord,
  type CommentSource,
  CommentInjector,
} from '../tasks/CommentInjector.js';

function makeSource(stages: CommentRecord[][]): CommentSource {
  let i = 0;
  return {
    async listComments() {
      const stage = stages[i] ?? stages[stages.length - 1] ?? [];
      i++;
      return stage;
    },
  };
}

function makeWriter(): AgentWriter & { writes: string[] } {
  const writes: string[] = [];
  return {
    writes,
    write(s: string) {
      writes.push(s);
    },
  };
}

const silentLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() };

describe('CommentInjector', () => {
  it('first poll establishes baseline without injecting', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [{ id: 'c-1', body: '@agent run tests', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    const injected = await injector.poll();
    expect(injected).toBe(0);
    expect(writer.writes).toEqual([]);
  });

  it('second poll injects new mentions', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [], // bootstrap
      [{ id: 'c-2', body: '@agent run tests', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    await injector.poll();
    const injected = await injector.poll();
    expect(injected).toBe(1);
    expect(writer.writes).toEqual(['run tests\n']);
  });

  it('skips comments without mentions', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [],
      [{ id: 'c-2', body: 'lgtm', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    await injector.poll();
    expect(await injector.poll()).toBe(0);
    expect(writer.writes).toEqual([]);
  });

  it('skips comments authored by the agent itself', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [],
      [{ id: 'c-2', body: '@agent run tests', authorKind: 'agent', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    await injector.poll();
    expect(await injector.poll()).toBe(0);
  });

  it('does not double-inject the same comment across polls', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [],
      [{ id: 'c-2', body: '@agent run', authorKind: 'human', createdAt: 0 }],
      [{ id: 'c-2', body: '@agent run', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    await injector.poll();
    await injector.poll();
    expect(await injector.poll()).toBe(0);
    expect(writer.writes).toHaveLength(1);
  });

  it('skips when stripped body is empty', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [],
      [{ id: 'c-2', body: '@agent', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    await injector.poll();
    expect(await injector.poll()).toBe(0);
  });

  it('honors custom mentionPattern', async () => {
    const writer = makeWriter();
    const source = makeSource([
      [],
      [{ id: 'c-2', body: '/agent please run', authorKind: 'human', createdAt: 0 }],
    ]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      mentionPattern: /(^|\s)\/agent\b/i,
      logger: silentLogger,
    });
    await injector.poll();
    expect(await injector.poll()).toBe(1);
    expect(writer.writes[0]).toBe('please run\n');
  });

  it('start()/stop() lifecycle is idempotent', () => {
    const writer = makeWriter();
    const source = makeSource([[]]);
    const injector = new CommentInjector({
      taskId: 't-1',
      source,
      writer,
      logger: silentLogger,
    });
    injector.start();
    injector.start();
    injector.stop();
    injector.stop();
  });
});
