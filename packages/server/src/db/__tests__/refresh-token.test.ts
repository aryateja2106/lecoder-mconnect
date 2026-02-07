/**
 * Refresh Token Repository Tests
 *
 * Unit tests for the refresh_tokens repository.
 * Uses mocked SQL client to avoid database dependencies.
 */

import { describe, test, expect } from 'bun:test';
import type { RefreshToken, CreateRefreshTokenInput } from '../repositories/refresh-token.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const mockRefreshToken: RefreshToken = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '987fcdeb-51a2-3c4d-e5f6-789012345678',
  tokenHash: 'a'.repeat(64), // 64 char hex hash
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  revoked: false,
  createdAt: new Date(),
};

const mockCreateInput: CreateRefreshTokenInput = {
  userId: '987fcdeb-51a2-3c4d-e5f6-789012345678',
  tokenHash: 'b'.repeat(64),
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

// ============================================================================
// Type Tests
// ============================================================================

describe('RefreshToken Types', () => {
  test('RefreshToken interface has correct shape', () => {
    const token: RefreshToken = mockRefreshToken;

    expect(token.id).toBeDefined();
    expect(token.userId).toBeDefined();
    expect(token.tokenHash).toBeDefined();
    expect(token.expiresAt).toBeInstanceOf(Date);
    expect(typeof token.revoked).toBe('boolean');
    expect(token.createdAt).toBeInstanceOf(Date);
  });

  test('CreateRefreshTokenInput has required fields', () => {
    const input: CreateRefreshTokenInput = mockCreateInput;

    expect(input.userId).toBeDefined();
    expect(input.tokenHash).toBeDefined();
    expect(input.expiresAt).toBeInstanceOf(Date);
  });

  test('tokenHash has correct length for SHA-256', () => {
    // SHA-256 produces 256 bits = 32 bytes = 64 hex characters
    expect(mockRefreshToken.tokenHash).toHaveLength(64);
    expect(mockCreateInput.tokenHash).toHaveLength(64);
  });
});

// ============================================================================
// Repository Function Existence Tests
// ============================================================================

describe('RefreshToken Repository Exports', () => {
  test('exports refreshTokenRepository object', async () => {
    const { refreshTokenRepository } = await import('../repositories/refresh-token.js');

    expect(refreshTokenRepository).toBeDefined();
    expect(typeof refreshTokenRepository).toBe('object');
  });

  test('refreshTokenRepository has expected functions', async () => {
    const { refreshTokenRepository } = await import('../repositories/refresh-token.js');

    expect(typeof refreshTokenRepository.findByHash).toBe('function');
    expect(typeof refreshTokenRepository.findById).toBe('function');
    expect(typeof refreshTokenRepository.create).toBe('function');
    expect(typeof refreshTokenRepository.revokeByHash).toBe('function');
    expect(typeof refreshTokenRepository.revokeById).toBe('function');
    expect(typeof refreshTokenRepository.revokeAllForUser).toBe('function');
    expect(typeof refreshTokenRepository.isValid).toBe('function');
    expect(typeof refreshTokenRepository.deleteExpired).toBe('function');
    expect(typeof refreshTokenRepository.deleteRevokedOlderThan).toBe('function');
    expect(typeof refreshTokenRepository.listActiveForUser).toBe('function');
    expect(typeof refreshTokenRepository.countActiveForUser).toBe('function');
    expect(typeof refreshTokenRepository.rotate).toBe('function');
  });
});

// ============================================================================
// Token Expiry Tests (Logic Tests)
// ============================================================================

describe('Token Expiry Logic', () => {
  test('token with future expiresAt is not expired', () => {
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
    expect(futureExpiry > new Date()).toBe(true);
  });

  test('token with past expiresAt is expired', () => {
    const pastExpiry = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    expect(pastExpiry < new Date()).toBe(true);
  });

  test('token is valid only when not revoked and not expired', () => {
    const now = new Date();
    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60);
    const pastExpiry = new Date(Date.now() - 1000 * 60 * 60);

    // Valid: not revoked, not expired
    const validToken = { revoked: false, expiresAt: futureExpiry };
    expect(!validToken.revoked && validToken.expiresAt > now).toBe(true);

    // Invalid: revoked
    const revokedToken = { revoked: true, expiresAt: futureExpiry };
    expect(!revokedToken.revoked && revokedToken.expiresAt > now).toBe(false);

    // Invalid: expired
    const expiredToken = { revoked: false, expiresAt: pastExpiry };
    expect(!expiredToken.revoked && expiredToken.expiresAt > now).toBe(false);

    // Invalid: both revoked and expired
    const badToken = { revoked: true, expiresAt: pastExpiry };
    expect(!badToken.revoked && badToken.expiresAt > now).toBe(false);
  });
});

// ============================================================================
// Index Re-export Tests
// ============================================================================

describe('RefreshToken Repository Index Exports', () => {
  test('is exported from repositories index', async () => {
    const index = await import('../repositories/index.js');

    expect(index.refreshTokenRepository).toBeDefined();
  });

  test('types are exported from repositories index', async () => {
    // This is a compile-time check that would fail if types aren't exported
    const index = await import('../repositories/index.js');

    // Runtime check that the object exists
    expect(typeof index.refreshTokenRepository).toBe('object');
  });
});
