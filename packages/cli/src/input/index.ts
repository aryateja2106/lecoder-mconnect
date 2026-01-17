/**
 * Input Module Barrel Export
 * MConnect v0.2.0
 */

export { PriorityQueue, type QueuedClient } from './PriorityQueue.js';
export { IdleDetector, type IdleState, type IdleDetectorConfig } from './IdleDetector.js';
export {
  InputArbiter,
  type InputArbiterConfig,
  type InputResult,
  type ArbiterEvents,
  type AuditEventType,
  type AuditLogEntry,
  type AuditLogCallback,
} from './InputArbiter.js';
