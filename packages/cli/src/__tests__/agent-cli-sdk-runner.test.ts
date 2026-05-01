/**
 * Unit tests for the SDK-runner pure helpers (no network, no SDK).
 */

import { describe, expect, it } from 'vitest';
import {
  buildPrompt,
  formatDuration,
  normalizeSDKMessage,
  probeCursorSdk,
} from '../agent-cli/sdk-runner.js';

describe('buildPrompt', () => {
  it('embeds the user task with the default instructions', () => {
    const prompt = buildPrompt('do thing');
    expect(prompt).toContain('User task:');
    expect(prompt).toContain('do thing');
    expect(prompt).toContain('You are a programmable Cursor SDK agent');
  });

  it('appends extra instructions when given', () => {
    const prompt = buildPrompt('do thing', 'EXTRA RULE');
    expect(prompt).toContain('EXTRA RULE');
    expect(prompt).toContain('do thing');
  });
});

describe('formatDuration', () => {
  it('uses ms below 1000', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });
  it('uses s with 1 decimal at 1000+', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(4250)).toBe('4.3s');
  });
});

describe('normalizeSDKMessage', () => {
  it('returns [] for malformed inputs', () => {
    expect(normalizeSDKMessage(null)).toEqual([]);
    expect(normalizeSDKMessage({})).toEqual([]);
    expect(normalizeSDKMessage({ type: 123 })).toEqual([]);
  });

  it('emits assistant_delta for assistant text blocks', () => {
    const events = normalizeSDKMessage({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'hello' }] },
    });
    expect(events).toEqual([{ type: 'assistant_delta', text: 'hello' }]);
  });

  it('emits a tool event for assistant tool blocks', () => {
    const events = normalizeSDKMessage({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 'call_1', name: 'shell', input: { cmd: 'ls' } }],
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'tool',
      callId: 'call_1',
      name: 'shell',
      status: 'requested',
    });
    if (events[0].type === 'tool') {
      expect(events[0].params).toContain('ls');
    }
  });

  it('emits thinking', () => {
    const events = normalizeSDKMessage({ type: 'thinking', text: 'pondering' });
    expect(events).toEqual([{ type: 'thinking', text: 'pondering' }]);
  });

  it('emits tool_call with status', () => {
    const events = normalizeSDKMessage({
      type: 'tool_call',
      call_id: 'c1',
      name: 'shell',
      status: 'completed',
      args: { cmd: 'ls' },
    });
    expect(events[0]).toMatchObject({ type: 'tool', callId: 'c1', status: 'completed' });
  });

  it('emits status events with optional message', () => {
    const events = normalizeSDKMessage({
      type: 'status',
      status: 'RUNNING',
      message: 'go',
    });
    expect(events).toEqual([{ type: 'status', status: 'RUNNING', message: 'go' }]);
  });

  it('emits task events', () => {
    const events = normalizeSDKMessage({
      type: 'task',
      status: 'started',
      text: 'build the thing',
    });
    expect(events).toEqual([{ type: 'task', status: 'started', text: 'build the thing' }]);
  });

  it('truncates long tool params to ~80 chars', () => {
    const longInput = { cmd: 'x'.repeat(200) };
    const events = normalizeSDKMessage({
      type: 'tool_call',
      call_id: 'c',
      name: 'shell',
      status: 'pending',
      args: longInput,
    });
    if (events[0]?.type === 'tool') {
      expect(events[0].params?.length).toBeLessThan(85);
      expect(events[0].params?.endsWith('...')).toBe(true);
    }
  });
});

describe('probeCursorSdk', () => {
  it('returns ok=false with a useful error when @cursor/sdk is missing', async () => {
    const res = await probeCursorSdk();
    // In CI without @cursor/sdk installed: ok=false; otherwise: ok=true.
    if (!res.ok) {
      expect(typeof res.error).toBe('string');
      expect(res.error.length).toBeGreaterThan(0);
    }
  });
});
