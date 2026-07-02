type MarketingEventName =
  | 'marketing_page_view'
  | 'install_cta_clicked'
  | 'docs_install_viewed';

const SENSITIVE_KEY_PATTERN = /(token|secret|password|url|path|command|input|text|clipboard|file|output)/i;

function enabled() {
  const value = process.env.NEXT_PUBLIC_POSTHOG_ENABLED;
  return value === '1' || value?.toLowerCase() === 'true';
}

function sanitize(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      return value !== undefined && !SENSITIVE_KEY_PATTERN.test(key);
    }),
  );
}

export async function initMarketingAnalytics() {
  if (!enabled() || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  getDistinctId();
}

const DISTINCT_ID_KEY = 'mconnect_marketing_distinct_id';

function getDistinctId() {
  if (typeof window === 'undefined') return 'anonymous';
  const existing = window.localStorage.getItem(DISTINCT_ID_KEY);
  if (existing) return existing;
  const random =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const distinctId = `marketing_${random}`;
  window.localStorage.setItem(DISTINCT_ID_KEY, distinctId);
  return distinctId;
}

export async function captureMarketingEvent(
  event: MarketingEventName,
  properties: Record<string, unknown> = {},
) {
  if (typeof window === 'undefined' || !enabled()) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');
  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: getDistinctId(),
    properties: {
      ...sanitize(properties),
      source: 'website',
      app: 'lecoder-mconnect',
    },
  });

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(
      `${host}/capture/`,
      new Blob([body], { type: 'application/json' }),
    );
    if (sent) return;
  }

  await fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}
