import { createHash, randomBytes } from 'node:crypto';

/**
 * Generate a cryptographically secure session token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('base64url');
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
