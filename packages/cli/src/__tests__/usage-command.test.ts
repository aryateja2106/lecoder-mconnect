import { afterEach, describe, expect, it } from 'vitest';
import {
  parseUsageSnapshot,
  resolveUsageCommand,
  resolveUsageTimeoutMs,
  runUsageCommand,
} from '../observability/usage-command.js';

describe('usage command observability', () => {
  afterEach(() => {
    delete process.env.MCONNECT_USAGE_COMMAND;
    delete process.env.MCONNECT_USAGE_TIMEOUT_MS;
  });

  it('parses camelCase usage snapshots', () => {
    const snapshot = parseUsageSnapshot(
      JSON.stringify({
        promptTokens: 120,
        completionTokens: 30,
        totalTokens: 150,
        costUsd: 0.12,
        window: 'day',
        model: 'gpt-5.5',
        updatedAt: '2026-05-19T12:00:00.000Z',
      })
    );

    expect(snapshot).toMatchObject({
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      costUsd: 0.12,
      window: 'day',
      model: 'gpt-5.5',
      updatedAt: '2026-05-19T12:00:00.000Z',
    });
  });

  it('normalizes snake_case snapshots and derives total tokens', () => {
    const snapshot = parseUsageSnapshot(
      JSON.stringify({
        prompt_tokens: '9',
        completion_tokens: 4,
        cost_usd: '0.03',
        updated_at: 1_779_177_600,
      })
    );

    expect(snapshot.promptTokens).toBe(9);
    expect(snapshot.completionTokens).toBe(4);
    expect(snapshot.totalTokens).toBe(13);
    expect(snapshot.costUsd).toBe(0.03);
    expect(snapshot.updatedAt).toBe('2026-05-19T08:00:00.000Z');
  });

  it('returns unavailable snapshots for invalid output', () => {
    const snapshot = parseUsageSnapshot('not json');

    expect(snapshot.errorMessage).toBe('Usage command returned invalid JSON');
    expect(snapshot.updatedAt).toBeDefined();
  });

  it('resolves command and timeout from environment before config', () => {
    process.env.MCONNECT_USAGE_COMMAND = 'echo env';
    process.env.MCONNECT_USAGE_TIMEOUT_MS = '1234';

    expect(resolveUsageCommand({ version: 'test', usage: { command: 'echo config' } })).toBe(
      'echo env'
    );
    expect(resolveUsageTimeoutMs({ version: 'test', usage: { timeoutMs: 999 } })).toBe(1234);
  });

  it('runs a configured JSON command', async () => {
    const snapshot = await runUsageCommand(
      'node -e "console.log(JSON.stringify({ totalTokens: 42, costUsd: 0.01 }))"',
      { timeoutMs: 2_000 }
    );

    expect(snapshot.totalTokens).toBe(42);
    expect(snapshot.costUsd).toBe(0.01);
    expect(snapshot.errorMessage).toBeUndefined();
  });
});
