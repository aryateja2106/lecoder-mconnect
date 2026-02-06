/**
 * GitHub OAuth Provider Tests
 *
 * Tests for the GitHub OAuth provider implementation.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { githubProvider, registerGitHubProvider } from '../providers/github.js';
import { OAuthError, hasProvider } from '../oauth.js';

// ============================================================================
// Test Setup
// ============================================================================

const originalEnv = { ...process.env };

beforeEach(() => {
  // Reset environment
  process.env.GITHUB_CLIENT_ID = 'test-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
});

afterEach(() => {
  // Restore environment
  process.env = { ...originalEnv };
});

// ============================================================================
// Authorization URL Tests
// ============================================================================

describe('GitHubProvider.getAuthorizationUrl', () => {
  test('generates correct authorization URL', () => {
    const url = githubProvider.getAuthorizationUrl(
      'https://app.example.com/callback',
      'test-state-123',
      'test-code-challenge'
    );

    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback');
    expect(url).toContain('state=test-state-123');
    expect(url).toContain('code_challenge=test-code-challenge');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('scope=read%3Auser+user%3Aemail');
  });

  test('throws when client ID not configured', () => {
    delete process.env.GITHUB_CLIENT_ID;

    expect(() =>
      githubProvider.getAuthorizationUrl(
        'https://app.example.com/callback',
        'test-state',
        'test-challenge'
      )
    ).toThrow(OAuthError);
  });

  test('throws when client secret not configured', () => {
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(() =>
      githubProvider.getAuthorizationUrl(
        'https://app.example.com/callback',
        'test-state',
        'test-challenge'
      )
    ).toThrow(OAuthError);
  });
});

// ============================================================================
// Token Exchange Tests (with mocked fetch)
// ============================================================================

describe('GitHubProvider.exchangeCode', () => {
  test('exchanges code for tokens successfully', async () => {
    // Mock fetch
    const mockFetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: 'ghu_test-access-token',
            token_type: 'bearer',
            scope: 'read:user,user:email',
          }),
          { status: 200 }
        )
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const tokens = await githubProvider.exchangeCode(
      'test-auth-code',
      'https://app.example.com/callback',
      'test-code-verifier'
    );

    expect(tokens.accessToken).toBe('ghu_test-access-token');
    expect(tokens.tokenType).toBe('bearer');
    expect(tokens.scope).toBe('read:user,user:email');

    // Verify fetch was called with correct params
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = (mockFetch.mock.calls[0] || []) as unknown as [string, RequestInit];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(options.method).toBe('POST');

    // Body is a URLSearchParams object
    const body = options.body as URLSearchParams;
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('code')).toBe('test-auth-code');
    expect(body.get('code_verifier')).toBe('test-code-verifier');
  });

  test('throws on token exchange error from GitHub', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'bad_verification_code',
            error_description: 'The code passed is incorrect or expired.',
          }),
          { status: 200 }
        )
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(
      githubProvider.exchangeCode(
        'invalid-code',
        'https://app.example.com/callback',
        'test-verifier'
      )
    ).rejects.toThrow(OAuthError);
  });

  test('throws on network error', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response('Server Error', { status: 500 }))
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(
      githubProvider.exchangeCode(
        'test-code',
        'https://app.example.com/callback',
        'test-verifier'
      )
    ).rejects.toThrow(OAuthError);
  });
});

// ============================================================================
// User Info Tests (with mocked fetch)
// ============================================================================

describe('GitHubProvider.getUserInfo', () => {
  test('fetches user info with email in profile', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 12345,
            login: 'testuser',
            name: 'Test User',
            email: 'test@example.com',
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          }),
          { status: 200 }
        )
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const userInfo = await githubProvider.getUserInfo('test-access-token');

    expect(userInfo.id).toBe('12345');
    expect(userInfo.email).toBe('test@example.com');
    expect(userInfo.name).toBe('Test User');
    expect(userInfo.avatarUrl).toBe('https://avatars.githubusercontent.com/u/12345');

    // Verify Authorization header
    const [, options] = (mockFetch.mock.calls[0] || []) as unknown as [string, RequestInit];
    expect(options.headers).toHaveProperty('Authorization', 'Bearer test-access-token');
  });

  test('fetches user info with email from emails endpoint', async () => {
    let callCount = 0;
    const mockFetch = mock((url: string) => {
      callCount++;
      if (url.includes('/user/emails')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { email: 'secondary@example.com', primary: false, verified: true },
              { email: 'primary@example.com', primary: true, verified: true },
            ]),
            { status: 200 }
          )
        );
      }
      // User endpoint - no email
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 12345,
            login: 'testuser',
            name: 'Test User',
            email: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          }),
          { status: 200 }
        )
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const userInfo = await githubProvider.getUserInfo('test-access-token');

    expect(userInfo.email).toBe('primary@example.com');
    expect(callCount).toBe(2); // User + emails endpoint
  });

  test('uses login as name when name is null', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 12345,
            login: 'testuser',
            name: null,
            email: 'test@example.com',
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          }),
          { status: 200 }
        )
      )
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const userInfo = await githubProvider.getUserInfo('test-access-token');

    expect(userInfo.name).toBe('testuser');
  });

  test('throws when no email available', async () => {
    let _callCount = 0;
    const mockFetch = mock((url: string) => {
      _callCount++;
      if (url.includes('/user/emails')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { email: 'unverified@example.com', primary: true, verified: false },
            ]),
            { status: 200 }
          )
        );
      }
      // User endpoint - no email
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: 12345,
            login: 'testuser',
            name: 'Test User',
            email: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/12345',
          }),
          { status: 200 }
        )
      );
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(githubProvider.getUserInfo('test-access-token')).rejects.toThrow(
      OAuthError
    );
  });

  test('throws on API error', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(new Response('Unauthorized', { status: 401 }))
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(githubProvider.getUserInfo('invalid-token')).rejects.toThrow(OAuthError);
  });
});

// ============================================================================
// Provider Registration Tests
// ============================================================================

describe('registerGitHubProvider', () => {
  test('registers the GitHub provider', () => {
    registerGitHubProvider();
    expect(hasProvider('github')).toBe(true);
  });
});
