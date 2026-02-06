/**
 * Presets REST API Routes
 *
 * Handles preset management endpoints:
 * - GET /presets - List available presets
 * - GET /presets/:name - Get preset details
 * - POST /presets - Register a custom preset
 * - DELETE /presets/:name - Remove a custom preset
 */

import type { AgentPreset } from '@lecoder/shared';
import { z } from 'zod';
import {
  listPresets,
  getPreset,
  registerPreset,
  unregisterPreset,
  hasPreset,
} from '../agents/presets/index.js';

// ============================================================================
// Request Validation
// ============================================================================

const agentConfigSchema = z.object({
  type: z.enum(['claude', 'gemini', 'codex', 'aider', 'shell', 'custom']),
  name: z.string().min(1).max(100),
  command: z.string().min(1).max(500),
  args: z.array(z.string()).optional(),
  initialPrompt: z.string().optional(),
  env: z.record(z.string()).optional(),
  autoRun: z.boolean().optional(),
  container: z
    .object({
      image: z.string().min(1),
      volumes: z.array(z.string()).optional(),
      ports: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      network: z.string().optional(),
      workDir: z.string().optional(),
      removeOnExit: z.boolean().optional(),
      privileged: z.boolean().optional(),
      user: z.string().optional(),
      resourceLimits: z
        .object({
          cpuShares: z.number().optional(),
          memoryMB: z.number().optional(),
          diskMB: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  mcp: z
    .object({
      transport: z.enum(['stdio', 'sse']),
    })
    .optional(),
});

const createPresetSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Preset name must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1).max(200),
  agents: z.array(agentConfigSchema).min(1).max(10),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Handle GET /presets
 *
 * List all available presets.
 */
export function handleListPresets(): Response {
  const presets = listPresets();

  return Response.json({
    presets: presets.map((p) => ({
      name: p.name,
      description: p.description,
      agentCount: p.agents.length,
      agents: p.agents.map((a) => ({
        type: a.type,
        name: a.name,
        command: a.command,
        hasContainer: !!a.container,
        hasMCP: !!a.mcp,
      })),
    })),
  });
}

/**
 * Handle GET /presets/:name
 *
 * Get details of a specific preset.
 */
export function handleGetPreset(name: string): Response {
  const preset = getPreset(name);

  if (!preset) {
    return Response.json(
      {
        error: 'not_found',
        error_description: `Preset '${name}' not found`,
      },
      { status: 404 }
    );
  }

  return Response.json(preset);
}

/**
 * Handle POST /presets
 *
 * Register a custom preset.
 */
export async function handleCreatePreset(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Invalid JSON body',
      },
      { status: 400 }
    );
  }

  const parseResult = createPresetSchema.safeParse(body);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      },
      { status: 400 }
    );
  }

  const { name, description, agents } = parseResult.data;

  try {
    const preset: AgentPreset = { name, description, agents };
    registerPreset(preset);
    return Response.json(preset, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register preset';
    return Response.json(
      {
        error: 'conflict',
        error_description: message,
      },
      { status: 409 }
    );
  }
}

/**
 * Handle DELETE /presets/:name
 *
 * Remove a custom preset.
 */
export function handleDeletePreset(name: string): Response {
  if (!hasPreset(name)) {
    return Response.json(
      {
        error: 'not_found',
        error_description: `Preset '${name}' not found`,
      },
      { status: 404 }
    );
  }

  try {
    unregisterPreset(name);
    return new Response(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove preset';
    return Response.json(
      {
        error: 'conflict',
        error_description: message,
      },
      { status: 409 }
    );
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Extract preset name from path
 */
function extractPresetName(pathname: string): string | null {
  const match = pathname.match(/^\/presets\/([a-z0-9-]+)$/);
  return match ? match[1] : null;
}

/**
 * Handle preset routes
 *
 * @param request - HTTP request
 * @param pathname - URL pathname
 * @returns Response or null if route not matched
 */
export async function handlePresetRoutes(
  request: Request,
  pathname: string,
): Promise<Response | null> {
  // GET /presets - List presets
  if (pathname === '/presets' && request.method === 'GET') {
    return handleListPresets();
  }

  // POST /presets - Register custom preset
  if (pathname === '/presets' && request.method === 'POST') {
    return handleCreatePreset(request);
  }

  // Routes with preset name
  const presetName = extractPresetName(pathname);
  if (presetName) {
    // GET /presets/:name - Get preset details
    if (request.method === 'GET') {
      return handleGetPreset(presetName);
    }

    // DELETE /presets/:name - Remove custom preset
    if (request.method === 'DELETE') {
      return handleDeletePreset(presetName);
    }
  }

  return null;
}
