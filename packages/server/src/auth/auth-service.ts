/**
 * Auth Service
 *
 * High-level authentication service that combines JWT management
 * with refresh token storage and rotation.
 */

import type { AccessTokenClaims, TokenPair, User } from '@lecoder/shared';
import { JWTService, hashTokenJti, type JWTConfig } from './jwt.js';
import { refreshTokenRepository, userRepository } from '../db/repositories/index.js';
import { withTransaction, type SqlClient } from '../db/client.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Auth service configuration
 */
export interface AuthServiceConfig {
  jwt: JWTConfig;
  /** Maximum refresh tokens per user (default: 5) */
  maxRefreshTokensPerUser?: number;
}

/**
 * Token refresh result
 */
export interface RefreshResult {
  tokenPair: TokenPair;
  user: User;
}

/**
 * Auth error types
 */
export type AuthErrorCode =
  | 'INVALID_TOKEN'
  | 'EXPIRED_TOKEN'
  | 'REVOKED_TOKEN'
  | 'USER_NOT_FOUND'
  | 'TOKEN_ROTATION_FAILED';

/**
 * Auth error class
 */
export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ============================================================================
// Auth Service
// ============================================================================

/**
 * Authentication service
 */
export class AuthService {
  private readonly jwtService: JWTService;
  private readonly maxRefreshTokensPerUser: number;

  constructor(config: AuthServiceConfig) {
    this.jwtService = new JWTService(config.jwt);
    this.maxRefreshTokensPerUser = config.maxRefreshTokensPerUser ?? 5;
  }

  /**
   * Create a new token pair for a user
   *
   * Stores the refresh token hash in the database.
   */
  async createTokenPair(user: User, sql?: SqlClient): Promise<TokenPair> {
    // Create token pair
    const { accessToken, refreshToken, expiresIn, refreshTokenJti, refreshTokenExpiresAt } =
      await this.jwtService.createTokenPair(user);

    // Hash the JTI for storage
    const tokenHash = await hashTokenJti(refreshTokenJti);

    // Store refresh token hash
    await refreshTokenRepository.create(
      {
        userId: user.id,
        tokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
      sql
    );

    // Enforce max tokens per user (cleanup old tokens)
    await this.enforceMaxTokens(user.id, sql);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Validate an access token
   *
   * @returns Token claims if valid
   * @throws AuthError if invalid
   */
  async validateAccessToken(token: string): Promise<AccessTokenClaims> {
    const claims = await this.jwtService.validateAccessToken(token);

    if (!claims) {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired access token');
    }

    return claims;
  }

  /**
   * Refresh a token pair using a refresh token
   *
   * Implements token rotation:
   * 1. Validates the refresh token
   * 2. Checks if the token hash exists and is not revoked
   * 3. Creates a new token pair
   * 4. Revokes the old refresh token
   * 5. Stores the new refresh token hash
   *
   * @returns New token pair and user
   * @throws AuthError if refresh fails
   */
  async refreshToken(refreshTokenStr: string): Promise<RefreshResult> {
    // Validate the refresh token JWT
    const claims = await this.jwtService.validateRefreshToken(refreshTokenStr);

    if (!claims) {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired refresh token');
    }

    // Hash the JTI to look up in database
    const oldTokenHash = await hashTokenJti(claims.jti);

    // Use transaction for atomic rotation
    return withTransaction(async (sql) => {
      // Check if token exists and is valid
      const tokenRecord = await refreshTokenRepository.findByHash(oldTokenHash, sql);

      if (!tokenRecord) {
        throw new AuthError('INVALID_TOKEN', 'Refresh token not found');
      }

      if (tokenRecord.revoked) {
        // Token reuse detected - revoke all tokens for this user as a security measure
        await refreshTokenRepository.revokeAllForUser(tokenRecord.userId, sql);
        throw new AuthError('REVOKED_TOKEN', 'Refresh token has been revoked');
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new AuthError('EXPIRED_TOKEN', 'Refresh token has expired');
      }

      // Verify user IDs match
      if (tokenRecord.userId !== claims.sub) {
        throw new AuthError('INVALID_TOKEN', 'Token user mismatch');
      }

      // Get the user
      const user = await userRepository.findById(claims.sub, sql);

      if (!user) {
        throw new AuthError('USER_NOT_FOUND', 'User not found');
      }

      // Create new token pair
      const { accessToken, refreshToken: newRefreshToken, expiresIn, refreshTokenJti, refreshTokenExpiresAt } =
        await this.jwtService.createTokenPair(user);

      // Hash the new JTI
      const newTokenHash = await hashTokenJti(refreshTokenJti);

      // Rotate: revoke old, create new (atomic)
      const rotated = await refreshTokenRepository.rotate(
        oldTokenHash,
        {
          userId: user.id,
          tokenHash: newTokenHash,
          expiresAt: refreshTokenExpiresAt,
        },
        sql
      );

      if (!rotated) {
        throw new AuthError('TOKEN_ROTATION_FAILED', 'Failed to rotate refresh token');
      }

      // Enforce max tokens per user
      await this.enforceMaxTokens(user.id, sql);

      return {
        tokenPair: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn,
        },
        user,
      };
    });
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(refreshTokenStr: string): Promise<void> {
    const claims = await this.jwtService.validateRefreshToken(refreshTokenStr);

    if (!claims) {
      // Token is already invalid, nothing to revoke
      return;
    }

    const tokenHash = await hashTokenJti(claims.jti);
    await refreshTokenRepository.revokeByHash(tokenHash);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    return refreshTokenRepository.revokeAllForUser(userId);
  }

  /**
   * Create a development token (for testing)
   */
  async createDevToken(userId: string, email: string, name: string): Promise<TokenPair> {
    if (process.env.DEV_AUTH_BYPASS !== 'true') {
      throw new AuthError('INVALID_TOKEN', 'Dev tokens are only available in development mode');
    }

    return this.jwtService.createDevToken(userId, email, name);
  }

  /**
   * Enforce maximum refresh tokens per user
   *
   * Keeps only the most recent N tokens, revokes older ones.
   */
  private async enforceMaxTokens(userId: string, sql?: SqlClient): Promise<void> {
    const activeTokens = await refreshTokenRepository.listActiveForUser(userId, sql);

    if (activeTokens.length > this.maxRefreshTokensPerUser) {
      // Revoke oldest tokens (keep most recent)
      const tokensToRevoke = activeTokens.slice(this.maxRefreshTokensPerUser);

      for (const token of tokensToRevoke) {
        await refreshTokenRepository.revokeById(token.id, sql);
      }
    }
  }

  /**
   * Get JWT service for direct access if needed
   */
  getJWTService(): JWTService {
    return this.jwtService;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let authServiceInstance: AuthService | null = null;

/**
 * Get the global auth service instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    authServiceInstance = new AuthService({
      jwt: {
        secret: jwtSecret,
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRES ?? '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES ?? '30d',
      },
    });
  }

  return authServiceInstance;
}

/**
 * Initialize the auth service with custom configuration
 */
export function initializeAuthService(config: AuthServiceConfig): AuthService {
  authServiceInstance = new AuthService(config);
  return authServiceInstance;
}

/**
 * Reset the auth service (for testing)
 */
export function resetAuthService(): void {
  authServiceInstance = null;
}

// ============================================================================
// Export
// ============================================================================

export default {
  AuthService,
  AuthError,
  getAuthService,
  initializeAuthService,
  resetAuthService,
};
