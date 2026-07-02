import { randomBytes } from 'node:crypto';
import { loadConfig, saveConfig, type MConnectConfig } from './config.js';
import { VERSION } from './version.js';

export type CliAnalyticsEventName =
  | 'cli_session_started'
  | 'cli_pairing_code_shown'
  | 'cli_tunnel_ready'
  | 'cli_session_ended'
  | 'analytics_opt_in_changed';

export interface AnalyticsStatus {
  enabled: boolean;
  distinctId?: string;
  host: string;
  hasApiKey: boolean;
}

export interface AnalyticsCaptureProperties {
  [key: string]: unknown;
}

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|url|uri|path|cwd|dir|workdir|command|cmd|input|text|terminal|clipboard|file|filename|output|prompt)/i;

function analyticsConfig(config: MConnectConfig = loadConfig()) {
  return {
    enabled: config.analytics?.enabled ?? false,
    distinctId: config.analytics?.distinctId,
    apiKey: config.analytics?.posthogApiKey || process.env.POSTHOG_API_KEY || process.env.MCONNECT_POSTHOG_KEY,
    host: config.analytics?.posthogHost || process.env.POSTHOG_HOST || process.env.MCONNECT_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  };
}

function createDistinctId(): string {
  return `anon_${randomBytes(16).toString('hex')}`;
}

export function analyticsStatus(config: MConnectConfig = loadConfig()): AnalyticsStatus {
  const analytics = analyticsConfig(config);
  return {
    enabled: analytics.enabled,
    distinctId: analytics.distinctId,
    host: analytics.host,
    hasApiKey: !!analytics.apiKey,
  };
}

export function enableAnalytics(options: { apiKey?: string; host?: string } = {}): AnalyticsStatus {
  const config = loadConfig();
  const distinctId = config.analytics?.distinctId || createDistinctId();
  saveConfig({
    analytics: {
      ...config.analytics,
      enabled: true,
      distinctId,
      posthogApiKey: options.apiKey || config.analytics?.posthogApiKey,
      posthogHost: options.host || config.analytics?.posthogHost || DEFAULT_POSTHOG_HOST,
    },
  });
  return analyticsStatus();
}

export function disableAnalytics(): AnalyticsStatus {
  const config = loadConfig();
  saveConfig({
    analytics: {
      ...config.analytics,
      enabled: false,
    },
  });
  return analyticsStatus();
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsCaptureProperties = {}
): AnalyticsCaptureProperties {
  const sanitized: AnalyticsCaptureProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      sanitized[key] = value
        .map((item) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? sanitizeAnalyticsProperties(item as AnalyticsCaptureProperties)
            : item
        )
        .filter((item) => item !== undefined);
      continue;
    }
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAnalyticsProperties(value as AnalyticsCaptureProperties);
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

export async function captureCliEvent(
  event: CliAnalyticsEventName,
  properties: AnalyticsCaptureProperties = {}
): Promise<void> {
  const config = analyticsConfig();
  if (!config.enabled || !config.apiKey || !config.distinctId) return;

  const body = {
    api_key: config.apiKey,
    event,
    distinct_id: config.distinctId,
    properties: {
      ...sanitizeAnalyticsProperties(properties),
      app: 'lecoder-mconnect',
      version: VERSION,
      source: 'cli',
    },
  };

  try {
    await fetch(`${config.host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Analytics must never break the terminal session.
  }
}
