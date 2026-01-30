/**
 * Hook Event Normalizer
 *
 * Converts agent-specific hook events (Claude Code, Gemini CLI, etc.)
 * into the universal UniversalHookEvent format.
 */

import { randomUUID } from 'node:crypto';
import type {
  ClaudeHookEventData,
  GeminiHookEventData,
  HookAction,
  HookEventType,
  HookSource,
  IncomingHookRequest,
  UniversalHookEvent,
} from './types.js';

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return randomUUID();
}

/**
 * Get current timestamp in ISO 8601 format
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Normalize a Claude Code hook event
 */
function normalizeClaudeEvent(data: ClaudeHookEventData): UniversalHookEvent {
  const id = generateEventId();
  const timestamp = getTimestamp();
  const raw = data as unknown as Record<string, unknown>;

  const eventName = data.hook_event_name;

  switch (eventName) {
    case 'Notification':
      return {
        id,
        timestamp,
        source: 'claude',
        eventType: 'notification',
        title: data.message || 'Notification from Claude',
        details: data.message,
        actionable: false,
        raw,
      };

    case 'Stop':
    case 'SubagentStop':
      return {
        id,
        timestamp,
        source: 'claude',
        eventType: 'stopped',
        title: eventName === 'SubagentStop' ? 'Claude subagent finished' : 'Claude stopped',
        details: data.message,
        actionable: false,
        raw,
      };

    case 'PreToolUse': {
      // PreToolUse can be used to show approval requests
      const toolName = data.tool_name || 'unknown tool';
      const toolInput = data.tool_input;

      // Format tool input for display
      let details = `Tool: ${toolName}`;
      if (toolInput) {
        // For common tools, show relevant info
        if (toolName === 'Bash' && toolInput.command) {
          details = `$ ${toolInput.command}`;
        } else if (toolName === 'Write' && toolInput.file_path) {
          details = `Writing to: ${toolInput.file_path}`;
        } else if (toolName === 'Edit' && toolInput.file_path) {
          details = `Editing: ${toolInput.file_path}`;
        } else {
          details = `${toolName}: ${JSON.stringify(toolInput).slice(0, 100)}`;
        }
      }

      return {
        id,
        timestamp,
        source: 'claude',
        eventType: 'needs_approval',
        title: `Claude wants to use: ${toolName}`,
        details,
        actionable: true,
        actions: [
          { id: 'approve', label: 'Approve', variant: 'approve' },
          { id: 'deny', label: 'Deny', variant: 'deny' },
        ],
        raw,
      };
    }

    case 'PostToolUse':
      return {
        id,
        timestamp,
        source: 'claude',
        eventType: 'notification',
        title: `Claude used: ${data.tool_name || 'tool'}`,
        details: data.message,
        actionable: false,
        raw,
      };

    default:
      return {
        id,
        timestamp,
        source: 'claude',
        eventType: 'notification',
        title: `Claude: ${eventName}`,
        details: data.message,
        actionable: false,
        raw,
      };
  }
}

/**
 * Normalize a Gemini CLI hook event
 */
function normalizeGeminiEvent(data: GeminiHookEventData): UniversalHookEvent {
  const id = generateEventId();
  const timestamp = getTimestamp();
  const raw = data as unknown as Record<string, unknown>;

  const eventType = data.event_type;

  switch (eventType) {
    case 'Notification':
      return {
        id,
        timestamp,
        source: 'gemini',
        eventType: 'notification',
        title: data.message || 'Notification from Gemini',
        details: data.message,
        actionable: false,
        raw,
      };

    case 'AfterAgent': {
      const exitCode = data.exit_code;
      const isError = exitCode !== undefined && exitCode !== 0;

      return {
        id,
        timestamp,
        source: 'gemini',
        eventType: isError ? 'error' : 'stopped',
        title: isError ? `Gemini exited with error (code ${exitCode})` : 'Gemini finished',
        details: data.message,
        actionable: false,
        raw,
      };
    }

    case 'BeforeModel':
    case 'AfterModel':
      return {
        id,
        timestamp,
        source: 'gemini',
        eventType: 'notification',
        title: `Gemini: ${eventType === 'BeforeModel' ? 'Starting' : 'Completed'} model call`,
        details: data.model ? `Model: ${data.model}` : undefined,
        actionable: false,
        raw,
      };

    default:
      return {
        id,
        timestamp,
        source: 'gemini',
        eventType: 'notification',
        title: `Gemini: ${eventType}`,
        details: data.message,
        actionable: false,
        raw,
      };
  }
}

/**
 * Normalize a custom/unknown source event
 */
function normalizeCustomEvent(
  source: HookSource,
  eventType: string,
  data: Record<string, unknown>
): UniversalHookEvent {
  const id = generateEventId();
  const timestamp = getTimestamp();

  // Try to map common event type patterns
  // Use word/underscore boundary matching to avoid false positives (e.g., "task" containing "ask")
  let normalizedType: HookEventType = 'notification';
  const lowerType = eventType.toLowerCase();

  // Helper to check if a word exists as a standalone segment (word boundary or underscore-delimited)
  // Matches: "stop", "stopped", "_stop_", "_stop", "stop_", etc.
  const hasWord = (word: string) => {
    const pattern = new RegExp(`(^|_|\\b)${word}($|_|\\b)`);
    return pattern.test(lowerType);
  };

  // Check stopped/finished patterns FIRST (more specific)
  // Matches: stop, stopped, finish, finished, done, end, ended
  const hasStopPattern =
    hasWord('stop') ||
    hasWord('stopped') ||
    hasWord('finish') ||
    hasWord('finished') ||
    hasWord('done') ||
    hasWord('end') ||
    hasWord('ended');

  // Check approval patterns (less specific - check after stop patterns)
  // Matches: approval, confirm, ask as standalone words or segments
  // But NOT 'ask' when it's part of 'task'
  const hasApprovalPattern =
    hasWord('approval') || hasWord('confirm') || (hasWord('ask') && !lowerType.includes('task'));

  // Check error patterns
  const hasErrorPattern =
    hasWord('error') ||
    hasWord('fail') ||
    hasWord('failed') ||
    hasWord('failure') ||
    hasWord('fatal');

  if (hasStopPattern) {
    normalizedType = 'stopped';
  } else if (hasApprovalPattern) {
    normalizedType = 'needs_approval';
  } else if (hasErrorPattern) {
    normalizedType = 'error';
  }

  // Try to extract title and details from common fields
  const title =
    (data.title as string) ||
    (data.message as string) ||
    (data.summary as string) ||
    `${source}: ${eventType}`;

  const details = (data.details as string) || (data.description as string) || (data.body as string);

  // Check if actionable
  const actionable = normalizedType === 'needs_approval' || Boolean(data.actionable);
  let actions: HookAction[] | undefined;

  if (actionable && !data.actions) {
    actions = [
      { id: 'approve', label: 'Approve', variant: 'approve' },
      { id: 'deny', label: 'Deny', variant: 'deny' },
    ];
  } else if (data.actions && Array.isArray(data.actions)) {
    actions = data.actions as HookAction[];
  }

  return {
    id,
    timestamp,
    source,
    eventType: normalizedType,
    title,
    details,
    actionable,
    actions,
    raw: data,
  };
}

/**
 * Normalize an incoming hook request to a UniversalHookEvent
 *
 * @param request - The incoming hook request from an agent
 * @returns Normalized UniversalHookEvent
 */
export function normalizeHookEvent(request: IncomingHookRequest): UniversalHookEvent {
  const { source, event_type, data } = request;

  switch (source) {
    case 'claude': {
      // Claude events have hook_event_name in the data
      const claudeData: ClaudeHookEventData = {
        hook_event_name: (data.hook_event_name as string) || event_type,
        ...data,
      } as ClaudeHookEventData;
      return normalizeClaudeEvent(claudeData);
    }

    case 'gemini': {
      // Gemini events have event_type in the data
      const geminiData: GeminiHookEventData = {
        event_type: (data.event_type as string) || event_type,
        ...data,
      } as GeminiHookEventData;
      return normalizeGeminiEvent(geminiData);
    }

    default:
      return normalizeCustomEvent(source, event_type, data);
  }
}

/**
 * Validate an incoming hook request
 *
 * @param body - The raw request body
 * @returns Validated IncomingHookRequest or null if invalid
 */
export function validateHookRequest(body: unknown): IncomingHookRequest | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const obj = body as Record<string, unknown>;

  // Source is required
  if (!obj.source || typeof obj.source !== 'string') {
    return null;
  }

  // Validate source is a known type
  const validSources: HookSource[] = ['claude', 'gemini', 'copilot', 'aider', 'custom'];
  if (!validSources.includes(obj.source as HookSource)) {
    return null;
  }

  // Event type is required
  if (!obj.event_type || typeof obj.event_type !== 'string') {
    return null;
  }

  // Data should be an object (can be empty)
  const data = obj.data && typeof obj.data === 'object' ? obj.data : {};

  return {
    source: obj.source as HookSource,
    event_type: obj.event_type,
    data: data as Record<string, unknown>,
  };
}
