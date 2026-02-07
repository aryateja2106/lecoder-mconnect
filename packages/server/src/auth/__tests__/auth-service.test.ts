/**
 * Auth Service Tests
 *
 * Tests for the high-level AuthService that combines JWT management
 * with refresh token storage and rotation.
 *
 * Note: These tests are unit tests that mock the database.
 * Integration tests with real database are in auth-service.integration.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import type { User } from '@lecoder/shared';
import {
  AuthService,
  AuthError,
  initializeAuthService,
  resetAuthService,
  getAuthService,
  type AuthServiceConfig,
} from '../auth-service.js';
import { hashTokenJti } from '../jwt.js';

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

const testConfig: AuthServiceConfig = {
  jwt: {
    secret: TEST_SECRET,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '30d',
  },
};

// ============================================================================
// Mock Setup
// ============================================================================

// We'll mock the repository modules for unit testing
// Integration tests will use real database

// ============================================================================
// AuthService Constructor Tests
// ============================================================================

describe('AuthService Constructor', () => {
  test('creates service with valid config', () => {
    const service = new AuthService(testConfig);
    expect(service).toBeDefined();
  });

  test('provides access to JWT service', () => {
    const service = new AuthService(testConfig);
    const jwtService = service.getJWTService();
    expect(jwtService).toBeDefined();
  });
});

// ============================================================================
// Access Token Validation Tests
// ============================================================================

describe('AuthService Access Token Validation', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(testConfig);
  });

  test('validates a valid access token', async () => {
    // Create a token directly via JWT service
    const jwtService = service.getJWTService();
    const accessToken = await jwtService.createAccessToken(testUser);

    // Validate through AuthService
    const claims = await service.validateAccessToken(accessToken);

    expect(claims).toBeDefined();
    expect(claims.sub).toBe(testUser.id);
    expect(claims.email).toBe(testUser.email);
  });

  test('throws AuthError for invalid token', async () => {
    await expect(service.validateAccessToken('invalid.token.here')).rejects.toThrow(AuthError);
    await expect(service.validateAccessToken('invalid.token.here')).rejects.toThrow(
      'Invalid or expired access token'
    );
  });

  test('throws AuthError with correct code for invalid token', async () => {
    try {
      await service.validateAccessToken('invalid.token.here');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe('INVALID_TOKEN');
    }
  });

  test('throws AuthError for expired token', async () => {
    // Create service with very short expiry
    const shortExpiryService = new AuthService({
      jwt: {
        secret: TEST_SECRET,
        accessTokenExpiry: '1s',
      },
    });

    const jwtService = shortExpiryService.getJWTService();
    const token = await jwtService.createAccessToken(testUser);

    // Wait for token to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(shortExpiryService.validateAccessToken(token)).rejects.toThrow(AuthError);
  });
});

// ============================================================================
// AuthError Tests
// ============================================================================

describe('AuthError', () => {
  test('creates error with code and message', () => {
    const error = new AuthError('INVALID_TOKEN', 'Token is invalid');

    expect(error.message).toBe('Token is invalid');
    expect(error.code).toBe('INVALID_TOKEN');
    expect(error.name).toBe('AuthError');
  });

  test('is instanceof Error', () => {
    const error = new AuthError('EXPIRED_TOKEN', 'Token expired');
    expect(error).toBeInstanceOf(Error);
  });

  test('supports all error codes', () => {
    const codes = [
      'INVALID_TOKEN',
      'EXPIRED_TOKEN',
      'REVOKED_TOKEN',
      'USER_NOT_FOUND',
      'TOKEN_ROTATION_FAILED',
    ] as const;

    for (const code of codes) {
      const error = new AuthError(code, 'Test message');
      expect(error.code).toBe(code);
    }
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('AuthService Singleton', () => {
  beforeEach(() => {
    resetAuthService();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES;
    delete process.env.JWT_REFRESH_EXPIRES;
  });

  afterEach(() => {
    resetAuthService();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES;
    delete process.env.JWT_REFRESH_EXPIRES;
  });

  test('initializeAuthService creates a new instance', () => {
    const service = initializeAuthService(testConfig);
    expect(service).toBeInstanceOf(AuthService);
  });

  test('getAuthService returns same instance after init', () => {
    const service1 = initializeAuthService(testConfig);
    const service2 = getAuthService();
    expect(service2).toBe(service1);
  });

  test('getAuthService uses env vars when no init', () => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.JWT_ACCESS_EXPIRES = '1h';
    process.env.JWT_REFRESH_EXPIRES = '14d';

    const service = getAuthService();
    expect(service).toBeInstanceOf(AuthService);

    const jwtService = service.getJWTService();
    expect(jwtService.getAccessTokenExpirySeconds()).toBe(60 * 60);
  });

  test('getAuthService throws if no secret configured', () => {
    expect(() => getAuthService()).toThrow('JWT_SECRET environment variable is required');
  });

  test('resetAuthService clears the singleton', () => {
    process.env.JWT_SECRET = TEST_SECRET;

    const service1 = getAuthService();
    resetAuthService();

    // Change config
    process.env.JWT_SECRET = 'different-secret-key-also-at-least-32-chars';
    const service2 = getAuthService();

    expect(service2).not.toBe(service1);
  });
});

// ============================================================================
// Dev Token Tests
// ============================================================================

describe('AuthService Dev Token', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(testConfig);
    delete process.env.DEV_AUTH_BYPASS;
  });

  afterEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });

  test('throws when DEV_AUTH_BYPASS is not set', async () => {
    await expect(
      service.createDevToken('user-1', 'dev@test.com', 'Dev')
    ).rejects.toThrow(AuthError);
  });

  test('throws AuthError with correct code when DEV_AUTH_BYPASS is not set', async () => {
    try {
      await service.createDevToken('user-1', 'dev@test.com', 'Dev');
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).code).toBe('INVALID_TOKEN');
    }
  });

  test('creates token when DEV_AUTH_BYPASS is true', async () => {
    process.env.DEV_AUTH_BYPASS = 'true';

    const tokenPair = await service.createDevToken('user-1', 'dev@test.com', 'Dev User');

    expect(tokenPair.accessToken).toBeDefined();
    expect(tokenPair.refreshToken).toBeDefined();
    expect(tokenPair.expiresIn).toBeGreaterThan(0);
  });
});

// ============================================================================
// Token Hash Consistency Tests
// ============================================================================

describe('Token Hash Consistency', () => {
  test('hashTokenJti produces consistent results', async () => {
    const jti = '550e8400-e29b-41d4-a716-446655440000';

    const hash1 = await hashTokenJti(jti);
    const hash2 = await hashTokenJti(jti);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]+$/);
  });
});
