/**
 * PTY Manager for MConnect v0.1.2
 *
 * Manages pseudo-terminal instances using node-pty.
 * Each agent gets its own PTY for full terminal emulation.
 */

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

/**
 * Fix spawn-helper permissions in node-pty prebuilds
 * This is needed because npm sometimes strips execute permissions
 * from prebuilt binaries when installing globally or via npx.
 */
function fixSpawnHelperPermissions(): void {
  if (process.platform === 'win32') {
    return;
  }

  // The most reliable way: use require.resolve to find node-pty
  try {
    const nodePtyPath = require.resolve('node-pty');
    const nodePtyDir = dirname(nodePtyPath);
    const prebuildsPath = join(nodePtyDir, 'prebuilds');

    if (existsSync(prebuildsPath)) {
      console.log(`[PTY] Checking spawn-helper permissions in: ${prebuildsPath}`);
      fixPermissionsInDir(prebuildsPath);
    }
  } catch (_e) {
    // node-pty not found yet, try relative paths as fallback
  }

  // Also try relative paths as fallback
  const possiblePaths = [
    // Relative to this file (in dist/)
    join(__dirname, '..', '..', 'node_modules', 'node-pty', 'prebuilds'),
    // When installed globally
    join(__dirname, '..', '..', '..', 'node-pty', 'prebuilds'),
    join(__dirname, '..', '..', '..', '..', 'node-pty', 'prebuilds'),
    join(__dirname, '..', '..', '..', '..', '..', 'node-pty', 'prebuilds'),
  ];

  for (const prebuildsPath of possiblePaths) {
    if (existsSync(prebuildsPath)) {
      fixPermissionsInDir(prebuildsPath);
    }
  }
}

/**
 * Recursively fix permissions for spawn-helper files
 */
function fixPermissionsInDir(dir: string): void {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        fixPermissionsInDir(fullPath);
      } else if (entry.name === 'spawn-helper') {
        try {
          const stats = statSync(fullPath);
          const hasExec = (stats.mode & 0o111) !== 0;

          // Always try to set permissions (even if they look right, they might not be)
          // This handles edge cases where stat reports wrong permissions
          try {
            chmodSync(fullPath, 0o755);
            if (!hasExec) {
              console.log(`[PTY] Fixed spawn-helper permissions: ${fullPath}`);
            }
          } catch (_chmodErr) {
            // If chmod fails but we have exec, that's ok
            if (!hasExec) {
              console.error(`[PTY] Cannot fix spawn-helper permissions: ${fullPath}`);
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
 */
function validateShell(shellPath: string): { valid: boolean; error?: string } {
  try {
    if (!existsSync(shellPath)) {
      return { valid: false, error: `Shell not found: ${shellPath}` };
    }
    accessSync(shellPath, constants.X_OK);
    return { valid: true };
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

    let ptyProcess: IPty;
    try {
      ptyProcess = pty.spawn(options.command, options.args || [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: cleanEnv,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[PTY] Spawn failed:`, errMsg);
      console.error(`[PTY] Command: ${options.command}`);
      console.error(`[PTY] Args: ${JSON.stringify(options.args || [])}`);
      console.error(`[PTY] CWD: ${cwd}`);
      throw new Error(`Failed to spawn PTY: ${errMsg}\nCommand: ${options.command}\nCWD: ${cwd}`);
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
