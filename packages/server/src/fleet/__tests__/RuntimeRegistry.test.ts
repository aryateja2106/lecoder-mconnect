/**
 * Tests for fleet/RuntimeRegistry
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { RuntimeRegistry, type Clock } from '../RuntimeRegistry.js';

class FakeClock implements Clock {
  current = 0;
  now() {
    return this.current;
  }
  advance(ms: number) {
    this.current += ms;
  }
}

const baseInput = {
  name: 'laptop',
  hostname: 'macbook-pro.local',
  platform: 'darwin',
  arch: 'arm64',
  user: 'arya',
  version: '0.2.0',
};

describe('RuntimeRegistry', () => {
  let registry: RuntimeRegistry;
  let clock: FakeClock;
  let nextId = 0;

  beforeEach(() => {
    clock = new FakeClock();
    nextId = 0;
    registry = new RuntimeRegistry({
      clock,
      generateId: () => `r-${++nextId}`,
      offlineAfterMs: 1000,
    });
  });

  describe('register', () => {
    it('creates a runtime with a fresh id', () => {
      const r = registry.register(baseInput);
      expect(r.id).toBe('r-1');
      expect(r.status).toBe('online');
      expect(r.registeredAt).toBe(0);
      expect(r.lastHeartbeatAt).toBe(0);
    });

    it('reuses the runtime id on re-registration with same hostname/user', () => {
      const a = registry.register(baseInput);
      clock.advance(500);
      const b = registry.register(baseInput);
      expect(b.id).toBe(a.id);
      expect(b.lastHeartbeatAt).toBe(500);
      expect(registry.size()).toBe(1);
    });

    it('treats different users on the same host as separate runtimes', () => {
      registry.register(baseInput);
      registry.register({ ...baseInput, user: 'sujith' });
      expect(registry.size()).toBe(2);
    });

    it('treats different ownerUserId as separate runtimes', () => {
      registry.register({ ...baseInput, ownerUserId: 'u-1' });
      registry.register({ ...baseInput, ownerUserId: 'u-2' });
      expect(registry.size()).toBe(2);
    });
  });

  describe('heartbeat', () => {
    it('updates lastHeartbeatAt for known runtime', () => {
      const r = registry.register(baseInput);
      clock.advance(700);
      expect(registry.heartbeat(r.id)).toBe(true);
      expect(registry.get(r.id)?.lastHeartbeatAt).toBe(700);
    });

    it('returns false for unknown runtime', () => {
      expect(registry.heartbeat('does-not-exist')).toBe(false);
    });
  });

  describe('status sweep', () => {
    it('keeps online while heartbeat is fresh', () => {
      const r = registry.register(baseInput);
      clock.advance(500);
      expect(registry.get(r.id)?.status).toBe('online');
    });

    it('marks stale once heartbeat is older than offlineAfterMs', () => {
      const r = registry.register(baseInput);
      clock.advance(1500);
      registry.sweepStaleRuntimes();
      expect(registry.get(r.id)?.status).toBe('stale');
    });

    it('marks offline after 5x offlineAfterMs', () => {
      const r = registry.register(baseInput);
      clock.advance(6000);
      registry.sweepStaleRuntimes();
      expect(registry.get(r.id)?.status).toBe('offline');
    });
  });

  describe('list', () => {
    it('returns all runtimes sorted by name', () => {
      registry.register({ ...baseInput, name: 'zen' });
      registry.register({ ...baseInput, name: 'apple', hostname: 'apple.local' });
      const list = registry.list();
      expect(list.map((r) => r.name)).toEqual(['apple', 'zen']);
    });

    it('filters by ownerUserId', () => {
      registry.register({ ...baseInput, ownerUserId: 'u-1' });
      registry.register({ ...baseInput, ownerUserId: 'u-2', hostname: 'b.local' });
      const list = registry.list({ ownerUserId: 'u-1' });
      expect(list.length).toBe(1);
      expect(list[0].ownerUserId).toBe('u-1');
    });
  });

  describe('task queue', () => {
    it('enqueues and drains tasks', () => {
      const r = registry.register(baseInput);
      registry.enqueueTask(r.id, { id: 't-1', title: 'a' });
      registry.enqueueTask(r.id, { id: 't-2', title: 'b' });
      expect(registry.queueDepth(r.id)).toBe(2);

      const drained = registry.drainTasks(r.id);
      expect(drained.map((t) => t.id)).toEqual(['t-1', 't-2']);
      expect(registry.queueDepth(r.id)).toBe(0);
    });

    it('respects max param', () => {
      const r = registry.register(baseInput);
      for (let i = 0; i < 5; i++) registry.enqueueTask(r.id, { id: `t-${i}`, title: '' });
      const drained = registry.drainTasks(r.id, 2);
      expect(drained.length).toBe(2);
      expect(registry.queueDepth(r.id)).toBe(3);
    });

    it('refuses to enqueue for unknown runtime', () => {
      expect(registry.enqueueTask('nope', { id: 't-1', title: 'a' })).toBe(false);
    });

    it('returns empty when no queue exists', () => {
      const r = registry.register(baseInput);
      expect(registry.drainTasks(r.id)).toEqual([]);
    });
  });

  describe('remove', () => {
    it('drops a runtime and its queue', () => {
      const r = registry.register(baseInput);
      registry.enqueueTask(r.id, { id: 't-1', title: 'a' });
      expect(registry.remove(r.id)).toBe(true);
      expect(registry.size()).toBe(0);
      expect(registry.queueDepth(r.id)).toBe(0);
    });

    it('returns false for unknown runtime', () => {
      expect(registry.remove('nope')).toBe(false);
    });
  });
});
