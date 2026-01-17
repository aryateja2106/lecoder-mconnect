import { createHash, randomBytes } from 'node:crypto';

/**
 * MConnect Security Module v0.2.0
 *
 * Session-bound tokens, token rotation, and input security
 */

/**
 * Generate a cryptographically secure session token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
}

/**
 * Session-bound token with rotation support
 */
export interface SessionToken {
  token: string;
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  previousToken?: string;
  previousExpiresAt?: number;
}

/**
 * Token Manager - Handles session-bound tokens with rotation
 */
export class TokenManager {
  private tokens: Map<string, SessionToken> = new Map(); // token -> SessionToken
  private sessionTokens: Map<string, string> = new Map(); // sessionId -> current token
  private tokenLifetimeMs: number;
  private gracePeriodMs: number;

  constructor(tokenLifetimeMs: number = 86400000, gracePeriodMs: number = 60000) {
    // Default: 24 hour lifetime, 60 second grace period
    this.tokenLifetimeMs = tokenLifetimeMs;
    this.gracePeriodMs = gracePeriodMs;
  }

  /**
   * Create a new token bound to a session
   */
  createToken(sessionId: string): SessionToken {
    const token = generateSecureToken();
    const now = Date.now();

    const sessionToken: SessionToken = {
      token,
      sessionId,
      createdAt: now,
      expiresAt: now + this.tokenLifetimeMs,
    };

    // If there's an existing token, keep it as previous for grace period
    const existingToken = this.sessionTokens.get(sessionId);
    if (existingToken) {
      const existing = this.tokens.get(existingToken);
      if (existing) {
        sessionToken.previousToken = existing.token;
        sessionToken.previousExpiresAt = now + this.gracePeriodMs;
        // Remove old token from main map (but it's still valid via previous)
        this.tokens.delete(existingToken);
      }
    }

    this.tokens.set(token, sessionToken);
    this.sessionTokens.set(sessionId, token);

    return sessionToken;
  }

  /**
   * Validate a token and return session ID if valid
   */
  validateToken(token: string): { valid: boolean; sessionId?: string; reason?: string } {
    const now = Date.now();

    // Check current tokens
    const sessionToken = this.tokens.get(token);
    if (sessionToken) {
      if (now > sessionToken.expiresAt) {
        return { valid: false, reason: 'token_expired' };
      }
      return { valid: true, sessionId: sessionToken.sessionId };
    }

    // Check if it's a previous token in grace period
    for (const st of this.tokens.values()) {
      if (st.previousToken === token && st.previousExpiresAt && now <= st.previousExpiresAt) {
        return { valid: true, sessionId: st.sessionId };
      }
    }

    return { valid: false, reason: 'token_invalid' };
  }

  /**
   * Rotate token for a session (on reconnect)
   * Returns new token if rotation successful
   */
  rotateToken(sessionId: string): SessionToken | null {
    const currentToken = this.sessionTokens.get(sessionId);
    if (!currentToken) {
      // No existing token, create new one
      return this.createToken(sessionId);
    }

    const existing = this.tokens.get(currentToken);
    if (!existing) {
      return this.createToken(sessionId);
    }

    // Create new token with previous token preserved
    return this.createToken(sessionId);
  }

  /**
   * Revoke all tokens for a session
   */
  revokeSessionTokens(sessionId: string): void {
    const token = this.sessionTokens.get(sessionId);
    if (token) {
      this.tokens.delete(token);
    }
    this.sessionTokens.delete(sessionId);
  }

  /**
   * Get current token for a session
   */
  getSessionToken(sessionId: string): string | undefined {
    return this.sessionTokens.get(sessionId);
  }

  /**
   * Clean up expired tokens
   */
  cleanup(): void {
    const now = Date.now();

    for (const [token, sessionToken] of this.tokens) {
      // Remove if main token expired and no valid previous token
      if (now > sessionToken.expiresAt) {
        if (!sessionToken.previousExpiresAt || now > sessionToken.previousExpiresAt) {
          this.tokens.delete(token);
          this.sessionTokens.delete(sessionToken.sessionId);
        }
      }
    }
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionTokens.keys());
  }
}

/**
 * Generate a short session ID for display (8 chars)
 */
export function generateSessionId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Hash a token for safe logging (don't log full tokens)
 */
export function hashForLogging(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8);
}

/**
 * Validate session token format
 */
export function isValidToken(token: string): boolean {
  // Base64url: alphanumeric, -, _
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

/**
 * Rate limiter for connections
 */
export class RateLimiter {
  private connections: Map<string, { count: number; resetTime: number }> = new Map();
  private maxConnections: number;
  private windowMs: number;

  constructor(maxConnections: number = 10, windowMs: number = 60000) {
    this.maxConnections = maxConnections;
    this.windowMs = windowMs;
  }

  /**
   * Check if an IP is allowed to connect
   */
  isAllowed(ip: string): boolean {
    const now = Date.now();
    const record = this.connections.get(ip);

    if (!record || now > record.resetTime) {
      this.connections.set(ip, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxConnections) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.connections) {
      if (now > record.resetTime) {
        this.connections.delete(ip);
      }
    }
  }
}

/**
 * Sanitize user input for terminal
 */
export function sanitizeInput(input: string): string {
  // Remove null bytes and other control characters that could be malicious
  // But preserve normal terminal control sequences
  return input.replace(/\x00/g, '');
}

/**
 * Check if a command looks like an injection attempt
 */
export function detectInjection(input: string): boolean {
  const suspiciousPatterns = [
    /\$\(.*\)/, // Command substitution
    /`.*`/, // Backtick command substitution
    /;\s*rm\s/i, // Injection attempt
    /\|\s*sh\b/i, // Piping to shell
    /\|\s*bash\b/i, // Piping to bash
    />\s*\/etc\//i, // Writing to system files
    /curl.*\|\s*sh/i, // Remote code execution
    /wget.*\|\s*sh/i, // Remote code execution
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Pairing Code Manager - Allows manual code entry as alternative to QR scanning
 *
 * Generates short human-readable codes that can be entered manually
 * in the web app to obtain a valid session token.
 */
export class PairingCodeManager {
  private codes: Map<string, { token: string; sessionId: string; expiresAt: number }> = new Map();
  private codeLifetimeMs: number;

  constructor(codeLifetimeMs: number = 300000) {
    // Default: 5 minute lifetime for pairing codes
    this.codeLifetimeMs = codeLifetimeMs;
  }

  /**
   * Generate a short human-readable pairing code (6 alphanumeric chars, uppercase)
   */
  private generateCode(): string {
    // Use only unambiguous characters (no 0/O, 1/I/L)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Create a pairing code for a session token
   */
  createCode(sessionId: string, token: string): string {
    // Clean up any existing code for this session
    this.revokeSessionCodes(sessionId);

    const code = this.generateCode();
    const now = Date.now();

    this.codes.set(code, {
      token,
      sessionId,
      expiresAt: now + this.codeLifetimeMs,
    });

    return code;
  }

  /**
   * Validate a pairing code and return the session token
   */
  validateCode(code: string): { valid: boolean; token?: string; sessionId?: string; reason?: string } {
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    const now = Date.now();

    const entry = this.codes.get(normalizedCode);
    if (!entry) {
      return { valid: false, reason: 'invalid_code' };
    }

    if (now > entry.expiresAt) {
      this.codes.delete(normalizedCode);
      return { valid: false, reason: 'code_expired' };
    }

    return { valid: true, token: entry.token, sessionId: entry.sessionId };
  }

  /**
   * Revoke all codes for a session
   */
  revokeSessionCodes(sessionId: string): void {
    for (const [code, entry] of this.codes) {
      if (entry.sessionId === sessionId) {
        this.codes.delete(code);
      }
    }
  }

  /**
   * Clean up expired codes
   */
  cleanup(): void {
    const now = Date.now();
    for (const [code, entry] of this.codes) {
      if (now > entry.expiresAt) {
        this.codes.delete(code);
      }
    }
  }

  /**
   * Get remaining lifetime for a code (in seconds)
   */
  getCodeLifetime(code: string): number | null {
    const normalizedCode = code.toUpperCase().replace(/\s/g, '');
    const entry = this.codes.get(normalizedCode);
    if (!entry) return null;

    const remaining = Math.max(0, entry.expiresAt - Date.now());
    return Math.floor(remaining / 1000);
  }
}

// Singleton pairing code manager (shared across session restarts)
let pairingCodeManager: PairingCodeManager | null = null;

export function getPairingCodeManager(): PairingCodeManager {
  if (!pairingCodeManager) {
    pairingCodeManager = new PairingCodeManager();
  }
  return pairingCodeManager;
}
