/**
 * Tests for the Universal Hooks Layer
 */

import { describe, expect, it } from 'vitest';
import { normalizeHookEvent, validateHookRequest } from '../hooks/normalizer.js';
import type { IncomingHookRequest } from '../hooks/types.js';

describe('Hooks Module', () => {
  describe('validateHookRequest', () => {
    it('should validate correct request', () => {
      const request = {
        source: 'claude',
        event_type: 'Notification',
        data: { message: 'Hello' },
      };

      const result = validateHookRequest(request);
      expect(result).not.toBeNull();
      expect(result?.source).toBe('claude');
      expect(result?.event_type).toBe('Notification');
    });

    it('should reject missing source', () => {
      const request = {
        event_type: 'Notification',
        data: {},
      };

      const result = validateHookRequest(request);
      expect(result).toBeNull();
    });

    it('should reject invalid source', () => {
      const request = {
        source: 'invalid_source',
        event_type: 'Notification',
        data: {},
      };

      const result = validateHookRequest(request);
      expect(result).toBeNull();
    });

    it('should reject missing event_type', () => {
      const request = {
        source: 'claude',
        data: {},
      };

      const result = validateHookRequest(request);
      expect(result).toBeNull();
    });

    it('should accept request without data', () => {
      const request = {
        source: 'claude',
        event_type: 'Stop',
      };

      const result = validateHookRequest(request);
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({});
    });

    it('should accept all valid sources', () => {
      const sources = ['claude', 'gemini', 'copilot', 'aider', 'custom'];

      for (const source of sources) {
        const request = { source, event_type: 'test', data: {} };
        const result = validateHookRequest(request);
        expect(result).not.toBeNull();
        expect(result?.source).toBe(source);
      }
    });
  });

  describe('normalizeHookEvent - Claude', () => {
    it('should normalize Notification event', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'Notification',
        data: {
          hook_event_name: 'Notification',
          message: 'Test notification',
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.source).toBe('claude');
      expect(event.eventType).toBe('notification');
      expect(event.title).toBe('Test notification');
      expect(event.actionable).toBe(false);
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();
    });

    it('should normalize Stop event', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'Stop',
        data: {
          hook_event_name: 'Stop',
          message: 'Agent stopped',
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.eventType).toBe('stopped');
      expect(event.title).toBe('Claude stopped');
    });

    it('should normalize PreToolUse as approval request', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'PreToolUse',
        data: {
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: {
            command: 'rm -rf node_modules',
          },
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.eventType).toBe('needs_approval');
      expect(event.actionable).toBe(true);
      expect(event.actions).toHaveLength(2);
      expect(event.actions?.[0].id).toBe('approve');
      expect(event.actions?.[1].id).toBe('deny');
      expect(event.title).toContain('Bash');
      expect(event.details).toContain('rm -rf node_modules');
    });

    it('should format Bash command in details', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'PreToolUse',
        data: {
          hook_event_name: 'PreToolUse',
          tool_name: 'Bash',
          tool_input: { command: 'git push --force' },
        },
      };

      const event = normalizeHookEvent(request);
      expect(event.details).toBe('$ git push --force');
    });

    it('should format Write tool in details', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'PreToolUse',
        data: {
          hook_event_name: 'PreToolUse',
          tool_name: 'Write',
          tool_input: { file_path: '/etc/hosts' },
        },
      };

      const event = normalizeHookEvent(request);
      expect(event.details).toBe('Writing to: /etc/hosts');
    });
  });

  describe('normalizeHookEvent - Gemini', () => {
    it('should normalize Notification event', () => {
      const request: IncomingHookRequest = {
        source: 'gemini',
        event_type: 'Notification',
        data: {
          event_type: 'Notification',
          message: 'Gemini notification',
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.source).toBe('gemini');
      expect(event.eventType).toBe('notification');
      expect(event.title).toBe('Gemini notification');
    });

    it('should normalize AfterAgent success', () => {
      const request: IncomingHookRequest = {
        source: 'gemini',
        event_type: 'AfterAgent',
        data: {
          event_type: 'AfterAgent',
          exit_code: 0,
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.eventType).toBe('stopped');
      expect(event.title).toBe('Gemini finished');
    });

    it('should normalize AfterAgent error', () => {
      const request: IncomingHookRequest = {
        source: 'gemini',
        event_type: 'AfterAgent',
        data: {
          event_type: 'AfterAgent',
          exit_code: 1,
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.eventType).toBe('error');
      expect(event.title).toContain('error');
      expect(event.title).toContain('1');
    });
  });

  describe('normalizeHookEvent - Custom', () => {
    it('should handle unknown source', () => {
      const request: IncomingHookRequest = {
        source: 'custom',
        event_type: 'my_event',
        data: {
          title: 'Custom Event',
          message: 'Custom message',
        },
      };

      const event = normalizeHookEvent(request);

      expect(event.source).toBe('custom');
      expect(event.title).toBe('Custom Event');
    });

    it('should detect approval event type from name', () => {
      const request: IncomingHookRequest = {
        source: 'custom',
        event_type: 'needs_approval_for_action',
        data: { title: 'Approval needed' },
      };

      const event = normalizeHookEvent(request);
      expect(event.eventType).toBe('needs_approval');
      expect(event.actionable).toBe(true);
    });

    it('should detect stopped event type from name', () => {
      const request: IncomingHookRequest = {
        source: 'custom',
        event_type: 'task_finished',
        data: { title: 'Done' },
      };

      const event = normalizeHookEvent(request);
      expect(event.eventType).toBe('stopped');
    });

    it('should detect error event type from name', () => {
      const request: IncomingHookRequest = {
        source: 'custom',
        event_type: 'fatal_error',
        data: { title: 'Error occurred' },
      };

      const event = normalizeHookEvent(request);
      expect(event.eventType).toBe('error');
    });
  });

  describe('Event ID and Timestamp', () => {
    it('should generate unique IDs', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'Notification',
        data: { message: 'Test' },
      };

      const event1 = normalizeHookEvent(request);
      const event2 = normalizeHookEvent(request);

      expect(event1.id).not.toBe(event2.id);
    });

    it('should generate valid ISO timestamps', () => {
      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'Notification',
        data: { message: 'Test' },
      };

      const event = normalizeHookEvent(request);
      const date = new Date(event.timestamp);

      expect(date.toISOString()).toBe(event.timestamp);
      expect(Date.now() - date.getTime()).toBeLessThan(1000);
    });
  });

  describe('Raw Data Preservation', () => {
    it('should preserve original data in raw field', () => {
      const originalData = {
        hook_event_name: 'Notification',
        message: 'Test',
        custom_field: 'preserved',
        nested: { key: 'value' },
      };

      const request: IncomingHookRequest = {
        source: 'claude',
        event_type: 'Notification',
        data: originalData,
      };

      const event = normalizeHookEvent(request);

      expect(event.raw).toEqual(originalData);
      expect(event.raw.custom_field).toBe('preserved');
      expect((event.raw.nested as Record<string, unknown>).key).toBe('value');
    });
  });
});
