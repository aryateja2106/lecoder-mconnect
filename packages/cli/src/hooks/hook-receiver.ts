/**
 * Hook Receiver HTTP Handler
 *
 * Receives hook events from AI coding agents (Claude Code, Gemini CLI, etc.)
 * via HTTP POST and broadcasts them to connected WebSocket clients.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeHookEvent, validateHookRequest } from './normalizer.js';
import type { UniversalHookEvent } from './types.js';

/**
 * Callback type for broadcasting hook events
 */
export type HookEventBroadcaster = (event: UniversalHookEvent) => void;

/**
 * Configuration for the hook receiver
 */
export interface HookReceiverConfig {
  /** Session token for authentication */
  token: string;
  /** Callback to broadcast events to WebSocket clients */
  onEvent: HookEventBroadcaster;
  /** Optional rate limit (events per minute) */
  rateLimit?: number;
}

/**
 * Simple rate limiter for hook events
 */
class HookRateLimiter {
  private counts: Map<string, { count: number; resetTime: number }> = new Map();
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 60, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.counts.get(key);

    if (!entry || now > entry.resetTime) {
      this.counts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.counts) {
      if (now > entry.resetTime) {
        this.counts.delete(key);
      }
    }
  }
}

/**
 * Hook Receiver class
 *
 * Handles HTTP requests to /api/hooks and normalizes + broadcasts events.
 */
export class HookReceiver {
  private config: HookReceiverConfig;
  private rateLimiter: HookRateLimiter;
  private eventHistory: UniversalHookEvent[] = [];
  private maxHistorySize = 100;

  constructor(config: HookReceiverConfig) {
    this.config = config;
    this.rateLimiter = new HookRateLimiter(config.rateLimit || 60);

    // Cleanup rate limiter periodically
    setInterval(() => this.rateLimiter.cleanup(), 60000);
  }

  /**
   * Handle an incoming HTTP request
   *
   * @param req - Incoming HTTP request
   * @param res - Server response
   * @param path - Request path (after /api/hooks)
   * @returns true if the request was handled
   */
  async handleRequest(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
    // Only handle POST to /api/hooks
    if (req.method !== 'POST' || path !== '/api/hooks') {
      return false;
    }

    try {
      // Authenticate request
      const authHeader = req.headers.authorization;
      const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      // Also allow token as query parameter (for simpler curl testing)
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const queryToken = url.searchParams.get('token');

      if (providedToken !== this.config.token && queryToken !== this.config.token) {
        this.sendJSON(res, 401, { received: false, error: 'Unauthorized' });
        return true;
      }

      // Rate limit by source IP
      const clientIp = this.getClientIp(req);
      if (!this.rateLimiter.isAllowed(clientIp)) {
        this.sendJSON(res, 429, { received: false, error: 'Rate limit exceeded' });
        return true;
      }

      // Parse request body
      const body = await this.parseBody(req);
      if (!body) {
        this.sendJSON(res, 400, { received: false, error: 'Invalid JSON body' });
        return true;
      }

      // Validate request
      const hookRequest = validateHookRequest(body);
      if (!hookRequest) {
        this.sendJSON(res, 400, {
          received: false,
          error:
            'Invalid hook request. Required: source (claude|gemini|copilot|aider|custom), event_type (string)',
        });
        return true;
      }

      // Normalize to universal format
      const event = normalizeHookEvent(hookRequest);

      // Store in history
      this.addToHistory(event);

      // Broadcast to WebSocket clients
      this.config.onEvent(event);

      // Log the event
      console.log(`[HookReceiver] ${event.source}:${event.eventType} - ${event.title}`);

      // Send success response
      this.sendJSON(res, 200, {
        received: true,
        eventId: event.id,
      });

      return true;
    } catch (error) {
      console.error('[HookReceiver] Error:', error);
      this.sendJSON(res, 500, {
        received: false,
        error: 'Internal server error',
      });
      return true;
    }
  }

  /**
   * Get recent event history
   */
  getHistory(): UniversalHookEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Add event to history with size limit
   */
  private addToHistory(event: UniversalHookEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Parse JSON body from request
   */
  private parseBody(req: IncomingMessage): Promise<unknown | null> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });

      req.on('error', () => {
        resolve(null);
      });

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * Send JSON response
   */
  private sendJSON(res: ServerResponse, status: number, data: object): void {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
  }

  /**
   * Extract client IP from request
   */
  private getClientIp(req: IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }
}

/**
 * Handle CORS preflight requests for /api/hooks
 */
export function handleCORSPreflight(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }
  return false;
}
