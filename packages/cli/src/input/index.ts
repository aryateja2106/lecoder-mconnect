/**
 * Input Module Barrel Export
 * MConnect v0.2.0
 */

export { IdleDetector, type IdleDetectorConfig, type IdleState } from './IdleDetector.js';
export {
  type ArbiterEvents,
  type AuditEventType,
  type AuditLogCallback,
  type AuditLogEntry,
  InputArbiter,
  type InputArbiterConfig,
  type InputResult,
} from './InputArbiter.js';
export { PriorityQueue, type QueuedClient } from './PriorityQueue.js';
