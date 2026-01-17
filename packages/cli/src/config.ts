/**
 * MConnect Configuration Module v0.2.0
 *
 * Handles:
 * - Environment variables (MCONNECT_HOME, MCONNECT_PORT, etc.)
 * - Config file migration from old to new locations
 * - Configuration loading and defaults
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ============================================
// Constants
// ============================================

const OLD_CONFIG_PATH = join(homedir(), '.mconnect.json');
const DEFAULT_DATA_DIR = join(homedir(), '.mconnect');
const CONFIG_FILE_NAME = 'config.json';

// ============================================
// Environment Variables
// ============================================

export interface MConnectEnvConfig {
  /** Data directory (MCONNECT_HOME) - where all MConnect data is stored */
  dataDir: string;
  /** WebSocket port (MCONNECT_PORT) - default 8765 */
  port: number;
  /** Log level (MCONNECT_LOG_LEVEL) - debug, info, warn, error */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Max concurrent sessions (MCONNECT_MAX_SESSIONS) */
  maxSessions: number;
  /** Disable tunnel (MCONNECT_NO_TUNNEL) */
  disableTunnel: boolean;
}

/**
 * Get MConnect data directory from environment or default
 */
export function getDataDir(): string {
  return process.env.MCONNECT_HOME || process.env.MCONNECT_DATA_DIR || DEFAULT_DATA_DIR;
}

/**
 * Get WebSocket port from environment or default
 */
export function getPort(): number {
  const portStr = process.env.MCONNECT_PORT;
  if (portStr) {
    const port = parseInt(portStr, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return 8765;
}

/**
 * Get log level from environment or default
 */
export function getLogLevel(): MConnectEnvConfig['logLevel'] {
  const level = process.env.MCONNECT_LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return 'info';
}

/**
 * Get max sessions from environment or default
 */
export function getMaxSessions(): number {
  const maxStr = process.env.MCONNECT_MAX_SESSIONS;
  if (maxStr) {
    const max = parseInt(maxStr, 10);
    if (!isNaN(max) && max > 0) {
      return max;
    }
  }
  return 5;
}

/**
 * Check if tunnel is disabled via environment
 */
export function isTunnelDisabled(): boolean {
  return process.env.MCONNECT_NO_TUNNEL === '1' || process.env.MCONNECT_NO_TUNNEL === 'true';
}

/**
 * Get all environment-based configuration
 */
export function getEnvConfig(): MConnectEnvConfig {
  return {
    dataDir: getDataDir(),
    port: getPort(),
    logLevel: getLogLevel(),
    maxSessions: getMaxSessions(),
    disableTunnel: isTunnelDisabled(),
  };
}

// ============================================
// Config File
// ============================================

export interface MConnectConfig {
  version: string;
  port?: number;
  logLevel?: string;
  maxSessions?: number;
  disableTunnel?: boolean;
  guardrails?: {
    level?: 'default' | 'strict' | 'permissive' | 'none';
    blockedCommands?: string[];
    allowedCommands?: string[];
  };
  tunnel?: {
    provider?: 'cloudflare' | 'ngrok' | 'none';
    customDomain?: string;
  };
  terminal?: {
    scrollbackLines?: number;
    fontSize?: number;
  };
}

const DEFAULT_CONFIG: MConnectConfig = {
  version: '0.2.0',
  port: 8765,
  logLevel: 'info',
  maxSessions: 5,
  disableTunnel: false,
  guardrails: {
    level: 'default',
  },
  terminal: {
    scrollbackLines: 10000,
  },
};

/**
 * Get config file path
 */
export function getConfigPath(): string {
  return join(getDataDir(), CONFIG_FILE_NAME);
}

/**
 * Migrate config from old location to new location
 * Returns true if migration was performed
 */
export function migrateConfig(): { migrated: boolean; message?: string } {
  // Check if old config exists
  if (!existsSync(OLD_CONFIG_PATH)) {
    return { migrated: false };
  }

  const newConfigPath = getConfigPath();

  // Check if new config already exists
  if (existsSync(newConfigPath)) {
    return {
      migrated: false,
      message: `Old config found at ${OLD_CONFIG_PATH} but new config already exists at ${newConfigPath}. Please manually merge or remove the old config.`,
    };
  }

  try {
    // Read old config
    const oldConfigContent = readFileSync(OLD_CONFIG_PATH, 'utf-8');
    const oldConfig = JSON.parse(oldConfigContent);

    // Merge with defaults and add version
    const newConfig: MConnectConfig = {
      ...DEFAULT_CONFIG,
      ...oldConfig,
      version: '0.2.0',
    };

    // Ensure data directory exists
    const dataDir = getDataDir();
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    // Write new config
    writeFileSync(newConfigPath, JSON.stringify(newConfig, null, 2));

    // Rename old config to backup
    const backupPath = `${OLD_CONFIG_PATH}.backup`;
    renameSync(OLD_CONFIG_PATH, backupPath);

    return {
      migrated: true,
      message: `Config migrated from ${OLD_CONFIG_PATH} to ${newConfigPath}. Old config backed up to ${backupPath}`,
    };
  } catch (error) {
    return {
      migrated: false,
      message: `Failed to migrate config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(): MConnectConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('Failed to load config, using defaults:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<MConnectConfig>): void {
  const configPath = getConfigPath();
  const dataDir = getDataDir();

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Merge with existing config
  const existingConfig = loadConfig();
  const newConfig = { ...existingConfig, ...config, version: '0.2.0' };

  writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
}

/**
 * Get merged configuration (file + environment)
 * Environment variables take precedence over config file
 */
export function getMergedConfig(): MConnectConfig & MConnectEnvConfig {
  const fileConfig = loadConfig();
  const envConfig = getEnvConfig();

  return {
    ...fileConfig,
    ...envConfig,
    // Environment overrides specific settings
    port: envConfig.port !== 8765 ? envConfig.port : (fileConfig.port ?? 8765),
    logLevel: process.env.MCONNECT_LOG_LEVEL ? envConfig.logLevel : (fileConfig.logLevel as any ?? 'info'),
    maxSessions: process.env.MCONNECT_MAX_SESSIONS ? envConfig.maxSessions : (fileConfig.maxSessions ?? 5),
    disableTunnel: process.env.MCONNECT_NO_TUNNEL ? envConfig.disableTunnel : (fileConfig.disableTunnel ?? false),
  };
}

/**
 * Ensure data directory exists
 */
export function ensureDataDir(): string {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * Print environment variable help
 */
export function getEnvVarHelp(): string {
  return `
Environment Variables:
  MCONNECT_HOME         Data directory (default: ~/.mconnect)
  MCONNECT_PORT         WebSocket port (default: 8765)
  MCONNECT_LOG_LEVEL    Log level: debug, info, warn, error (default: info)
  MCONNECT_MAX_SESSIONS Max concurrent sessions (default: 5)
  MCONNECT_NO_TUNNEL    Disable tunnel (default: false)
`.trim();
}
