/**
 * Unit tests for the agent session store.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type AgentSessionRecord,
  appendTranscript,
  findSessionByTag,
  generateSessionId,
  getAgentPaths,
  listSessions,
  readSession,
  removeSession,
  updateSession,
  writeSession,
} from '../agent-cli/session-store.js';

function makeRecord(id: string, overrides: Partial<AgentSessionRecord> = {}): AgentSessionRecord {
  return {
    id,
    name: `Session ${id}`,
    cwd: '/tmp',
    worktreePath: null,
    worktreeBranch: null,
    repoRoot: null,
    executionMode: 'local',
    modelId: 'composer-2',
    modelParams: null,
    status: 'idle',
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    promptCount: 0,
    lastError: null,
    transcript: [],
    tags: [],
    ...overrides,
  };
}

describe('session-store', () => {
  let tmpRoot: string;
  let original: string | undefined;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'lecoder-sess-'));
    original = process.env.LECODER_AGENT_DIR;
    process.env.LECODER_AGENT_DIR = tmpRoot;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.LECODER_AGENT_DIR;
    else process.env.LECODER_AGENT_DIR = original;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('generateSessionId produces a sess_-prefixed unique id', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).toMatch(/^sess_[0-9a-f]{8}$/);
    expect(b).toMatch(/^sess_[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });

  it('writeSession + readSession round-trip', () => {
    const rec = makeRecord('sess_aaaa1111', { name: 'roundtrip' });
    writeSession(rec);
    const read = readSession(rec.id);
    expect(read).toEqual(rec);
  });

  it('readSession returns null for missing files', () => {
    expect(readSession('sess_missing')).toBeNull();
  });

  it('readSession returns null on corrupt JSON', () => {
    const { sessionsDir } = getAgentPaths();
    require('node:fs').mkdirSync(sessionsDir, { recursive: true });
    require('node:fs').writeFileSync(`${sessionsDir}/sess_corrupt.json`, 'not json', 'utf-8');
    expect(readSession('sess_corrupt')).toBeNull();
  });

  it('updateSession applies a mutator and persists', () => {
    writeSession(makeRecord('sess_upd', { promptCount: 0 }));
    const updated = updateSession('sess_upd', (s) => ({ ...s, promptCount: s.promptCount + 5 }));
    expect(updated?.promptCount).toBe(5);
    expect(readSession('sess_upd')?.promptCount).toBe(5);
  });

  it('updateSession returns null when session is missing', () => {
    expect(updateSession('sess_missing', (s) => s)).toBeNull();
  });

  it('appendTranscript caps tail at 200 entries', () => {
    let rec = makeRecord('sess_x');
    for (let i = 0; i < 250; i++) {
      rec = appendTranscript(rec, { role: 'system', text: `entry_${i}` });
    }
    expect(rec.transcript).toHaveLength(200);
    expect(rec.transcript[0].text).toBe('entry_50');
    expect(rec.transcript[199].text).toBe('entry_249');
  });

  it('listSessions returns most-recent first', () => {
    writeSession(makeRecord('sess_old', { lastActivityAt: '2026-01-01T00:00:00Z' }));
    writeSession(makeRecord('sess_new', { lastActivityAt: '2026-05-01T00:00:00Z' }));
    const list = listSessions();
    expect(list[0].id).toBe('sess_new');
    expect(list[1].id).toBe('sess_old');
  });

  it('listSessions filters by tag', () => {
    writeSession(makeRecord('sess_a', { tags: ['loop:loop_x'] }));
    writeSession(makeRecord('sess_b', { tags: ['other'] }));
    const filtered = listSessions({ tag: 'loop:loop_x' });
    expect(filtered.map((s) => s.id)).toEqual(['sess_a']);
  });

  it('listSessions prunes records older than the TTL', () => {
    const oldId = 'sess_oldttl';
    writeSession(makeRecord(oldId));
    const { sessionsDir } = getAgentPaths();
    const file = join(sessionsDir, `${oldId}.json`);
    // Backdate mtime by 60 days
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    require('node:fs').utimesSync(file, longAgo, longAgo);
    process.env.LECODER_AGENT_SESSION_TTL_DAYS = '30';
    try {
      const list = listSessions();
      expect(list.find((s) => s.id === oldId)).toBeUndefined();
      expect(existsSync(file)).toBe(false);
    } finally {
      delete process.env.LECODER_AGENT_SESSION_TTL_DAYS;
    }
  });

  it('findSessionByTag returns the most-recent matching session', () => {
    writeSession(
      makeRecord('sess_m1', { tags: ['loop:foo'], lastActivityAt: '2026-01-01T00:00:00Z' })
    );
    writeSession(
      makeRecord('sess_m2', { tags: ['loop:foo'], lastActivityAt: '2026-05-01T00:00:00Z' })
    );
    const found = findSessionByTag('loop:foo');
    expect(found?.id).toBe('sess_m2');
  });

  it('removeSession deletes the file', () => {
    writeSession(makeRecord('sess_rm'));
    expect(removeSession('sess_rm')).toBe(true);
    expect(readSession('sess_rm')).toBeNull();
  });

  it('removeSession returns false for missing files', () => {
    expect(removeSession('sess_nonexistent')).toBe(false);
  });
});
