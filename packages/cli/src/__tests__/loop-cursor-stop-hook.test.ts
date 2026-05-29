/**
 * Unit tests for the Cursor stop hook entrypoint.
 *
 * The hook is invoked as a separate process by Cursor and must:
 *   - read JSON from stdin (or empty if absent)
 *   - emit exactly one JSON object to stdout containing `followup_message`
 *   - never throw out of `runCursorStopHook` and never write to stderr
 *   - persist iteration progress to ~/.lecoder/loops/active.json
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CursorStopInput, handleStop, parseStopInput } from '../loop/cursor-stop-hook.js';
import { type LoopState, writeActiveLoop } from '../loop/state.js';

function makeActiveLoop(
  specPath: string,
  outputDir: string,
  overrides: Partial<LoopState> = {}
): LoopState {
  return {
    id: 'loop_stoptest',
    mode: 'spec',
    status: 'active',
    specPath,
    outputDir,
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

describe('cursor-stop-hook.parseStopInput', () => {
  it('parses a valid Cursor stop payload', () => {
    const raw = JSON.stringify({
      conversation_id: 'abc',
      status: 'completed',
      loop_count: 3,
    });
    const parsed = parseStopInput(raw);
    expect(parsed.conversation_id).toBe('abc');
    expect(parsed.status).toBe('completed');
    expect(parsed.loop_count).toBe(3);
  });

  it('returns empty object on empty stdin', () => {
    expect(parseStopInput('')).toEqual({});
    expect(parseStopInput('   ')).toEqual({});
  });

  it('returns empty object on malformed JSON', () => {
    expect(parseStopInput('not json')).toEqual({});
    expect(parseStopInput('{"unterminated')).toEqual({});
  });

  it('returns empty object when JSON is not an object', () => {
    expect(parseStopInput('null')).toEqual({});
    expect(parseStopInput('"a string"')).toEqual({});
    expect(parseStopInput('42')).toEqual({});
  });
});

describe('cursor-stop-hook.handleStop', () => {
  let tmpRoot: string;
  let loopDir: string;
  let specPath: string;
  let outputDir: string;
  let originalLoopDir: string | undefined;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'lecoder-stop-'));
    loopDir = join(tmpRoot, 'loops');
    mkdirSync(loopDir, { recursive: true });
    specPath = join(tmpRoot, 'spec.md');
    outputDir = join(tmpRoot, 'out');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(specPath, '# UI\n\n`ui_hybrid_[N].html`\n');

    originalLoopDir = process.env.LECODER_LOOP_DIR;
    process.env.LECODER_LOOP_DIR = loopDir;
  });

  afterEach(() => {
    if (originalLoopDir === undefined) {
      delete process.env.LECODER_LOOP_DIR;
    } else {
      process.env.LECODER_LOOP_DIR = originalLoopDir;
    }
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('emits empty followup when there is no active loop', async () => {
    const out = await handleStop({});
    expect(out).toEqual({ followup_message: '' });
  });

  it('emits a continuation followup on the first turn of a fresh spec loop', async () => {
    writeActiveLoop(makeActiveLoop(specPath, outputDir, { target: 3 }));
    const out = await handleStop({ conversation_id: 'c', status: 'completed', loop_count: 1 });
    expect(out.followup_message).not.toBe('');
    expect(out.followup_message).toContain('iteration 1 of 3');
    expect(out.followup_message).toContain('ui_hybrid_1.html');

    // State file should have been advanced.
    const stateRaw = readFileSync(join(loopDir, 'active.json'), 'utf-8');
    const state = JSON.parse(stateRaw) as LoopState;
    expect(state.completed).toBe(1);
    expect(state.lastIterationAt).toBeTruthy();
    expect(state.historyTail).toEqual(['iteration_0_completed']);
  });

  it('archives the loop and emits empty followup once the target is reached', async () => {
    writeActiveLoop(makeActiveLoop(specPath, outputDir, { target: 2 }));
    // Simulate the agent producing both files
    writeFileSync(join(outputDir, 'ui_hybrid_1.html'), '<html></html>');
    writeFileSync(join(outputDir, 'ui_hybrid_2.html'), '<html></html>');

    const out = await handleStop({ status: 'completed' });
    expect(out).toEqual({ followup_message: '' });

    // active.json should be gone, history file should exist
    expect(existsSync(join(loopDir, 'active.json'))).toBe(false);
    expect(existsSync(join(loopDir, 'history'))).toBe(true);
    const histFiles = readFileSync;
    const archivedPath = join(loopDir, 'history', 'loop_stoptest.json');
    expect(existsSync(archivedPath)).toBe(true);
    const archived = JSON.parse(histFiles(archivedPath, 'utf-8')) as LoopState;
    expect(archived.status).toBe('done');
    void archived;
  });

  it('respects status=paused (no continuation, no state change)', async () => {
    writeActiveLoop(makeActiveLoop(specPath, outputDir, { status: 'paused' }));
    const out = await handleStop({ status: 'completed' });
    expect(out).toEqual({ followup_message: '' });

    // Active loop file should still exist (not archived) and unchanged
    const stateRaw = readFileSync(join(loopDir, 'active.json'), 'utf-8');
    const state = JSON.parse(stateRaw) as LoopState;
    expect(state.status).toBe('paused');
    expect(state.completed).toBe(0);
  });

  it('archives with status=error when spec file is missing', async () => {
    writeActiveLoop(makeActiveLoop(join(tmpRoot, 'missing.md'), outputDir, { target: 3 }));
    const out = await handleStop({ status: 'completed' });
    // Error decisions still emit a non-empty followup so the agent sees the problem,
    // but the loop is archived so we don't keep firing.
    expect(out.followup_message).toContain('Spec file not found');
    expect(existsSync(join(loopDir, 'active.json'))).toBe(false);
    const archivedPath = join(loopDir, 'history', 'loop_stoptest.json');
    expect(existsSync(archivedPath)).toBe(true);
    const archived = JSON.parse(readFileSync(archivedPath, 'utf-8')) as LoopState;
    expect(archived.status).toBe('error');
    expect(archived.lastError).toContain('Spec file not found');
  });

  it('emits empty followup when Cursor reports a non-completed status', async () => {
    writeActiveLoop(makeActiveLoop(specPath, outputDir, { target: 3 }));
    const out = await handleStop({ status: 'cancelled' });
    expect(out).toEqual({ followup_message: '' });
  });

  it('writes a prompt snapshot to disk on continuation', async () => {
    writeActiveLoop(makeActiveLoop(specPath, outputDir, { target: 3 }));
    await handleStop({ status: 'completed' });
    const promptPath = join(loopDir, 'prompt.txt');
    expect(existsSync(promptPath)).toBe(true);
    const body = readFileSync(promptPath, 'utf-8');
    expect(body).toContain('iteration 1');
  });

  it('handles task mode counter advancement', async () => {
    writeActiveLoop(
      makeActiveLoop(specPath, outputDir, {
        mode: 'task',
        target: 2,
        completed: 0,
      })
    );

    const first = await handleStop({ status: 'completed' });
    expect(first.followup_message).toContain('turn 1 of 2');
    let stateRaw = readFileSync(join(loopDir, 'active.json'), 'utf-8');
    let state = JSON.parse(stateRaw) as LoopState;
    expect(state.completed).toBe(1);

    const second = await handleStop({ status: 'completed' });
    // Task mode: completed=1 → turn 2, after handling completed becomes 2.
    expect(second.followup_message).toContain('turn 2 of 2');
    stateRaw = existsSync(join(loopDir, 'active.json'))
      ? readFileSync(join(loopDir, 'active.json'), 'utf-8')
      : '';
    if (stateRaw) {
      state = JSON.parse(stateRaw);
      expect(state.completed).toBe(2);
    }

    const third = await handleStop({ status: 'completed' });
    expect(third).toEqual({ followup_message: '' });
    expect(existsSync(join(loopDir, 'active.json'))).toBe(false);
  });
});

describe('cursor-stop-hook stdin/stdout contract', () => {
  it('always returns an object with a string `followup_message`', async () => {
    const tmpRoot2 = mkdtempSync(join(tmpdir(), 'lecoder-shape-'));
    const original = process.env.LECODER_LOOP_DIR;
    process.env.LECODER_LOOP_DIR = join(tmpRoot2, 'loops');
    try {
      const inputs: CursorStopInput[] = [
        {},
        { status: 'completed' },
        { status: 'completed', loop_count: 0 },
        { conversation_id: 'x' },
      ];
      for (const input of inputs) {
        const out = await handleStop(input);
        expect(typeof out.followup_message).toBe('string');
        expect(Object.keys(out)).toEqual(['followup_message']);
      }
    } finally {
      if (original === undefined) delete process.env.LECODER_LOOP_DIR;
      else process.env.LECODER_LOOP_DIR = original;
      rmSync(tmpRoot2, { recursive: true, force: true });
    }
  });
});
