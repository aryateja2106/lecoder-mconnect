/**
 * MConnect Vault — binary discovery
 *
 * Locate the `lockshell` binary on the system and capture metadata
 * needed for safe invocation. Resolves once at startup and pins the
 * absolute path so a later `$PATH` mutation by an agent cannot
 * redirect us to a malicious binary.
 *
 * We do not use `which` directly — it shells out, which means a path
 * hijack on `which` itself would defeat the lookup. Instead we walk
 * `$PATH` ourselves with `node:fs.statSync`.
 */

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export interface VaultDiscovery {
  /** Absolute path to lockshell, or `null` if not found / not executable. */
  binary: string | null;
  /** Reported version (e.g. "0.1.4") if the binary exists. */
  version: string | null;
  /** Reason discovery failed, if applicable. */
  failure?: 'not_in_path' | 'not_executable' | 'version_unreadable';
}

/** Minimum lockshell version compatible with the wrap protocol. */
export const MIN_LOCKSHELL_VERSION = '0.1.4';

export function discoverLockshell(): VaultDiscovery {
  const path = process.env.PATH ?? '';
  const dirs = path.split(':').filter(Boolean);

  // Prepend a small set of known-safe directories so a malicious user
  // PATH cannot push their fake binary ahead of the real one.
  const trustedFirst = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'];
  const candidateDirs = [...trustedFirst, ...dirs];

  for (const dir of candidateDirs) {
    const candidate = join(dir, 'lockshell');
    if (!existsSync(candidate)) continue;
    try {
      const st = statSync(candidate);
      if (!st.isFile()) continue;
      // Owner-executable check. We could also assert NOT writable by
      // `other`, but that runs into platform quirks; accept any
      // executable file as discovered for now.
      // eslint-disable-next-line no-bitwise
      if ((st.mode & 0o111) === 0) {
        return { binary: null, version: null, failure: 'not_executable' };
      }
      const version = readVersion(candidate);
      if (version === null) {
        return { binary: candidate, version: null, failure: 'version_unreadable' };
      }
      return { binary: candidate, version };
    } catch {
      // stat failed (race? permission denied?) — try next
      continue;
    }
  }
  return { binary: null, version: null, failure: 'not_in_path' };
}

function readVersion(binary: string): string | null {
  try {
    const out = execFileSync(binary, ['--version'], {
      timeout: 2000,
      encoding: 'utf8',
    });
    // Output looks like: `lockshell 0.1.4 (...)` — grab the bare version.
    const m = out.match(/\b(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\b/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Compare semver-ish version strings. `a >= b` returns true.
 * Handles the simple `MAJOR.MINOR.PATCH` shape lockshell currently emits;
 * pre-release suffixes are ignored for the purposes of compatibility.
 */
export function versionAtLeast(a: string, b: string): boolean {
  const parse = (s: string) =>
    s.split(/[-+]/, 1)[0].split('.').map((p) => Number.parseInt(p, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const ai = av[i] ?? 0;
    const bi = bv[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return true;
}
