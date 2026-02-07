/**
 * User Repository
 *
 * CRUD operations for the users table.
 */

import type { User, OAuthProvider } from '@lecoder/shared';
import { type SqlClient, getClient } from '../client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * User creation data (from OAuth)
 */
export interface CreateUserInput {
  email: string;
  name?: string;
  avatarUrl?: string;
  provider: OAuthProvider;
  providerId: string;
}

/**
 * User update data
 */
export interface UpdateUserInput {
  name?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
}

/**
 * Database row type
 */
interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  provider: string;
  provider_id: string;
  created_at: Date;
  last_login_at: Date | null;
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map database row to User type
 */
function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split('@')[0],
    avatarUrl: row.avatar_url ?? undefined,
    provider: row.provider as OAuthProvider,
    providerId: row.provider_id,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Find user by ID
 */
export async function findById(id: string, sql?: SqlClient): Promise<User | null> {
  const client = sql ?? getClient();

  const rows = await client<UserRow[]>`
    SELECT id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
    FROM users
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToUser(rows[0]);
}

/**
 * Find user by email
 */
export async function findByEmail(email: string, sql?: SqlClient): Promise<User | null> {
  const client = sql ?? getClient();

  const rows = await client<UserRow[]>`
    SELECT id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
    FROM users
    WHERE email = ${email}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToUser(rows[0]);
}

/**
 * Find user by OAuth provider and provider ID
 */
export async function findByProvider(
  provider: OAuthProvider,
  providerId: string,
  sql?: SqlClient
): Promise<User | null> {
  const client = sql ?? getClient();

  const rows = await client<UserRow[]>`
    SELECT id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
    FROM users
    WHERE provider = ${provider} AND provider_id = ${providerId}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToUser(rows[0]);
}

/**
 * Create a new user
 */
export async function create(input: CreateUserInput, sql?: SqlClient): Promise<User> {
  const client = sql ?? getClient();

  const rows = await client<UserRow[]>`
    INSERT INTO users (email, name, avatar_url, provider, provider_id)
    VALUES (${input.email}, ${input.name ?? null}, ${input.avatarUrl ?? null}, ${input.provider}, ${input.providerId})
    RETURNING id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
  `;

  return mapRowToUser(rows[0]);
}

/**
 * Create or update user by OAuth provider (upsert)
 *
 * Used during OAuth login - creates user if not exists, updates if exists.
 */
export async function upsertByProvider(input: CreateUserInput, sql?: SqlClient): Promise<User> {
  const client = sql ?? getClient();

  const rows = await client<UserRow[]>`
    INSERT INTO users (email, name, avatar_url, provider, provider_id, last_login_at)
    VALUES (${input.email}, ${input.name ?? null}, ${input.avatarUrl ?? null}, ${input.provider}, ${input.providerId}, NOW())
    ON CONFLICT (provider, provider_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      avatar_url = EXCLUDED.avatar_url,
      last_login_at = NOW()
    RETURNING id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
  `;

  return mapRowToUser(rows[0]);
}

/**
 * Update user by ID
 */
export async function update(id: string, input: UpdateUserInput, sql?: SqlClient): Promise<User | null> {
  const client = sql ?? getClient();

  // Build dynamic update query
  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    updates.push(`name = $${values.length + 2}`);
    values.push(input.name);
  }
  if (input.avatarUrl !== undefined) {
    updates.push(`avatar_url = $${values.length + 2}`);
    values.push(input.avatarUrl);
  }
  if (input.lastLoginAt !== undefined) {
    updates.push(`last_login_at = $${values.length + 2}`);
    values.push(input.lastLoginAt);
  }

  if (updates.length === 0) {
    return findById(id, client);
  }

  // For simple updates, use template literals
  const rows = await client<UserRow[]>`
    UPDATE users
    SET
      name = COALESCE(${input.name ?? null}, name),
      avatar_url = COALESCE(${input.avatarUrl ?? null}, avatar_url),
      last_login_at = COALESCE(${input.lastLoginAt ?? null}, last_login_at)
    WHERE id = ${id}
    RETURNING id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToUser(rows[0]);
}

/**
 * Update last login time
 */
export async function updateLastLogin(id: string, sql?: SqlClient): Promise<void> {
  const client = sql ?? getClient();

  await client`
    UPDATE users
    SET last_login_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * Delete user by ID
 */
export async function deleteById(id: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM users
    WHERE id = ${id}
  `;

  return result.count > 0;
}

/**
 * List all users (with pagination)
 */
export async function list(
  options: { limit?: number; offset?: number } = {},
  sql?: SqlClient
): Promise<User[]> {
  const client = sql ?? getClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const rows = await client<UserRow[]>`
    SELECT id, email, name, avatar_url, provider, provider_id, created_at, last_login_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return rows.map(mapRowToUser);
}

/**
 * Count total users
 */
export async function count(sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const result = await client<[{ count: string }]>`
    SELECT COUNT(*) as count FROM users
  `;

  return Number.parseInt(result[0].count, 10);
}

// ============================================================================
// Export
// ============================================================================

export const userRepository = {
  findById,
  findByEmail,
  findByProvider,
  create,
  upsertByProvider,
  update,
  updateLastLogin,
  deleteById,
  list,
  count,
};

export default userRepository;
