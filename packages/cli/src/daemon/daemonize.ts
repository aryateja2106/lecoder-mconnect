/**
 * Daemonization utilities for MConnect
 * MConnect v0.2.0
 *
 * Fork/detach logic for running as background daemon
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_DATA_DIR = `${process.env.HOME}/.mconnect`;
const PID_FILE = 'daemon.pid';

/**
 * Get the path to the PID file
 */
function getPidFilePath(dataDir: string = DEFAULT_DATA_DIR): string {
  return join(dataDir, PID_FILE);
}

/**
 * Ensure the data directory exists
 */
function ensureDataDir(dataDir: string = DEFAULT_DATA_DIR): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * Fork the current process and detach to run as a daemon
 *
 * @param scriptPath - Path to the daemon script to run
 * @param args - Arguments to pass to the daemon
 * @param dataDir - Data directory for PID file
 * @returns The PID of the spawned daemon process
 */
export function daemonize(
  scriptPath: string,
  args: string[] = [],
  dataDir: string = DEFAULT_DATA_DIR
): number {
  ensureDataDir(dataDir);

  // Check if already running
  if (isDaemonRunning(dataDir)) {
    const pid = getDaemonPid(dataDir);
    throw new Error(`Daemon is already running with PID ${pid}`);
  }

  // Spawn detached child process
  const child = spawn(process.execPath, [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MCONNECT_DAEMON: '1',
      MCONNECT_DATA_DIR: dataDir,
    },
  });

  // Detach from parent
  child.unref();

  if (!child.pid) {
    throw new Error('Failed to spawn daemon process');
  }

  // Write PID file
  const pidPath = getPidFilePath(dataDir);
  writeFileSync(pidPath, child.pid.toString(), 'utf-8');

  return child.pid;
}

/**
 * Check if the daemon is currently running
 *
 * @param dataDir - Data directory containing PID file
 * @returns True if daemon is running
 */
export function isDaemonRunning(dataDir: string = DEFAULT_DATA_DIR): boolean {
  const pid = getDaemonPid(dataDir);
  if (!pid) {
    return false;
  }

  try {
    // Send signal 0 to check if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    // Process doesn't exist, clean up stale PID file
    const pidPath = getPidFilePath(dataDir);
    try {
      unlinkSync(pidPath);
    } catch {
      // Ignore cleanup errors
    }
    return false;
  }
}

/**
 * Get the PID of the running daemon
 *
 * @param dataDir - Data directory containing PID file
 * @returns The PID if found, null otherwise
 */
export function getDaemonPid(dataDir: string = DEFAULT_DATA_DIR): number | null {
  const pidPath = getPidFilePath(dataDir);

  if (!existsSync(pidPath)) {
    return null;
  }

  try {
    const content = readFileSync(pidPath, 'utf-8').trim();
    const pid = parseInt(content, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * Kill the running daemon
 *
 * @param dataDir - Data directory containing PID file
 * @param force - Use SIGKILL instead of SIGTERM
 * @returns True if daemon was killed, false if not running
 */
export function killDaemon(dataDir: string = DEFAULT_DATA_DIR, force = false): boolean {
  const pid = getDaemonPid(dataDir);
  if (!pid) {
    return false;
  }

  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');

    // Remove PID file
    const pidPath = getPidFilePath(dataDir);
    try {
      unlinkSync(pidPath);
    } catch {
      // Ignore cleanup errors
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Write PID file for the current process (called by daemon after start)
 *
 * @param dataDir - Data directory for PID file
 */
export function writePidFile(dataDir: string = DEFAULT_DATA_DIR): void {
  ensureDataDir(dataDir);
  const pidPath = getPidFilePath(dataDir);
  writeFileSync(pidPath, process.pid.toString(), 'utf-8');
}

/**
 * Remove PID file (called by daemon on shutdown)
 *
 * @param dataDir - Data directory containing PID file
 */
export function removePidFile(dataDir: string = DEFAULT_DATA_DIR): void {
  const pidPath = getPidFilePath(dataDir);
  try {
    unlinkSync(pidPath);
  } catch {
    // Ignore errors
  }
}
