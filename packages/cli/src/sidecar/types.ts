/**
 * Sidecar Mode Types
 * MConnect v1.1.0
 *
 * Type definitions for the sidecar mode that enables
 * terminal sharing without spawning new shells.
 */

/**
 * Configuration for sidecar mode
 */
export interface SidecarConfig {
  /** Server port (default: 8765) */
  port?: number;
  /** Enable Cloudflare tunnel for remote access (default: true) */
  enableTunnel?: boolean;
  /** Read-only mode - no input forwarding (default: false) */
  observeOnly?: boolean;
  /** Run in background after printing connection info (default: false) */
  background?: boolean;
  /** Web app URL for external UI (optional) */
  webUrl?: string;
}

/**
 * Connection information for a sidecar session
 */
export interface ConnectionInfo {
  /** Local WebSocket URL */
  localUrl: string;
  /** Remote tunnel URL (if tunnel enabled) */
  tunnelUrl?: string;
  /** 6-character pairing code */
  pairingCode: string;
  /** Unique session identifier */
  sessionId: string;
}

/**
 * Information about a connected client
 */
export interface ClientInfo {
  /** Unique client identifier */
  id: string;
  /** Client type */
  type: 'pc' | 'mobile' | 'browser';
  /** Connection timestamp */
  connectedAt: Date;
  /** Client's user agent (if available) */
  userAgent?: string;
}

/**
 * Sidecar session status information
 */
export interface SidecarInfo {
  /** Whether terminal is attached */
  attached: boolean;
  /** Current terminal dimensions */
  terminalSize: TerminalSize;
  /** Number of connected clients */
  clientCount: number;
  /** Session uptime in seconds */
  uptime?: number;
}

/**
 * Terminal dimensions
 */
export interface TerminalSize {
  rows: number;
  cols: number;
}

/**
 * Events emitted by TerminalBridge
 */
export interface TerminalBridgeEvents {
  /** Terminal output data */
  data: (data: Buffer) => void;
  /** Terminal size changed */
  resize: (size: TerminalSize) => void;
  /** Terminal closed */
  close: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * Events emitted by SidecarSession
 */
export interface SidecarSessionEvents {
  /** Client connected */
  client_connected: (client: ClientInfo) => void;
  /** Client disconnected */
  client_disconnected: (client: ClientInfo) => void;
  /** Input received from client */
  input: (data: Buffer, client: ClientInfo) => void;
  /** Input was rejected */
  input_rejected: (info: { clientId: string; reason: string }) => void;
  /** Session started */
  started: (info: SidecarInfo) => void;
  /** Session stopped */
  stopped: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * Protocol message types for sidecar mode (v2.1)
 */
export type SidecarMessageType =
  | 'sidecar_attach'
  | 'sidecar_info'
  | 'capabilities_request'
  | 'capabilities';

/**
 * Sidecar attach message (client -> server)
 */
export interface SidecarAttachMessage {
  type: 'sidecar_attach';
  token: string;
  clientType: 'pc' | 'mobile' | 'browser';
}

/**
 * Sidecar info message (server -> client)
 */
export interface SidecarInfoMessage {
  type: 'sidecar_info';
  attached: boolean;
  ttyPath?: string;
  terminalSize: TerminalSize;
  permissions: {
    input: boolean;
    resize: boolean;
  };
}

/**
 * Capabilities request message (client -> server)
 */
export interface CapabilitiesRequestMessage {
  type: 'capabilities_request';
}

/**
 * Capabilities response message (server -> client)
 */
export interface CapabilitiesResponseMessage {
  type: 'capabilities';
  sandbox: {
    csp: string;
    fileSystemAccess: boolean;
    clipboard: boolean;
  };
  terminal: {
    input: boolean;
    resize: boolean;
    scrollback: number;
  };
}
