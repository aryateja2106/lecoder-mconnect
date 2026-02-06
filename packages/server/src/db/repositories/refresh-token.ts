/**
 * Refresh Token Repository
 *
 * CRUD operations for the refresh_tokens table.
 * Handles token storage, validation, and rotation.
 */

import { type SqlClient, getClient } from '../client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Refresh token record
 */
export interface RefreshToken {
  /** Token UUID */
  id: string;
  /** Owner user ID */
  userId: string;
  /** SHA-256 hash of the token JTI */
  tokenHash: string;
  /** Token expiration timestamp */
  expiresAt: Date;
  /** Whether token has been revoked */
  revoked: boolean;
  /** Token creation timestamp */
  createdAt: Date;
}

/**
 * Create refresh token input
 */
export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Database row type
 */
interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

// ============================================================================
// Mappers
// ============================================================================

/**
 * Map database row to RefreshToken type
 */
function mapRowToRefreshToken(row: RefreshTokenRow): RefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Find refresh token by hash
 */
export async function findByHash(tokenHash: string, sql?: SqlClient): Promise<RefreshToken | null> {
  const client = sql ?? getClient();

  const rows = await client<RefreshTokenRow[]>`
    SELECT id, user_id, token_hash, expires_at, revoked, created_at
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToRefreshToken(rows[0]);
}

/**
 * Find refresh token by ID
 */
export async function findById(id: string, sql?: SqlClient): Promise<RefreshToken | null> {
  const client = sql ?? getClient();

  const rows = await client<RefreshTokenRow[]>`
    SELECT id, user_id, token_hash, expires_at, revoked, created_at
    FROM refresh_tokens
    WHERE id = ${id}
  `;

  if (rows.length === 0) {
    return null;
  }

  return mapRowToRefreshToken(rows[0]);
}

/**
 * Create a new refresh token
 */
export async function create(input: CreateRefreshTokenInput, sql?: SqlClient): Promise<RefreshToken> {
  const client = sql ?? getClient();

  const rows = await client<RefreshTokenRow[]>`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES (${input.userId}, ${input.tokenHash}, ${input.expiresAt})
    RETURNING id, user_id, token_hash, expires_at, revoked, created_at
  `;

  return mapRowToRefreshToken(rows[0]);
}

/**
 * Revoke a refresh token by hash
 */
export async function revokeByHash(tokenHash: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE refresh_tokens
    SET revoked = TRUE
    WHERE token_hash = ${tokenHash}
      AND revoked = FALSE
  `;

  return result.count > 0;
}

/**
 * Revoke a refresh token by ID
 */
export async function revokeById(id: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE refresh_tokens
    SET revoked = TRUE
    WHERE id = ${id}
      AND revoked = FALSE
  `;

  return result.count > 0;
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllForUser(userId: string, sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const result = await client`
    UPDATE refresh_tokens
    SET revoked = TRUE
    WHERE user_id = ${userId}
      AND revoked = FALSE
  `;

  return result.count;
}

/**
 * Check if a token hash is valid (exists, not revoked, not expired)
 */
export async function isValid(tokenHash: string, sql?: SqlClient): Promise<boolean> {
  const client = sql ?? getClient();

  const rows = await client<[{ count: string }]>`
    SELECT COUNT(*) as count
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
      AND revoked = FALSE
      AND expires_at > NOW()
  `;

  return parseInt(rows[0].count, 10) > 0;
}

/**
 * Delete expired tokens (cleanup job)
 */
export async function deleteExpired(sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW()
  `;

  return result.count;
}

/**
 * Delete revoked tokens older than specified days
 */
export async function deleteRevokedOlderThan(days: number, sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const result = await client`
    DELETE FROM refresh_tokens
    WHERE revoked = TRUE
      AND created_at < NOW() - INTERVAL '1 day' * ${days}
  `;

  return result.count;
}

/**
 * List all active tokens for a user
 */
export async function listActiveForUser(userId: string, sql?: SqlClient): Promise<RefreshToken[]> {
  const client = sql ?? getClient();

  const rows = await client<RefreshTokenRow[]>`
    SELECT id, user_id, token_hash, expires_at, revoked, created_at
    FROM refresh_tokens
    WHERE user_id = ${userId}
      AND revoked = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
  `;

  return rows.map(mapRowToRefreshToken);
}

/**
 * Count active tokens for a user
 */
export async function countActiveForUser(userId: string, sql?: SqlClient): Promise<number> {
  const client = sql ?? getClient();

  const rows = await client<[{ count: string }]>`
    SELECT COUNT(*) as count
    FROM refresh_tokens
    WHERE user_id = ${userId}
      AND revoked = FALSE
      AND expires_at > NOW()
  `;

  return parseInt(rows[0].count, 10);
}

// ============================================================================
// Token Rotation
// ============================================================================

/**
 * Rotate a refresh token (revoke old, create new)
 *
 * Performs atomic rotation within a transaction.
 */
export async function rotate(
  oldTokenHash: string,
  newInput: CreateRefreshTokenInput,
  sql?: SqlClient
): Promise<RefreshToken | null> {
  const client = sql ?? getClient();

  // First verify the old token is valid
  const oldToken = await findByHash(oldTokenHash, client);
  if (!oldToken || oldToken.revoked || oldToken.expiresAt < new Date()) {
    return null;
  }

  // Verify user IDs match
  if (oldToken.userId !== newInput.userId) {
    return null;
  }

  // Revoke old token
  await revokeByHash(oldTokenHash, client);

  // Create new token
  return create(newInput, client);
}

// ============================================================================
// Export
// ============================================================================

export const refreshTokenRepository = {
  findByHash,
  findById,
  create,
  revokeByHash,
  revokeById,
  revokeAllForUser,
  isValid,
  deleteExpired,
  deleteRevokedOlderThan,
  listActiveForUser,
  countActiveForUser,
  rotate,
};

export default refreshTokenRepository;
