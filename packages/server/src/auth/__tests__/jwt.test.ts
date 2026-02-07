/**
 * JWT Service Tests
 *
 * Tests for JWT token creation, validation, and the JWTService class.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { User } from '@lecoder/shared';
import {
  JWTService,
  hashTokenJti,
  initializeJWTService,
  resetJWTService,
  getJWTService,
  type JWTConfig,
} from '../jwt.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SECRET = 'test-secret-key-must-be-at-least-32-chars-long';

const testUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  name: 'Test User',
  provider: 'github',
  providerId: 'gh-12345',
  createdAt: new Date('2024-01-01'),
};

const testConfig: JWTConfig = {
  secret: TEST_SECRET,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '30d',
};

// ============================================================================
// JWTService Constructor Tests
// ============================================================================

describe('JWTService Constructor', () => {
  test('creates service with valid config', () => {
    const service = new JWTService(testConfig);
    expect(service).toBeDefined();
  });

  test('throws error if secret is too short', () => {
    expect(() => new JWTService({ secret: 'short' })).toThrow(
      'JWT secret must be at least 32 characters'
    );
  });

  test('throws error if secret is empty', () => {
    expect(() => new JWTService({ secret: '' })).toThrow(
      'JWT secret must be at least 32 characters'
    );
  });

  test('uses default expiry values if not provided', () => {
    const service = new JWTService({ secret: TEST_SECRET });
    expect(service.getAccessTokenExpirySeconds()).toBe(15 * 60); // 15 minutes
    expect(service.getRefreshTokenExpirySeconds()).toBe(30 * 24 * 60 * 60); // 30 days
  });

  test('uses custom expiry values when provided', () => {
    const service = new JWTService({
      secret: TEST_SECRET,
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '7d',
    });
    expect(service.getAccessTokenExpirySeconds()).toBe(60 * 60); // 1 hour
    expect(service.getRefreshTokenExpirySeconds()).toBe(7 * 24 * 60 * 60); // 7 days
  });
});

// ============================================================================
// Access Token Tests
// ============================================================================

describe('Access Token Creation and Validation', () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService(testConfig);
  });

  test('creates a valid access token', async () => {
    const token = await service.createAccessToken(testUser);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('validates a valid access token', async () => {
    const token = await service.createAccessToken(testUser);
    const claims = await service.validateAccessToken(token);

    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe(testUser.id);
    expect(claims!.email).toBe(testUser.email);
    expect(claims!.name).toBe(testUser.name);
    expect(claims!.provider).toBe(testUser.provider);
    expect(claims!.iss).toBe('mconnect');
    expect(typeof claims!.jti).toBe('string');
    expect(claims!.iat).toBeGreaterThan(0);
    expect(claims!.exp).toBeGreaterThan(claims!.iat);
  });

  test('returns null for invalid token', async () => {
    const claims = await service.validateAccessToken('invalid.token.here');
    expect(claims).toBeNull();
  });

  test('returns null for malformed token', async () => {
    const claims = await service.validateAccessToken('not-a-jwt');
    expect(claims).toBeNull();
  });

  test('returns null for token signed with different secret', async () => {
    const otherService = new JWTService({
      secret: 'different-secret-key-also-32-chars',
    });

    const token = await otherService.createAccessToken(testUser);
    const claims = await service.validateAccessToken(token);

    expect(claims).toBeNull();
  });

  test('returns null for expired token', async () => {
    // Create a service with very short expiry
    const shortExpiryService = new JWTService({
      secret: TEST_SECRET,
      accessTokenExpiry: '1s', // 1 second
    });

    const token = await shortExpiryService.createAccessToken(testUser);

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const claims = await shortExpiryService.validateAccessToken(token);
    expect(claims).toBeNull();
  });

  test('generates unique JTI for each token', async () => {
    const token1 = await service.createAccessToken(testUser);
    const token2 = await service.createAccessToken(testUser);

    const claims1 = await service.validateAccessToken(token1);
    const claims2 = await service.validateAccessToken(token2);

    expect(claims1!.jti).not.toBe(claims2!.jti);
  });
});

// ============================================================================
// Refresh Token Tests
// ============================================================================

describe('Refresh Token Creation and Validation', () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService(testConfig);
  });

  test('creates a valid refresh token', async () => {
    const { token, jti, expiresAt } = await service.createRefreshToken(testUser.id);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
    expect(jti).toBeDefined();
    expect(typeof jti).toBe('string');
    expect(expiresAt).toBeInstanceOf(Date);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test('validates a valid refresh token', async () => {
    const { token, jti } = await service.createRefreshToken(testUser.id);
    const claims = await service.validateRefreshToken(token);

    expect(claims).not.toBeNull();
    expect(claims!.sub).toBe(testUser.id);
    expect(claims!.jti).toBe(jti);
    expect(claims!.iss).toBe('mconnect');
    expect(claims!.iat).toBeGreaterThan(0);
    expect(claims!.exp).toBeGreaterThan(claims!.iat);
  });

  test('returns null for invalid refresh token', async () => {
    const claims = await service.validateRefreshToken('invalid.token.here');
    expect(claims).toBeNull();
  });

  test('refresh token expiry is later than access token', async () => {
    const { token: refreshToken } = await service.createRefreshToken(testUser.id);
    const accessToken = await service.createAccessToken(testUser);

    const refreshClaims = await service.validateRefreshToken(refreshToken);
    const accessClaims = await service.validateAccessToken(accessToken);

    expect(refreshClaims!.exp).toBeGreaterThan(accessClaims!.exp);
  });
});

// ============================================================================
// Token Pair Tests
// ============================================================================

describe('Token Pair Creation', () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService(testConfig);
  });

  test('creates both access and refresh tokens', async () => {
    const result = await service.createTokenPair(testUser);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(15 * 60); // 15 minutes in seconds
    expect(result.refreshTokenJti).toBeDefined();
    expect(result.refreshTokenExpiresAt).toBeInstanceOf(Date);
  });

  test('access token contains user info', async () => {
    const { accessToken } = await service.createTokenPair(testUser);
    const claims = await service.validateAccessToken(accessToken);

    expect(claims!.sub).toBe(testUser.id);
    expect(claims!.email).toBe(testUser.email);
    expect(claims!.name).toBe(testUser.name);
  });

  test('refresh token JTI matches returned value', async () => {
    const { refreshToken, refreshTokenJti } = await service.createTokenPair(testUser);
    const claims = await service.validateRefreshToken(refreshToken);

    expect(claims!.jti).toBe(refreshTokenJti);
  });
});

// ============================================================================
// Token Hash Utility Tests
// ============================================================================

describe('hashTokenJti', () => {
  test('returns a 64-character hex string', async () => {
    const hash = await hashTokenJti('test-jti-123');

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64); // SHA-256 = 256 bits = 64 hex chars
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  test('produces consistent hashes for same input', async () => {
    const hash1 = await hashTokenJti('same-jti');
    const hash2 = await hashTokenJti('same-jti');

    expect(hash1).toBe(hash2);
  });

  test('produces different hashes for different inputs', async () => {
    const hash1 = await hashTokenJti('jti-1');
    const hash2 = await hashTokenJti('jti-2');

    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('JWT Service Singleton', () => {
  beforeEach(() => {
    resetJWTService();
    // Clear env vars
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES;
    delete process.env.JWT_REFRESH_EXPIRES;
  });

  afterEach(() => {
    resetJWTService();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES;
    delete process.env.JWT_REFRESH_EXPIRES;
  });

  test('initializeJWTService creates a new instance', () => {
    const service = initializeJWTService(testConfig);
    expect(service).toBeInstanceOf(JWTService);
  });

  test('getJWTService returns same instance after init', () => {
    const service1 = initializeJWTService(testConfig);
    const service2 = getJWTService();
    expect(service2).toBe(service1);
  });

  test('getJWTService uses env vars when no init', () => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.JWT_ACCESS_EXPIRES = '1h';
    process.env.JWT_REFRESH_EXPIRES = '14d';

    const service = getJWTService();

    expect(service).toBeInstanceOf(JWTService);
    expect(service.getAccessTokenExpirySeconds()).toBe(60 * 60); // 1 hour
    expect(service.getRefreshTokenExpirySeconds()).toBe(14 * 24 * 60 * 60); // 14 days
  });

  test('getJWTService throws if no secret configured', () => {
    expect(() => getJWTService()).toThrow('JWT_SECRET environment variable is required');
  });

  test('resetJWTService clears the singleton', () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const service1 = getJWTService();
    resetJWTService();

    // Change secret
    process.env.JWT_SECRET = 'different-secret-key-also-at-least-32-chars';
    const service2 = getJWTService();

    // Should be different instances
    expect(service2).not.toBe(service1);
  });
});

// ============================================================================
// Dev Token Tests
// ============================================================================

describe('Dev Token Creation', () => {
  let service: JWTService;

  beforeEach(() => {
    service = new JWTService(testConfig);
    // Ensure dev mode is disabled by default
    delete process.env.DEV_AUTH_BYPASS;
  });

  afterEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });

  test('throws when DEV_AUTH_BYPASS is not set', async () => {
    await expect(service.createDevToken('user-1', 'dev@test.com', 'Dev')).rejects.toThrow(
      'Dev tokens are only available when DEV_AUTH_BYPASS=true'
    );
  });

  test('throws when DEV_AUTH_BYPASS is false', async () => {
    process.env.DEV_AUTH_BYPASS = 'false';

    await expect(service.createDevToken('user-1', 'dev@test.com', 'Dev')).rejects.toThrow(
      'Dev tokens are only available when DEV_AUTH_BYPASS=true'
    );
  });

  test('creates token when DEV_AUTH_BYPASS is true', async () => {
    process.env.DEV_AUTH_BYPASS = 'true';

    const tokenPair = await service.createDevToken('user-1', 'dev@test.com', 'Dev User');

    expect(tokenPair.accessToken).toBeDefined();
    expect(tokenPair.refreshToken).toBeDefined();
    expect(tokenPair.expiresIn).toBeGreaterThan(0);

    // Validate the access token
    const claims = await service.validateAccessToken(tokenPair.accessToken);
    expect(claims!.sub).toBe('user-1');
    expect(claims!.email).toBe('dev@test.com');
    expect(claims!.name).toBe('Dev User');
    expect(claims!.provider).toBe('github');
  });
});

// ============================================================================
// Duration Parsing Tests
// ============================================================================

describe('Duration Parsing', () => {
  test('parses seconds correctly', () => {
    const service = new JWTService({
      secret: TEST_SECRET,
      accessTokenExpiry: '30s',
    });
    expect(service.getAccessTokenExpirySeconds()).toBe(30);
  });

  test('parses minutes correctly', () => {
    const service = new JWTService({
      secret: TEST_SECRET,
      accessTokenExpiry: '5m',
    });
    expect(service.getAccessTokenExpirySeconds()).toBe(5 * 60);
  });

  test('parses hours correctly', () => {
    const service = new JWTService({
      secret: TEST_SECRET,
      accessTokenExpiry: '2h',
    });
    expect(service.getAccessTokenExpirySeconds()).toBe(2 * 60 * 60);
  });

  test('parses days correctly', () => {
    const service = new JWTService({
      secret: TEST_SECRET,
      refreshTokenExpiry: '7d',
    });
    expect(service.getRefreshTokenExpirySeconds()).toBe(7 * 24 * 60 * 60);
  });

  test('throws for invalid duration format', () => {
    expect(
      () =>
        new JWTService({
          secret: TEST_SECRET,
          accessTokenExpiry: 'invalid',
        })
    ).toThrow('Invalid duration format: invalid');
  });
});
