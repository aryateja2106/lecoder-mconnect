import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyticsStatus,
  disableAnalytics,
  enableAnalytics,
  sanitizeAnalyticsProperties,
} from '../analytics.js';

describe('CLI analytics config', () => {
  const previousHome = process.env.MCONNECT_HOME;
  let tempDir: string | null = null;

  afterEach(() => {
    process.env.MCONNECT_HOME = previousHome;
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  function useTempHome() {
    tempDir = mkdtempSync(join(tmpdir(), 'mconnect-analytics-'));
    process.env.MCONNECT_HOME = tempDir;
    return tempDir;
  }

  it('defaults analytics off and creates an anonymous install id only on opt in', () => {
    const home = useTempHome();

    expect(analyticsStatus()).toEqual({
      enabled: false,
      distinctId: undefined,
      host: 'https://us.i.posthog.com',
      hasApiKey: false,
    });

    const enabled = enableAnalytics({ apiKey: 'phc_test', host: 'https://eu.i.posthog.com' });
    expect(enabled.enabled).toBe(true);
    expect(enabled.distinctId).toMatch(/^anon_/);
    expect(enabled.host).toBe('https://eu.i.posthog.com');
    expect(enabled.hasApiKey).toBe(true);

    const persisted = JSON.parse(readFileSync(join(home, 'config.json'), 'utf-8'));
    expect(persisted.analytics.enabled).toBe(true);
    expect(persisted.analytics.distinctId).toBe(enabled.distinctId);

    const disabled = disableAnalytics();
    expect(disabled.enabled).toBe(false);
    expect(disabled.distinctId).toBe(enabled.distinctId);
  });

  it('sanitizes sensitive analytics properties before CLI capture', () => {
    expect(
      sanitizeAnalyticsProperties({
        token: 'secret',
        connectUrl: 'https://example.com?token=secret',
        workDir: '/Users/aryateja/private',
        command: 'cat ~/.ssh/id_rsa',
        input: 'password',
        safeCount: 3,
      })
    ).toEqual({ safeCount: 3 });
  });
});
