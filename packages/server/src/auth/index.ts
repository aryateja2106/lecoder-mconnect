/**
 * Auth Module
 *
 * OAuth 2.0 + JWT authentication for MConnect V2.
 * - GitHub OAuth provider
 * - JWT token management
 * - PKCE support for mobile
 */

// OAuth service
export {
  type OAuthProviderConfig,
  type OAuthProviderInterface,
  type OAuthTokens,
  type OAuthUserInfo,
  type OAuthPendingState,
  type OAuthService,
  OAuthError,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  registerProvider,
  getProvider,
  hasProvider,
  getAuthorizationUrl,
  exchangeCode,
  storePendingState,
  consumePendingState,
  oauthService,
} from './oauth.js';

// Providers
export { githubProvider, registerGitHubProvider } from './providers/github.js';
export { registerAllProviders } from './providers/index.js';

// JWT service
export {
  type JWTConfig,
  JWTService,
  getJWTService,
  initializeJWTService,
  resetJWTService,
  hashTokenJti,
} from './jwt.js';

// Auth service (high-level)
export {
  type AuthServiceConfig,
  type RefreshResult,
  type AuthErrorCode,
  AuthService,
  AuthError,
  getAuthService,
  initializeAuthService,
  resetAuthService,
} from './auth-service.js';

// HTTP routes
export {
  handleAuthorize,
  handleCallback,
  handleToken,
  handleRefresh,
  handleRevoke,
  handleDevToken,
  handleAuthRoutes,
} from './routes.js';

/**
 * Initialize the auth module
 *
 * - Registers all OAuth providers
 * - Sets up JWT service
 *
 * Call this during server startup.
 */
export function initializeAuth(): void {
  // Register OAuth providers
  const { registerGitHubProvider } = require('./providers/github.js');
  registerGitHubProvider();
}
