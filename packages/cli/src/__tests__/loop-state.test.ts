/**
 * Unit tests for loop state management.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  appendHistory,
  archiveActiveLoop,
  generateLoopId,
  getLoopPaths,
  type LoopState,
  listArchivedLoops,
  readActiveLoop,
  updateActiveLoop,
  writeActiveLoop,
  writePromptSnapshot,
} from '../loop/state.js';

function makeState(overrides: Partial<LoopState> = {}): LoopState {
  return {
    id: 'loop_st',
    mode: 'spec',
    status: 'active',
    specPath: '/tmp/spec.md',
    outputDir: '/tmp/out',
    target: 5,
    completed: 0,
    lastIterationAt: null,
    createdAt: new Date().toISOString(),
    workDir: '/tmp',
    kickoffPrompt: '',
    historyTail: [],
    mconnect: null,
    lastError: null,
    ...overrides,
  };
}

describe('state', () => {
  let tmpRoot: string;
  let original: string | undefined;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'lecoder-state-'));
    original = process.env.LECODER_LOOP_DIR;
    process.env.LECODER_LOOP_DIR = tmpRoot;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.LECODER_LOOP_DIR;
    else process.env.LECODER_LOOP_DIR = original;
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('generateLoopId returns a unique-looking id with the loop_ prefix', () => {
    const a = generateLoopId();
    const b = generateLoopId();
    expect(a.startsWith('loop_')).toBe(true);
    expect(b.startsWith('loop_')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('readActiveLoop returns null when the file is absent', () => {
    expect(readActiveLoop()).toBeNull();
  });

  it('writeActiveLoop + readActiveLoop round-trips a state object', () => {
    const state = makeState({ id: 'loop_a', completed: 2 });
    writeActiveLoop(state);
    const read = readActiveLoop();
    expect(read).toEqual(state);
  });

  it('readActiveLoop returns null for a corrupt active.json', () => {
    const { activeFile } = getLoopPaths();
    require('node:fs').mkdirSync(tmpRoot, { recursive: true });
    require('node:fs').writeFileSync(activeFile, 'not json', 'utf-8');
    expect(readActiveLoop()).toBeNull();
  });

  it('updateActiveLoop applies the mutator and persists', () => {
    writeActiveLoop(makeState({ completed: 0 }));
    const updated = updateActiveLoop((s) => ({ ...s, completed: s.completed + 1 }));
    expect(updated?.completed).toBe(1);
    expect(readActiveLoop()?.completed).toBe(1);
  });

  it('updateActiveLoop returns null when there is no active loop', () => {
    expect(updateActiveLoop((s) => s)).toBeNull();
  });

  it('archiveActiveLoop moves state into history with the given final status', () => {
    writeActiveLoop(makeState({ id: 'loop_to_archive' }));
    const archived = archiveActiveLoop('done');
    expect(archived?.status).toBe('done');
    const { activeFile, historyDir } = getLoopPaths();
    expect(existsSync(activeFile)).toBe(false);
    const historyFile = join(historyDir, 'loop_to_archive.json');
    expect(existsSync(historyFile)).toBe(true);
    const fromDisk = JSON.parse(readFileSync(historyFile, 'utf-8'));
    expect(fromDisk.status).toBe('done');
  });

  it('listArchivedLoops returns archived loops most-recent first', () => {
    writeActiveLoop(makeState({ id: 'loop_a', createdAt: '2026-01-01T00:00:00Z' }));
    archiveActiveLoop('done');
    writeActiveLoop(makeState({ id: 'loop_b', createdAt: '2026-02-01T00:00:00Z' }));
    archiveActiveLoop('done');
    const list = listArchivedLoops();
    expect(list.map((l) => l.id)).toEqual(['loop_b', 'loop_a']);
  });

  it('appendHistory caps tail at 5 entries', () => {
    let state = makeState();
    for (let i = 0; i < 10; i++) {
      state = appendHistory(state, `entry_${i}`);
    }
    expect(state.historyTail).toHaveLength(5);
    expect(state.historyTail[0]).toBe('entry_5');
    expect(state.historyTail[4]).toBe('entry_9');
  });

  it('writePromptSnapshot writes a readable prompt file', () => {
    writePromptSnapshot({
      iteration: 3,
      body: 'do thing',
      updatedAt: '2026-05-01T12:00:00Z',
    });
    const { promptFile } = getLoopPaths();
    expect(existsSync(promptFile)).toBe(true);
    const body = readFileSync(promptFile, 'utf-8');
    expect(body).toContain('iteration 3');
    expect(body).toContain('do thing');
  });
});
