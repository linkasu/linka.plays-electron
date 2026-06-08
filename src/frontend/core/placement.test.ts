import { describe, expect, it } from "vitest";
import { clampTargetCenterPercent, createSafePlacementArea, randomTargetCenterPercent } from "./placement";

describe("placement", () => {
  it("creates a safe area below the HUD", () => {
    expect(createSafePlacementArea({ viewportWidth: 1000, viewportHeight: 700 })).toEqual({
      x: 32,
      y: 112,
      width: 936,
      height: 524
    });
  });

  it("clamps target centers so the whole target stays visible", () => {
    const point = clampTargetCenterPercent({ x: 0, y: 0 }, {
      viewportWidth: 1000,
      viewportHeight: 700,
      targetWidth: 200,
      targetHeight: 120
    });

    expect(point.x).toBeCloseTo(13.2, 3);
    expect(point.y).toBeCloseTo(24.571, 3);
  });

  it("keeps random placement away from previous point when possible", () => {
    const values = [0, 0, 0.9, 0.9];
    const point = randomTargetCenterPercent({
      viewportWidth: 1000,
      viewportHeight: 700,
      targetWidth: 100,
      targetHeight: 100,
      previous: { x: 8.2, y: 23.142857142857142 },
      minDistance: 200,
      random: () => values.shift() ?? 0.9
    });

    expect(point.x).toBeGreaterThan(70);
    expect(point.y).toBeGreaterThan(70);
  });
});
