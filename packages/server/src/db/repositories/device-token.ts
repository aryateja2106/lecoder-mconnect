/**
 * Device Token Repository
 *
 * CRUD operations for the device_tokens table (APNs push notification tokens).
 */

import { type SqlClient, getClient } from '../client.js';

// ============================================================================
// Types
// ============================================================================

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterTokenInput {
  userId: string;
  token: string;
  platform?: 'ios' | 'android' | 'web';
}

interface DeviceTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Mappers
// ============================================================================

function mapRowToDeviceToken(row: DeviceTokenRow): DeviceToken {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    platform: row.platform as DeviceToken['platform'],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Register or update a device token for a user.
 * Uses upsert to handle re-registration of the same token.
 */
export async function registerToken(
  input: RegisterTokenInput,
  sql?: SqlClient
): Promise<DeviceToken> {
  const dbClient = sql ?? getClient();

  const rows = await dbClient<DeviceTokenRow[]>`
    INSERT INTO device_tokens (user_id, token, platform, is_active, updated_at)
    VALUES (
      ${input.userId},
      ${input.token},
      ${input.platform ?? 'ios'},
      TRUE,
      NOW()
    )
    ON CONFLICT (user_id, token)
    DO UPDATE SET is_active = TRUE, updated_at = NOW()
    RETURNING id, user_id, token, platform, is_active, created_at, updated_at
  `;

  return mapRowToDeviceToken(rows[0]);
}

/**
 * Get all active device tokens for a user
 */
export async function getActiveTokensByUser(
  userId: string,
  sql?: SqlClient
): Promise<DeviceToken[]> {
  const dbClient = sql ?? getClient();

  const rows = await dbClient<DeviceTokenRow[]>`
    SELECT id, user_id, token, platform, is_active, created_at, updated_at
    FROM device_tokens
    WHERE user_id = ${userId} AND is_active = TRUE
    ORDER BY updated_at DESC
  `;

  return rows.map(mapRowToDeviceToken);
}

/**
 * Get all active tokens for multiple users (for batch notifications)
 */
export async function getActiveTokensByUsers(
  userIds: string[],
  sql?: SqlClient
): Promise<DeviceToken[]> {
  if (userIds.length === 0) return [];
  const dbClient = sql ?? getClient();

  const rows = await dbClient<DeviceTokenRow[]>`
    SELECT id, user_id, token, platform, is_active, created_at, updated_at
    FROM device_tokens
    WHERE user_id = ANY(${userIds}) AND is_active = TRUE
    ORDER BY updated_at DESC
  `;

  return rows.map(mapRowToDeviceToken);
}

/**
 * Deactivate a specific device token (e.g., when APNs reports it invalid)
 */
export async function deactivateToken(
  token: string,
  sql?: SqlClient
): Promise<boolean> {
  const dbClient = sql ?? getClient();

  const result = await dbClient`
    UPDATE device_tokens
    SET is_active = FALSE, updated_at = NOW()
    WHERE token = ${token}
  `;

  return result.count > 0;
}

/**
 * Deactivate all tokens for a user
 */
export async function deactivateUserTokens(
  userId: string,
  sql?: SqlClient
): Promise<number> {
  const dbClient = sql ?? getClient();

  const result = await dbClient`
    UPDATE device_tokens
    SET is_active = FALSE, updated_at = NOW()
    WHERE user_id = ${userId} AND is_active = TRUE
  `;

  return result.count;
}

/**
 * Remove a specific device token
 */
export async function removeToken(
  userId: string,
  token: string,
  sql?: SqlClient
): Promise<boolean> {
  const dbClient = sql ?? getClient();

  const result = await dbClient`
    DELETE FROM device_tokens
    WHERE user_id = ${userId} AND token = ${token}
  `;

  return result.count > 0;
}

/**
 * Remove inactive tokens older than a threshold
 */
export async function cleanupInactiveTokens(
  olderThanDays: number,
  sql?: SqlClient
): Promise<number> {
  const dbClient = sql ?? getClient();

  const result = await dbClient`
    DELETE FROM device_tokens
    WHERE is_active = FALSE
    AND updated_at < NOW() - INTERVAL '1 day' * ${olderThanDays}
  `;

  return result.count;
}

// ============================================================================
// Export
// ============================================================================

export const deviceTokenRepository = {
  registerToken,
  getActiveTokensByUser,
  getActiveTokensByUsers,
  deactivateToken,
  deactivateUserTokens,
  removeToken,
  cleanupInactiveTokens,
};

export default deviceTokenRepository;
