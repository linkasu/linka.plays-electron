import { describe, expect, it } from "vitest";
import {
  createMusicalPathStones,
  findNextMusicalPathStone,
  isExpectedMusicalPathStone,
  musicalPathHitPadding,
  musicalPathStoneTemplate,
  type MusicalPathStone,
} from "./model";

type Rect = { left: number; right: number; top: number; bottom: number };

function compactDesktopTargetRect(stone: MusicalPathStone): Rect {
  const centerX = stone.x * 8;
  const centerY = Math.max(stone.y * 6, 210);
  const halfWidth = (142 + musicalPathHitPadding * 2) / 2;
  const halfHeight = (162 + musicalPathHitPadding * 2) / 2;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY - halfHeight,
    bottom: centerY + halfHeight,
  };
}

function overlaps(first: Rect, second: Rect) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

describe("musical path model", () => {
  it("creates eight ordered stones from low do to high do", () => {
    const stones = createMusicalPathStones();

    expect(stones).toHaveLength(8);
    expect(stones.map((stone) => stone.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stones.map((stone) => stone.note)).toEqual([
      "до",
      "ре",
      "ми",
      "фа",
      "соль",
      "ля",
      "си",
      "до",
    ]);
    expect(stones.every((stone) => !stone.selected && !stone.softError)).toBe(true);
  });

  it("lays the path as a snake: notes 1-4 along the lower row, 5-8 back along the upper", () => {
    const stones = createMusicalPathStones();

    expect(stones.slice(0, 4).map((stone) => [stone.x, stone.y])).toEqual([
      [14, 65.5],
      [38, 65.5],
      [62, 65.5],
      [86, 65.5],
    ]);
    expect(stones.slice(4).map((stone) => [stone.x, stone.y])).toEqual([
      [86, 37],
      [62, 37],
      [38, 37],
      [14, 37],
    ]);
    expect(stones.slice(4).map((stone) => [stone.mobileX, stone.mobileY])).toEqual([
      [28, 60],
      [72, 60],
      [28, 34],
      [72, 34],
    ]);
  });

  it("keeps every compact-desktop effective gaze zone disjoint", () => {
    const rects = createMusicalPathStones().map(compactDesktopTargetRect);

    expect(
      rects.every((rect, index) => rects.slice(index + 1).every((other) => !overlaps(rect, other))),
    ).toBe(true);
  });

  it("limits stones by max steps", () => {
    const stones = createMusicalPathStones(5);

    expect(stones).toHaveLength(5);
    expect(stones.map((stone) => stone.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("clamps max steps to available stones", () => {
    expect(createMusicalPathStones(0)).toHaveLength(1);
    expect(createMusicalPathStones(99)).toHaveLength(musicalPathStoneTemplate.length);
  });

  it("finds the next unselected stone by completed step count", () => {
    const stones = createMusicalPathStones();
    stones[0].selected = true;

    expect(findNextMusicalPathStone(stones, 0)?.id).toBeUndefined();
    expect(findNextMusicalPathStone(stones, 1)?.id).toBe("re");
  });

  it("checks expected stone identity", () => {
    const stones = createMusicalPathStones();

    expect(isExpectedMusicalPathStone(stones[0], stones[0])).toBe(true);
    expect(isExpectedMusicalPathStone(stones[1], stones[0])).toBe(false);
    expect(isExpectedMusicalPathStone(stones[0], undefined)).toBe(false);
  });
});
