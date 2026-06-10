import { describe, expect, it } from "vitest";
import { advanceHoldProgress, calculatePulsingTargetRadii, computeTargetAssistState, targetPathPoint } from "./model";

describe("pulsing-target model", () => {
  it("keeps the effective hold zone large enough for gaze", () => {
    const radii = calculatePulsingTargetRadii({ width: 1024, height: 768 }, 1.2);

    expect(radii.coreRadius).toBeGreaterThanOrEqual(84);
    expect(radii.holdRadius).toBeGreaterThanOrEqual(150);
    expect(radii.hintRadius).toBeGreaterThan(radii.holdRadius);
  });

  it("grows progress while held and decays gently after leaving", () => {
    const started = advanceHoldProgress(0.2, { deltaSeconds: 0.45, dwellMs: 900, inside: true });
    const released = advanceHoldProgress(started, { deltaSeconds: 1, dwellMs: 900, inside: false, releaseDecayPerSecond: 0.12 });

    expect(started).toBeCloseTo(0.7, 5);
    expect(released).toBeCloseTo(0.58, 5);
  });

  it("slows the target and marks hints when pointer leaves the zone", () => {
    const inside = computeTargetAssistState(90, 150, true);
    const near = computeTargetAssistState(190, 150, true);
    const far = computeTargetAssistState(290, 150, true);
    const invalid = computeTargetAssistState(Number.POSITIVE_INFINITY, 150, false);

    expect(inside.inside).toBe(true);
    expect(near.near).toBe(true);
    expect(near.speedScale).toBeLessThan(inside.speedScale);
    expect(far.speedScale).toBeLessThan(near.speedScale);
    expect(invalid.pointerValid).toBe(false);
  });

  it("keeps the moving target inside the safe stage", () => {
    const stage = { width: 420, height: 360 };

    for (let index = 0; index < 18; index += 1) {
      const point = targetPathPoint(index * 0.51, stage);

      expect(point.x).toBeGreaterThanOrEqual(40);
      expect(point.x).toBeLessThanOrEqual(stage.width - 40);
      expect(point.y).toBeGreaterThanOrEqual(112);
      expect(point.y).toBeLessThanOrEqual(stage.height - 56);
    }
  });
});
