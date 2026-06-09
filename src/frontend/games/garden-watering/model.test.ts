import { describe, expect, it } from "vitest";
import { advanceFlowerGrowth, wateringStrength, type GardenFlowerGrowth } from "./model";

const seed: GardenFlowerGrowth = {
  growth: 0,
  wateredSeconds: 0,
  completed: false,
  bloomPulse: 0
};

describe("garden-watering model", () => {
  it("uses soft falloff around the flower", () => {
    expect(wateringStrength(10, 100)).toBe(1);
    expect(wateringStrength(82, 100)).toBeGreaterThan(0);
    expect(wateringStrength(100, 100)).toBe(0);
  });

  it("grows faster when water is closer", () => {
    const close = advanceFlowerGrowth(seed, { deltaSeconds: 1, distancePx: 8, waterRadiusPx: 100 });
    const far = advanceFlowerGrowth(seed, { deltaSeconds: 1, distancePx: 82, waterRadiusPx: 100 });

    expect(close.growth).toBeGreaterThan(far.growth);
    expect(close.wateredSeconds).toBeGreaterThan(far.wateredSeconds);
  });

  it("does not grow when water is outside the radius", () => {
    const next = advanceFlowerGrowth(seed, { deltaSeconds: 1, distancePx: 140, waterRadiusPx: 100 });

    expect(next.growth).toBe(0);
    expect(next.wateredSeconds).toBe(0);
    expect(next.completed).toBe(false);
  });

  it("clamps growth and marks the flower complete", () => {
    const next = advanceFlowerGrowth({ ...seed, growth: 0.94 }, { deltaSeconds: 1, distancePx: 0, waterRadiusPx: 120, growthPerSecond: 0.2 });

    expect(next.growth).toBe(1);
    expect(next.completed).toBe(true);
    expect(next.bloomPulse).toBe(1);
  });
});
