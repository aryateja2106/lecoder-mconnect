/**
 * JWT Token Management
 *
 * Provides JWT token creation, validation, and refresh using the `jose` library.
 * Implements secure token rotation for refresh tokens.
 */

import * as jose from 'jose';
import type { AccessTokenClaims, RefreshTokenClaims, TokenPair, User, OAuthProvider } from '@lecoder/shared';

// ============================================================================
// Configuration
// ============================================================================

/**
 * JWT configuration options
 */
export interface JWTConfig {
  /** Secret key for signing tokens (min 32 bytes recommended) */
  secret: string;
  /** Token issuer (default: 'mconnect') */
  issuer?: string;
  /** Access token expiration (default: '15m') */
  accessTokenExpiry?: string;
  /** Refresh token expiration (default: '30d') */
  refreshTokenExpiry?: string;
  /** Algorithm to use (default: 'HS256') */
  algorithm?: 'HS256' | 'HS384' | 'HS512';
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<JWTConfig, 'secret'>> = {
  issuer: 'mconnect',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '30d',
  algorithm: 'HS256',
};

/**
 * Parse duration string to seconds
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Invalid duration unit: ${unit}`);
  }
}

// ============================================================================
// JWT Service
// ============================================================================

/**
 * JWT service for token management
 */
export class JWTService {
  private readonly secret: Uint8Array;
  private readonly config: Required<Omit<JWTConfig, 'secret'>>;

  constructor(config: JWTConfig) {
    if (!config.secret || config.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters');
    }

    this.secret = new TextEncoder().encode(config.secret);
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Validate duration formats eagerly
    parseDuration(this.config.accessTokenExpiry);
    parseDuration(this.config.refreshTokenExpiry);
  }

  /**
   * Generate a unique token ID (jti)
   */
  private generateJti(): string {
    return crypto.randomUUID();
  }

  /**
   * Create access token for a user
   */
  async createAccessToken(user: User): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = parseDuration(this.config.accessTokenExpiry);

    const claims: Omit<AccessTokenClaims, 'iat' | 'exp'> = {
      iss: 'mconnect',
      sub: user.id,
      email: user.email,
      name: user.name,
      provider: user.provider,
      jti: this.generateJti(),
    };

    const token = await new jose.SignJWT(claims as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: this.config.algorithm })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(this.secret);

    return token;
  }

  /**
   * Create refresh token for a user
   */
  async createRefreshToken(userId: string): Promise<{ token: string; jti: string; expiresAt: Date }> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = parseDuration(this.config.refreshTokenExpiry);
    const jti = this.generateJti();

    const claims: Omit<RefreshTokenClaims, 'iat' | 'exp'> = {
      iss: 'mconnect',
      sub: userId,
      jti,
    };

    const token = await new jose.SignJWT(claims as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: this.config.algorithm })
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(this.secret);

    const expiresAt = new Date((now + expiresIn) * 1000);

    return { token, jti, expiresAt };
  }

  /**
   * Create a token pair (access + refresh) for a user
   */
  async createTokenPair(user: User): Promise<TokenPair & { refreshTokenJti: string; refreshTokenExpiresAt: Date }> {
    const accessToken = await this.createAccessToken(user);
    const { token: refreshToken, jti, expiresAt } = await this.createRefreshToken(user.id);
    const expiresIn = parseDuration(this.config.accessTokenExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      refreshTokenJti: jti,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /**
   * Validate and decode an access token
   *
   * @returns Token claims if valid, null if invalid or expired
   */
  async validateAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        issuer: this.config.issuer,
      });

      // Validate required claims
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.name !== 'string' ||
        typeof payload.provider !== 'string' ||
        typeof payload.jti !== 'string'
      ) {
        return null;
      }

      return {
        iss: 'mconnect',
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        provider: payload.provider as OAuthProvider,
        iat: payload.iat ?? 0,
        exp: payload.exp ?? 0,
        jti: payload.jti,
      };
    } catch (error) {
      // Token is invalid, expired, or signature mismatch
      if (error instanceof jose.errors.JWTExpired) {
        return null;
      }
      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        return null;
      }
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        return null;
      }
      // Log unexpected errors but still return null
      console.error('Unexpected JWT validation error:', error);
      return null;
    }
  }

  /**
   * Validate and decode a refresh token
   *
   * @returns Token claims if valid, null if invalid or expired
   */
  async validateRefreshToken(token: string): Promise<RefreshTokenClaims | null> {
    try {
      const { payload } = await jose.jwtVerify(token, this.secret, {
        issuer: this.config.issuer,
      });

      // Validate required claims
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string'
      ) {
        return null;
      }

      return {
        iss: 'mconnect',
        sub: payload.sub,
        iat: payload.iat ?? 0,
        exp: payload.exp ?? 0,
        jti: payload.jti,
      };
    } catch (error) {
      // Token is invalid, expired, or signature mismatch
      if (error instanceof jose.errors.JWTExpired) {
        return null;
      }
      if (error instanceof jose.errors.JWTClaimValidationFailed) {
        return null;
      }
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        return null;
      }
      // Log unexpected errors but still return null
      console.error('Unexpected JWT validation error:', error);
      return null;
    }
  }

  /**
   * Create a development token for testing
   * Only works when DEV_AUTH_BYPASS is enabled
   */
  async createDevToken(userId: string, email: string, name: string): Promise<TokenPair> {
    if (process.env.DEV_AUTH_BYPASS !== 'true') {
      throw new Error('Dev tokens are only available when DEV_AUTH_BYPASS=true');
    }

    const user: User = {
      id: userId,
      email,
      name,
      provider: 'github',
      providerId: `dev-${userId}`,
      createdAt: new Date(),
    };

    const { accessToken, refreshToken, expiresIn } = await this.createTokenPair(user);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Get the access token expiration in seconds
   */
  getAccessTokenExpirySeconds(): number {
    return parseDuration(this.config.accessTokenExpiry);
  }

  /**
   * Get the refresh token expiration in seconds
   */
  getRefreshTokenExpirySeconds(): number {
    return parseDuration(this.config.refreshTokenExpiry);
  }
}

// ============================================================================
// Token Hash Utilities
// ============================================================================

/**
 * Hash a refresh token JTI for storage
 * Uses SHA-256 to hash the JTI for database storage
 */
export async function hashTokenJti(jti: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(jti);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Singleton Instance
// ============================================================================

let jwtServiceInstance: JWTService | null = null;

/**
 * Get the global JWT service instance
 *
 * Creates the service on first call using environment variables.
 */
export function getJWTService(): JWTService {
  if (!jwtServiceInstance) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    jwtServiceInstance = new JWTService({
      secret,
      accessTokenExpiry: process.env.JWT_ACCESS_EXPIRES ?? '15m',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES ?? '30d',
    });
  }

  return jwtServiceInstance;
}

/**
 * Initialize the JWT service with custom configuration
 */
export function initializeJWTService(config: JWTConfig): JWTService {
  jwtServiceInstance = new JWTService(config);
  return jwtServiceInstance;
}

/**
 * Reset the JWT service (for testing)
 */
export function resetJWTService(): void {
  jwtServiceInstance = null;
}

// ============================================================================
// Export
// ============================================================================

export default {
  JWTService,
  getJWTService,
  initializeJWTService,
  resetJWTService,
  hashTokenJti,
};
