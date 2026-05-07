/**
 * SessionScrollback unit tests.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { SessionScrollback } from '../SessionScrollback.js';

describe('SessionScrollback', () => {
  let sb: SessionScrollback;

  beforeEach(() => {
    sb = new SessionScrollback({ maxBytesPerAgent: 64 });
  });

  describe('append + readAll', () => {
    it('returns empty for unknown agent', () => {
      expect(sb.readAll('nope')).toBe('');
      expect(sb.size('nope')).toBe(0);
      expect(sb.has('nope')).toBe(false);
    });

    it('reads back appended chunks in order', () => {
      sb.append('a1', 'hello ');
      sb.append('a1', 'world');
      expect(sb.readAll('a1')).toBe('hello world');
      expect(sb.size('a1')).toBe(11);
      expect(sb.has('a1')).toBe(true);
    });

    it('keeps per-agent buffers isolated', () => {
      sb.append('a1', 'one');
      sb.append('a2', 'two');
      expect(sb.readAll('a1')).toBe('one');
      expect(sb.readAll('a2')).toBe('two');
    });

    it('ignores empty appends', () => {
      sb.append('a1', '');
      expect(sb.has('a1')).toBe(false);
      expect(sb.size('a1')).toBe(0);
    });
  });

  describe('eviction at maxBytes', () => {
    it('drops oldest chunks when total exceeds maxBytes', () => {
      const chunk = 'x'.repeat(20);
      for (let i = 0; i < 5; i++) {
        sb.append('a1', chunk);
      }
      expect(sb.size('a1')).toBeLessThanOrEqual(64);
      expect(sb.readAll('a1').endsWith('xxxxx')).toBe(true);
    });

    it('trims a head chunk when only partial overflow needs evicting', () => {
      sb.append('a1', 'A'.repeat(40));
      sb.append('a1', 'B'.repeat(40));
      expect(sb.size('a1')).toBe(64);
      const all = sb.readAll('a1');
      expect(all.endsWith('B'.repeat(40))).toBe(true);
      expect(all.length).toBe(64);
    });

    it('handles a single chunk larger than maxBytes by trimming', () => {
      sb.append('a1', 'Z'.repeat(200));
      expect(sb.size('a1')).toBe(64);
      expect(sb.readAll('a1')).toBe('Z'.repeat(64));
    });
  });

  describe('readFromOffset', () => {
    beforeEach(() => {
      sb = new SessionScrollback({ maxBytesPerAgent: 1024 });
      sb.append('a1', 'AAAA');
      sb.append('a1', 'BBBB');
      sb.append('a1', 'CCCC');
    });

    it('returns full buffer for offset <= 0', () => {
      expect(sb.readFromOffset('a1', 0)).toBe('AAAABBBBCCCC');
      expect(sb.readFromOffset('a1', -10)).toBe('AAAABBBBCCCC');
    });

    it('returns empty for offset >= totalBytes', () => {
      expect(sb.readFromOffset('a1', 12)).toBe('');
      expect(sb.readFromOffset('a1', 9999)).toBe('');
    });

    it('starts mid-chunk', () => {
      expect(sb.readFromOffset('a1', 6)).toBe('BBCCCC');
    });

    it('starts on a chunk boundary', () => {
      expect(sb.readFromOffset('a1', 4)).toBe('BBBBCCCC');
      expect(sb.readFromOffset('a1', 8)).toBe('CCCC');
    });
  });

  describe('dropAgent / clear', () => {
    it('dropAgent removes one agent only', () => {
      sb.append('a1', 'one');
      sb.append('a2', 'two');
      sb.dropAgent('a1');
      expect(sb.has('a1')).toBe(false);
      expect(sb.readAll('a2')).toBe('two');
    });

    it('clear removes all agents', () => {
      sb.append('a1', 'one');
      sb.append('a2', 'two');
      sb.clear();
      expect(sb.has('a1')).toBe(false);
      expect(sb.has('a2')).toBe(false);
    });
  });

  describe('default config', () => {
    it('uses 2 MB default when no config given', () => {
      const big = new SessionScrollback();
      const oneMb = 'y'.repeat(1024 * 1024);
      big.append('a1', oneMb);
      expect(big.size('a1')).toBe(1024 * 1024);
    });
  });
});
