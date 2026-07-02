import { describe, expect, it } from "vitest";
import {
  sanitizeAnalyticsProperties,
  terminalInputMetadata,
  isAnalyticsEnabled,
} from "./analytics";

describe("analytics privacy helpers", () => {
  it("defaults analytics off unless explicitly configured", () => {
    expect(isAnalyticsEnabled(undefined)).toBe(false);
    expect(isAnalyticsEnabled("")).toBe(false);
    expect(isAnalyticsEnabled("0")).toBe(false);
    expect(isAnalyticsEnabled("false")).toBe(false);
    expect(isAnalyticsEnabled("1")).toBe(true);
    expect(isAnalyticsEnabled("true")).toBe(true);
  });

  it("removes sensitive terminal and identity fields before capture", () => {
    const sanitized = sanitizeAnalyticsProperties({
      token: "secret",
      tunnelUrl: "https://example.trycloudflare.com",
      cwd: "/Users/aryateja/project",
      command: "rm -rf /tmp/demo",
      terminalText: "private terminal output",
      clipboard: "copied secret",
      fileName: "secret.ts",
      safe: "ok",
      count: 2,
      nested: {
        path: "/tmp/x",
        result: "kept",
      },
    });

    expect(sanitized).toEqual({
      safe: "ok",
      count: 2,
      nested: {
        result: "kept",
      },
    });
  });

  it("captures terminal input as metadata only", () => {
    expect(terminalInputMetadata("npm test\n", "keyboard")).toEqual({
      byteLength: 9,
      charLength: 9,
      source: "keyboard",
      hasNewline: true,
    });
  });
});
