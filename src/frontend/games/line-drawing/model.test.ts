import { describe, expect, it } from "vitest";
import { drawingLevelAt, drawingLevels, wrapDrawingLevelIndex } from "./model";

describe("line drawing levels", () => {
  it("progresses from simple shapes to animals", () => {
    expect(drawingLevels[0].id).toBe("straight-line");
    expect(drawingLevels.at(-2)?.id).toBe("cat");
    expect(drawingLevels.at(-1)?.id).toBe("dog");
  });

  it("keeps every level drawable with at least two points inside normalized bounds", () => {
    for (const level of drawingLevels) {
      expect(level.points.length, level.id).toBeGreaterThanOrEqual(2);
      const uniquePoints = new Set<string>();
      for (const point of level.points) {
        expect(point.x, level.id).toBeGreaterThanOrEqual(0);
        expect(point.x, level.id).toBeLessThanOrEqual(1);
        expect(point.y, level.id).toBeGreaterThanOrEqual(0);
        expect(point.y, level.id).toBeLessThanOrEqual(1);
        uniquePoints.add(`${point.x}:${point.y}`);
      }
      expect(uniquePoints.size, level.id).toBe(level.points.length);
    }
  });

  it("wraps level indexes safely", () => {
    expect(wrapDrawingLevelIndex(-1)).toBe(drawingLevels.length - 1);
    expect(drawingLevelAt(drawingLevels.length).id).toBe(drawingLevels[0].id);
  });
});
