#!/usr/bin/env node
/**
 * Postinstall script for MConnect
 *
 * Fixes spawn-helper permissions on macOS/Linux.
 * This is needed because npm sometimes strips execute permissions
 * from prebuilt binaries when installing globally.
 */

import { execSync } from 'node:child_process';
import { existsSync, chmodSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Find and fix spawn-helper permissions
 */
function fixSpawnHelperPermissions() {
  // Only needed on Unix-like systems
  if (process.platform === 'win32') {
    return;
  }

  const possiblePaths = [
    // When installed as dependency
    join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds'),
    // When installed globally
    join(__dirname, '..', '..', 'node-pty', 'prebuilds'),
    // Alternative global path
    join(__dirname, '..', '..', '..', 'node-pty', 'prebuilds'),
  ];

  let fixed = false;

  for (const prebuildsPath of possiblePaths) {
    if (existsSync(prebuildsPath)) {
      fixed = fixPermissionsInDir(prebuildsPath) || fixed;
    }
  }

  // Also try using find command as fallback
  if (!fixed) {
    try {
      // Find spawn-helper in any node_modules
      const result = execSync(
        'find . -path "*/node-pty/prebuilds/*/spawn-helper" -type f 2>/dev/null || true',
        { encoding: 'utf8', cwd: join(__dirname, '..') }
      ).trim();

      if (result) {
        for (const file of result.split('\n').filter(Boolean)) {
          const fullPath = join(__dirname, '..', file);
          if (existsSync(fullPath)) {
            try {
              chmodSync(fullPath, 0o755);
              console.log(`[postinstall] Fixed permissions: ${file}`);
              fixed = true;
            } catch (e) {
              // Ignore permission errors
            }
          }
        }
      }
    } catch (e) {
      // find command failed, ignore
    }
  }

  if (fixed) {
    console.log('[postinstall] spawn-helper permissions fixed successfully');
  }
}

/**
 * Recursively fix permissions for spawn-helper files
 */
function fixPermissionsInDir(dir) {
  let fixed = false;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        fixed = fixPermissionsInDir(fullPath) || fixed;
      } else if (entry.name === 'spawn-helper') {
        try {
          const stats = statSync(fullPath);
          // Check if execute bit is missing
          if ((stats.mode & 0o111) === 0) {
            chmodSync(fullPath, 0o755);
            console.log(`[postinstall] Fixed permissions: ${fullPath}`);
            fixed = true;
          }
        } catch (e) {
          // Ignore permission errors
        }
      }
    }
  } catch (e) {
    // Ignore read errors
  }

  return fixed;
}

// Run the fix
fixSpawnHelperPermissions();
