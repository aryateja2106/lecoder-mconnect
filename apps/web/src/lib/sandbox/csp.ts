/**
 * Content Security Policy Configuration
 * MConnect v1.1.0
 *
 * Provides CSP configuration helpers for browser sandboxing.
 * Creates secure CSP policies for different use cases.
 */

import type { CSPConfig, SandboxEvent } from './types.js';

/**
 * CSP preset names
 */
export type CSPPreset = 'strict' | 'default' | 'permissive' | 'terminal-only';

/**
 * CSP violation event data
 */
export interface CSPViolation {
  directive: string;
  blockedUri: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

/**
 * Default CSP configurations for different security levels
 */
export const CSP_PRESETS: Record<CSPPreset, CSPConfig> = {
  /**
   * Strict CSP - Maximum security
   * - No inline scripts or styles
   * - Only connect to self
   * - No iframes or workers
   */
  strict: {
    defaultSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    connectSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'"],
    frameSrc: ["'none'"],
    workerSrc: ["'none'"],
  },

  /**
   * Default CSP - Balanced security
   * - Allow inline styles (needed for xterm.js)
   * - Connect to WebSocket endpoints
   * - Allow blob URLs for workers
   */
  default: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", 'wss:', 'ws:'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    frameSrc: ["'none'"],
    workerSrc: ["'self'", 'blob:'],
  },

  /**
   * Permissive CSP - Minimal restrictions
   * - Allow most operations
   * - Still block dangerous patterns
   */
  permissive: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ['*'],
    imgSrc: ['*', 'data:', 'blob:'],
    fontSrc: ['*'],
    frameSrc: ["'self'"],
    workerSrc: ["'self'", 'blob:'],
  },

  /**
   * Terminal-only CSP - Optimized for terminal display
   * - Minimal permissions for viewing terminal output
   * - Allow WebSocket for real-time updates
   * - Block most external resources
   */
  'terminal-only': {
    defaultSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // xterm.js needs inline styles
    connectSrc: ["'self'", 'wss:', 'ws:'],
    imgSrc: ["'none'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    frameSrc: ["'none'"],
    workerSrc: ["'none'"],
  },
};

/**
 * Build a CSP string from configuration
 */
export function buildCSPString(config: CSPConfig): string {
  const directives: string[] = [];

  if (config.defaultSrc.length > 0) {
    directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  }

  if (config.scriptSrc.length > 0) {
    directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  }

  if (config.styleSrc.length > 0) {
    directives.push(`style-src ${config.styleSrc.join(' ')}`);
  }

  if (config.connectSrc.length > 0) {
    directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  }

  if (config.imgSrc.length > 0) {
    directives.push(`img-src ${config.imgSrc.join(' ')}`);
  }

  if (config.fontSrc.length > 0) {
    directives.push(`font-src ${config.fontSrc.join(' ')}`);
  }

  if (config.frameSrc.length > 0) {
    directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  }

  if (config.workerSrc.length > 0) {
    directives.push(`worker-src ${config.workerSrc.join(' ')}`);
  }

  return directives.join('; ');
}

/**
 * Create a custom CSP config by merging with a preset
 */
export function createCSPConfig(
  preset: CSPPreset,
  overrides: Partial<CSPConfig> = {}
): CSPConfig {
  const base = { ...CSP_PRESETS[preset] };

  return {
    defaultSrc: overrides.defaultSrc ?? [...base.defaultSrc],
    scriptSrc: overrides.scriptSrc ?? [...base.scriptSrc],
    styleSrc: overrides.styleSrc ?? [...base.styleSrc],
    connectSrc: overrides.connectSrc ?? [...base.connectSrc],
    imgSrc: overrides.imgSrc ?? [...base.imgSrc],
    fontSrc: overrides.fontSrc ?? [...base.fontSrc],
    frameSrc: overrides.frameSrc ?? [...base.frameSrc],
    workerSrc: overrides.workerSrc ?? [...base.workerSrc],
  };
}

/**
 * Add a source to a specific directive
 */
export function addSource(
  config: CSPConfig,
  directive: keyof CSPConfig,
  source: string
): CSPConfig {
  const newConfig = { ...config };
  if (!newConfig[directive].includes(source)) {
    newConfig[directive] = [...newConfig[directive], source];
  }
  return newConfig;
}

/**
 * Remove a source from a specific directive
 */
export function removeSource(
  config: CSPConfig,
  directive: keyof CSPConfig,
  source: string
): CSPConfig {
  return {
    ...config,
    [directive]: config[directive].filter((s) => s !== source),
  };
}

/**
 * Add WebSocket URL to connect-src
 */
export function allowWebSocket(config: CSPConfig, wsUrl: string): CSPConfig {
  // Parse the WebSocket URL and add both ws: and wss: variants
  try {
    const url = new URL(wsUrl);
    const host = url.host;

    return addSource(
      addSource(config, 'connectSrc', `ws://${host}`),
      'connectSrc',
      `wss://${host}`
    );
  } catch {
    // If URL parsing fails, just add the URL as-is
    return addSource(config, 'connectSrc', wsUrl);
  }
}

/**
 * CSP violation listener
 */
export class CSPViolationMonitor {
  private listeners: Set<(event: SandboxEvent) => void> = new Set();
  private violations: CSPViolation[] = [];
  private isListening = false;

  /**
   * Start listening for CSP violations
   */
  start(): void {
    if (this.isListening) return;

    document.addEventListener('securitypolicyviolation', this.handleViolation);
    this.isListening = true;
  }

  /**
   * Stop listening for CSP violations
   */
  stop(): void {
    if (!this.isListening) return;

    document.removeEventListener('securitypolicyviolation', this.handleViolation);
    this.isListening = false;
  }

  /**
   * Get all recorded violations
   */
  getViolations(): CSPViolation[] {
    return [...this.violations];
  }

  /**
   * Clear recorded violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Add event listener for violations
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
   * Handle CSP violation event
   */
  private handleViolation = (e: SecurityPolicyViolationEvent): void => {
    const violation: CSPViolation = {
      directive: e.violatedDirective,
      blockedUri: e.blockedURI,
      sourceFile: e.sourceFile || undefined,
      lineNumber: e.lineNumber || undefined,
      columnNumber: e.columnNumber || undefined,
    };

    this.violations.push(violation);
    this.emitEvent('csp_violation', violation);
  };

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
        console.error('Error in CSP violation event listener:', error);
      }
    }
  }
}

/**
 * Apply CSP to a meta tag in the document
 * Note: This is less effective than HTTP headers but works for dynamic scenarios
 */
export function applyCSPMetaTag(config: CSPConfig): HTMLMetaElement {
  // Remove existing CSP meta tag if present
  const existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (existing) {
    existing.remove();
  }

  // Create new meta tag
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = buildCSPString(config);

  // Insert at the beginning of head
  document.head.insertBefore(meta, document.head.firstChild);

  return meta;
}

/**
 * Generate CSP for sandbox iframe
 */
export function generateSandboxCSP(
  allowedConnections: string[] = [],
  preset: CSPPreset = 'terminal-only'
): string {
  let config = createCSPConfig(preset);

  // Add allowed WebSocket connections
  for (const connection of allowedConnections) {
    config = allowWebSocket(config, connection);
  }

  return buildCSPString(config);
}
