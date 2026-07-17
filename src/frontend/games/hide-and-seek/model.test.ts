import { describe, expect, it } from "vitest";
import {
  createHideAndSeekLayout,
  hideAndSeekEffectiveTargetBounds,
  hideAndSeekFallbackObstacles,
  hideAndSeekRectsOverlap
} from "./model";

const viewports = [
  { width: 900, height: 600 },
  { width: 1024, height: 600 },
  { width: 1280, height: 800 }
];

describe("hide-and-seek placement", () => {
  it.each(viewports)("places five deterministic targets at $width x $height", ({ width, height }) => {
    const obstacles = hideAndSeekFallbackObstacles(width, height);
    for (const targetScale of [1, 2]) {
      const options = {
        viewportWidth: width,
        viewportHeight: height,
        targetScale,
        obstacles
      };
      const layout = createHideAndSeekLayout(options);
      const repeatedLayout = createHideAndSeekLayout(options);
      const bounds = layout.placements.map((placement) => hideAndSeekEffectiveTargetBounds(
        placement,
        layout.targetWidth,
        layout.targetHeight,
        layout.hitPadding
      ));

      expect(layout).toEqual(repeatedLayout);
      expect(layout.placements).toHaveLength(5);
      for (const targetBounds of bounds) {
        expect(targetBounds.x).toBeGreaterThanOrEqual(0);
        expect(targetBounds.y).toBeGreaterThanOrEqual(0);
        expect(targetBounds.x + targetBounds.width).toBeLessThanOrEqual(width);
        expect(targetBounds.y + targetBounds.height).toBeLessThanOrEqual(height);
        expect(obstacles.every((obstacle) => !hideAndSeekRectsOverlap(targetBounds, obstacle))).toBe(true);
      }

      for (let index = 0; index < bounds.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < bounds.length; otherIndex += 1) {
          expect(hideAndSeekRectsOverlap(bounds[index], bounds[otherIndex])).toBe(false);
        }
      }
    }
  });
});
