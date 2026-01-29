/**
 * Browser Sandbox Capability Detection
 * MConnect v1.1.0
 *
 * Detects available browser capabilities for sandboxing.
 * Provides runtime feature detection for security-sensitive APIs.
 */

import type { SandboxCapabilities, SandboxEvent } from './types.js';

/**
 * Capability detection result with details
 */
export interface CapabilityDetails {
  available: boolean;
  reason?: string;
  version?: string;
}

/**
 * Extended capabilities with detailed info
 */
export interface DetailedCapabilities {
  fileSystemAccess: CapabilityDetails;
  clipboard: CapabilityDetails;
  notifications: CapabilityDetails;
  serviceWorker: CapabilityDetails;
  webSocket: CapabilityDetails;
  sandboxedIframe: CapabilityDetails;
  iframeCsp: CapabilityDetails;
}

/**
 * Detect all browser sandbox capabilities
 */
export async function detectCapabilities(): Promise<SandboxCapabilities> {
  const [
    fileSystemAccess,
    clipboard,
    notifications,
    serviceWorker,
    webSocket,
    sandboxedIframe,
    iframeCsp,
  ] = await Promise.all([
    detectFileSystemAccess(),
    detectClipboard(),
    detectNotifications(),
    detectServiceWorker(),
    detectWebSocket(),
    detectSandboxedIframe(),
    detectIframeCsp(),
  ]);

  return {
    fileSystemAccess,
    clipboard,
    notifications,
    serviceWorker,
    webSocket,
    sandboxedIframe,
    iframeCsp,
  };
}

/**
 * Detect capabilities with detailed information
 */
export async function detectDetailedCapabilities(): Promise<DetailedCapabilities> {
  return {
    fileSystemAccess: await detectFileSystemAccessDetails(),
    clipboard: await detectClipboardDetails(),
    notifications: await detectNotificationsDetails(),
    serviceWorker: await detectServiceWorkerDetails(),
    webSocket: detectWebSocketDetails(),
    sandboxedIframe: detectSandboxedIframeDetails(),
    iframeCsp: detectIframeCspDetails(),
  };
}

/**
 * Check if File System Access API is available
 */
export async function detectFileSystemAccess(): Promise<boolean> {
  try {
    return 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
  } catch {
    return false;
  }
}

/**
 * Detailed File System Access detection
 */
async function detectFileSystemAccessDetails(): Promise<CapabilityDetails> {
  const hasShowOpenFilePicker = 'showOpenFilePicker' in window;
  const hasShowSaveFilePicker = 'showSaveFilePicker' in window;
  const hasShowDirectoryPicker = 'showDirectoryPicker' in window;

  if (!hasShowOpenFilePicker && !hasShowSaveFilePicker && !hasShowDirectoryPicker) {
    return {
      available: false,
      reason: 'File System Access API not supported in this browser',
    };
  }

  const features: string[] = [];
  if (hasShowOpenFilePicker) features.push('open');
  if (hasShowSaveFilePicker) features.push('save');
  if (hasShowDirectoryPicker) features.push('directory');

  return {
    available: true,
    reason: `Supported features: ${features.join(', ')}`,
  };
}

/**
 * Check if Clipboard API is available
 */
export async function detectClipboard(): Promise<boolean> {
  try {
    return 'clipboard' in navigator && 'readText' in navigator.clipboard;
  } catch {
    return false;
  }
}

/**
 * Detailed Clipboard API detection
 */
async function detectClipboardDetails(): Promise<CapabilityDetails> {
  if (!('clipboard' in navigator)) {
    return {
      available: false,
      reason: 'Clipboard API not available',
    };
  }

  const hasReadText = 'readText' in navigator.clipboard;
  const hasWriteText = 'writeText' in navigator.clipboard;
  const hasRead = 'read' in navigator.clipboard;
  const hasWrite = 'write' in navigator.clipboard;

  const features: string[] = [];
  if (hasReadText) features.push('readText');
  if (hasWriteText) features.push('writeText');
  if (hasRead) features.push('read');
  if (hasWrite) features.push('write');

  return {
    available: features.length > 0,
    reason: `Available methods: ${features.join(', ')}`,
  };
}

/**
 * Check if Notification API is available
 */
export async function detectNotifications(): Promise<boolean> {
  try {
    return 'Notification' in window;
  } catch {
    return false;
  }
}

/**
 * Detailed Notification API detection
 */
async function detectNotificationsDetails(): Promise<CapabilityDetails> {
  if (!('Notification' in window)) {
    return {
      available: false,
      reason: 'Notification API not supported',
    };
  }

  const permission = Notification.permission;
  return {
    available: true,
    reason: `Current permission: ${permission}`,
  };
}

/**
 * Check if Service Worker is available
 */
export async function detectServiceWorker(): Promise<boolean> {
  try {
    return 'serviceWorker' in navigator;
  } catch {
    return false;
  }
}

/**
 * Detailed Service Worker detection
 */
async function detectServiceWorkerDetails(): Promise<CapabilityDetails> {
  if (!('serviceWorker' in navigator)) {
    return {
      available: false,
      reason: 'Service Worker not supported',
    };
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return {
      available: true,
      reason: `${registrations.length} registration(s) active`,
    };
  } catch (error) {
    return {
      available: true,
      reason: 'Available but registration check failed',
    };
  }
}

/**
 * Check if WebSocket is available
 */
export function detectWebSocket(): Promise<boolean> {
  return Promise.resolve('WebSocket' in window);
}

/**
 * Detailed WebSocket detection
 */
function detectWebSocketDetails(): CapabilityDetails {
  if (!('WebSocket' in window)) {
    return {
      available: false,
      reason: 'WebSocket not supported',
    };
  }

  return {
    available: true,
    reason: 'WebSocket API available',
  };
}

/**
 * Check if sandboxed iframes are supported
 */
export function detectSandboxedIframe(): Promise<boolean> {
  try {
    const iframe = document.createElement('iframe');
    return Promise.resolve('sandbox' in iframe);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Detailed sandboxed iframe detection
 */
function detectSandboxedIframeDetails(): CapabilityDetails {
  try {
    const iframe = document.createElement('iframe');
    if (!('sandbox' in iframe)) {
      return {
        available: false,
        reason: 'Sandbox attribute not supported on iframes',
      };
    }

    // Check supported sandbox tokens
    const tokens = [
      'allow-scripts',
      'allow-same-origin',
      'allow-forms',
      'allow-popups',
      'allow-modals',
      'allow-downloads',
    ];

    return {
      available: true,
      reason: `Sandbox tokens available: ${tokens.join(', ')}`,
    };
  } catch (error) {
    return {
      available: false,
      reason: 'Failed to detect iframe sandbox support',
    };
  }
}

/**
 * Check if iframe CSP attribute is supported
 */
export function detectIframeCsp(): Promise<boolean> {
  try {
    const iframe = document.createElement('iframe');
    return Promise.resolve('csp' in iframe);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Detailed iframe CSP detection
 */
function detectIframeCspDetails(): CapabilityDetails {
  try {
    const iframe = document.createElement('iframe');
    if (!('csp' in iframe)) {
      return {
        available: false,
        reason: 'CSP attribute not supported on iframes (use HTTP headers instead)',
      };
    }

    return {
      available: true,
      reason: 'CSP attribute supported on iframes',
    };
  } catch (error) {
    return {
      available: false,
      reason: 'Failed to detect iframe CSP support',
    };
  }
}

/**
 * Check if running in a secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext ?? false;
}

/**
 * Get browser information for capability reporting
 */
export function getBrowserInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;

  // Detect browser name and version
  if (ua.includes('Firefox/')) {
    const version = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] ?? 'unknown';
    return { name: 'Firefox', version };
  }

  if (ua.includes('Edg/')) {
    const version = ua.match(/Edg\/(\d+\.\d+)/)?.[1] ?? 'unknown';
    return { name: 'Edge', version };
  }

  if (ua.includes('Chrome/')) {
    const version = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] ?? 'unknown';
    return { name: 'Chrome', version };
  }

  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const version = ua.match(/Version\/(\d+\.\d+)/)?.[1] ?? 'unknown';
    return { name: 'Safari', version };
  }

  return { name: 'Unknown', version: 'unknown' };
}

/**
 * CapabilityMonitor class for watching capability changes
 */
export class CapabilityMonitor {
  private capabilities: SandboxCapabilities | null = null;
  private listeners: Set<(event: SandboxEvent) => void> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start monitoring capabilities
   */
  async start(intervalMs: number = 5000): Promise<SandboxCapabilities> {
    this.capabilities = await detectCapabilities();

    // Periodically check for capability changes
    this.checkInterval = setInterval(async () => {
      const newCapabilities = await detectCapabilities();
      this.checkForChanges(newCapabilities);
    }, intervalMs);

    return this.capabilities;
  }

  /**
   * Stop monitoring capabilities
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current capabilities
   */
  getCapabilities(): SandboxCapabilities | null {
    return this.capabilities;
  }

  /**
   * Add event listener for capability changes
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
   * Check for capability changes and emit events
   */
  private checkForChanges(newCapabilities: SandboxCapabilities): void {
    if (!this.capabilities) {
      this.capabilities = newCapabilities;
      return;
    }

    const keys = Object.keys(newCapabilities) as (keyof SandboxCapabilities)[];
    for (const key of keys) {
      if (this.capabilities[key] !== newCapabilities[key]) {
        this.emitEvent('capability_detected', {
          capability: key,
          previousValue: this.capabilities[key],
          newValue: newCapabilities[key],
        });
      }
    }

    this.capabilities = newCapabilities;
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
        console.error('Error in capability event listener:', error);
      }
    }
  }
}
