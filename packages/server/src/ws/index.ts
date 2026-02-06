/**
 * WebSocket Module
 *
 * Protocol v3 WebSocket hub for real-time communication.
 * - Client authentication
 * - Message routing
 * - Heartbeat mechanism
 * - Input arbitration
 */

export {
  WSHub,
  getWSHub,
  initializeWSHub,
  resetWSHub,
  type WSHubConfig,
  type WebSocketData,
  type InputHandler,
} from './WSHub.js';

export {
  InputArbiter,
  type InputArbiterConfig,
  type InputResult,
  type QueuedClient,
  type ArbiterState,
  type AuditEventType,
  type AuditLogEntry,
  type AuditLogCallback,
} from './InputArbiter.js';
