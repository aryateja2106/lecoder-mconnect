/**
 * Push Notification Service
 *
 * Sends APNs push notifications for agent events.
 * Uses HTTP/2 with JWT-based authentication to communicate with APNs.
 */

import * as jose from 'jose';
import { deviceTokenRepository } from '../db/repositories/device-token.js';
import { getOpikService } from '../observability/OpikService.js';
import type { PushNotificationPayload } from '@lecoder/shared/protocol';

// ============================================================================
// Types
// ============================================================================

interface APNsConfig {
  /** APNs Key ID from Apple Developer Portal */
  keyId: string;
  /** Team ID from Apple Developer Portal */
  teamId: string;
  /** Private key contents (.p8 file) */
  privateKey: string;
  /** Bundle ID for the app */
  bundleId: string;
  /** Use production APNs (default: false for sandbox) */
  production: boolean;
}

interface APNsNotification {
  /** Device token (hex string) */
  deviceToken: string;
  /** APNs payload */
  payload: APNsPayload;
  /** Optional expiry (Unix timestamp) */
  expiration?: number;
  /** Priority: 10 (immediate) or 5 (power considerations) */
  priority?: 5 | 10;
  /** Push type */
  pushType?: 'alert' | 'background';
}

interface APNsPayload {
  aps: {
    alert?: {
      title: string;
      body: string;
    };
    badge?: number;
    sound?: string;
    'content-available'?: number;
    'mutable-content'?: number;
  };
  /** Custom data fields */
  [key: string]: unknown;
}

interface APNsSendResult {
  success: boolean;
  deviceToken: string;
  statusCode?: number;
  reason?: string;
}

// ============================================================================
// PushService Class
// ============================================================================

export class PushService {
  private config: APNsConfig | null = null;
  private jwtToken: string | null = null;
  private jwtExpiresAt = 0;
  private privateKey: jose.KeyLike | null = null;
  private initialized = false;

  /**
   * Initialize the push service with APNs credentials
   */
  async initialize(config?: Partial<APNsConfig>): Promise<void> {
    const keyId = config?.keyId ?? process.env.APNS_KEY_ID;
    const teamId = config?.teamId ?? process.env.APNS_TEAM_ID;
    const privateKey = config?.privateKey ?? process.env.APNS_PRIVATE_KEY;
    const bundleId = config?.bundleId ?? process.env.APNS_BUNDLE_ID ?? 'com.lecoder.mconnect';
    const production = config?.production ?? process.env.APNS_PRODUCTION === 'true';

    if (!keyId || !teamId || !privateKey) {
      console.warn('[PushService] APNs credentials not configured. Push notifications disabled.');
      return;
    }

    try {
      // Parse the private key
      this.privateKey = await jose.importPKCS8(privateKey, 'ES256');

      this.config = {
        keyId,
        teamId,
        privateKey,
        bundleId,
        production,
      };

      this.initialized = true;
      console.log(`[PushService] Initialized (${production ? 'production' : 'sandbox'})`);
    } catch (error) {
      console.error('[PushService] Failed to initialize:', error);
    }
  }

  /**
   * Check if push notifications are enabled
   */
  isEnabled(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * Send a push notification to a user by userId
   */
  async sendToUser(userId: string, payload: PushNotificationPayload): Promise<APNsSendResult[]> {
    if (!this.isEnabled()) {
      return [];
    }

    const opik = getOpikService();
    const traceCtx = opik.startTrace('push:sendToUser', {
      userId,
      notificationType: payload.type,
    });

    try {
      // Get all active device tokens for the user
      const tokens = await deviceTokenRepository.getActiveTokensByUser(userId);

      if (tokens.length === 0) {
        opik.endTrace(traceCtx, { tokenCount: 0, sent: 0 });
        return [];
      }

      // Build APNs payload
      const apnsPayload = this.buildAPNsPayload(payload);

      // Send to all device tokens in parallel
      const results = await Promise.all(
        tokens
          .filter((t) => t.platform === 'ios')
          .map((t) =>
            this.sendNotification({
              deviceToken: t.token,
              payload: apnsPayload,
              priority: 10,
              pushType: 'alert',
            })
          )
      );

      // Deactivate any tokens that APNs reports as invalid
      for (const result of results) {
        if (!result.success && this.isInvalidTokenError(result.reason)) {
          await deviceTokenRepository.deactivateToken(result.deviceToken);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      opik.endTrace(traceCtx, {
        tokenCount: tokens.length,
        sent: successCount,
        failed: results.length - successCount,
      });

      return results;
    } catch (error) {
      opik.endTrace(traceCtx, undefined, error as Error);
      return [];
    }
  }

  /**
   * Send agent completed notification
   */
  async notifyAgentCompleted(
    userId: string,
    agentId: string,
    agentName: string,
    sessionId: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      type: 'agent_completed',
      title: 'Agent Completed',
      body: `${agentName} has finished execution`,
      sessionId,
      agentId,
      agentName,
      sound: 'default',
    });
  }

  /**
   * Send agent error notification
   */
  async notifyAgentError(
    userId: string,
    agentId: string,
    agentName: string,
    sessionId: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      type: 'agent_error',
      title: 'Agent Error',
      body: `${agentName} encountered an error`,
      sessionId,
      agentId,
      agentName,
      sound: 'default',
    });
  }

  /**
   * Send approval required notification
   */
  async notifyApprovalRequired(
    userId: string,
    command: string,
    sessionId: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      type: 'approval_required',
      title: 'Approval Required',
      body: `A guarded command needs your approval`,
      sessionId,
      command,
      sound: 'default',
    });
  }

  /**
   * Send session idle notification
   */
  async notifySessionIdle(
    userId: string,
    sessionId: string
  ): Promise<void> {
    await this.sendToUser(userId, {
      type: 'session_idle',
      title: 'Session Idle',
      body: 'Your session has been idle. Agents may be waiting for input.',
      sessionId,
      sound: 'default',
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build APNs payload from our notification payload
   */
  private buildAPNsPayload(payload: PushNotificationPayload): APNsPayload {
    return {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge ?? 1,
        sound: payload.sound ?? 'default',
        'mutable-content': 1,
      },
      // Custom data for the app to process
      type: payload.type,
      sessionId: payload.sessionId,
      agentId: payload.agentId,
      agentName: payload.agentName,
      command: payload.command,
    };
  }

  /**
   * Send a single notification to APNs
   */
  private async sendNotification(notification: APNsNotification): Promise<APNsSendResult> {
    if (!this.config) {
      return { success: false, deviceToken: notification.deviceToken, reason: 'not_configured' };
    }

    try {
      const jwt = await this.getJWT();
      const host = this.config.production
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com';

      const url = `${host}/3/device/${notification.deviceToken}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'authorization': `bearer ${jwt}`,
          'apns-topic': this.config.bundleId,
          'apns-push-type': notification.pushType ?? 'alert',
          'apns-priority': String(notification.priority ?? 10),
          ...(notification.expiration
            ? { 'apns-expiration': String(notification.expiration) }
            : {}),
          'content-type': 'application/json',
        },
        body: JSON.stringify(notification.payload),
      });

      if (response.ok) {
        return { success: true, deviceToken: notification.deviceToken, statusCode: response.status };
      }

      // Parse error response
      let reason = 'unknown';
      try {
        const body = await response.json() as { reason?: string };
        reason = body.reason ?? 'unknown';
      } catch {
        // Ignore parse errors
      }

      return {
        success: false,
        deviceToken: notification.deviceToken,
        statusCode: response.status,
        reason,
      };
    } catch (error) {
      return {
        success: false,
        deviceToken: notification.deviceToken,
        reason: (error as Error).message,
      };
    }
  }

  /**
   * Get or refresh APNs JWT token
   */
  private async getJWT(): Promise<string> {
    // APNs JWTs are valid for up to 60 minutes; refresh at 50 min
    const now = Math.floor(Date.now() / 1000);
    if (this.jwtToken && this.jwtExpiresAt > now) {
      return this.jwtToken;
    }

    if (!this.config || !this.privateKey) {
      throw new Error('PushService not initialized');
    }

    const token = await new jose.SignJWT({})
      .setProtectedHeader({
        alg: 'ES256',
        kid: this.config.keyId,
      })
      .setIssuer(this.config.teamId)
      .setIssuedAt()
      .sign(this.privateKey);

    this.jwtToken = token;
    this.jwtExpiresAt = now + 3000; // Refresh after 50 minutes

    return token;
  }

  /**
   * Check if an APNs error indicates an invalid token
   */
  private isInvalidTokenError(reason?: string): boolean {
    if (!reason) return false;
    return [
      'BadDeviceToken',
      'Unregistered',
      'DeviceTokenNotForTopic',
      'ExpiredToken',
    ].includes(reason);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let pushServiceInstance: PushService | null = null;

/**
 * Get the global PushService instance
 */
export function getPushService(): PushService {
  if (!pushServiceInstance) {
    pushServiceInstance = new PushService();
  }
  return pushServiceInstance;
}

/**
 * Initialize the PushService
 */
export async function initializePushService(config?: Partial<APNsConfig>): Promise<PushService> {
  const service = getPushService();
  await service.initialize(config);
  return service;
}

/**
 * Reset the PushService (for testing)
 */
export function resetPushService(): void {
  pushServiceInstance = null;
}

export default PushService;
