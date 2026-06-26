import { describe, expect, it } from "vitest";
import { correctShelfIdFor, generateShelfSortingRound, shelvesForRule } from "./model";

describe("generateShelfSortingRound", () => {
  it("alternates category and color rules", () => {
    expect(generateShelfSortingRound(1).rule).toBe("category");
    expect(generateShelfSortingRound(2).rule).toBe("color");
    expect(generateShelfSortingRound(3).rule).toBe("category");
  });

  it("includes exactly one correct shelf for each generated round", () => {
    for (let index = 1; index <= 100; index += 1) {
      const round = generateShelfSortingRound(index);
      const shelfIds = round.shelves.map((shelf) => shelf.id);

      expect(round.shelves).toEqual(shelvesForRule(round.rule));
      expect(round.correctShelfId).toBe(correctShelfIdFor(round.item, round.rule));
      expect(shelfIds).toContain(round.correctShelfId);
      expect(new Set(shelfIds).size).toBe(round.shelves.length);
      expect(round.shelves[round.correctIndex].id).toBe(round.correctShelfId);
    }
  });

  it("keeps the round id stable for telemetry", () => {
    const round = generateShelfSortingRound(8);

    expect(round.roundId).toBe("shelf-sorting:round:8");
  });

  it("uses injected randomness for deterministic item choice", () => {
    const first = generateShelfSortingRound(1, () => 0).item.id;

    expect(generateShelfSortingRound(1, () => 0).item.id).toBe(first);
    expect(generateShelfSortingRound(1, () => 0.99).item.id).not.toBe(first);
  });
});
