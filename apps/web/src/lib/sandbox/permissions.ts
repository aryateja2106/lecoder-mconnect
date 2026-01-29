/**
 * Browser Sandbox Permission Manager
 * MConnect v1.1.0
 *
 * Manages browser permissions for sandbox capabilities.
 * Handles permission requests, state tracking, and expiration.
 */

import type {
  PermissionType,
  PermissionState,
  PermissionConfig,
  SandboxEvent,
} from './types.js';

/**
 * Permission request options
 */
export interface PermissionRequestOptions {
  /** Optional duration in milliseconds before permission expires */
  expiresIn?: number;
  /** Whether to prompt user even if previously denied */
  forcePrompt?: boolean;
}

/**
 * Permission manager for browser sandbox
 */
export class PermissionManager {
  private permissions: Map<PermissionType, PermissionConfig> = new Map();
  private listeners: Set<(event: SandboxEvent) => void> = new Set();

  constructor() {
    this.initializeDefaults();
  }

  /**
   * Initialize default permission states
   */
  private initializeDefaults(): void {
    const defaultPermissions: PermissionType[] = [
      'terminal_view',
      'terminal_input',
      'file_download',
      'clipboard_read',
      'clipboard_write',
      'notification',
    ];

    for (const type of defaultPermissions) {
      this.permissions.set(type, {
        type,
        state: 'prompt',
      });
    }
  }

  /**
   * Get current state of a permission
   */
  getState(type: PermissionType): PermissionState {
    const config = this.permissions.get(type);
    if (!config) return 'prompt';

    // Check if permission has expired
    if (config.expiresAt && new Date() > config.expiresAt) {
      this.updatePermission(type, 'prompt');
      return 'prompt';
    }

    return config.state;
  }

  /**
   * Get full permission configuration
   */
  getConfig(type: PermissionType): PermissionConfig | undefined {
    return this.permissions.get(type);
  }

  /**
   * Get all permissions
   */
  getAllPermissions(): Map<PermissionType, PermissionConfig> {
    return new Map(this.permissions);
  }

  /**
   * Request a permission from the user
   */
  async request(
    type: PermissionType,
    options: PermissionRequestOptions = {}
  ): Promise<PermissionState> {
    const currentState = this.getState(type);

    // If already granted and not forcing prompt, return current state
    if (currentState === 'granted' && !options.forcePrompt) {
      return 'granted';
    }

    // If denied and not forcing prompt, return denied
    if (currentState === 'denied' && !options.forcePrompt) {
      return 'denied';
    }

    // Request permission based on type
    const granted = await this.requestBrowserPermission(type);
    const newState: PermissionState = granted ? 'granted' : 'denied';

    // Calculate expiration if specified
    let expiresAt: Date | undefined;
    if (granted && options.expiresIn) {
      expiresAt = new Date(Date.now() + options.expiresIn);
    }

    this.updatePermission(type, newState, expiresAt);
    return newState;
  }

  /**
   * Grant a permission programmatically
   */
  grant(type: PermissionType, expiresIn?: number): void {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : undefined;
    this.updatePermission(type, 'granted', expiresAt);
  }

  /**
   * Deny a permission programmatically
   */
  deny(type: PermissionType): void {
    this.updatePermission(type, 'denied');
  }

  /**
   * Reset a permission to prompt state
   */
  reset(type: PermissionType): void {
    this.updatePermission(type, 'prompt');
  }

  /**
   * Reset all permissions to prompt state
   */
  resetAll(): void {
    for (const type of this.permissions.keys()) {
      this.reset(type);
    }
  }

  /**
   * Check if a permission is granted
   */
  isGranted(type: PermissionType): boolean {
    return this.getState(type) === 'granted';
  }

  /**
   * Check if all specified permissions are granted
   */
  areAllGranted(types: PermissionType[]): boolean {
    return types.every((type) => this.isGranted(type));
  }

  /**
   * Add event listener for permission changes
   */
  addEventListener(callback: (event: SandboxEvent) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: (event: SandboxEvent) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Update permission state and emit event
   */
  private updatePermission(
    type: PermissionType,
    state: PermissionState,
    expiresAt?: Date
  ): void {
    const config: PermissionConfig = {
      type,
      state,
      grantedAt: state === 'granted' ? new Date() : undefined,
      expiresAt,
    };

    this.permissions.set(type, config);
    this.emitEvent('permission_changed', { type, state, expiresAt });
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(type: SandboxEvent['type'], data: unknown): void {
    const event: SandboxEvent = {
      type,
      timestamp: new Date(),
      data,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in permission event listener:', error);
      }
    }
  }

  /**
   * Request browser-level permission
   */
  private async requestBrowserPermission(type: PermissionType): Promise<boolean> {
    switch (type) {
      case 'clipboard_read':
        return this.requestClipboardRead();

      case 'clipboard_write':
        return this.requestClipboardWrite();

      case 'notification':
        return this.requestNotification();

      case 'terminal_view':
      case 'terminal_input':
      case 'file_download':
        // These are app-level permissions, not browser permissions
        // Return true to indicate the app can manage these
        return true;

      default:
        return false;
    }
  }

  /**
   * Request clipboard read permission
   */
  private async requestClipboardRead(): Promise<boolean> {
    try {
      if (!navigator.clipboard) return false;

      // Try to read clipboard to trigger permission prompt
      await navigator.clipboard.readText();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request clipboard write permission
   */
  private async requestClipboardWrite(): Promise<boolean> {
    try {
      if (!navigator.clipboard) return false;

      // Try to write to clipboard to trigger permission prompt
      await navigator.clipboard.writeText('');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request notification permission
   */
  private async requestNotification(): Promise<boolean> {
    try {
      if (!('Notification' in window)) return false;

      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
}

/**
 * Default permission manager instance
 */
export const permissionManager = new PermissionManager();
