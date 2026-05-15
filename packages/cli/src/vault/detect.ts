/**
 * MConnect Vault — placeholder detection
 *
 * Identifies `{{NAME}}` patterns in command strings that should be resolved
 * by an external secret broker (currently only `lockshell run`) before the
 * command reaches the agent's PTY.
 *
 * The pattern intentionally matches lockshell's own validator at
 * `crates/lockshell/src/commands/register.rs:34-44` — uppercase ASCII +
 * digits + underscore, must start with a letter or underscore. Lowercase
 * patterns are NOT matched because they collide with Mustache-style
 * templating that agents may emit for non-secret reasons.
 */

const PLACEHOLDER_RE = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;

export interface PlaceholderMatch {
  /** All distinct placeholder names found, in stable sorted order. */
  names: string[];
  /** Total number of `{{...}}` occurrences (duplicates count separately). */
  occurrenceCount: number;
}

export function detectPlaceholders(command: string): PlaceholderMatch {
  const seen = new Set<string>();
  let occurrenceCount = 0;
  // Use a fresh `lastIndex` each call so concurrent invocations are safe.
  const re = new RegExp(PLACEHOLDER_RE.source, PLACEHOLDER_RE.flags);
  for (const m of command.matchAll(re)) {
    seen.add(m[1]);
    occurrenceCount++;
  }
  return {
    names: Array.from(seen).sort(),
    occurrenceCount,
  };
}

export function hasPlaceholders(command: string): boolean {
  return detectPlaceholders(command).occurrenceCount > 0;
}
