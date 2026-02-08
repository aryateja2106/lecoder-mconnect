/**
 * OAuth Service Tests
 *
 * Tests for PKCE utilities and OAuth service functions.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  registerProvider,
  getProvider,
  hasProvider,
  getAuthorizationUrl,
  storePendingState,
  consumePendingState,
  OAuthError,
  type OAuthProviderInterface,
  type OAuthPendingState,
} from '../oauth.js';

// ============================================================================
// PKCE Utility Tests
// ============================================================================

describe('PKCE Utilities', () => {
  describe('generateCodeVerifier', () => {
    test('generates a string of correct length', () => {
      const verifier = generateCodeVerifier();
      // 32 bytes -> ~43 base64url characters
      expect(verifier.length).toBeGreaterThanOrEqual(32);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    test('generates different values each time', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    test('contains only base64url characters', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    test('generates a challenge from verifier', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toBeDefined();
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBeGreaterThan(0);
    });

    test('generates consistent challenge for same verifier', async () => {
      const verifier = 'test-code-verifier-12345';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    test('generates different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);

      expect(challenge1).not.toBe(challenge2);
    });

    test('contains only base64url characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateState', () => {
    test('generates a string', () => {
      const state = generateState();
      expect(typeof state).toBe('string');
      expect(state.length).toBeGreaterThan(0);
    });

    test('generates different values each time', () => {
      const state1 = generateState();
      const state2 = generateState();
      expect(state1).not.toBe(state2);
    });

    test('contains only base64url characters', () => {
      const state = generateState();
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });
});

// ============================================================================
// Provider Registry Tests
// ============================================================================

describe('Provider Registry', () => {
  const mockProvider: OAuthProviderInterface = {
    getAuthorizationUrl: (redirectUri, state, codeChallenge) =>
      `https://mock.example.com/auth?redirect_uri=${redirectUri}&state=${state}&code_challenge=${codeChallenge}`,
    exchangeCode: async () => ({
      accessToken: 'mock-token',
      tokenType: 'Bearer',
    }),
    getUserInfo: async () => ({
      id: 'mock-user-id',
      email: 'mock@example.com',
      name: 'Mock User',
    }),
  };

  test('hasProvider returns false for unregistered provider', () => {
    // Use a different name to avoid conflicts with other tests
    expect(hasProvider('google')).toBe(false);
  });

  test('registerProvider and getProvider work together', () => {
    // Register the GitHub provider for this test
    registerProvider('github', mockProvider);

    expect(hasProvider('github')).toBe(true);
    const retrieved = getProvider('github');
    expect(retrieved).toBe(mockProvider);
  });

  test('getProvider throws for unknown provider', () => {
    expect(() => getProvider('google')).toThrow(OAuthError);
    expect(() => getProvider('google')).toThrow('Unknown OAuth provider: google');
  });
});

// ============================================================================
// OAuth Authorization URL Tests
// ============================================================================

describe('getAuthorizationUrl', () => {
  const mockProvider: OAuthProviderInterface = {
    getAuthorizationUrl: (redirectUri, state, codeChallenge) =>
      `https://example.com/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
    exchangeCode: async () => ({
      accessToken: 'mock-token',
      tokenType: 'Bearer',
    }),
    getUserInfo: async () => ({
      id: 'mock-id',
      email: 'mock@test.com',
    }),
  };

  beforeEach(() => {
    registerProvider('github', mockProvider);
  });

  test('returns authorization URL from provider', () => {
    const url = getAuthorizationUrl(
      'github',
      'https://app.example.com/callback',
      'test-state',
      'test-challenge'
    );

    expect(url).toContain('https://example.com/oauth');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
    expect(url).toContain('state=test-state');
    expect(url).toContain('code_challenge=test-challenge');
  });

  test('throws for unknown provider', () => {
    expect(() =>
      getAuthorizationUrl(
        'google',
        'https://app.example.com/callback',
        'test-state',
        'test-challenge'
      )
    ).toThrow(OAuthError);
  });
});

// ============================================================================
// Pending State Tests
// ============================================================================

describe('Pending State Management', () => {
  test('storePendingState and consumePendingState work together', () => {
    const state: OAuthPendingState = {
      state: 'test-state-123',
      redirectUri: 'https://app.example.com/callback',
      provider: 'github',
      createdAt: Date.now(),
    };

    storePendingState(state);
    const consumed = consumePendingState('test-state-123');

    expect(consumed).toBeDefined();
    expect(consumed?.state).toBe('test-state-123');
    expect(consumed?.redirectUri).toBe('https://app.example.com/callback');
    expect(consumed?.provider).toBe('github');
  });

  test('consumePendingState removes the state', () => {
    const state: OAuthPendingState = {
      state: 'test-state-456',
      redirectUri: 'https://app.example.com/callback',
      provider: 'github',
      createdAt: Date.now(),
    };

    storePendingState(state);

    // First consume should succeed
    const first = consumePendingState('test-state-456');
    expect(first).toBeDefined();

    // Second consume should fail (already consumed)
    const second = consumePendingState('test-state-456');
    expect(second).toBeNull();
  });

  test('consumePendingState returns null for unknown state', () => {
    const consumed = consumePendingState('unknown-state');
    expect(consumed).toBeNull();
  });

  test('consumePendingState returns null for expired state', () => {
    const state: OAuthPendingState = {
      state: 'expired-state-789',
      redirectUri: 'https://app.example.com/callback',
      provider: 'github',
      // Created 15 minutes ago (past the 10-minute expiration)
      createdAt: Date.now() - 15 * 60 * 1000,
    };

    storePendingState(state);
    const consumed = consumePendingState('expired-state-789');

    expect(consumed).toBeNull();
  });
});

// ============================================================================
// OAuthError Tests
// ============================================================================

describe('OAuthError', () => {
  test('creates error with message and code', () => {
    const error = new OAuthError('Test error', 'test_code');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('test_code');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('OAuthError');
  });

  test('creates error with custom status code', () => {
    const error = new OAuthError('Server error', 'server_error', 500);

    expect(error.message).toBe('Server error');
    expect(error.code).toBe('server_error');
    expect(error.statusCode).toBe(500);
  });

  test('is instanceof Error', () => {
    const error = new OAuthError('Test', 'test');
    expect(error).toBeInstanceOf(Error);
  });
});
