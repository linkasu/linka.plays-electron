import { describe, expect, it } from "vitest";
import { clampSettings, createDefaultSettings, settingsFromPreset } from "./settings";

describe("settings", () => {
  it("clamps session settings into safe ranges", () => {
    const settings = clampSettings({
      ...createDefaultSettings(),
      sessionSeconds: 1,
      maxSteps: 100,
      dwellMs: 100,
      targetScale: 5,
      motionSpeed: 10
    });

    expect(settings.sessionSeconds).toBe(30);
    expect(settings.maxSteps).toBe(40);
    expect(settings.dwellMs).toBe(500);
    expect(settings.targetScale).toBe(2);
    expect(settings.motionSpeed).toBe(1.4);
  });

  it("returns independent preset objects", () => {
    const gentle = settingsFromPreset("gentle");
    gentle.maxSteps = 99;

    expect(settingsFromPreset("gentle").maxSteps).toBe(5);
  });
});
