/**
 * GitHub OAuth Provider
 *
 * Implements OAuth 2.0 authorization code flow with PKCE for GitHub.
 * https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps
 */

import {
  type OAuthProviderInterface,
  type OAuthTokens,
  type OAuthUserInfo,
  OAuthError,
  registerProvider,
} from '../oauth.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * GitHub OAuth configuration from environment
 */
interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Get GitHub OAuth configuration from environment
 */
function getConfig(): GitHubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new OAuthError(
      'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.',
      'config_error',
      500
    );
  }

  return { clientId, clientSecret };
}

// ============================================================================
// GitHub OAuth URLs
// ============================================================================

const GITHUB_AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

// ============================================================================
// GitHub-specific Types
// ============================================================================

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// ============================================================================
// GitHub OAuth Provider Implementation
// ============================================================================

/**
 * GitHub OAuth provider
 */
class GitHubProvider implements OAuthProviderInterface {
  /**
   * Get the GitHub authorization URL with PKCE
   */
  getAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
  ): string {
    const config = getConfig();

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      // GitHub requires PKCE for GitHub Apps but accepts it for OAuth Apps too
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${GITHUB_AUTHORIZATION_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<OAuthTokens> {
    const config = getConfig();

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new OAuthError(
        `GitHub token exchange failed: ${response.status} ${response.statusText}`,
        'token_exchange_failed',
        502
      );
    }

    const data = (await response.json()) as GitHubTokenResponse;

    if (data.error) {
      throw new OAuthError(
        data.error_description || data.error,
        data.error,
        400
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Get user info from GitHub
   */
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    // Fetch user profile
    const userResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!userResponse.ok) {
      throw new OAuthError(
        `GitHub user info failed: ${userResponse.status} ${userResponse.statusText}`,
        'user_info_failed',
        502
      );
    }

    const userData = (await userResponse.json()) as GitHubUserResponse;

    // Get email - GitHub may not include it in user profile
    let email = userData.email;

    if (!email) {
      // Fetch emails separately
      const emailsResponse = await fetch(GITHUB_EMAILS_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as GitHubEmailResponse[];
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        const verifiedEmail = emails.find((e) => e.verified);
        email = primaryEmail?.email || verifiedEmail?.email || null;
      }
    }

    if (!email) {
      throw new OAuthError(
        'Could not retrieve email from GitHub. Please ensure your GitHub account has a verified email.',
        'no_email',
        400
      );
    }

    return {
      id: userData.id.toString(),
      email,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url,
    };
  }
}

// ============================================================================
// Registration
// ============================================================================

/**
 * GitHub provider instance
 */
export const githubProvider = new GitHubProvider();

/**
 * Register the GitHub provider
 * Call this during server initialization
 */
export function registerGitHubProvider(): void {
  registerProvider('github', githubProvider);
}

export default githubProvider;
