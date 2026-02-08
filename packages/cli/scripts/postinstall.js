#!/usr/bin/env node
/**
 * Postinstall script for MConnect
 *
 * Ensures node-pty helper binaries are executable on macOS/Linux.
 * npm and npx can strip execute bits from native prebuilt helpers.
 */

import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function dedupePaths(paths) {
  return Array.from(new Set(paths.map((path) => resolve(path))));
}

function buildNodePtyCandidatePaths({
  runtimeDir = __dirname,
  cwd = process.cwd(),
  nodePtyPackageJsonPath,
  maxParentDepth = 6,
} = {}) {
  const prebuildPaths = [];
  const buildReleasePaths = [];

  if (nodePtyPackageJsonPath) {
    const nodePtyRoot = dirname(nodePtyPackageJsonPath);
    prebuildPaths.push(join(nodePtyRoot, 'prebuilds'));
    buildReleasePaths.push(join(nodePtyRoot, 'build', 'Release'));
  }

  // Explicit workspace-root candidate for npm workspaces.
  prebuildPaths.push(join(cwd, 'node_modules', 'node-pty', 'prebuilds'));
  buildReleasePaths.push(join(cwd, 'node_modules', 'node-pty', 'build', 'Release'));

  for (let depth = 0; depth <= maxParentDepth; depth++) {
    const parentSegments = depth === 0 ? [] : Array(depth).fill('..');
    const baseDir = resolve(runtimeDir, ...parentSegments);

    prebuildPaths.push(join(baseDir, 'node_modules', 'node-pty', 'prebuilds'));
    buildReleasePaths.push(join(baseDir, 'node_modules', 'node-pty', 'build', 'Release'));

    prebuildPaths.push(join(baseDir, 'node-pty', 'prebuilds'));
    buildReleasePaths.push(join(baseDir, 'node-pty', 'build', 'Release'));
  }

  return {
    prebuildPaths: dedupePaths(prebuildPaths),
    buildReleasePaths: dedupePaths(buildReleasePaths),
  };
}

function getNpxNodePtyCandidatePaths(homeDir) {
  if (!homeDir) {
    return { prebuildPaths: [], buildReleasePaths: [] };
  }

  const npxRoot = join(homeDir, '.npm', '_npx');
  if (!existsSync(npxRoot)) {
    return { prebuildPaths: [], buildReleasePaths: [] };
  }

  try {
    const entries = readdirSync(npxRoot, { withFileTypes: true });
    const prebuildPaths = [];
    const buildReleasePaths = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const cacheDir = join(npxRoot, entry.name, 'node_modules', 'node-pty');
      prebuildPaths.push(join(cacheDir, 'prebuilds'));
      buildReleasePaths.push(join(cacheDir, 'build', 'Release'));
    }

    return {
      prebuildPaths: dedupePaths(prebuildPaths),
      buildReleasePaths: dedupePaths(buildReleasePaths),
    };
  } catch {
    return { prebuildPaths: [], buildReleasePaths: [] };
  }
}

function createEmptySummary() {
  return {
    checkedDirs: 0,
    matchedFiles: 0,
    changedFiles: 0,
  };
}

function fixPermissionsInDir(dir, includeNodeFiles = false) {
  const summary = {
    checkedDirs: 1,
    matchedFiles: 0,
    changedFiles: 0,
  };

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const childSummary = fixPermissionsInDir(fullPath, includeNodeFiles);
        summary.checkedDirs += childSummary.checkedDirs;
        summary.matchedFiles += childSummary.matchedFiles;
        summary.changedFiles += childSummary.changedFiles;
      } else if (entry.name === 'spawn-helper' || (includeNodeFiles && entry.name.endsWith('.node'))) {
        summary.matchedFiles += 1;
        try {
          const stats = statSync(fullPath);
          const hasExec = (stats.mode & 0o111) !== 0;

          chmodSync(fullPath, 0o755);
          if (!hasExec) {
            summary.changedFiles += 1;
            console.log(`[postinstall] Fixed permissions (0600→0755): ${fullPath}`);
          }
        } catch {
          // Ignore permission errors
        }
      }
    }
  } catch {
    // Ignore read errors
  }

  return summary;
}

/**
 * Find and fix spawn-helper permissions
 */
function fixSpawnHelperPermissions() {
  if (process.platform === 'win32') {
    return;
  }

  let nodePtyPackageJsonPath;
  try {
    nodePtyPackageJsonPath = require.resolve('node-pty/package.json');
  } catch {
    // Ignore resolution errors and rely on fallback paths.
  }

  const directCandidates = buildNodePtyCandidatePaths({
    runtimeDir: __dirname,
    cwd: process.cwd(),
    nodePtyPackageJsonPath,
  });
  const npxCandidates = getNpxNodePtyCandidatePaths(process.env.HOME);

  const prebuildPaths = dedupePaths([
    ...directCandidates.prebuildPaths,
    ...npxCandidates.prebuildPaths,
  ]);
  const buildReleasePaths = dedupePaths([
    ...directCandidates.buildReleasePaths,
    ...npxCandidates.buildReleasePaths,
  ]);

  const summary = createEmptySummary();

  for (const prebuildPath of prebuildPaths) {
    if (!existsSync(prebuildPath)) continue;
    summary.checkedDirs += 1;
    const result = fixPermissionsInDir(prebuildPath);
    summary.matchedFiles += result.matchedFiles;
    summary.changedFiles += result.changedFiles;
  }

  for (const releasePath of buildReleasePaths) {
    if (!existsSync(releasePath)) continue;
    summary.checkedDirs += 1;
    const result = fixPermissionsInDir(releasePath, true);
    summary.matchedFiles += result.matchedFiles;
    summary.changedFiles += result.changedFiles;
  }

  if (summary.matchedFiles === 0) {
    console.warn(
      `[postinstall] spawn-helper not found in ${summary.checkedDirs} checked node-pty directories`
    );
    return;
  }

  if (summary.changedFiles > 0) {
    console.log(`[postinstall] Updated execute permissions for ${summary.changedFiles} file(s)`);
  }
}

fixSpawnHelperPermissions();
