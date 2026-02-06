/**
 * OAuth HTTP Routes
 *
 * Handles OAuth 2.0 authorization flow endpoints:
 * - GET /auth/authorize - Start OAuth flow (redirect to provider)
 * - GET /auth/callback - OAuth callback (exchange code for tokens)
 * - POST /auth/token - Exchange code for tokens (PKCE)
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/revoke - Revoke refresh token
 * - POST /auth/dev-token - Create dev token (dev mode only)
 */

import type { OAuthProvider, TokenResponse } from '@lecoder/shared';
import { z } from 'zod';
import {
  OAuthError,
  generateState,
  getAuthorizationUrl,
  exchangeCode,
  storePendingState,
  consumePendingState,
  hasProvider,
} from './oauth.js';
import { AuthError, getAuthService } from './auth-service.js';

// ============================================================================
// Request Validation Schemas
// ============================================================================

const authorizeQuerySchema = z.object({
  provider: z.enum(['github', 'google']),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  state: z.string().optional(),
});

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Handle GET /auth/authorize
 *
 * Starts the OAuth flow by redirecting to the provider's authorization URL.
 * The client must provide a PKCE code_challenge (S256 method).
 *
 * Query Parameters:
 * - provider: 'github' | 'google'
 * - redirect_uri: Where to redirect after authorization
 * - code_challenge: PKCE code challenge (base64url encoded SHA-256)
 * - code_challenge_method: Must be 'S256'
 * - state: Optional CSRF state (one will be generated if not provided)
 */
export async function handleAuthorize(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  // Validate query parameters
  const parseResult = authorizeQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      },
      { status: 400 }
    );
  }

  const { provider, redirect_uri, code_challenge, state: clientState } = parseResult.data;

  // Check if provider is configured
  if (!hasProvider(provider as OAuthProvider)) {
    return Response.json(
      {
        error: 'unsupported_provider',
        error_description: `OAuth provider '${provider}' is not configured`,
      },
      { status: 400 }
    );
  }

  // Generate state for CSRF protection if not provided
  const state = clientState || generateState();

  // Store pending state for callback verification
  storePendingState({
    state,
    redirectUri: redirect_uri,
    provider: provider as OAuthProvider,
    createdAt: Date.now(),
  });

  try {
    // Get authorization URL from provider
    const authUrl = getAuthorizationUrl(
      provider as OAuthProvider,
      redirect_uri,
      state,
      code_challenge
    );

    // Redirect to provider
    return Response.redirect(authUrl, 302);
  } catch (error) {
    if (error instanceof OAuthError) {
      return Response.json(
        {
          error: error.code,
          error_description: error.message,
        },
        { status: error.statusCode }
      );
    }
    throw error;
  }
}

/**
 * Handle GET /auth/callback
 *
 * Handles the OAuth callback from the provider.
 * Exchanges the authorization code for tokens using PKCE.
 *
 * Query Parameters:
 * - code: Authorization code from provider
 * - state: State parameter for CSRF verification
 *
 * The client must provide the code_verifier in a subsequent request or
 * we can redirect back to the client with the code for client-side exchange.
 *
 * For mobile PKCE flow, we redirect back to the client app with the code.
 */
export async function handleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);

  // Check for OAuth error from provider
  if (queryParams.error) {
    return Response.json(
      {
        error: queryParams.error,
        error_description: queryParams.error_description || 'OAuth authorization failed',
      },
      { status: 400 }
    );
  }

  // Validate query parameters
  const parseResult = callbackQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: parseResult.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', '),
      },
      { status: 400 }
    );
  }

  const { code, state } = parseResult.data;

  // Verify state and get pending OAuth info
  const pending = consumePendingState(state);
  if (!pending) {
    return Response.json(
      {
        error: 'invalid_state',
        error_description: 'Invalid or expired state parameter. Please restart the OAuth flow.',
      },
      { status: 400 }
    );
  }

  // For PKCE mobile flow, redirect back to the client app with the code
  // The client will then call /auth/token with the code and code_verifier
  const redirectUri = new URL(pending.redirectUri);
  redirectUri.searchParams.set('code', code);
  redirectUri.searchParams.set('state', state);
  redirectUri.searchParams.set('provider', pending.provider);

  return Response.redirect(redirectUri.toString(), 302);
}

/**
 * Handle POST /auth/token
 *
 * Exchange authorization code for tokens (PKCE flow completion).
 * This is called by the client after receiving the code from callback.
 *
 * Request Body:
 * - grant_type: 'authorization_code'
 * - code: Authorization code from callback
 * - redirect_uri: Must match the original redirect_uri
 * - code_verifier: PKCE code verifier
 * - provider: OAuth provider name
 */
export async function handleToken(request: Request): Promise<Response> {
  // Parse request body
  let body: Record<string, string>;
  const contentType = request.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    body = (await request.json()) as Record<string, string>;
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Content-Type must be application/json or application/x-www-form-urlencoded',
      },
      { status: 400 }
    );
  }

  // Validate required fields
  const { grant_type, code, redirect_uri, code_verifier, provider } = body;

  if (grant_type !== 'authorization_code') {
    return Response.json(
      {
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported',
      },
      { status: 400 }
    );
  }

  if (!code || !redirect_uri || !code_verifier || !provider) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Missing required parameters: code, redirect_uri, code_verifier, provider',
      },
      { status: 400 }
    );
  }

  if (!hasProvider(provider as OAuthProvider)) {
    return Response.json(
      {
        error: 'unsupported_provider',
        error_description: `OAuth provider '${provider}' is not configured`,
      },
      { status: 400 }
    );
  }

  try {
    // Exchange code for tokens and get/create user
    const { user } = await exchangeCode(
      provider as OAuthProvider,
      code,
      redirect_uri,
      code_verifier
    );

    // Create our own JWT tokens using AuthService (stores refresh token)
    const authService = getAuthService();
    const tokenPair = await authService.createTokenPair(user);

    // Return OAuth 2.0 compliant token response
    const response: TokenResponse = {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      expires_in: tokenPair.expiresIn,
      token_type: 'Bearer',
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof OAuthError) {
      return Response.json(
        {
          error: error.code,
          error_description: error.message,
        },
        { status: error.statusCode }
      );
    }

    console.error('Token exchange error:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred during token exchange',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /auth/refresh
 *
 * Refresh an access token using a refresh token.
 * Implements token rotation: old refresh token is revoked, new one is issued.
 *
 * Request Body:
 * - refresh_token: The refresh token
 */
export async function handleRefresh(request: Request): Promise<Response> {
  // Parse request body
  let body: Record<string, string>;
  const contentType = request.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    body = (await request.json()) as Record<string, string>;
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Content-Type must be application/json or application/x-www-form-urlencoded',
      },
      { status: 400 }
    );
  }

  const { refresh_token } = body;

  if (!refresh_token) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Missing required parameter: refresh_token',
      },
      { status: 400 }
    );
  }

  try {
    const authService = getAuthService();
    const { tokenPair } = await authService.refreshToken(refresh_token);

    // Return OAuth 2.0 compliant token response
    const response: TokenResponse = {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      expires_in: tokenPair.expiresIn,
      token_type: 'Bearer',
    };

    return Response.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.code === 'USER_NOT_FOUND' ? 404 : 401;
      return Response.json(
        {
          error: error.code.toLowerCase(),
          error_description: error.message,
        },
        { status: statusCode }
      );
    }

    console.error('Token refresh error:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred during token refresh',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle POST /auth/revoke
 *
 * Revoke a refresh token.
 *
 * Request Body:
 * - token: The refresh token to revoke
 * - token_type_hint: Optional, should be 'refresh_token'
 */
export async function handleRevoke(request: Request): Promise<Response> {
  // Parse request body
  let body: Record<string, string>;
  const contentType = request.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    body = (await request.json()) as Record<string, string>;
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  } else {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Content-Type must be application/json or application/x-www-form-urlencoded',
      },
      { status: 400 }
    );
  }

  const { token } = body;

  if (!token) {
    return Response.json(
      {
        error: 'invalid_request',
        error_description: 'Missing required parameter: token',
      },
      { status: 400 }
    );
  }

  try {
    const authService = getAuthService();
    await authService.revokeRefreshToken(token);

    // RFC 7009: Always return 200, even if token was invalid
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error('Token revoke error:', error);
    // Still return 200 per RFC 7009
    return new Response(null, { status: 200 });
  }
}

/**
 * Handle POST /auth/dev-token
 *
 * Create a development token for testing (only works when DEV_AUTH_BYPASS=true).
 *
 * Request Body:
 * - user_id: User ID for the token (optional, defaults to 'dev-user')
 * - email: Email for the token (optional, defaults to 'dev@localhost')
 * - name: Name for the token (optional, defaults to 'Dev User')
 */
export async function handleDevToken(request: Request): Promise<Response> {
  // Check if dev mode is enabled
  if (process.env.DEV_AUTH_BYPASS !== 'true') {
    return Response.json(
      {
        error: 'forbidden',
        error_description: 'Dev tokens are only available when DEV_AUTH_BYPASS=true',
      },
      { status: 403 }
    );
  }

  // Parse request body
  let body: Record<string, string> = {};
  const contentType = request.headers.get('Content-Type');

  if (contentType?.includes('application/json')) {
    try {
      body = (await request.json()) as Record<string, string>;
    } catch {
      // Empty body is OK for dev token
    }
  } else if (contentType?.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    body = Object.fromEntries(new URLSearchParams(text));
  }

  const userId =
    body.user_id ||
    process.env.DEV_USER_ID ||
    `dev-user-${crypto.randomUUID().slice(0, 8)}`;
  const email = body.email || 'dev@localhost';
  const name = body.name || 'Dev User';

  try {
    const authService = getAuthService();
    const tokenPair = await authService.createDevToken(userId, email, name);

    // Return OAuth 2.0 compliant token response
    const response: TokenResponse = {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      expires_in: tokenPair.expiresIn,
      token_type: 'Bearer',
    };

    return Response.json(response);
  } catch (error) {
    console.error('Dev token error:', error);
    return Response.json(
      {
        error: 'server_error',
        error_description: 'An unexpected error occurred creating dev token',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Handle auth routes
 *
 * @param request - HTTP request
 * @param pathname - URL pathname (e.g., '/auth/authorize')
 * @returns Response or null if route not matched
 */
export async function handleAuthRoutes(
  request: Request,
  pathname: string
): Promise<Response | null> {
  // GET /auth/authorize
  if (pathname === '/auth/authorize' && request.method === 'GET') {
    return handleAuthorize(request);
  }

  // GET /auth/callback
  if (pathname === '/auth/callback' && request.method === 'GET') {
    return handleCallback(request);
  }

  // POST /auth/token
  if (pathname === '/auth/token' && request.method === 'POST') {
    return handleToken(request);
  }

  // POST /auth/refresh
  if (pathname === '/auth/refresh' && request.method === 'POST') {
    return handleRefresh(request);
  }

  // POST /auth/revoke
  if (pathname === '/auth/revoke' && request.method === 'POST') {
    return handleRevoke(request);
  }

  // POST /auth/dev-token (development only)
  if (pathname === '/auth/dev-token' && request.method === 'POST') {
    return handleDevToken(request);
  }

  return null;
}

export default handleAuthRoutes;
