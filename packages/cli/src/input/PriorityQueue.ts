/**
 * Priority Queue - Client priority management
 * MConnect v0.2.0
 *
 * Manages client priority levels for input arbitration
 * Priority order: EXCLUSIVE > HIGH > NORMAL > LOW > OBSERVER
 */

import type { Priority, ClientType } from '../session/types.js';

export interface QueuedClient {
  clientId: string;
  clientType: ClientType;
  priority: Priority;
  joinedAt: Date;
}

/**
 * Priority order mapping (higher number = higher priority)
 */
const PRIORITY_ORDER: Record<Priority, number> = {
  exclusive: 4,
  high: 3,
  normal: 2,
  low: 1,
  observer: 0,
};

export class PriorityQueue {
  private clients: Map<string, QueuedClient> = new Map();

  /**
   * Add or update a client in the queue
   */
  add(clientId: string, clientType: ClientType, priority: Priority = 'normal'): void {
    const existing = this.clients.get(clientId);

    this.clients.set(clientId, {
      clientId,
      clientType,
      priority,
      joinedAt: existing?.joinedAt ?? new Date(),
    });
  }

  /**
   * Remove a client from the queue
   */
  remove(clientId: string): boolean {
    return this.clients.delete(clientId);
  }

  /**
   * Update a client's priority
   */
  updatePriority(clientId: string, priority: Priority): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.priority = priority;
    return true;
  }

  /**
   * Get the highest priority client that can send input
   * Observer priority clients are never considered for input
   */
  getActiveClient(): QueuedClient | null {
    let highest: QueuedClient | null = null;
    let highestOrder = -1;

    for (const client of this.clients.values()) {
      // Observers cannot send input
      if (client.priority === 'observer') {
        continue;
      }

      const order = PRIORITY_ORDER[client.priority];
      if (order > highestOrder) {
        highest = client;
        highestOrder = order;
      } else if (order === highestOrder && highest) {
        // Same priority: prefer PC clients, then earlier join time
        if (client.clientType === 'pc' && highest.clientType !== 'pc') {
          highest = client;
        } else if (client.clientType === highest.clientType) {
          // Same type: prefer earlier join time
          if (client.joinedAt < highest.joinedAt) {
            highest = client;
          }
        }
      }
    }

    return highest;
  }

  /**
   * Get the client with exclusive priority (if any)
   */
  getExclusiveClient(): QueuedClient | null {
    for (const client of this.clients.values()) {
      if (client.priority === 'exclusive') {
        return client;
      }
    }
    return null;
  }

  /**
   * Check if a client can send input based on their priority
   */
  canSendInput(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.priority === 'observer') {
      return false;
    }

    // If there's an exclusive client, only they can send
    const exclusive = this.getExclusiveClient();
    if (exclusive) {
      return exclusive.clientId === clientId;
    }

    // Otherwise, check if this is the active (highest priority) client
    const active = this.getActiveClient();
    return active?.clientId === clientId;
  }

  /**
   * Get a client by ID
   */
  get(clientId: string): QueuedClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients
   */
  getAll(): QueuedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients by type
   */
  getByType(clientType: ClientType): QueuedClient[] {
    return this.getAll().filter((c) => c.clientType === clientType);
  }

  /**
   * Get all PC clients (non-observer)
   */
  getPcClients(): QueuedClient[] {
    return this.getByType('pc').filter((c) => c.priority !== 'observer');
  }

  /**
   * Get all mobile clients (non-observer)
   */
  getMobileClients(): QueuedClient[] {
    return this.getByType('mobile').filter((c) => c.priority !== 'observer');
  }

  /**
   * Check if any PC client is present (non-observer)
   */
  hasPcClient(): boolean {
    return this.getPcClients().length > 0;
  }

  /**
   * Check if any mobile client is present (non-observer)
   */
  hasMobileClient(): boolean {
    return this.getMobileClients().length > 0;
  }

  /**
   * Clear all exclusive priorities (reset to their default)
   */
  clearExclusive(): void {
    for (const client of this.clients.values()) {
      if (client.priority === 'exclusive') {
        // Reset to default based on client type
        client.priority = client.clientType === 'pc' ? 'high' : 'normal';
      }
    }
  }

  /**
   * Get number of clients
   */
  size(): number {
    return this.clients.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.clients.size === 0;
  }

  /**
   * Clear all clients
   */
  clear(): void {
    this.clients.clear();
  }

  /**
   * Get clients sorted by priority (highest first)
   */
  getSorted(): QueuedClient[] {
    return this.getAll().sort((a, b) => {
      const orderDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (orderDiff !== 0) return orderDiff;

      // Same priority: prefer PC, then earlier join
      if (a.clientType === 'pc' && b.clientType !== 'pc') return -1;
      if (b.clientType === 'pc' && a.clientType !== 'pc') return 1;

      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
  }

  /**
   * Compare two priorities
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  static comparePriority(a: Priority, b: Priority): number {
    return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
  }

  /**
   * Get the default priority for a client type
   */
  static getDefaultPriority(clientType: ClientType): Priority {
    return clientType === 'pc' ? 'high' : 'normal';
  }
}
