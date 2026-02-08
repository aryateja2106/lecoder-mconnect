import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNodePtyCandidatePaths } from '../pty/pty-manager.js';

describe('buildNodePtyCandidatePaths', () => {
  it('should include package-root and workspace-root node-pty paths', () => {
    const runtimeDir = '/workspace/packages/cli/dist/pty';
    const cwd = '/workspace';
    const packageJsonPath = '/workspace/node_modules/node-pty/package.json';

    const candidates = buildNodePtyCandidatePaths({
      runtimeDir,
      cwd,
      nodePtyPackageJsonPath: packageJsonPath,
      maxParentDepth: 2,
    });

    expect(candidates.prebuildPaths).toContain('/workspace/node_modules/node-pty/prebuilds');
    expect(candidates.buildReleasePaths).toContain('/workspace/node_modules/node-pty/build/Release');
  });

  it('should include ancestor node_modules fallbacks from runtime directory', () => {
    const runtimeDir = '/workspace/packages/cli/src/pty';
    const cwd = '/tmp/example';

    const candidates = buildNodePtyCandidatePaths({
      runtimeDir,
      cwd,
      maxParentDepth: 3,
    });

    expect(candidates.prebuildPaths).toContain(join('/workspace/packages/cli/src/pty', 'node_modules', 'node-pty', 'prebuilds'));
    expect(candidates.prebuildPaths).toContain('/workspace/packages/cli/node_modules/node-pty/prebuilds');
    expect(candidates.prebuildPaths).toContain('/workspace/packages/node-pty/prebuilds');
  });

  it('should return deduplicated path lists', () => {
    const runtimeDir = '/workspace';
    const cwd = '/workspace';
    const packageJsonPath = '/workspace/node_modules/node-pty/package.json';

    const candidates = buildNodePtyCandidatePaths({
      runtimeDir,
      cwd,
      nodePtyPackageJsonPath: packageJsonPath,
      maxParentDepth: 0,
    });

    expect(new Set(candidates.prebuildPaths).size).toBe(candidates.prebuildPaths.length);
    expect(new Set(candidates.buildReleasePaths).size).toBe(candidates.buildReleasePaths.length);
  });
});
