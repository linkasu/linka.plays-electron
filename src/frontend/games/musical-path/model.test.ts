import { describe, expect, it } from "vitest";
import { createMusicalPathStones, findNextMusicalPathStone, isExpectedMusicalPathStone, musicalPathStoneTemplate } from "./model";

describe("musical path model", () => {
  it("creates eight ordered stones from low do to high do", () => {
    const stones = createMusicalPathStones();

    expect(stones).toHaveLength(8);
    expect(stones.map((stone) => stone.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stones.map((stone) => stone.note)).toEqual(["до", "ре", "ми", "фа", "соль", "ля", "си", "до"]);
    expect(stones.every((stone) => !stone.selected && !stone.softError)).toBe(true);
  });

  it("places notes from bottom to top", () => {
    const stones = createMusicalPathStones();

    expect(stones.map((stone) => stone.y)).toEqual([76, 70, 64, 58, 52, 46, 40, 34]);
    expect(stones.map((stone) => stone.mobileY)).toEqual([82, 75, 68, 61, 54, 47, 40, 34]);
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
