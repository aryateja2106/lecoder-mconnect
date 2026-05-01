import { afterEach, describe, expect, test } from 'bun:test';
import {
  applyCorsHeaders,
  buildCorsHeaders,
  handleCorsPreflight,
  resolveAllowedOrigin,
} from './cors';

const CORS_ENV_KEYS = [
  'LECODER_HUB_CORS_ORIGINS',
  'LECODER_HUB_CORS_METHODS',
  'LECODER_HUB_CORS_HEADERS',
] as const;

function clearEnv() {
  for (const key of CORS_ENV_KEYS) {
    delete process.env[key];
  }
}

describe('cors helpers', () => {
  afterEach(clearEnv);

  describe('resolveAllowedOrigin', () => {
    test('returns null when request has no Origin header', () => {
      const req = new Request('http://hub.local/fleet');
      expect(resolveAllowedOrigin(req)).toBeNull();
    });

    test('mirrors origin by default (no env var set)', () => {
      const req = new Request('http://hub.local/fleet', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(resolveAllowedOrigin(req)).toBe('http://localhost:3000');
    });

    test('mirrors when env explicitly set to "*"', () => {
      process.env.LECODER_HUB_CORS_ORIGINS = '*';
      const req = new Request('http://hub.local/fleet', {
        headers: { Origin: 'https://app.example.com' },
      });
      expect(resolveAllowedOrigin(req)).toBe('https://app.example.com');
    });

    test('honors a comma-separated allowlist', () => {
      process.env.LECODER_HUB_CORS_ORIGINS = 'https://app.example.com, http://localhost:3000';
      const allowed = new Request('http://hub.local/fleet', {
        headers: { Origin: 'http://localhost:3000' },
      });
      expect(resolveAllowedOrigin(allowed)).toBe('http://localhost:3000');

      const blocked = new Request('http://hub.local/fleet', {
        headers: { Origin: 'https://evil.example.com' },
      });
      expect(resolveAllowedOrigin(blocked)).toBeNull();
    });
  });

  describe('buildCorsHeaders', () => {
    test('returns empty headers when no Origin', () => {
      const headers = buildCorsHeaders(new Request('http://hub.local/'));
      expect(headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('emits the canonical CORS header set when allowed', () => {
      const req = new Request('http://hub.local/fleet', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const headers = buildCorsHeaders(req);
      expect(headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(headers.get('Vary')).toBe('Origin');
      expect(headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
      expect(headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    test('honors LECODER_HUB_CORS_METHODS / HEADERS overrides', () => {
      process.env.LECODER_HUB_CORS_METHODS = 'GET,POST';
      process.env.LECODER_HUB_CORS_HEADERS = 'Authorization';
      const req = new Request('http://hub.local/fleet', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const headers = buildCorsHeaders(req);
      expect(headers.get('Access-Control-Allow-Methods')).toBe('GET,POST');
      expect(headers.get('Access-Control-Allow-Headers')).toBe('Authorization');
    });
  });

  describe('handleCorsPreflight', () => {
    test('returns null for non-preflight OPTIONS', () => {
      const req = new Request('http://hub.local/fleet', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      });
      // No Access-Control-Request-Method => not a real preflight
      expect(handleCorsPreflight(req)).toBeNull();
    });

    test('returns 204 with CORS headers for valid preflight', () => {
      const req = new Request('http://hub.local/fleet', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization, Content-Type',
        },
      });
      const res = handleCorsPreflight(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(204);
      expect(res!.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    test('returns null when origin not in allowlist', () => {
      process.env.LECODER_HUB_CORS_ORIGINS = 'https://app.example.com';
      const req = new Request('http://hub.local/fleet', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://evil.local',
          'Access-Control-Request-Method': 'POST',
        },
      });
      const res = handleCorsPreflight(req);
      // We still return a 204 — but without the allow-origin header so the
      // browser will reject. This matches CORS semantics: the server doesn't
      // need to refuse the request, it just doesn't grant access.
      expect(res!.status).toBe(204);
      expect(res!.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('applyCorsHeaders', () => {
    test('mutates response headers when origin is allowed', () => {
      const req = new Request('http://hub.local/fleet', {
        headers: { Origin: 'http://localhost:3000' },
      });
      const res = applyCorsHeaders(req, Response.json({ ok: true }));
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    test('leaves response untouched when no Origin', () => {
      const req = new Request('http://hub.local/fleet');
      const res = applyCorsHeaders(req, Response.json({ ok: true }));
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
