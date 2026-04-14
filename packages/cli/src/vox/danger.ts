/**
 * Vox Danger Detection
 * MConnect vox integration
 *
 * Identifies destructive shell patterns and non-shell output from the LLM.
 */

/**
 * Patterns that indicate a potentially destructive or privileged shell command.
 * Ported from /Users/aryateja/Projects/vox/src/vox/cli.py lines 38-54.
 */
export const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+.*-\w*[rf]\w*/i,
  /\brm\s+-\w*R/i,
  /\bsudo\b/i,
  /\bdd\b\s+if=/i,
  /\bmkfs\b/i,
  /\bshred\b/i,
  /\bwipefs\b/i,
  /\b:\(\)\s*\{/,
  /\bchmod\s+777\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /\bsystemctl\s+(stop|disable|mask)\b/i,
  /\bkillall\b/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
  /\bpoweroff\b/i,
];

/**
 * Patterns that indicate the LLM returned code, markup, or JSON rather than a shell command.
 * Ported from /Users/aryateja/Projects/vox/src/vox/cli.py lines 56-64.
 */
export const NON_SHELL_PATTERNS: RegExp[] = [
  /^\s*import\s+/,
  /^\s*from\s+\w+\s+import\b/,
  /^\s*def\s+\w+\(/,
  /^\s*class\s+\w+/,
  /^\s*<\?php/,
  /^\s*<html/i,
  /^\s*\{"/,
];

/**
 * Returns true if the command contains any dangerous pattern.
 */
export function isDangerous(cmd: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(cmd));
}

/**
 * Returns true if the first line of the string looks like a shell command
 * (i.e., does not match any non-shell pattern).
 */
export function looksLikeShell(cmd: string): boolean {
  const firstLine = cmd.split('\n')[0] ?? '';
  return !NON_SHELL_PATTERNS.some((pattern) => pattern.test(firstLine));
}
