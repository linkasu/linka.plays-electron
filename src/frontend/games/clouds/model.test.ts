import { describe, expect, it } from "vitest";
import { cloudPlacementArea, cloudPlacementsOverlap, cloudVisualBounds, createCloudPlacementLayout } from "./model";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

describe("clouds placement", () => {
  it("uses the full animated lobe bounds", () => {
    const bounds = cloudVisualBounds(100, 50);

    expect(bounds.left).toBeGreaterThan(165);
    expect(bounds.right).toBeGreaterThan(170);
    expect(bounds.top).toBeGreaterThan(85);
    expect(bounds.bottom).toBeGreaterThan(85);
  });

  it.each([
    { width: 900, height: 600 },
    { width: 1024, height: 600 },
    { width: 1280, height: 800 }
  ])("keeps visual bounds separate at $width x $height across seeds and templates", ({ width, height }) => {
    const area = cloudPlacementArea(width, height);

    for (const seed of [1, 7, 29, 113]) {
      for (const templateOffset of [0, 1, 2]) {
        const layout = createCloudPlacementLayout({
          viewportWidth: width,
          viewportHeight: height,
          targetScale: 1.6,
          random: seededRandom(seed),
          templateOffset
        });

        for (const placement of layout.placements) {
          expect(placement.baseRx * 2).toBeGreaterThanOrEqual(190);
          expect(placement.x - placement.visualBounds.left).toBeGreaterThanOrEqual(area.x - 0.001);
          expect(placement.x + placement.visualBounds.right).toBeLessThanOrEqual(area.x + area.width + 0.001);
          expect(placement.y - placement.visualBounds.top).toBeGreaterThanOrEqual(area.y - 0.001);
          expect(placement.y + placement.visualBounds.bottom).toBeLessThanOrEqual(area.y + area.height + 0.001);
        }

        for (let first = 0; first < layout.placements.length; first += 1) {
          for (let second = first + 1; second < layout.placements.length; second += 1) {
            expect(cloudPlacementsOverlap(layout.placements[first], layout.placements[second])).toBe(false);
          }
        }
      }
    }
  });

  it("reduces scale and then count when six large clouds do not fit", () => {
    const layout = createCloudPlacementLayout({
      viewportWidth: 900,
      viewportHeight: 600,
      targetScale: 1.6,
      random: seededRandom(5)
    });

    expect(layout.radiusScale).toBeLessThan(1);
    expect(layout.count).toBeLessThan(6);
    expect(layout.count).toBeGreaterThanOrEqual(4);
  });
});
