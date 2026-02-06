/**
 * Notification Bridge
 *
 * Wires AgentManager lifecycle events to the PushService.
 * Listens for agent status changes and sends push notifications
 * to the session owner when notable events occur.
 */

import type { AgentStatus } from '@lecoder/shared';
import { type AgentManager, getAgentManager } from '../agents/AgentManager.js';
import { getPushService, type PushService } from './PushService.js';
import { sessionRepository } from '../db/repositories/session.js';
import { agentRepository } from '../db/repositories/agent.js';

// ============================================================================
// NotificationBridge Class
// ============================================================================

export class NotificationBridge {
  private agentManager: AgentManager;
  private pushService: PushService;
  private listening = false;

  constructor(agentManager?: AgentManager, pushService?: PushService) {
    this.agentManager = agentManager ?? getAgentManager();
    this.pushService = pushService ?? getPushService();
  }

  /**
   * Start listening to agent events
   */
  start(): void {
    if (this.listening) return;

    this.agentManager.on('statusChange', this.handleStatusChange.bind(this));
    this.agentManager.on('error', this.handleError.bind(this));
    this.listening = true;

    console.log('[NotificationBridge] Listening for agent events');
  }

  /**
   * Stop listening to agent events
   */
  stop(): void {
    if (!this.listening) return;

    this.agentManager.removeListener('statusChange', this.handleStatusChange.bind(this));
    this.agentManager.removeListener('error', this.handleError.bind(this));
    this.listening = false;
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  /**
   * Handle agent status change events
   */
  private async handleStatusChange(
    agentId: string,
    status: AgentStatus,
    previousStatus: AgentStatus
  ): Promise<void> {
    // Only notify on terminal states (exited, error) from running states
    if (status === 'exited' && (previousStatus === 'running' || previousStatus === 'idle')) {
      await this.sendAgentCompletedNotification(agentId);
    } else if (status === 'error' && previousStatus !== 'error') {
      await this.sendAgentErrorNotification(agentId);
    }
  }

  /**
   * Handle agent error events
   */
  private async handleError(agentId: string, _error: Error): Promise<void> {
    await this.sendAgentErrorNotification(agentId);
  }

  // ==========================================================================
  // Notification Senders
  // ==========================================================================

  /**
   * Send agent completed notification to session owner
   */
  private async sendAgentCompletedNotification(agentId: string): Promise<void> {
    if (!this.pushService.isEnabled()) return;

    try {
      const { userId, agentName, sessionId } = await this.resolveAgentContext(agentId);
      if (!userId) return;

      await this.pushService.notifyAgentCompleted(userId, agentId, agentName, sessionId);
    } catch (error) {
      console.error('[NotificationBridge] Failed to send agent completed notification:', error);
    }
  }

  /**
   * Send agent error notification to session owner
   */
  private async sendAgentErrorNotification(agentId: string): Promise<void> {
    if (!this.pushService.isEnabled()) return;

    try {
      const { userId, agentName, sessionId } = await this.resolveAgentContext(agentId);
      if (!userId) return;

      await this.pushService.notifyAgentError(userId, agentId, agentName, sessionId);
    } catch (error) {
      console.error('[NotificationBridge] Failed to send agent error notification:', error);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Resolve agent context (userId, agentName, sessionId) from agentId
   */
  private async resolveAgentContext(agentId: string): Promise<{
    userId: string | null;
    agentName: string;
    sessionId: string;
  }> {
    // Look up agent to get sessionId and name
    const agent = await agentRepository.findById(agentId);
    if (!agent) {
      return { userId: null, agentName: 'Unknown Agent', sessionId: '' };
    }

    // Look up session to get userId
    const session = await sessionRepository.findById(agent.sessionId);
    if (!session) {
      return { userId: null, agentName: agent.name, sessionId: agent.sessionId };
    }

    return {
      userId: session.userId,
      agentName: agent.name,
      sessionId: agent.sessionId,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let bridgeInstance: NotificationBridge | null = null;

/**
 * Get the global NotificationBridge instance
 */
export function getNotificationBridge(): NotificationBridge {
  if (!bridgeInstance) {
    bridgeInstance = new NotificationBridge();
  }
  return bridgeInstance;
}

/**
 * Initialize and start the NotificationBridge
 */
export function initializeNotificationBridge(
  agentManager?: AgentManager,
  pushService?: PushService
): NotificationBridge {
  if (bridgeInstance) {
    bridgeInstance.stop();
  }
  bridgeInstance = new NotificationBridge(agentManager, pushService);
  bridgeInstance.start();
  return bridgeInstance;
}

/**
 * Reset the NotificationBridge (for testing)
 */
export function resetNotificationBridge(): void {
  if (bridgeInstance) {
    bridgeInstance.stop();
    bridgeInstance = null;
  }
}

export default NotificationBridge;
