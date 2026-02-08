/**
 * PTY Manager for MConnect v0.1.2
 *
 * Manages pseudo-terminal instances using node-pty.
 * Each agent gets its own PTY for full terminal emulation.
 */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { accessSync, chmodSync, constants, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IPty } from 'node-pty';
import type { PTYEvent, PTYInstance, PTYOptions, PTYSize } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use createRequire to load CommonJS node-pty module in ESM
const require = createRequire(import.meta.url);

// node-pty module (loaded via require for CommonJS compatibility)
let pty: typeof import('node-pty') | null = null;

interface NodePtyCandidatePaths {
  prebuildPaths: string[];
  buildReleasePaths: string[];
}

interface NodePtyCandidatePathOptions {
  runtimeDir?: string;
  cwd?: string;
  nodePtyPackageJsonPath?: string;
  maxParentDepth?: number;
}

interface PermissionFixSummary {
  checkedDirs: number;
  matchedFiles: number;
  changedFiles: number;
}

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.map((path) => resolve(path))));
}

/**
 * Build candidate search paths for node-pty helper binaries.
 * This is pure so it can be unit-tested without touching the filesystem.
 */
export function buildNodePtyCandidatePaths(options: NodePtyCandidatePathOptions = {}): NodePtyCandidatePaths {
  const runtimeDir = options.runtimeDir || __dirname;
  const cwd = options.cwd || process.cwd();
  const maxParentDepth = options.maxParentDepth ?? 6;

  const prebuildPaths: string[] = [];
  const buildReleasePaths: string[] = [];

  if (options.nodePtyPackageJsonPath) {
    const nodePtyRoot = dirname(options.nodePtyPackageJsonPath);
    prebuildPaths.push(join(nodePtyRoot, 'prebuilds'));
    buildReleasePaths.push(join(nodePtyRoot, 'build', 'Release'));
  }

  // Explicit workspace root candidate (where npm workspaces hoist dependencies).
  prebuildPaths.push(join(cwd, 'node_modules', 'node-pty', 'prebuilds'));
  buildReleasePaths.push(join(cwd, 'node_modules', 'node-pty', 'build', 'Release'));

  // Walk up from runtime location to catch global and nested install layouts.
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

/**
 * Discover node-pty locations in npx cache without broad recursive scans.
 */
function getNpxNodePtyCandidatePaths(homeDir: string | undefined): NodePtyCandidatePaths {
  if (!homeDir) {
    return { prebuildPaths: [], buildReleasePaths: [] };
  }

  const npxRoot = join(homeDir, '.npm', '_npx');
  if (!existsSync(npxRoot)) {
    return { prebuildPaths: [], buildReleasePaths: [] };
  }

  try {
    const entries = readdirSync(npxRoot, { withFileTypes: true });
    const prebuildPaths: string[] = [];
    const buildReleasePaths: string[] = [];

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

/**
 * Fix spawn-helper permissions in node-pty prebuilds
 * This is needed because npm sometimes strips execute permissions
 * from prebuilt binaries when installing globally or via npx.
 */
function fixSpawnHelperPermissions(): void {
  if (process.platform === 'win32') {
    return;
  }

  let nodePtyPackageJsonPath: string | undefined;
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

  const summary: PermissionFixSummary = {
    checkedDirs: 0,
    matchedFiles: 0,
    changedFiles: 0,
  };

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
      `[PTY] spawn-helper not found in ${summary.checkedDirs} checked node-pty directories. Try: npm rebuild node-pty`
    );
  }
}

/**
 * Recursively fix permissions for spawn-helper files (and optionally .node binaries)
 */
function fixPermissionsInDir(dir: string, includeNodeFiles = false): PermissionFixSummary {
  const summary: PermissionFixSummary = {
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

          // Always try to set permissions (even if they look right, they might not be)
          // This handles edge cases where stat reports wrong permissions
          // Critical on macOS where npm strips execute bits from prebuilt binaries
          try {
            chmodSync(fullPath, 0o755);
            if (!hasExec) {
              summary.changedFiles += 1;
              console.log(`[PTY] Fixed permissions (0600→0755): ${fullPath}`);
            }
          } catch (_chmodErr) {
            // If chmod fails but we have exec, that's ok
            if (!hasExec) {
              console.error(`[PTY] Cannot fix permissions: ${fullPath}`);
            }
          }
        } catch (_e) {
          // Ignore stat errors
        }
      }
    }
  } catch (_e) {
    // Ignore read errors
  }

  return summary;
}

/**
 * Check if node-pty is available
 */
export async function isPtyAvailable(): Promise<boolean> {
  try {
    // Fix spawn-helper permissions before loading
    fixSpawnHelperPermissions();

    // Use require() instead of import() for CommonJS native modules
    pty = require('node-pty');
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Generate unique PTY ID
 */
function generatePtyId(): string {
  return `pty_${randomBytes(4).toString('hex')}`;
}

/**
 * Validate that a shell binary exists and is executable
 *
 * Security: Uses execFileSync instead of execSync to prevent shell injection.
 * Only allows alphanumeric characters, slashes, underscores, dots, and hyphens.
 */
function validateShell(shellPath: string): { valid: boolean; error?: string } {
  // Handle empty input
  if (!shellPath || shellPath.trim() === '') {
    return { valid: false, error: 'Shell path cannot be empty' };
  }

  // Security: Whitelist allowed characters to prevent injection
  const validPattern = /^[a-zA-Z0-9/_.-]+$/;
  if (!validPattern.test(shellPath)) {
    return { valid: false, error: `Invalid shell path: contains disallowed characters` };
  }

  try {
    // Absolute paths: check directly
    if (shellPath.startsWith('/')) {
      if (!existsSync(shellPath)) {
        return { valid: false, error: `Shell not found: ${shellPath}` };
      }
      accessSync(shellPath, constants.X_OK);
      return { valid: true };
    }

    // Relative paths starting with ./ or ../
    if (shellPath.startsWith('./') || shellPath.startsWith('../')) {
      const resolvedPath = resolve(shellPath);
      if (!existsSync(resolvedPath)) {
        return { valid: false, error: `Shell not found: ${shellPath}` };
      }
      accessSync(resolvedPath, constants.X_OK);
      return { valid: true };
    }

    // Container runtimes: these are validated separately by the container manager.
    // The PTY shell validation is designed for user shells (bash, zsh, etc.) but
    // container commands like 'docker exec' are special - they wrap a shell inside.
    const containerRuntimes = ['docker', 'podman', 'nerdctl', 'lima', 'colima'];
    const shellBasename = shellPath.split('/').pop() || shellPath;
    if (containerRuntimes.includes(shellBasename)) {
      // For container runtimes, accept if 'which' finds it OR just trust it
      // since the container manager already validated docker availability
      try {
        const resolvedPath = execFileSync('which', [shellPath], {
          encoding: 'utf8',
          timeout: 5000,
        }).trim();
        if (resolvedPath && existsSync(resolvedPath)) {
          return { valid: true };
        }
      } catch {
        // 'which' failed but container manager should handle this gracefully
      }
      // Accept container runtimes even without 'which' resolution - the spawn
      // will fail with a clear error if docker truly isn't available
      console.warn(`[PTY] Container runtime '${shellPath}' not in PATH, attempting spawn anyway`);
      return { valid: true };
    }

    // Windows: skip 'which' (not available)
    if (process.platform === 'win32') {
      return {
        valid: false,
        error: `Shell not found: ${shellPath} (use absolute path on Windows)`,
      };
    }

    // Non-absolute paths: resolve via 'which' (SAFE - uses execFileSync)
    try {
      const resolvedPath = execFileSync('which', [shellPath], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim();
      if (resolvedPath && existsSync(resolvedPath)) {
        return { valid: true };
      }
    } catch {
      // 'which' failed - command not in PATH
    }

    return { valid: false, error: `Shell not found: ${shellPath}` };
  } catch (_error) {
    return { valid: false, error: `Shell not executable: ${shellPath}` };
  }
}

/**
 * Validate that a directory exists
 */
function validateCwd(cwd: string | undefined): { valid: boolean; error?: string } {
  if (!cwd) {
    return { valid: true }; // Will use process.cwd() as default
  }
  try {
    const resolvedPath = resolve(cwd);
    if (!existsSync(resolvedPath)) {
      return { valid: false, error: `Working directory not found: ${cwd}` };
    }
    return { valid: true };
  } catch (_error) {
    return { valid: false, error: `Invalid working directory: ${cwd}` };
  }
}

/**
 * Wrapper around a single node-pty instance
 */
class PTYInstanceImpl implements PTYInstance {
  public readonly id: string;
  public readonly pid: number;

  private ptyProcess: IPty;
  private dataHandlers: ((data: string) => void)[] = [];
  private exitHandlers: ((code: number, signal?: number) => void)[] = [];
  private running: boolean = true;

  constructor(id: string, ptyProcess: IPty) {
    this.id = id;
    this.ptyProcess = ptyProcess;
    this.pid = ptyProcess.pid;

    // Setup event handlers
    this.ptyProcess.onData((data) => {
      this.dataHandlers.forEach((handler) => handler(data));
    });

    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.running = false;
      this.exitHandlers.forEach((handler) => handler(exitCode, signal));
    });
  }

  write(data: string): void {
    if (this.running) {
      this.ptyProcess.write(data);
    }
  }

  resize(size: PTYSize): void {
    if (this.running) {
      this.ptyProcess.resize(size.cols, size.rows);
    }
  }

  kill(signal?: string): void {
    if (this.running) {
      this.ptyProcess.kill(signal);
      this.running = false;
    }
  }

  onData(callback: (data: string) => void): void {
    this.dataHandlers.push(callback);
  }

  onExit(callback: (exitCode: number, signal?: number) => void): void {
    this.exitHandlers.push(callback);
  }

  isRunning(): boolean {
    return this.running;
  }
}

/**
 * PTY Manager - manages multiple PTY instances
 */
export class PTYManager {
  private instances: Map<string, PTYInstanceImpl> = new Map();
  private eventHandlers: ((event: PTYEvent) => void)[] = [];
  private initialized: boolean = false;

  /**
   * Initialize the PTY manager (loads node-pty)
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    const available = await isPtyAvailable();
    if (!available) {
      throw new Error(
        'node-pty is not available. Run: npm install node-pty\n' +
          'Requires: Python 3, C++ compiler (Xcode on macOS, build-essential on Linux)'
      );
    }

    this.initialized = true;
    return true;
  }

  /**
   * Create a new PTY instance
   */
  async create(options: PTYOptions): Promise<PTYInstance> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!pty) {
      throw new Error('PTY module not loaded');
    }

    // Validate shell exists and is executable
    const shellValidation = validateShell(options.command);
    if (!shellValidation.valid) {
      throw new Error(shellValidation.error || `Invalid shell: ${options.command}`);
    }

    // Validate working directory exists
    const cwdValidation = validateCwd(options.cwd);
    if (!cwdValidation.valid) {
      throw new Error(cwdValidation.error || `Invalid cwd: ${options.cwd}`);
    }

    const id = generatePtyId();
    const cols = options.cols || 80;
    const rows = options.rows || 24;
    const cwd = options.cwd || process.cwd();

    // Build clean environment (filter out undefined values from process.env)
    const cleanEnv: Record<string, string> = {};

    // Copy process.env, filtering out undefined values
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        cleanEnv[key] = value;
      }
    }

    // Merge custom env vars
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        if (value !== undefined) {
          cleanEnv[key] = value;
        }
      }
    }

    // Set terminal-related env vars
    cleanEnv.TERM = 'xterm-256color';
    cleanEnv.COLORTERM = 'truecolor';
    cleanEnv.FORCE_COLOR = '1';

    // Debug logging
    console.log(`[PTY] Spawning: ${options.command} ${(options.args || []).join(' ')}`);
    console.log(`[PTY] CWD: ${cwd}`);
    console.log(`[PTY] Env vars count: ${Object.keys(cleanEnv).length}`);

    let ptyProcess: IPty | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        ptyProcess = pty.spawn(options.command, options.args || [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: cleanEnv,
        });
        break; // Success
      } catch (error) {
        const lastError = error instanceof Error ? error : new Error(String(error));
        const errMsg = lastError.message;

        if (attempt < maxRetries && errMsg.includes('posix_spawnp')) {
          // posix_spawnp failure is often a permissions issue - retry after fixing
          console.warn(`[PTY] Spawn attempt ${attempt + 1} failed (posix_spawnp), fixing permissions and retrying...`);
          fixSpawnHelperPermissions();
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        console.error(`[PTY] Spawn failed:`, errMsg);
        console.error(`[PTY] Command: ${options.command}`);
        console.error(`[PTY] Args: ${JSON.stringify(options.args || [])}`);
        console.error(`[PTY] CWD: ${cwd}`);

        if (errMsg.includes('posix_spawnp')) {
          throw new Error(
            `Failed to spawn PTY: ${errMsg}\nCommand: ${options.command}\nCWD: ${cwd}\n\n` +
            `This is usually a node-pty spawn-helper permissions issue.\n` +
            `Try running: npm rebuild node-pty\n` +
            `Or: chmod +x $(find node_modules/node-pty -name spawn-helper)`
          );
        }
        throw new Error(`Failed to spawn PTY: ${errMsg}\nCommand: ${options.command}\nCWD: ${cwd}`);
      }
    }

    if (!ptyProcess) {
      throw new Error(`Failed to spawn PTY after ${maxRetries + 1} attempts\nCommand: ${options.command}\nCWD: ${cwd}`);
    }

    const instance = new PTYInstanceImpl(id, ptyProcess);

    // Wire up events to manager
    instance.onData((data) => {
      this.emit({ type: 'data', ptyId: id, data });
    });

    instance.onExit((exitCode, signal) => {
      this.emit({ type: 'exit', ptyId: id, exitCode, signal });
      this.instances.delete(id);
    });

    this.instances.set(id, instance);
    return instance;
  }

  /**
   * Get a PTY instance by ID
   */
  get(id: string): PTYInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Get all PTY instances
   */
  getAll(): PTYInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Kill a PTY instance
   */
  kill(id: string, signal?: string): boolean {
    const instance = this.instances.get(id);
    if (instance) {
      instance.kill(signal);
      this.instances.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Kill all PTY instances
   */
  killAll(): void {
    for (const instance of this.instances.values()) {
      instance.kill();
    }
    this.instances.clear();
  }

  /**
   * Register event handler
   */
  onEvent(handler: (event: PTYEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: PTYEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }

  /**
   * Get count of active PTYs
   */
  get count(): number {
    return this.instances.size;
  }
}

// Singleton instance
let ptyManager: PTYManager | null = null;

/**
 * Get the global PTY manager instance
 */
export function getPTYManager(): PTYManager {
  if (!ptyManager) {
    ptyManager = new PTYManager();
  }
  return ptyManager;
}
