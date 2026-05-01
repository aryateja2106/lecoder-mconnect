/**
 * Unit tests for the loop orchestrator's `decideNext`.
 *
 * Covers the cases enumerated in the plan:
 *   - count not yet reached → continue with next iteration directive
 *   - count reached → stop with empty followup
 *   - infinite mode → continue forever (until safety cap)
 *   - paused → empty followup
 *   - missing spec (spec mode) → error followup
 *   - cursor reported non-completed status → empty followup
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildKickoffPrompt, decideNext } from '../loop/orchestrator.js';
import type { LoopState } from '../loop/state.js';

function makeState(overrides: Partial<LoopState> = {}): LoopState {
  return {
    id: 'loop_test',
    mode: 'spec',
    status: 'active',
    specPath: '/nonexistent/spec.md',
    outputDir: '/tmp/nonexistent-output',
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

describe('orchestrator.decideNext', () => {
  let tmpRoot: string;
  let specPath: string;
  let outputDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'lecoder-orch-'));
    specPath = join(tmpRoot, 'spec.md');
    outputDir = join(tmpRoot, 'out');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      specPath,
      [
        '# UI Spec',
        '',
        '## File Naming',
        '',
        '`ui_hybrid_[iteration_number].html`',
        '',
        'Body text here.',
      ].join('\n'),
      'utf-8'
    );
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('continues when target is not yet reached', () => {
    const state = makeState({
      specPath,
      outputDir,
      target: 5,
      completed: 0,
    });
    const decision = decideNext({ state });
    expect(decision.action).toBe('continue');
    if (decision.action !== 'continue') return;
    expect(decision.iterationNumber).toBe(1);
    expect(decision.followupMessage).toContain('iteration 1 of 5');
    expect(decision.followupMessage).toContain('ui_hybrid_1.html');
    // Foundation pass directive for iterations 1-3
    expect(decision.followupMessage).toContain('Foundation pass');
  });

  it('uses filesystem ground truth for next iteration number', () => {
    writeFileSync(join(outputDir, 'ui_hybrid_1.html'), '<html></html>');
    writeFileSync(join(outputDir, 'ui_hybrid_2.html'), '<html></html>');
    const state = makeState({ specPath, outputDir, target: 5, completed: 0 });
    const decision = decideNext({ state });
    expect(decision.action).toBe('continue');
    if (decision.action !== 'continue') return;
    expect(decision.iterationNumber).toBe(3);
    expect(decision.followupMessage).toContain('ui_hybrid_3.html');
  });

  it('stops when target is reached on disk (spec mode)', () => {
    for (let i = 1; i <= 3; i++) {
      writeFileSync(join(outputDir, `ui_hybrid_${i}.html`), '<html></html>');
    }
    const state = makeState({ specPath, outputDir, target: 3, completed: 2 });
    const decision = decideNext({ state });
    expect(decision.action).toBe('stop');
    expect(decision.followupMessage).toBe('');
    if (decision.action === 'stop') {
      expect(decision.reason).toContain('3');
    }
  });

  it('stops when completed counter hits target (task mode)', () => {
    const state = makeState({
      mode: 'task',
      specPath,
      outputDir,
      target: 4,
      completed: 4,
    });
    const decision = decideNext({ state });
    expect(decision.action).toBe('stop');
    expect(decision.followupMessage).toBe('');
  });

  it('continues forever in infinite mode', () => {
    writeFileSync(join(outputDir, 'ui_hybrid_99.html'), '<html></html>');
    const state = makeState({
      specPath,
      outputDir,
      target: 'infinite',
      completed: 99,
    });
    const decision = decideNext({ state });
    expect(decision.action).toBe('continue');
    if (decision.action !== 'continue') return;
    expect(decision.iterationNumber).toBe(100);
  });

  it('hits the safety cap in infinite mode at 1000 iterations', () => {
    // Simulate 1000 prior iterations on disk
    for (let i = 1; i <= 1000; i++) {
      writeFileSync(join(outputDir, `ui_hybrid_${i}.html`), '');
    }
    const state = makeState({
      specPath,
      outputDir,
      target: 'infinite',
      completed: 1000,
    });
    const decision = decideNext({ state });
    expect(decision.action).toBe('stop');
    if (decision.action === 'stop') {
      expect(decision.reason).toContain('1000');
    }
  });

  it('emits empty followup when paused', () => {
    const state = makeState({ specPath, outputDir, status: 'paused' });
    const decision = decideNext({ state });
    expect(decision.action).toBe('stop');
    expect(decision.followupMessage).toBe('');
  });

  it('emits empty followup when already done', () => {
    const state = makeState({ specPath, outputDir, status: 'done' });
    const decision = decideNext({ state });
    expect(decision.action).toBe('stop');
  });

  it('returns error decision when spec file is missing in spec mode', () => {
    const state = makeState({
      specPath: join(tmpRoot, 'does-not-exist.md'),
      outputDir,
      target: 3,
    });
    const decision = decideNext({ state });
    expect(decision.action).toBe('error');
    expect(decision.followupMessage).toContain('Spec file not found');
    if (decision.action === 'error') {
      expect(decision.reason).toContain('not found');
    }
  });

  it('treats Cursor non-completed status as a stop signal', () => {
    const state = makeState({ specPath, outputDir, target: 5 });
    const decision = decideNext({ state, cursorStatus: 'error' });
    expect(decision.action).toBe('stop');
    expect(decision.followupMessage).toBe('');
    if (decision.action === 'stop') {
      expect(decision.reason).toContain('error');
    }
  });

  it('progressively escalates sophistication directives by iteration band', () => {
    const bands = [
      { iteration: 1, contains: 'Foundation pass' },
      { iteration: 4, contains: 'Refinement pass' },
      { iteration: 8, contains: 'Innovation pass' },
      { iteration: 15, contains: 'Revolutionary pass' },
    ];

    for (const { iteration, contains } of bands) {
      // Seed outputDir with iteration-1 prior files so next iteration matches
      const localOutput = join(tmpRoot, `out-${iteration}`);
      mkdirSync(localOutput, { recursive: true });
      for (let i = 1; i < iteration; i++) {
        writeFileSync(join(localOutput, `ui_hybrid_${i}.html`), '');
      }
      const state = makeState({
        specPath,
        outputDir: localOutput,
        target: 'infinite',
        completed: iteration - 1,
      });
      const decision = decideNext({ state });
      expect(decision.action).toBe('continue');
      if (decision.action !== 'continue') continue;
      expect(decision.iterationNumber).toBe(iteration);
      expect(decision.followupMessage).toContain(contains);
    }
  });
});

describe('orchestrator.buildKickoffPrompt', () => {
  it('produces a spec-mode kickoff prompt', () => {
    const state: LoopState = {
      id: 'loop_kick',
      mode: 'spec',
      status: 'active',
      specPath: '/abs/spec.md',
      outputDir: '/abs/out',
      target: 5,
      completed: 0,
      lastIterationAt: null,
      createdAt: new Date().toISOString(),
      workDir: '/tmp',
      kickoffPrompt: '',
      historyTail: [],
      mconnect: null,
    };
    const prompt = buildKickoffPrompt(state);
    expect(prompt).toContain('[lecoder-loop] start');
    expect(prompt).toContain('mode=spec');
    expect(prompt).toContain('target=5');
    expect(prompt).toContain('/abs/spec.md');
  });

  it('produces a task-mode kickoff prompt with done sentinel hint', () => {
    const state: LoopState = {
      id: 'loop_kick_task',
      mode: 'task',
      status: 'active',
      specPath: '/abs/brief.md',
      outputDir: '/abs/repo',
      target: 'infinite',
      completed: 0,
      lastIterationAt: null,
      createdAt: new Date().toISOString(),
      workDir: '/tmp',
      kickoffPrompt: '',
      historyTail: [],
      mconnect: null,
    };
    const prompt = buildKickoffPrompt(state);
    expect(prompt).toContain('mode=task');
    expect(prompt).toContain('LECODER_LOOP_DONE');
    expect(prompt).toContain('target=infinite');
  });
});

describe('output-dir handling', () => {
  it('treats a missing output dir as having zero iterations', () => {
    const tmpRoot2 = mkdtempSync(join(tmpdir(), 'lecoder-no-out-'));
    const localSpec = join(tmpRoot2, 'spec.md');
    writeFileSync(localSpec, '# spec\n\n`ui_hybrid_[N].html`\n');

    const state: LoopState = {
      id: 'loop_no_out',
      mode: 'spec',
      status: 'active',
      specPath: localSpec,
      outputDir: join(tmpRoot2, 'never-created'),
      target: 3,
      completed: 0,
      lastIterationAt: null,
      createdAt: new Date().toISOString(),
      workDir: tmpRoot2,
      kickoffPrompt: '',
      historyTail: [],
      mconnect: null,
    };
    const decision = decideNext({ state });
    expect(decision.action).toBe('continue');
    if (decision.action === 'continue') {
      expect(decision.iterationNumber).toBe(1);
    }
    rmSync(tmpRoot2, { recursive: true, force: true });
    expect(existsSync(tmpRoot2)).toBe(false);
  });
});
