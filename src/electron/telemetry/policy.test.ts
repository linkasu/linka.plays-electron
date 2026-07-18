import { describe, expect, it } from "vitest";
import { isTelemetryEnabled, retryDelayMs } from "./policy";

describe("telemetry policy", () => {
  it("is disabled in development and tests unless explicitly forced", () => {
    expect(isTelemetryEnabled(false, undefined)).toBe(false);
    expect(isTelemetryEnabled(false, "0")).toBe(false);
    expect(isTelemetryEnabled(false, "1")).toBe(true);
    expect(isTelemetryEnabled(true, undefined)).toBe(true);
  });

  it("uses bounded exponential backoff with jitter", () => {
    expect(retryDelayMs(0, 0)).toBe(750);
    expect(retryDelayMs(1, 1)).toBe(2500);
    expect(retryDelayMs(20, 1)).toBe(375000);
  });
});
