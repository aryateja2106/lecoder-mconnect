/**
 * Spec File Reader
 *
 * Reads a Disler-style markdown specification file and inspects the
 * output directory to determine the next iteration number.
 *
 * The spec file may declare a file naming pattern (e.g. `ui_hybrid_[N].html`)
 * inline; we match it heuristically. Falls back to a generic
 * `iteration_<N>.md` pattern when none is found.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Result of analysing a spec + output directory.
 */
export interface SpecAnalysis {
  /** Whether the spec file was readable. */
  exists: boolean;
  /** Raw spec contents (truncated to 16KB to keep prompts small). */
  body: string;
  /** Detected file naming pattern, e.g. "ui_hybrid_[iteration_number].html". */
  filenamePattern: string | null;
  /** Regex extracted from filenamePattern that captures the iteration number. */
  filenameRegex: RegExp;
  /** Existing iteration numbers found in outputDir, sorted ascending. */
  existingIterations: number[];
  /** Existing iteration filenames (full names, not paths). */
  existingFiles: string[];
  /** Next iteration number to generate (max(existing) + 1, or 1). */
  nextIterationNumber: number;
}

const MAX_SPEC_BYTES = 16 * 1024;
const FALLBACK_PATTERN = 'iteration_[N].md';

/**
 * Heuristic for finding the iteration filename pattern in a spec.
 *
 * Looks for back-tick or fenced examples like:
 *   `ui_hybrid_[iteration_number].html`
 *   `iteration_[N].md`
 * and any "File Naming" header followed by a back-tick example.
 */
export function extractFilenamePattern(body: string): string | null {
  const fileNamingHeader = /file\s*naming[^\n]*\n[^`]*`([^`]+)`/i;
  const headerMatch = body.match(fileNamingHeader);
  if (headerMatch?.[1].includes('[')) {
    return headerMatch[1].trim();
  }

  const inline = body.match(/`([a-z0-9._-]+_\[[a-z_]*(?:n|number)\][a-z0-9._-]*)`/i);
  if (inline) return inline[1].trim();

  return null;
}

/**
 * Convert a filename pattern like "ui_hybrid_[iteration_number].html"
 * into a regex that captures the iteration number as group 1.
 */
export function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, (match) =>
    match === '[' || match === ']' ? match : `\\${match}`
  );
  const withCapture = escaped.replace(/\[[a-z_]*(?:n|number)\]/i, '(\\d+)');
  return new RegExp(`^${withCapture}$`, 'i');
}

/**
 * Analyse a spec + output directory.
 *
 * Returns a SpecAnalysis even when the spec or directory is missing —
 * the stop hook needs a structurally valid response in every case.
 */
export function analyseSpec(specPath: string, outputDir: string): SpecAnalysis {
  let body = '';
  let exists = false;
  try {
    if (existsSync(specPath) && statSync(specPath).isFile()) {
      const raw = readFileSync(specPath, 'utf-8');
      body = raw.length > MAX_SPEC_BYTES ? `${raw.slice(0, MAX_SPEC_BYTES)}\n…[truncated]` : raw;
      exists = true;
    }
  } catch {
    // leave body empty
  }

  const filenamePattern = extractFilenamePattern(body) || FALLBACK_PATTERN;
  const filenameRegex = patternToRegex(filenamePattern);

  const existingFiles: string[] = [];
  const existingIterations: number[] = [];
  try {
    if (existsSync(outputDir) && statSync(outputDir).isDirectory()) {
      for (const entry of readdirSync(outputDir)) {
        const m = entry.match(filenameRegex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!Number.isNaN(num)) {
            existingIterations.push(num);
            existingFiles.push(entry);
          }
        }
      }
    }
  } catch {
    // unreadable output dir — treat as empty
  }
  existingIterations.sort((a, b) => a - b);
  existingFiles.sort();

  const nextIterationNumber =
    existingIterations.length > 0 ? existingIterations[existingIterations.length - 1] + 1 : 1;

  return {
    exists,
    body,
    filenamePattern,
    filenameRegex,
    existingIterations,
    existingFiles,
    nextIterationNumber,
  };
}

/**
 * Format the expected filename for an iteration number, given a pattern.
 */
export function formatIterationFilename(pattern: string, iteration: number): string {
  return pattern.replace(/\[[a-z_]*(?:n|number)\]/i, String(iteration));
}

/**
 * Resolve a spec path against a working dir, allowing both absolute
 * paths and paths relative to the loop's workDir.
 */
export function resolveSpecPath(specPath: string, workDir: string): string {
  if (specPath.startsWith('/')) return specPath;
  return join(workDir, specPath);
}
