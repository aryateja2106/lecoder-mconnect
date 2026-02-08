/**
 * OAuth 2.0 Service
 *
 * Implements OAuth 2.0 authorization code flow with PKCE for mobile clients.
 * Supports multiple providers (GitHub, Google) with a common interface.
 */

import type { OAuthProvider, User } from '@lecoder/shared';
import * as userRepository from '../db/repositories/user.js';

// ============================================================================
// Types
// ============================================================================

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  /** Provider name */
  name: OAuthProvider;
  /** OAuth authorization URL */
  authorizationUrl: string;
  /** OAuth token URL */
  tokenUrl: string;
  /** User info endpoint */
  userInfoUrl: string;
  /** Client ID from provider */
  clientId: string;
  /** Client secret from provider */
  clientSecret: string;
  /** OAuth scopes to request */
  scopes: string[];
}

/**
 * OAuth provider interface - implemented by each provider
 */
export interface OAuthProviderInterface {
  /** Get the authorization URL with PKCE */
  getAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
  ): string;

  /** Exchange authorization code for tokens */
  exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<OAuthTokens>;

  /** Get user info from provider */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

/**
 * OAuth tokens from provider
 */
export interface OAuthTokens {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token (if provided) */
  refreshToken?: string;
  /** Token expiration in seconds */
  expiresIn?: number;
  /** Token type (usually 'Bearer') */
  tokenType: string;
  /** Granted scopes */
  scope?: string;
}

/**
 * User info from OAuth provider
 */
export interface OAuthUserInfo {
  /** Provider user ID */
  id: string;
  /** User email */
  email: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Pending OAuth state stored between authorization and callback
 */
export interface OAuthPendingState {
  /** State parameter for CSRF protection */
  state: string;
  /** Code verifier for PKCE (client stores this) */
  codeVerifier?: string;
  /** Redirect URI used in authorization */
  redirectUri: string;
  /** OAuth provider */
  provider: OAuthProvider;
  /** Timestamp when state was created */
  createdAt: number;
}

/**
 * OAuth service interface
 */
export interface OAuthService {
  /** Get authorization URL for a provider */
  getAuthorizationUrl(
    provider: OAuthProvider,
    redirectUri: string,
    state: string,
    codeChallenge: string
  ): string;

  /** Exchange authorization code for tokens and create/update user */
  exchangeCode(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<{ user: User; providerTokens: OAuthTokens }>;
}

// ============================================================================
// PKCE Utilities
// ============================================================================

/**
 * Generate a cryptographically secure random string for PKCE code verifier
 * RFC 7636 recommends 43-128 characters
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate code challenge from code verifier using SHA-256
 * RFC 7636 S256 method
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64URL encode (RFC 4648)
 * Used for PKCE code verifier and challenge
 */
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = btoa(binary);
  // Convert to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a cryptographically secure random state parameter
 */
export function generateState(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// ============================================================================
// Provider Registry
// ============================================================================

const providers = new Map<OAuthProvider, OAuthProviderInterface>();

/**
 * Register an OAuth provider
 */
export function registerProvider(name: OAuthProvider, provider: OAuthProviderInterface): void {
  providers.set(name, provider);
}

/**
 * Get a registered OAuth provider
 */
export function getProvider(name: OAuthProvider): OAuthProviderInterface {
  const provider = providers.get(name);
  if (!provider) {
    throw new OAuthError(`Unknown OAuth provider: ${name}`, 'unknown_provider');
  }
  return provider;
}

/**
 * Check if a provider is registered
 */
export function hasProvider(name: OAuthProvider): boolean {
  return providers.has(name);
}

// ============================================================================
// OAuth Service Implementation
// ============================================================================

/**
 * OAuth error with error code
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthorizationUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const providerImpl = getProvider(provider);
  return providerImpl.getAuthorizationUrl(redirectUri, state, codeChallenge);
}

/**
 * Exchange authorization code for tokens and upsert user
 */
export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{ user: User; providerTokens: OAuthTokens }> {
  const providerImpl = getProvider(provider);

  // Exchange code for provider tokens
  const providerTokens = await providerImpl.exchangeCode(code, redirectUri, codeVerifier);

  // Get user info from provider
  const userInfo = await providerImpl.getUserInfo(providerTokens.accessToken);

  // Create or update user in database
  const user = await userRepository.upsertByProvider({
    email: userInfo.email,
    name: userInfo.name,
    avatarUrl: userInfo.avatarUrl,
    provider,
    providerId: userInfo.id,
  });

  return { user, providerTokens };
}

// ============================================================================
// State Management (In-Memory)
// ============================================================================

/**
 * In-memory store for pending OAuth states
 * In production, use Redis or database
 */
const pendingStates = new Map<string, OAuthPendingState>();

/** State expiration time (10 minutes) */
const STATE_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * Store pending OAuth state
 */
export function storePendingState(state: OAuthPendingState): void {
  pendingStates.set(state.state, state);

  // Clean up expired states periodically
  cleanupExpiredStates();
}

/**
 * Get and remove pending OAuth state
 */
export function consumePendingState(state: string): OAuthPendingState | null {
  const pending = pendingStates.get(state);
  if (!pending) {
    return null;
  }

  pendingStates.delete(state);

  // Check if expired
  if (Date.now() - pending.createdAt > STATE_EXPIRATION_MS) {
    return null;
  }

  return pending;
}

/**
 * Clean up expired states
 */
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [state, pending] of pendingStates) {
    if (now - pending.createdAt > STATE_EXPIRATION_MS) {
      pendingStates.delete(state);
    }
  }
}

// ============================================================================
// Export Service
// ============================================================================

export const oauthService: OAuthService = {
  getAuthorizationUrl,
  exchangeCode,
};

export default oauthService;
