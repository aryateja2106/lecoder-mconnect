/**
 * Unit tests for the loop spec parser.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  analyseSpec,
  extractFilenamePattern,
  formatIterationFilename,
  patternToRegex,
  resolveSpecPath,
} from '../loop/spec.js';

describe('extractFilenamePattern', () => {
  it('extracts a pattern from a `File Naming` heading', () => {
    const body = [
      '# Spec',
      '',
      '## File Naming',
      '',
      '`ui_hybrid_[iteration_number].html`',
      '',
      'Body.',
    ].join('\n');
    expect(extractFilenamePattern(body)).toBe('ui_hybrid_[iteration_number].html');
  });

  it('extracts a pattern from inline backticks', () => {
    const body = 'Use `iteration_[N].md` for filenames.';
    expect(extractFilenamePattern(body)).toBe('iteration_[N].md');
  });

  it('returns null when no pattern is present', () => {
    expect(extractFilenamePattern('No pattern here.')).toBeNull();
  });
});

describe('patternToRegex', () => {
  it('converts a pattern into a regex that captures the iteration number', () => {
    const re = patternToRegex('ui_hybrid_[iteration_number].html');
    expect(re.exec('ui_hybrid_7.html')?.[1]).toBe('7');
    expect(re.exec('ui_hybrid_42.html')?.[1]).toBe('42');
    expect(re.exec('ui_hybrid_NaN.html')).toBeNull();
    expect(re.exec('other.html')).toBeNull();
  });

  it('handles short [N] tokens', () => {
    const re = patternToRegex('iteration_[N].md');
    expect(re.exec('iteration_3.md')?.[1]).toBe('3');
  });
});

describe('formatIterationFilename', () => {
  it('substitutes the iteration number for the placeholder', () => {
    expect(formatIterationFilename('ui_hybrid_[iteration_number].html', 5)).toBe(
      'ui_hybrid_5.html'
    );
    expect(formatIterationFilename('iteration_[N].md', 12)).toBe('iteration_12.md');
  });
});

describe('resolveSpecPath', () => {
  it('returns absolute paths unchanged', () => {
    expect(resolveSpecPath('/abs/path/spec.md', '/work')).toBe('/abs/path/spec.md');
  });

  it('joins relative paths against workDir', () => {
    expect(resolveSpecPath('specs/foo.md', '/work')).toBe('/work/specs/foo.md');
  });
});

describe('analyseSpec', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'lecoder-spec-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('returns exists=false when the spec is missing', () => {
    const result = analyseSpec(join(tmpRoot, 'missing.md'), tmpRoot);
    expect(result.exists).toBe(false);
    expect(result.body).toBe('');
    expect(result.nextIterationNumber).toBe(1);
  });

  it('reads spec body and detects pattern', () => {
    const specPath = join(tmpRoot, 'spec.md');
    writeFileSync(specPath, '# Spec\n\n## File Naming\n\n`ui_hybrid_[N].html`\n');
    const out = join(tmpRoot, 'out');
    mkdirSync(out);
    const result = analyseSpec(specPath, out);
    expect(result.exists).toBe(true);
    expect(result.filenamePattern).toBe('ui_hybrid_[N].html');
    expect(result.nextIterationNumber).toBe(1);
    expect(result.existingFiles).toEqual([]);
  });

  it('discovers existing iterations and computes the next number', () => {
    const specPath = join(tmpRoot, 'spec.md');
    writeFileSync(specPath, '`ui_hybrid_[N].html`\n');
    const out = join(tmpRoot, 'out');
    mkdirSync(out);
    writeFileSync(join(out, 'ui_hybrid_1.html'), '');
    writeFileSync(join(out, 'ui_hybrid_3.html'), '');
    writeFileSync(join(out, 'ui_hybrid_2.html'), '');
    writeFileSync(join(out, 'unrelated.txt'), '');

    const result = analyseSpec(specPath, out);
    expect(result.existingIterations).toEqual([1, 2, 3]);
    expect(result.nextIterationNumber).toBe(4);
    // unrelated.txt is excluded
    expect(result.existingFiles).toHaveLength(3);
  });

  it('truncates very large spec bodies', () => {
    const specPath = join(tmpRoot, 'big.md');
    const big = 'x'.repeat(20 * 1024);
    writeFileSync(specPath, big);
    const out = join(tmpRoot, 'out');
    mkdirSync(out);
    const result = analyseSpec(specPath, out);
    expect(result.body.length).toBeLessThan(big.length);
    expect(result.body).toContain('truncated');
  });

  it('falls back to iteration_[N].md pattern when spec has none', () => {
    const specPath = join(tmpRoot, 'plain.md');
    writeFileSync(specPath, '# Just a heading\n\nNo file naming here.');
    const out = join(tmpRoot, 'out');
    mkdirSync(out);
    writeFileSync(join(out, 'iteration_1.md'), '');
    writeFileSync(join(out, 'iteration_2.md'), '');
    const result = analyseSpec(specPath, out);
    expect(result.filenamePattern).toBe('iteration_[N].md');
    expect(result.nextIterationNumber).toBe(3);
  });
});
