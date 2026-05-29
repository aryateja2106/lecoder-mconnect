/**
 * Verify that cursor source events are accepted and normalized correctly
 * by the universal hooks layer.
 */

import { describe, expect, it } from 'vitest';
import { normalizeHookEvent, validateHookRequest } from '../hooks/normalizer.js';
import type { IncomingHookRequest } from '../hooks/types.js';

describe('hooks/normalizer cursor source', () => {
  it('accepts cursor as a valid source', () => {
    const request = {
      source: 'cursor',
      event_type: 'loop_iteration_complete',
      data: {
        loop_id: 'loop_x',
        completed: 2,
        target: 5,
        next_iteration: 3,
      },
    };
    const validated = validateHookRequest(request);
    expect(validated).not.toBeNull();
    expect(validated?.source).toBe('cursor');
  });

  it('produces actionable iteration progress events', () => {
    const event = normalizeHookEvent({
      source: 'cursor',
      event_type: 'loop_iteration_complete',
      data: {
        loop_id: 'loop_progress',
        completed: 4,
        target: 10,
        next_iteration: 5,
      },
    } as IncomingHookRequest);

    expect(event.source).toBe('cursor');
    expect(event.actionable).toBe(true);
    expect(event.actions?.map((a) => a.id).sort()).toEqual(['pause', 'stop']);
    expect(event.title).toContain('4');
    expect(event.title).toContain('10');
    expect(event.details).toContain('5');
  });

  it('produces a stopped event for loop_complete', () => {
    const event = normalizeHookEvent({
      source: 'cursor',
      event_type: 'loop_complete',
      data: { loop_id: 'loop_done', completed: 5, reason: 'Reached target.' },
    } as IncomingHookRequest);

    expect(event.eventType).toBe('stopped');
    expect(event.actionable).toBe(false);
    expect(event.details).toContain('Reached target');
  });

  it('produces an error event for loop_error', () => {
    const event = normalizeHookEvent({
      source: 'cursor',
      event_type: 'loop_error',
      data: { loop_id: 'loop_err', reason: 'Spec missing' },
    } as IncomingHookRequest);
    expect(event.eventType).toBe('error');
  });

  it('falls back to a notification for unknown cursor event types', () => {
    const event = normalizeHookEvent({
      source: 'cursor',
      event_type: 'something_else',
      data: { message: 'hi' },
    } as IncomingHookRequest);
    expect(event.source).toBe('cursor');
    expect(event.eventType).toBe('notification');
    expect(event.title).toContain('something_else');
  });

  it('handles raw cursor stop events', () => {
    const event = normalizeHookEvent({
      source: 'cursor',
      event_type: 'stop',
      data: { status: 'completed', loop_count: 7 },
    } as IncomingHookRequest);
    expect(event.eventType).toBe('stopped');
    expect(event.title).toContain('Cursor');
  });
});
