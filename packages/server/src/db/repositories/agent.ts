/**
 * Agent Repository
 *
 * CRUD operations for the agents table.
 */

import type { Agent, AgentType, AgentStatus, AgentConfig } from '@lecoder/shared';
import { type SqlClient, getClient } from '../client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent creation data
 */
export interface CreateAgentInput {
  sessionId: string;
  type: AgentType;
  name: string;
  config: AgentConfig;
  containerId?: string;
  status?: AgentStatus;
}

/**
 * Agent update data
 */
export interface UpdateAgentInput {
  status?: AgentStatus;
  containerId?: string;
  startedAt?: Date;
  stoppedAt?: Date;
  exitCode?: number;
}

/**
 * Agent query filters
 */
export interface AgentFilter {
  sessionId?: string;
  status?: AgentStatus | AgentStatus[];
  type?: AgentType;
  limit?: number;
  offset?: number;
}

/**
 * Database row type
 */
interface AgentRow {
  id: string;
  session_id: string;
  type: string;
  name: string;
  status: string;
  container_id: string | null;
  config: AgentConfig;
  created_at: Date;
  started_at: Date | null;
  stopped_at: Date | null;
  exit_code: number | null;
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map database row to Agent type
 */
function mapRowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type as AgentType,
    name: row.name,
    status: row.status as AgentStatus,
    containerId: row.container_id ?? undefined,
    config: row.config,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    stoppedAt: row.stopped_at ?? undefined,
    exitCode: row.exit_code ?? undefined,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Find agent by ID
 */
export async function findById(id: string, sql?: SqlClient): Promise<Agent | null> {
  const client = sql ?? getClient();

  const rows = await client<AgentRow[]>`
    SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
    FROM agents
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToAgent(rows[0]);
}

/**
 * Find agent by container ID
 */
export async function findByContainerId(containerId: string, sql?: SqlClient): Promise<Agent | null> {
  const client = sql ?? getClient();

  const rows = await client<AgentRow[]>`
    SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
    FROM agents
    WHERE container_id = ${containerId}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToAgent(rows[0]);
}

/**
 * Create a new agent
 */
export async function create(input: CreateAgentInput, sql?: SqlClient): Promise<Agent> {
  const client = sql ?? getClient();

  const rows = await client<AgentRow[]>`
    INSERT INTO agents (session_id, type, name, status, container_id, config)
    VALUES (
      ${input.sessionId},
      ${input.type},
      ${input.name},
      ${input.status ?? 'starting'},
      ${input.containerId ?? null},
      ${JSON.stringify(input.config)}
    )
    RETURNING id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
  `;

  return mapRowToAgent(rows[0]);
}

/**
 * Update agent by ID
 */
export async function update(
  id: string,
  input: UpdateAgentInput,
  sql?: SqlClient
): Promise<Agent | null> {
  const client = sql ?? getClient();

  const rows = await client<AgentRow[]>`
    UPDATE agents
    SET
      status = COALESCE(${input.status ?? null}, status),
      container_id = COALESCE(${input.containerId ?? null}, container_id),
      started_at = COALESCE(${input.startedAt ?? null}, started_at),
      stopped_at = COALESCE(${input.stoppedAt ?? null}, stopped_at),
      exit_code = COALESCE(${input.exitCode ?? null}, exit_code)
    WHERE id = ${id}
    RETURNING id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToAgent(rows[0]);
}

/**
 * Update agent status
 */
export async function updateStatus(
  id: string,
  status: AgentStatus,
  sql?: SqlClient
): Promise<boolean> {
  const client = sql ?? getClient();

  // Auto-set started_at and stopped_at based on status
  let startedAt: Date | null = null;
  let stoppedAt: Date | null = null;

  if (status === 'running' || status === 'idle' || status === 'waiting') {
    startedAt = new Date();
  }
  if (status === 'exited' || status === 'error') {
    stoppedAt = new Date();
  }

  const result = await client`
    UPDATE agents
    SET
      status = ${status},
      started_at = COALESCE(${startedAt}, started_at),
      stopped_at = COALESCE(${stoppedAt}, stopped_at)
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * Mark agent as started
 */
export async function markStarted(id: string, containerId?: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE agents
    SET
      status = 'running',
      container_id = COALESCE(${containerId ?? null}, container_id),
      started_at = NOW()
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * Mark agent as stopped
 */
export async function markStopped(
  id: string,
  exitCode: number,
  status: 'exited' | 'error' = 'exited',
  sql?: SqlClient
): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE agents
    SET
      status = ${status},
      exit_code = ${exitCode},
      stopped_at = NOW()
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * Delete agent by ID
 */
export async function deleteById(id: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM agents
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * List agents with filters
 */
export async function list(filter: AgentFilter = {}, sql?: SqlClient): Promise<Agent[]> {
  const client = sql ?? getClient();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  let rows: AgentRow[];

  if (filter.sessionId && filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    rows = await client<AgentRow[]>`
      SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
      FROM agents
      WHERE session_id = ${filter.sessionId} AND status = ANY(${statuses})
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else if (filter.sessionId) {
    rows = await client<AgentRow[]>`
      SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
      FROM agents
      WHERE session_id = ${filter.sessionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    rows = await client<AgentRow[]>`
      SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
      FROM agents
      WHERE status = ANY(${statuses})
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else {
    rows = await client<AgentRow[]>`
      SELECT id, session_id, type, name, status, container_id, config, created_at, started_at, stopped_at, exit_code
      FROM agents
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  return rows.map(mapRowToAgent);
}

/**
 * Get all agents for a session
 */
export async function getBySession(sessionId: string, sql?: SqlClient): Promise<Agent[]> {
  return list({ sessionId }, sql);
}

/**
 * Get running agents for a session
 */
export async function getRunningBySession(sessionId: string, sql?: SqlClient): Promise<Agent[]> {
  return list({ sessionId, status: ['starting', 'running', 'idle', 'waiting'] }, sql);
}

/**
 * Count agents with filters
 */
export async function count(
  filter: Omit<AgentFilter, 'limit' | 'offset'> = {},
  sql?: SqlClient
): Promise<number> {
  const client = sql ?? getClient();

  let result: [{ count: string }];

  if (filter.sessionId && filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM agents
      WHERE session_id = ${filter.sessionId} AND status = ANY(${statuses})
    `;
  } else if (filter.sessionId) {
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM agents
      WHERE session_id = ${filter.sessionId}
    `;
  } else if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM agents
      WHERE status = ANY(${statuses})
    `;
  } else {
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM agents
    `;
  }

  return Number.parseInt(result[0].count, 10);
}

/**
 * Stop all agents for a session
 */
export async function stopAllForSession(
  sessionId: string,
  status: 'exited' | 'error' = 'exited',
  exitCode = 0,
  sql?: SqlClient
): Promise<number> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE agents
    SET
      status = ${status},
      exit_code = ${exitCode},
      stopped_at = NOW()
    WHERE session_id = ${sessionId}
      AND status NOT IN ('exited', 'error')
  `;

  return result.count;
}

// ============================================================================
// Export
// ============================================================================

export const agentRepository = {
  findById,
  findByContainerId,
  create,
  update,
  updateStatus,
  markStarted,
  markStopped,
  deleteById,
  list,
  getBySession,
  getRunningBySession,
  count,
  stopAllForSession,
};

export default agentRepository;
