import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { MConnectConfig } from '../config.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 5_000;

export interface UsageSnapshot {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  window?: string;
  model?: string;
  updatedAt?: string;
  errorMessage?: string;
}

export interface RunUsageCommandOptions {
  timeoutMs?: number;
  cwd?: string;
}

interface UsageCommandError extends Error {
  killed?: boolean;
  signal?: NodeJS.Signals;
}

function numberFrom(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function stringFrom(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function isoDateFrom(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const millis = value > 1_000_000_000_000 ? value : value * 1_000;
      return new Date(millis).toISOString();
    }
  }
  return undefined;
}

export function unavailableUsageSnapshot(message: string): UsageSnapshot {
  return {
    errorMessage: message,
    updatedAt: new Date().toISOString(),
  };
}

export function parseUsageSnapshot(stdout: string): UsageSnapshot {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return unavailableUsageSnapshot('Usage command returned no output');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return unavailableUsageSnapshot('Usage command returned invalid JSON');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return unavailableUsageSnapshot('Usage command returned invalid JSON');
  }

  const obj = payload as Record<string, unknown>;
  const promptTokens = numberFrom(
    obj,
    'promptTokens',
    'prompt_tokens',
    'inputTokens',
    'input_tokens'
  );
  const completionTokens = numberFrom(
    obj,
    'completionTokens',
    'completion_tokens',
    'outputTokens',
    'output_tokens'
  );
  const explicitTotal = numberFrom(obj, 'totalTokens', 'total_tokens', 'tokens');
  const totalTokens =
    explicitTotal ??
    (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: numberFrom(obj, 'costUsd', 'cost_usd', 'cost'),
    window: stringFrom(obj, 'window', 'period'),
    model: stringFrom(obj, 'model', 'modelName', 'model_name'),
    updatedAt: isoDateFrom(obj, 'updatedAt', 'updated_at', 'timestamp') ?? new Date().toISOString(),
    errorMessage: stringFrom(obj, 'errorMessage', 'error_message', 'error'),
  };
}

export function resolveUsageCommand(config: MConnectConfig): string | undefined {
  return process.env.MCONNECT_USAGE_COMMAND || config.usage?.command;
}

export function resolveUsageTimeoutMs(config: MConnectConfig): number {
  const envTimeout = process.env.MCONNECT_USAGE_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = Number(envTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return config.usage?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

export async function runUsageCommand(
  command: string | undefined,
  options: RunUsageCommandOptions = {}
): Promise<UsageSnapshot> {
  if (!command?.trim()) {
    return unavailableUsageSnapshot('Usage command is not configured');
  }

  try {
    const { stdout } = await execAsync(command, {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      shell: process.env.SHELL || undefined,
    });
    return parseUsageSnapshot(stdout);
  } catch (error) {
    const commandError = error as UsageCommandError;
    if (commandError.killed || commandError.signal === 'SIGTERM') {
      return unavailableUsageSnapshot('Usage command timed out');
    }
    return unavailableUsageSnapshot(commandError.message || 'Usage command failed');
  }
}
