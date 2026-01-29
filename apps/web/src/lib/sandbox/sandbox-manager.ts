/**
 * Browser Sandbox Manager
 * MConnect v1.1.0
 *
 * Central manager for browser sandbox state and lifecycle.
 * Coordinates permissions, capabilities, and CSP configuration.
 */

import type {
  SandboxState,
  SandboxCapabilities,
  SandboxEvent,
  PermissionType,
  CSPConfig,
} from './types.js';
import { PermissionManager } from './permissions.js';
import { CapabilityMonitor, detectCapabilities, isSecureContext } from './capabilities.js';
import {
  CSPViolationMonitor,
  createCSPConfig,
  type CSPPreset,
} from './csp.js';

/**
 * Sandbox manager configuration
 */
export interface SandboxManagerConfig {
  /** CSP preset to use */
  cspPreset?: CSPPreset;
  /** Custom CSP overrides */
  cspOverrides?: Partial<CSPConfig>;
  /** Capability monitoring interval (ms) */
  capabilityCheckInterval?: number;
  /** Auto-start monitoring on creation */
  autoStart?: boolean;
}

/**
 * Sandbox ready state
 */
export interface SandboxReadyState {
  /** Sandbox is fully initialized */
  ready: boolean;
  /** Running in secure context (HTTPS) */
  secureContext: boolean;
  /** Detected capabilities */
  capabilities: SandboxCapabilities;
  /** Any warnings or issues */
  warnings: string[];
}

/**
 * Central sandbox manager
 */
export class SandboxManager {
  private permissionManager: PermissionManager;
  private capabilityMonitor: CapabilityMonitor;
  private cspViolationMonitor: CSPViolationMonitor;
  private config: Required<SandboxManagerConfig>;
  private active = false;
  private listeners: Set<(event: SandboxEvent) => void> = new Set();

  constructor(config: SandboxManagerConfig = {}) {
    this.config = {
      cspPreset: config.cspPreset ?? 'default',
      cspOverrides: config.cspOverrides ?? {},
      capabilityCheckInterval: config.capabilityCheckInterval ?? 5000,
      autoStart: config.autoStart ?? true,
    };

    this.permissionManager = new PermissionManager();
    this.capabilityMonitor = new CapabilityMonitor();
    this.cspViolationMonitor = new CSPViolationMonitor();

    // Forward events from sub-managers
    this.setupEventForwarding();

    // Auto-start if configured
    if (this.config.autoStart) {
      this.start().catch((error) => {
        console.error('Failed to auto-start sandbox manager:', error);
      });
    }
  }

  /**
   * Start the sandbox manager
   */
  async start(): Promise<SandboxReadyState> {
    if (this.active) {
      return this.getReadyState();
    }

    // Start capability monitoring
    await this.capabilityMonitor.start(this.config.capabilityCheckInterval);

    // Start CSP violation monitoring
    this.cspViolationMonitor.start();

    this.active = true;
    return this.getReadyState();
  }

  /**
   * Stop the sandbox manager
   */
  stop(): void {
    this.capabilityMonitor.stop();
    this.cspViolationMonitor.stop();
    this.active = false;
  }

  /**
   * Get sandbox ready state
   */
  async getReadyState(): Promise<SandboxReadyState> {
    const capabilities = await detectCapabilities();
    const secureContext = isSecureContext();
    const warnings: string[] = [];

    // Check for issues
    if (!secureContext) {
      warnings.push('Not running in secure context (HTTPS required for some features)');
    }

    if (!capabilities.webSocket) {
      warnings.push('WebSocket not available - terminal sharing will not work');
    }

    if (!capabilities.clipboard) {
      warnings.push('Clipboard API not available - copy/paste disabled');
    }

    return {
      ready: this.active && capabilities.webSocket,
      secureContext,
      capabilities,
      warnings,
    };
  }

  /**
   * Get current sandbox state
   */
  getState(): SandboxState {
    return {
      permissions: this.permissionManager.getAllPermissions(),
      capabilities: this.capabilityMonitor.getCapabilities() ?? {
        fileSystemAccess: false,
        clipboard: false,
        notifications: false,
        serviceWorker: false,
        webSocket: false,
        sandboxedIframe: false,
        iframeCsp: false,
      },
      csp: createCSPConfig(this.config.cspPreset, this.config.cspOverrides),
      active: this.active,
    };
  }

  /**
   * Request a permission
   */
  async requestPermission(type: PermissionType): Promise<boolean> {
    const result = await this.permissionManager.request(type);
    return result === 'granted';
  }

  /**
   * Check if a permission is granted
   */
  hasPermission(type: PermissionType): boolean {
    return this.permissionManager.isGranted(type);
  }

  /**
   * Grant a permission (for app-level permissions)
   */
  grantPermission(type: PermissionType, expiresIn?: number): void {
    this.permissionManager.grant(type, expiresIn);
  }

  /**
   * Deny a permission
   */
  denyPermission(type: PermissionType): void {
    this.permissionManager.deny(type);
  }

  /**
   * Get capabilities
   */
  getCapabilities(): SandboxCapabilities | null {
    return this.capabilityMonitor.getCapabilities();
  }

  /**
   * Get CSP violations
   */
  getCSPViolations() {
    return this.cspViolationMonitor.getViolations();
  }

  /**
   * Clear CSP violations
   */
  clearCSPViolations(): void {
    this.cspViolationMonitor.clearViolations();
  }

  /**
   * Add event listener for sandbox events
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
   * Check if manager is active
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Setup event forwarding from sub-managers
   */
  private setupEventForwarding(): void {
    const forward = (event: SandboxEvent) => {
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in sandbox event listener:', error);
        }
      }
    };

    this.permissionManager.addEventListener(forward);
    this.capabilityMonitor.addEventListener(forward);
    this.cspViolationMonitor.addEventListener(forward);
  }
}

/**
 * Default sandbox manager instance
 */
let defaultManager: SandboxManager | null = null;

/**
 * Get the default sandbox manager
 */
export function getSandboxManager(): SandboxManager {
  if (!defaultManager) {
    defaultManager = new SandboxManager({ autoStart: false });
  }
  return defaultManager;
}

/**
 * Initialize the default sandbox manager
 */
export async function initializeSandbox(
  config?: SandboxManagerConfig
): Promise<SandboxReadyState> {
  if (defaultManager) {
    defaultManager.stop();
  }
  defaultManager = new SandboxManager({ ...config, autoStart: false });
  return defaultManager.start();
}
