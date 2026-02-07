/**
 * Session Repository
 *
 * CRUD operations for the sessions table.
 */

import type { Session, SessionState, SessionInfo, AgentSessionConfig } from '@lecoder/shared';
import { type SqlClient, getClient } from '../client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Session creation data
 */
export interface CreateSessionInput {
  userId: string;
  agentConfig: AgentSessionConfig;
  workingDirectory: string;
  state?: SessionState;
}

/**
 * Session update data
 */
export interface UpdateSessionInput {
  state?: SessionState;
  agentConfig?: AgentSessionConfig;
  lastActivityAt?: Date;
  completedAt?: Date;
}

/**
 * Session query filters
 */
export interface SessionFilter {
  userId?: string;
  state?: SessionState | SessionState[];
  limit?: number;
  offset?: number;
}

/**
 * Database row type
 */
interface SessionRow {
  id: string;
  user_id: string;
  state: string;
  agent_config: AgentSessionConfig;
  working_directory: string;
  created_at: Date;
  last_activity_at: Date;
  completed_at: Date | null;
}

/**
 * Session info row (with agent count)
 */
interface SessionInfoRow extends SessionRow {
  agent_count: string;
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map database row to Session type
 */
function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    state: row.state as SessionState,
    agentConfig: row.agent_config,
    workingDirectory: row.working_directory,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at ?? undefined,
  };
}

/**
 * Map database row to SessionInfo type
 */
function mapRowToSessionInfo(row: SessionInfoRow): SessionInfo {
  return {
    id: row.id,
    state: row.state as SessionState,
    workingDirectory: row.working_directory,
    agentCount: Number.parseInt(row.agent_count, 10),
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Find session by ID
 */
export async function findById(id: string, sql?: SqlClient): Promise<Session | null> {
  const client = sql ?? getClient();

  const rows = await client<SessionRow[]>`
    SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
    FROM sessions
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToSession(rows[0]);
}

/**
 * Find session by ID with user ownership check
 */
export async function findByIdForUser(
  id: string,
  userId: string,
  sql?: SqlClient
): Promise<Session | null> {
  const client = sql ?? getClient();

  const rows = await client<SessionRow[]>`
    SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
    FROM sessions
    WHERE id = ${id} AND user_id = ${userId}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToSession(rows[0]);
}

/**
 * Create a new session
 */
export async function create(input: CreateSessionInput, sql?: SqlClient): Promise<Session> {
  const client = sql ?? getClient();

  const rows = await client<SessionRow[]>`
    INSERT INTO sessions (user_id, state, agent_config, working_directory)
    VALUES (
      ${input.userId},
      ${input.state ?? 'running'},
      ${JSON.stringify(input.agentConfig)},
      ${input.workingDirectory}
    )
    RETURNING id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
  `;

  return mapRowToSession(rows[0]);
}

/**
 * Update session by ID
 */
export async function update(
  id: string,
  input: UpdateSessionInput,
  sql?: SqlClient
): Promise<Session | null> {
  const client = sql ?? getClient();

  // Handle state transition to completed
  const completedAt =
    input.state === 'completed' && input.completedAt === undefined ? new Date() : input.completedAt;

  const rows = await client<SessionRow[]>`
    UPDATE sessions
    SET
      state = COALESCE(${input.state ?? null}, state),
      agent_config = COALESCE(${input.agentConfig ? JSON.stringify(input.agentConfig) : null}, agent_config),
      last_activity_at = COALESCE(${input.lastActivityAt ?? null}, NOW()),
      completed_at = COALESCE(${completedAt ?? null}, completed_at)
    WHERE id = ${id}
    RETURNING id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToSession(rows[0]);
}

/**
 * Update session state
 */
export async function updateState(
  id: string,
  state: SessionState,
  sql?: SqlClient
): Promise<boolean> {
  const client = sql ?? getClient();

  const completedAt = state === 'completed' ? new Date() : null;

  const result = await client`
    UPDATE sessions
    SET
      state = ${state},
      last_activity_at = NOW(),
      completed_at = COALESCE(${completedAt}, completed_at)
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * Update last activity time
 */
export async function touch(id: string, sql?: SqlClient): Promise<void> {
  const client = sql ?? getClient();

  await client`
    UPDATE sessions
    SET last_activity_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * Delete session by ID
 */
export async function deleteById(id: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM sessions
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * List sessions with filters
 */
export async function list(filter: SessionFilter = {}, sql?: SqlClient): Promise<Session[]> {
  const client = sql ?? getClient();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  let rows: SessionRow[];

  if (filter.userId && filter.state) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    rows = await client<SessionRow[]>`
      SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
      FROM sessions
      WHERE user_id = ${filter.userId} AND state = ANY(${states})
      ORDER BY last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else if (filter.userId) {
    rows = await client<SessionRow[]>`
      SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
      FROM sessions
      WHERE user_id = ${filter.userId}
      ORDER BY last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else if (filter.state) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    rows = await client<SessionRow[]>`
      SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
      FROM sessions
      WHERE state = ANY(${states})
      ORDER BY last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else {
    rows = await client<SessionRow[]>`
      SELECT id, user_id, state, agent_config, working_directory, created_at, last_activity_at, completed_at
      FROM sessions
      ORDER BY last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  return rows.map(mapRowToSession);
}

/**
 * List sessions with agent count (for list views)
 */
export async function listInfo(
  filter: SessionFilter = {},
  sql?: SqlClient
): Promise<SessionInfo[]> {
  const client = sql ?? getClient();
  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;

  let rows: SessionInfoRow[];

  if (filter.userId && filter.state) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    rows = await client<SessionInfoRow[]>`
      SELECT
        s.id, s.user_id, s.state, s.agent_config, s.working_directory,
        s.created_at, s.last_activity_at, s.completed_at,
        COUNT(a.id) as agent_count
      FROM sessions s
      LEFT JOIN agents a ON a.session_id = s.id
      WHERE s.user_id = ${filter.userId} AND s.state = ANY(${states})
      GROUP BY s.id
      ORDER BY s.last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else if (filter.userId) {
    rows = await client<SessionInfoRow[]>`
      SELECT
        s.id, s.user_id, s.state, s.agent_config, s.working_directory,
        s.created_at, s.last_activity_at, s.completed_at,
        COUNT(a.id) as agent_count
      FROM sessions s
      LEFT JOIN agents a ON a.session_id = s.id
      WHERE s.user_id = ${filter.userId}
      GROUP BY s.id
      ORDER BY s.last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  } else {
    rows = await client<SessionInfoRow[]>`
      SELECT
        s.id, s.user_id, s.state, s.agent_config, s.working_directory,
        s.created_at, s.last_activity_at, s.completed_at,
        COUNT(a.id) as agent_count
      FROM sessions s
      LEFT JOIN agents a ON a.session_id = s.id
      GROUP BY s.id
      ORDER BY s.last_activity_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  return rows.map(mapRowToSessionInfo);
}

/**
 * Count sessions with filters
 */
export async function count(filter: Omit<SessionFilter, 'limit' | 'offset'> = {}, sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  let result: [{ count: string }];

  if (filter.userId && filter.state) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM sessions
      WHERE user_id = ${filter.userId} AND state = ANY(${states})
    `;
  } else if (filter.userId) {
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM sessions
      WHERE user_id = ${filter.userId}
    `;
  } else if (filter.state) {
    const states = Array.isArray(filter.state) ? filter.state : [filter.state];
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM sessions
      WHERE state = ANY(${states})
    `;
  } else {
    result = await client<[{ count: string }]>`
      SELECT COUNT(*) as count FROM sessions
    `;
  }

  return Number.parseInt(result[0].count, 10);
}

/**
 * Get active (running or paused) sessions for a user
 */
export async function getActiveSessions(userId: string, sql?: SqlClient): Promise<Session[]> {
  return list({ userId, state: ['running', 'paused'] }, sql);
}

/**
 * Cleanup old completed sessions
 *
 * @param olderThan - Delete completed sessions older than this date
 * @returns Number of deleted sessions
 */
export async function cleanupOld(olderThan: Date, sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM sessions
    WHERE state = 'completed' AND completed_at < ${olderThan}
  `;

  return result.count;
}

// ============================================================================
// Export
// ============================================================================

export const sessionRepository = {
  findById,
  findByIdForUser,
  create,
  update,
  updateState,
  touch,
  deleteById,
  list,
  listInfo,
  count,
  getActiveSessions,
  cleanupOld,
};

export default sessionRepository;
