/**
 * Agent Preset Registry
 *
 * Central registry for all agent presets. Presets define agent
 * configurations that can be referenced by name when creating sessions.
 *
 * Built-in presets:
 * - claude: Single Claude Code agent with container isolation
 * - dev-review: Developer + Reviewer Claude Code agents
 * - shell: Lightweight Alpine shell
 * - ubuntu-shell: Full Ubuntu shell with dev tools
 *
 * Custom presets can be registered at runtime via registerPreset().
 */

import type { AgentPreset, AgentConfig } from '@lecoder/shared';
import { claudePreset, devReviewPreset } from './claude.js';
import { shellPreset, ubuntuShellPreset } from './shell.js';

// ============================================================================
// Registry
// ============================================================================

/**
 * Preset registry - maps preset names to their definitions
 */
const presetRegistry = new Map<string, AgentPreset>();

/**
 * Initialize built-in presets
 */
function initBuiltinPresets(): void {
  presetRegistry.set(claudePreset.name, claudePreset);
  presetRegistry.set(devReviewPreset.name, devReviewPreset);
  presetRegistry.set(shellPreset.name, shellPreset);
  presetRegistry.set(ubuntuShellPreset.name, ubuntuShellPreset);

  // Alias: 'single' → claude preset (backward compatibility with V1)
  presetRegistry.set('single', claudePreset);
}

// Initialize on module load
initBuiltinPresets();

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a preset by name
 *
 * @param name - Preset name
 * @returns The preset, or undefined if not found
 */
export function getPreset(name: string): AgentPreset | undefined {
  return presetRegistry.get(name);
}

/**
 * Resolve a preset name to agent configurations
 *
 * Returns the agent configs from the preset with optional overrides applied.
 * If the preset is not found, returns undefined.
 *
 * @param name - Preset name
 * @param overrides - Optional overrides applied to each agent config
 * @returns Array of agent configurations, or undefined if preset not found
 */
export function resolvePreset(
  name: string,
  overrides?: Partial<Pick<AgentConfig, 'cwd' | 'env'>>,
): AgentConfig[] | undefined {
  const preset = presetRegistry.get(name);
  if (!preset) {
    return undefined;
  }

  return preset.agents.map((agent) => {
    const config: AgentConfig = { ...agent };

    if (overrides?.cwd) {
      config.cwd = overrides.cwd;
    }

    if (overrides?.env) {
      config.env = { ...config.env, ...overrides.env };
    }

    return config;
  });
}

/**
 * Register a custom preset
 *
 * @param preset - The preset to register
 * @throws Error if a built-in preset with the same name exists
 */
export function registerPreset(preset: AgentPreset): void {
  const builtinNames = new Set(['claude', 'dev-review', 'shell', 'ubuntu-shell', 'single']);
  if (builtinNames.has(preset.name)) {
    throw new Error(`Cannot override built-in preset '${preset.name}'`);
  }
  presetRegistry.set(preset.name, preset);
}

/**
 * Unregister a custom preset
 *
 * @param name - Preset name to remove
 * @returns true if the preset was removed, false if it didn't exist
 * @throws Error if attempting to remove a built-in preset
 */
export function unregisterPreset(name: string): boolean {
  const builtinNames = new Set(['claude', 'dev-review', 'shell', 'ubuntu-shell', 'single']);
  if (builtinNames.has(name)) {
    throw new Error(`Cannot remove built-in preset '${name}'`);
  }
  return presetRegistry.delete(name);
}

/**
 * List all registered presets
 *
 * @returns Array of all presets (built-in and custom)
 */
export function listPresets(): AgentPreset[] {
  // Deduplicate by filtering out the 'single' alias
  const seen = new Set<AgentPreset>();
  const result: AgentPreset[] = [];

  for (const preset of presetRegistry.values()) {
    if (!seen.has(preset)) {
      seen.add(preset);
      result.push(preset);
    }
  }

  return result;
}

/**
 * Check if a preset name exists
 *
 * @param name - Preset name to check
 * @returns true if the preset exists
 */
export function hasPreset(name: string): boolean {
  return presetRegistry.has(name);
}

/**
 * Create an AgentConfig from custom parameters
 *
 * Utility for creating agent configs from API requests
 * where the user provides individual fields instead of
 * selecting a preset.
 *
 * @param params - Custom agent parameters
 * @returns A valid AgentConfig
 */
export function createCustomAgentConfig(params: {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  image?: string;
  memoryMB?: number;
  enableMCP?: boolean;
}): AgentConfig {
  const config: AgentConfig = {
    type: 'custom',
    name: params.name,
    command: params.command,
    args: params.args,
    cwd: params.cwd,
    env: {
      TERM: 'xterm-256color',
      ...params.env,
    },
    autoRun: true,
  };

  if (params.image) {
    config.container = {
      image: params.image,
      workDir: '/workspace',
      removeOnExit: true,
      resourceLimits: {
        memoryMB: params.memoryMB ?? 512,
        cpuShares: 1024,
      },
    };
  }

  if (params.enableMCP) {
    config.mcp = {
      transport: 'stdio',
    };
  }

  return config;
}

/**
 * Reset the registry to built-in presets only (for testing)
 */
export function resetPresets(): void {
  presetRegistry.clear();
  initBuiltinPresets();
}

// Re-export preset definitions
export { claudePreset, devReviewPreset } from './claude.js';
export { shellPreset, ubuntuShellPreset } from './shell.js';
