/**
 * Hooks Module
 *
 * Universal hooks layer for receiving events from AI coding agents.
 */

export type { HookEventBroadcaster, HookReceiverConfig } from './hook-receiver.js';
export { HookReceiver, handleCORSPreflight } from './hook-receiver.js';
export * from './normalizer.js';
export * from './types.js';
