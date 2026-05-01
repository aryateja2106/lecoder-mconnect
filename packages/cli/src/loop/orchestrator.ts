/**
 * Loop Orchestrator
 *
 * Pure decision logic: given the current loop state (and optional
 * spec analysis), decide whether the Cursor agent should continue
 * with another iteration and craft the followup_message that drives it.
 *
 * Modeled on Disler's infinite-agentic-loop wave strategy, adapted for
 * Cursor's per-turn `stop` hook (which can only emit one continuation
 * message per turn — no parallel sub-agents). Wave-style "progressive
 * sophistication" is encoded as iteration-band directives in the
 * followup prompt so each iteration explores increasingly bold ideas.
 */

import {
  analyseSpec,
  formatIterationFilename,
  resolveSpecPath,
  type SpecAnalysis,
} from './spec.js';
import type { LoopState } from './state.js';

/**
 * Decision returned to the stop hook.
 */
export type LoopDecision =
  | {
      action: 'continue';
      followupMessage: string;
      iterationNumber: number;
      analysis: SpecAnalysis;
    }
  | {
      action: 'stop';
      reason: string;
      followupMessage: '';
    }
  | {
      action: 'error';
      reason: string;
      /** Brief operator-facing followup explaining the error. */
      followupMessage: string;
    };

/**
 * Inputs the orchestrator needs to make a decision.
 */
export interface OrchestratorInput {
  state: LoopState;
  /** Status reported by Cursor's stop hook payload, if any. */
  cursorStatus?: string;
  /** Cursor's loop_count from the stop hook payload (for logging only). */
  cursorLoopCount?: number;
}

/**
 * Iteration band → progressive sophistication directive.
 *
 * Adapted from Disler's wave-based "progressive sophistication" strategy:
 *   wave 1 → basic functional replacements
 *   wave 2 → multi-dimensional innovations
 *   wave 3 → complex paradigm combinations
 *   wave N → revolutionary concepts
 */
function sophisticationDirective(iteration: number): string {
  if (iteration <= 3) {
    return 'Foundation pass: establish a clear, single-dimension innovation. Keep it grounded and spec-compliant.';
  }
  if (iteration <= 6) {
    return 'Refinement pass: combine 2 innovation dimensions. Add a secondary interaction or visual layer.';
  }
  if (iteration <= 12) {
    return 'Innovation pass: combine 3+ innovation dimensions and explore an interaction paradigm not used in earlier iterations.';
  }
  return 'Revolutionary pass: push the spec boundaries. Combine paradigms, invent novel UI metaphors, and prioritise distinct creative direction over conformity.';
}

/**
 * Build the followup_message body for a continuation decision.
 *
 * The agent already has the rules file loaded (.cursor/rules/lecoder-loop.mdc),
 * so this prompt is intentionally short — it delegates spec/output details
 * to the persistent state file the rules tell the agent to read.
 */
export function buildContinuationPrompt(
  state: LoopState,
  analysis: SpecAnalysis,
  iterationNumber: number
): string {
  const expectedFilename = formatIterationFilename(
    analysis.filenamePattern || 'iteration_[N].md',
    iterationNumber
  );
  const sophistication = sophisticationDirective(iterationNumber);

  const targetText = state.target === 'infinite' ? 'infinite' : `${state.target}`;
  const recentTail = analysis.existingFiles.slice(-5);
  const recentSummary =
    recentTail.length === 0 ? '(none yet)' : recentTail.map((f) => `  - ${f}`).join('\n');

  if (state.mode === 'task') {
    return [
      '[lecoder-loop] continue',
      '',
      `Loop ${state.id} — turn ${iterationNumber} of ${targetText}.`,
      `Task brief: ${state.specPath}`,
      `Working dir: ${state.outputDir}`,
      '',
      'Resume the task brief. If the work is fully complete, write a single line `LECODER_LOOP_DONE` and stop.',
      'Otherwise, make the next concrete piece of progress, commit any code changes, and end your turn.',
      '',
      sophistication,
    ].join('\n');
  }

  return [
    '[lecoder-loop] continue',
    '',
    `Loop ${state.id} — iteration ${iterationNumber} of ${targetText}.`,
    `Spec: ${state.specPath}`,
    `Output dir: ${state.outputDir}`,
    `Expected filename: ${expectedFilename}`,
    '',
    'Existing iterations (last 5):',
    recentSummary,
    '',
    'Protocol:',
    '  1. Read the spec at the path above.',
    '  2. Glance at existing iterations to ensure your output is unique.',
    `  3. Generate iteration ${iterationNumber} as a single new file at ${state.outputDir}/${expectedFilename}.`,
    '  4. Do not modify any other iteration file.',
    '  5. End your turn after writing the file. The next iteration will be triggered automatically.',
    '',
    `Creative direction: ${sophistication}`,
  ].join('\n');
}

/**
 * Decide whether the Cursor agent should run another iteration.
 *
 * This is pure: no I/O beyond what `analyseSpec` does on the spec/output dir.
 */
export function decideNext(input: OrchestratorInput): LoopDecision {
  const { state } = input;

  if (state.status === 'paused') {
    return {
      action: 'stop',
      reason: 'Loop is paused.',
      followupMessage: '',
    };
  }

  if (state.status === 'done') {
    return {
      action: 'stop',
      reason: 'Loop already marked done.',
      followupMessage: '',
    };
  }

  if (state.status === 'error') {
    return {
      action: 'stop',
      reason: state.lastError || 'Loop is in error state.',
      followupMessage: '',
    };
  }

  if (input.cursorStatus && input.cursorStatus !== 'completed') {
    return {
      action: 'stop',
      reason: `Cursor reported status="${input.cursorStatus}"; pausing loop.`,
      followupMessage: '',
    };
  }

  const resolvedSpec = resolveSpecPath(state.specPath, state.workDir);
  const analysis = analyseSpec(resolvedSpec, state.outputDir);

  if (state.mode === 'spec' && !analysis.exists) {
    return {
      action: 'error',
      reason: `Spec file not found: ${resolvedSpec}`,
      followupMessage: [
        '[lecoder-loop] error',
        '',
        `Spec file not found: ${resolvedSpec}`,
        'Run `mconnect loop stop` from the host terminal, fix the spec path, then restart.',
        'Stopping for this turn.',
      ].join('\n'),
    };
  }

  // Filesystem-grounded completion check for spec mode: if we already
  // have at least `target` matching files in outputDir, the loop is done
  // regardless of what `state.completed` says. This is robust against the
  // agent skipping or duplicating iteration numbers.
  if (
    state.mode === 'spec' &&
    state.target !== 'infinite' &&
    analysis.existingIterations.length >= state.target
  ) {
    return {
      action: 'stop',
      reason: `Reached target of ${state.target} iterations (${analysis.existingIterations.length} on disk).`,
      followupMessage: '',
    };
  }

  // Counter-based completion check for task mode (no per-iteration files).
  if (state.mode === 'task' && state.target !== 'infinite' && state.completed >= state.target) {
    return {
      action: 'stop',
      reason: `Reached target of ${state.target} turns.`,
      followupMessage: '',
    };
  }

  // For spec mode, derive iteration number from disk so we are robust
  // against the agent skipping or duplicating numbers. Track `completed`
  // alongside for telemetry but trust the filesystem as ground truth.
  const iterationNumber =
    state.mode === 'spec' ? analysis.nextIterationNumber : state.completed + 1;

  // Defensive infinite-mode bound to avoid runaway costs.
  if (state.target === 'infinite' && iterationNumber > 1000) {
    return {
      action: 'stop',
      reason: 'Hard safety cap of 1000 iterations reached for infinite mode.',
      followupMessage: '',
    };
  }

  const followupMessage = buildContinuationPrompt(state, analysis, iterationNumber);

  return {
    action: 'continue',
    followupMessage,
    iterationNumber,
    analysis,
  };
}

/**
 * Build the kickoff prompt the user pastes into Cursor to start the loop.
 *
 * This is similar in spirit to Disler's slash-command argument parsing —
 * it tells the agent its job and where to read further state from.
 */
export function buildKickoffPrompt(state: LoopState): string {
  const targetText = state.target === 'infinite' ? 'infinite' : `${state.target}`;
  if (state.mode === 'task') {
    return [
      '[lecoder-loop] start',
      '',
      `Loop ${state.id} (mode=task, target=${targetText}).`,
      `Task brief: ${state.specPath}`,
      `Working dir: ${state.outputDir}`,
      '',
      'Read the task brief and start making progress. End your turn after each meaningful chunk of work.',
      'A `stop` hook will automatically continue the loop until the brief is complete or the target is hit.',
      'Write `LECODER_LOOP_DONE` on its own line when the task is fully complete to terminate the loop early.',
    ].join('\n');
  }

  return [
    '[lecoder-loop] start',
    '',
    `Loop ${state.id} (mode=spec, target=${targetText}).`,
    `Spec: ${state.specPath}`,
    `Output dir: ${state.outputDir}`,
    '',
    'Phase 1 — read and deeply understand the spec.',
    'Phase 2 — list existing iterations in the output dir; pick the next iteration number.',
    'Phase 3 — generate a single new iteration file following the spec.',
    'Phase 4 — end your turn. The next iteration will be triggered automatically by the stop hook.',
    '',
    'Each successive turn will receive a directive to push creative sophistication further.',
  ].join('\n');
}
