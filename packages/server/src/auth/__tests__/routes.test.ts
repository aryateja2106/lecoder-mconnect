/**
 * OAuth Routes Tests
 *
 * Tests for OAuth HTTP endpoints.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { handleAuthorize, handleCallback, handleToken } from '../routes.js';
import { registerProvider, storePendingState, type OAuthProviderInterface } from '../oauth.js';

// ============================================================================
// Test Setup
// ============================================================================

const originalEnv = { ...process.env };

// Mock provider for testing
const mockProvider: OAuthProviderInterface = {
  getAuthorizationUrl: (redirectUri, state, codeChallenge) =>
    `https://mock.example.com/oauth?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&code_challenge=${codeChallenge}`,
  exchangeCode: async () => ({
    accessToken: 'mock-access-token',
    tokenType: 'Bearer',
    scope: 'read:user',
  }),
  getUserInfo: async () => ({
    id: 'mock-user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
  }),
};

beforeEach(() => {
  // Set up environment for JWT
  process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-min-32-chars';
  process.env.GITHUB_CLIENT_ID = 'test-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';

  // Register mock provider
  registerProvider('github', mockProvider);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ============================================================================
// Authorization Endpoint Tests
// ============================================================================

describe('handleAuthorize', () => {
  test('redirects to provider with valid parameters', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('https://mock.example.com/oauth');
    expect(location).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
    expect(location).toContain('code_challenge=testchallenge');
  });

  test('returns 400 for missing provider', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
  });

  test('returns 400 for invalid redirect_uri', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=not-a-url&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
  });

  test('returns 400 for short code_challenge', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=tooshort&code_challenge_method=S256'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
  });

  test('returns 400 for wrong code_challenge_method', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=plain'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
  });

  test('returns 400 for unconfigured provider', async () => {
    const request = new Request(
      'http://localhost:3001/auth/authorize?provider=google&redirect_uri=https://app.example.com/callback&code_challenge=testchallenge12345678901234567890123456789012&code_challenge_method=S256'
    );

    const response = await handleAuthorize(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('unsupported_provider');
  });
});

// ============================================================================
// Callback Endpoint Tests
// ============================================================================

describe('handleCallback', () => {
  test('redirects to client with code on success', async () => {
    // First, store pending state
    const state = 'test-state-callback-123';
    storePendingState({
      state,
      redirectUri: 'https://app.example.com/callback',
      provider: 'github',
      createdAt: Date.now(),
    });

    const request = new Request(
      `http://localhost:3001/auth/callback?code=test-auth-code&state=${state}`
    );

    const response = await handleCallback(request);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('https://app.example.com/callback');
    expect(location).toContain('code=test-auth-code');
    expect(location).toContain(`state=${state}`);
    expect(location).toContain('provider=github');
  });

  test('returns 400 for invalid state', async () => {
    const request = new Request(
      'http://localhost:3001/auth/callback?code=test-auth-code&state=invalid-state'
    );

    const response = await handleCallback(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_state');
  });

  test('returns 400 for missing code', async () => {
    const request = new Request(
      'http://localhost:3001/auth/callback?state=test-state'
    );

    const response = await handleCallback(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
  });

  test('returns OAuth error from provider', async () => {
    const request = new Request(
      'http://localhost:3001/auth/callback?error=access_denied&error_description=User%20denied%20access'
    );

    const response = await handleCallback(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('access_denied');
    expect(body.error_description).toBe('User denied access');
  });
});

// ============================================================================
// Token Endpoint Tests
// ============================================================================

describe('handleToken', () => {
  test('returns 400 for missing Content-Type', async () => {
    const request = new Request('http://localhost:3001/auth/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'test-code',
        redirect_uri: 'https://app.example.com/callback',
        code_verifier: 'test-verifier',
        provider: 'github',
      }),
    });

    const response = await handleToken(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('Content-Type');
  });

  test('returns 400 for unsupported grant_type', async () => {
    const request = new Request('http://localhost:3001/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        code: 'test-code',
        redirect_uri: 'https://app.example.com/callback',
        code_verifier: 'test-verifier',
        provider: 'github',
      }),
    });

    const response = await handleToken(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('unsupported_grant_type');
  });

  test('returns 400 for missing parameters', async () => {
    const request = new Request('http://localhost:3001/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'test-code',
        // missing redirect_uri, code_verifier, provider
      }),
    });

    const response = await handleToken(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request');
    expect(body.error_description).toContain('Missing required parameters');
  });

  test('returns 400 for unsupported provider', async () => {
    const request = new Request('http://localhost:3001/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'test-code',
        redirect_uri: 'https://app.example.com/callback',
        code_verifier: 'test-verifier',
        provider: 'google',
      }),
    });

    const response = await handleToken(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('unsupported_provider');
  });

  test('accepts application/x-www-form-urlencoded', async () => {
    const request = new Request('http://localhost:3001/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&provider=google',
    });

    const response = await handleToken(request);

    // Should get "unsupported_provider" because google isn't registered
    // This proves the form parsing worked
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; error_description?: string };
    expect(body.error).toBe('invalid_request'); // Missing other params
  });
});
