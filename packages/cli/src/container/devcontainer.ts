/**
 * Dev Container configuration parser
 *
 * Parses .devcontainer/devcontainer.json files following the
 * Dev Container spec: https://containers.dev/implementors/json_reference/
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import type { DevContainerConfig } from './types.js';

/**
 * Standard locations for devcontainer.json
 */
const DEVCONTAINER_LOCATIONS = [
  '.devcontainer/devcontainer.json',
  '.devcontainer.json',
  '.devcontainer/Dockerfile', // Check if custom Dockerfile exists
];

/**
 * Variable interpolation context
 */
interface VariableContext {
  localWorkspaceFolder: string;
  containerWorkspaceFolder?: string;
  localWorkspaceFolderBasename?: string;
}

/**
 * Parse JSON with comments (JSONC)
 * Simple implementation that strips comments before parsing
 */
function parseJsonc(content: string): unknown {
  // Remove single-line comments (// ...)
  let stripped = content.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments (/* ... */)
  stripped = stripped.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove trailing commas before ] or }
  stripped = stripped.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(stripped);
}

/**
 * Resolve variables in a string value
 *
 * Supports:
 * - ${localWorkspaceFolder} - Host workspace path
 * - ${containerWorkspaceFolder} - Container workspace path
 * - ${localWorkspaceFolderBasename} - Workspace folder name
 * - ${localEnv:VARIABLE} - Host environment variable
 * - ${localEnv:VARIABLE:default} - With default value
 * - ${containerEnv:VARIABLE} - Container environment variable
 */
export function resolveVariables(
  value: string,
  context: VariableContext,
  containerEnv?: Record<string, string>
): string {
  return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const parts = expr.split(':');
    const varType = parts[0];

    switch (varType) {
      case 'localWorkspaceFolder':
        return context.localWorkspaceFolder;

      case 'containerWorkspaceFolder':
        return context.containerWorkspaceFolder || '/workspace';

      case 'localWorkspaceFolderBasename':
        return context.localWorkspaceFolderBasename || basename(context.localWorkspaceFolder);

      case 'localEnv': {
        const envName = parts[1];
        const defaultValue = parts[2] || '';
        return process.env[envName] || defaultValue;
      }

      case 'containerEnv': {
        const envName = parts[1];
        const defaultValue = parts[2] || '';
        return containerEnv?.[envName] || defaultValue;
      }

      default:
        // Unknown variable, return as-is
        return match;
    }
  });
}

/**
 * Resolve variables in an object recursively
 */
function resolveVariablesInObject<T>(
  obj: T,
  context: VariableContext,
  containerEnv?: Record<string, string>
): T {
  if (typeof obj === 'string') {
    return resolveVariables(obj, context, containerEnv) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveVariablesInObject(item, context, containerEnv)) as T;
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveVariablesInObject(value, context, containerEnv);
    }
    return result as T;
  }

  return obj;
}

/**
 * Find devcontainer.json in a workspace directory
 *
 * @param workspaceDir - The workspace directory to search
 * @returns Path to devcontainer.json or null if not found
 */
export function findDevContainerConfig(workspaceDir: string): string | null {
  for (const location of DEVCONTAINER_LOCATIONS) {
    const fullPath = join(workspaceDir, location);
    if (existsSync(fullPath) && fullPath.endsWith('.json')) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Check if a workspace has a devcontainer configuration
 *
 * @param workspaceDir - The workspace directory to check
 * @returns True if devcontainer.json exists
 */
export function hasDevContainerConfig(workspaceDir: string): boolean {
  return findDevContainerConfig(workspaceDir) !== null;
}

/**
 * Parse a devcontainer.json file
 *
 * @param workspaceDir - The workspace directory containing devcontainer config
 * @returns Parsed and resolved DevContainerConfig or null if not found
 */
export function parseDevContainer(workspaceDir: string): DevContainerConfig | null {
  const configPath = findDevContainerConfig(workspaceDir);

  if (!configPath) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const rawConfig = parseJsonc(content) as DevContainerConfig;

    // Create variable context
    const context: VariableContext = {
      localWorkspaceFolder: workspaceDir,
      containerWorkspaceFolder: rawConfig.workspaceFolder || '/workspace',
      localWorkspaceFolderBasename: basename(workspaceDir),
    };

    // Resolve variables in the config
    const resolvedConfig = resolveVariablesInObject(rawConfig, context, rawConfig.containerEnv);

    // Set defaults
    if (!resolvedConfig.workspaceFolder) {
      resolvedConfig.workspaceFolder = '/workspace';
    }

    // Resolve build context relative to devcontainer.json location
    if (resolvedConfig.build?.dockerfile) {
      const configDir = dirname(configPath);
      const dockerfilePath = join(configDir, resolvedConfig.build.dockerfile);
      if (!existsSync(dockerfilePath)) {
        console.warn(`[DevContainer] Dockerfile not found: ${dockerfilePath}`);
      }
    }

    return resolvedConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[DevContainer] Failed to parse ${configPath}: ${message}`);
    return null;
  }
}

/**
 * Get the container image from a devcontainer config
 *
 * Priority:
 * 1. config.image (direct image reference)
 * 2. Build from Dockerfile (returns null, caller should build)
 * 3. Default image
 */
export function getContainerImage(
  config: DevContainerConfig | null,
  defaultImage = 'ubuntu:22.04'
): string | null {
  if (!config) {
    return defaultImage;
  }

  // Direct image reference
  if (config.image) {
    return config.image;
  }

  // Has build config - return null to signal build is needed
  if (config.build?.dockerfile) {
    return null;
  }

  // Docker Compose - return null to signal compose handling
  if (config.dockerComposeFile) {
    return null;
  }

  return defaultImage;
}

/**
 * Get volume mounts from devcontainer config
 *
 * @param config - DevContainer configuration
 * @param workspaceDir - Host workspace directory
 * @returns Array of Docker volume mount strings
 */
export function getVolumeMounts(
  config: DevContainerConfig | null,
  workspaceDir: string
): string[] {
  const mounts: string[] = [];

  // Default workspace mount
  const workspaceFolder = config?.workspaceFolder || '/workspace';
  const workspaceMount =
    config?.workspaceMount ||
    `type=bind,source=${workspaceDir},target=${workspaceFolder}`;

  mounts.push(workspaceMount);

  // Additional mounts from config
  if (config?.mounts) {
    const context: VariableContext = {
      localWorkspaceFolder: workspaceDir,
      containerWorkspaceFolder: workspaceFolder,
    };

    for (const mount of config.mounts) {
      mounts.push(resolveVariables(mount, context));
    }
  }

  return mounts;
}

/**
 * Get environment variables from devcontainer config
 *
 * @param config - DevContainer configuration
 * @returns Combined environment variables
 */
export function getContainerEnv(config: DevContainerConfig | null): Record<string, string> {
  const env: Record<string, string> = {};

  // Container environment (set before ENTRYPOINT)
  if (config?.containerEnv) {
    Object.assign(env, config.containerEnv);
  }

  // Remote environment (set after ENTRYPOINT, for processes)
  if (config?.remoteEnv) {
    Object.assign(env, config.remoteEnv);
  }

  return env;
}

/**
 * Get the user to run as inside the container
 *
 * @param config - DevContainer configuration
 * @returns User string or undefined for default
 */
export function getContainerUser(config: DevContainerConfig | null): string | undefined {
  // remoteUser is for tools/processes (what we want for shells)
  if (config?.remoteUser) {
    return config.remoteUser;
  }

  // containerUser is for all operations
  if (config?.containerUser) {
    return config.containerUser;
  }

  return undefined;
}

/**
 * Get Docker run arguments from devcontainer config
 *
 * @param config - DevContainer configuration
 * @returns Array of Docker run arguments
 */
export function getDockerRunArgs(config: DevContainerConfig | null): string[] {
  const args: string[] = [];

  // Custom run args
  if (config?.runArgs) {
    args.push(...config.runArgs);
  }

  // Privileged mode
  if (config?.privileged) {
    args.push('--privileged');
  }

  // Capabilities
  if (config?.capAdd) {
    for (const cap of config.capAdd) {
      args.push('--cap-add', cap);
    }
  }

  // Security options
  if (config?.securityOpt) {
    for (const opt of config.securityOpt) {
      args.push('--security-opt', opt);
    }
  }

  return args;
}

/**
 * Create a minimal devcontainer config for a workspace
 * Used when no devcontainer.json exists
 *
 * @param workspaceDir - Host workspace directory
 * @param image - Container image to use
 * @returns DevContainerConfig with sensible defaults
 */
export function createDefaultDevContainerConfig(
  workspaceDir: string,
  image = 'ubuntu:22.04'
): DevContainerConfig {
  return {
    name: `MConnect - ${basename(workspaceDir)}`,
    image,
    workspaceFolder: '/workspace',
    remoteUser: 'root', // Default to root for simplicity
    containerEnv: {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  };
}
