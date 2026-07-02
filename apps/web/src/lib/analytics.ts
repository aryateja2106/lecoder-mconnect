export type ProductEventName =
  | "marketing_page_view"
  | "install_cta_clicked"
  | "docs_install_viewed"
  | "pairing_code_submitted"
  | "ws_connected"
  | "ws_reconnected"
  | "terminal_ready"
  | "keyboard_opened"
  | "terminal_input_sent"
  | "terminal_paste_sent"
  | "terminal_resized"
  | "input_rejected"
  | "control_requested";

export type TerminalInputSource = "keyboard" | "hardware_key" | "paste" | "direct" | "toolbar";

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|url|uri|path|cwd|dir|command|cmd|input|text|terminal|clipboard|file|filename|output|prompt)/i;

type AnalyticsValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | AnalyticsValue[]
  | { [key: string]: AnalyticsValue };

export type AnalyticsProperties = Record<string, AnalyticsValue>;

const DISTINCT_ID_KEY = "mconnect_distinct_id";

export function isAnalyticsEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

function getDistinctId(): string {
  if (typeof window === "undefined") return "anonymous";
  const existing = window.localStorage.getItem(DISTINCT_ID_KEY);
  if (existing) return existing;
  const random =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const distinctId = `web_${random}`;
  window.localStorage.setItem(DISTINCT_ID_KEY, distinctId);
  return distinctId;
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {},
): AnalyticsProperties {
  const sanitized: AnalyticsProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      sanitized[key] = value
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? sanitizeAnalyticsProperties(item as AnalyticsProperties)
            : item,
        )
        .filter((item) => item !== undefined);
      continue;
    }
    if (value && typeof value === "object") {
      sanitized[key] = sanitizeAnalyticsProperties(value as AnalyticsProperties);
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

export function terminalInputMetadata(
  data: string,
  source: TerminalInputSource,
): AnalyticsProperties {
  return {
    byteLength: new TextEncoder().encode(data).length,
    charLength: data.length,
    source,
    hasNewline: data.includes("\n") || data.includes("\r"),
  };
}

export async function initProductAnalytics(): Promise<void> {
  if (!isAnalyticsEnabled(process.env.NEXT_PUBLIC_POSTHOG_ENABLED)) return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  getDistinctId();
}

export async function captureProductEvent(
  event: ProductEventName,
  properties: AnalyticsProperties = {},
): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isAnalyticsEnabled(process.env.NEXT_PUBLIC_POSTHOG_ENABLED)) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: getDistinctId(),
    properties: {
      ...sanitizeAnalyticsProperties(properties),
      source: "pwa",
      app: "lecoder-mconnect",
    },
  });
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      `${host}/capture/`,
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  }

  await fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
