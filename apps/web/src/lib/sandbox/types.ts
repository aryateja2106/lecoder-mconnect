/**
 * Browser Sandbox Types
 * MConnect v1.1.0
 *
 * Type definitions for browser-based sandboxing capabilities.
 */

/**
 * Permission types that can be requested
 */
export type PermissionType =
  | 'terminal_view'
  | 'terminal_input'
  | 'file_download'
  | 'clipboard_read'
  | 'clipboard_write'
  | 'notification';

/**
 * Permission state
 */
export type PermissionState = 'granted' | 'denied' | 'prompt';

/**
 * Permission configuration for a capability
 */
export interface PermissionConfig {
  type: PermissionType;
  state: PermissionState;
  grantedAt?: Date;
  expiresAt?: Date;
}

/**
 * Browser sandbox capabilities
 */
export interface SandboxCapabilities {
  /** File System Access API available */
  fileSystemAccess: boolean;
  /** Clipboard API available */
  clipboard: boolean;
  /** Notification API available */
  notifications: boolean;
  /** Service Worker available */
  serviceWorker: boolean;
  /** WebSocket available */
  webSocket: boolean;
  /** Sandboxed iframe support */
  sandboxedIframe: boolean;
  /** CSP attribute on iframes */
  iframeCsp: boolean;
}

/**
 * Content Security Policy configuration
 */
export interface CSPConfig {
  /** Default source policy */
  defaultSrc: string[];
  /** Script source policy */
  scriptSrc: string[];
  /** Style source policy */
  styleSrc: string[];
  /** Connect source policy (for WebSocket/fetch) */
  connectSrc: string[];
  /** Image source policy */
  imgSrc: string[];
  /** Font source policy */
  fontSrc: string[];
  /** Frame source policy */
  frameSrc: string[];
  /** Worker source policy */
  workerSrc: string[];
}

/**
 * Sandbox session state
 */
export interface SandboxState {
  /** Current permissions */
  permissions: Map<PermissionType, PermissionConfig>;
  /** Detected capabilities */
  capabilities: SandboxCapabilities;
  /** CSP configuration */
  csp: CSPConfig;
  /** Session active */
  active: boolean;
}

/**
 * File system directory handle info
 */
export interface DirectoryInfo {
  /** Handle to the directory */
  handle: FileSystemDirectoryHandle;
  /** Directory name */
  name: string;
  /** When access was granted */
  grantedAt: Date;
}

/**
 * Sandbox event types
 */
export type SandboxEventType =
  | 'permission_changed'
  | 'capability_detected'
  | 'csp_violation'
  | 'sandbox_error';

/**
 * Sandbox event payload
 */
export interface SandboxEvent {
  type: SandboxEventType;
  timestamp: Date;
  data: unknown;
}
