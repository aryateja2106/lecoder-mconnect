/**
 * Browser Sandbox Module
 * MConnect v1.1.0
 *
 * Exports for browser-based sandboxing capabilities.
 * Provides permission management, capability detection, and CSP configuration.
 */

// Types
export type {
  PermissionType,
  PermissionState,
  PermissionConfig,
  SandboxCapabilities,
  CSPConfig,
  SandboxState,
  DirectoryInfo,
  SandboxEventType,
  SandboxEvent,
} from './types.js';

// Permission Manager
export {
  PermissionManager,
  permissionManager,
  type PermissionRequestOptions,
} from './permissions.js';

// Capability Detection
export {
  detectCapabilities,
  detectDetailedCapabilities,
  detectFileSystemAccess,
  detectClipboard,
  detectNotifications,
  detectServiceWorker,
  detectWebSocket,
  detectSandboxedIframe,
  detectIframeCsp,
  isSecureContext,
  getBrowserInfo,
  CapabilityMonitor,
  type CapabilityDetails,
  type DetailedCapabilities,
} from './capabilities.js';

// CSP Configuration
export {
  CSP_PRESETS,
  buildCSPString,
  createCSPConfig,
  addSource,
  removeSource,
  allowWebSocket,
  generateSandboxCSP,
  applyCSPMetaTag,
  CSPViolationMonitor,
  type CSPPreset,
  type CSPViolation,
} from './csp.js';

// Sandbox Manager
export {
  SandboxManager,
  getSandboxManager,
  initializeSandbox,
  type SandboxManagerConfig,
  type SandboxReadyState,
} from './sandbox-manager.js';
