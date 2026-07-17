import { describe, expect, it } from "vitest";
import { correctShelfIdFor, generateShelfSortingRound, shelfSortingItems, shelvesForRule } from "./model";

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

  it("uses distinct category symbols and large-swatch data for exact colors", () => {
    const categoryShelves = shelvesForRule("category");
    const colorShelves = shelvesForRule("color");

    expect(new Set(categoryShelves.map((shelf) => shelf.icon)).size).toBe(categoryShelves.length);
    expect(categoryShelves.every((shelf) => shelf.icon && !shelf.swatch)).toBe(true);
    expect(colorShelves.map((shelf) => shelf.id)).toEqual(["red", "yellow", "green"]);
    expect(colorShelves.every((shelf) => shelf.swatch && !shelf.icon)).toBe(true);
  });

  it("only puts items with an exact color on color rounds", () => {
    for (let index = 0; index < 20; index += 1) {
      const round = generateShelfSortingRound(2, () => index / 20);

      expect(round.item.colorShelfId).toBe(round.correctShelfId);
      expect(["red", "yellow", "green"]).toContain(round.correctShelfId);
    }
  });

  it("uses word images when available and MDI icons for teddy and kite", () => {
    const teddy = shelfSortingItems.find((item) => item.id === "teddy");
    const kite = shelfSortingItems.find((item) => item.id === "kite");

    expect(teddy?.icon).toBe("mdi-teddy-bear");
    expect(teddy?.imageId).toBeUndefined();
    expect(kite?.icon).toBe("mdi-kite");
    expect(kite?.imageId).toBeUndefined();
    expect(shelfSortingItems.filter((item) => !["teddy", "kite"].includes(item.id)).every((item) => item.imageId)).toBe(true);
  });

  it("prompts with the rule and item without naming the answer", () => {
    for (const roundIndex of [1, 2]) {
      const round = generateShelfSortingRound(roundIndex, () => 0);
      const answerTitle = round.shelves[round.correctIndex].title;

      expect(round.prompt).toContain(round.rule === "category" ? "Сортируем по категории" : "Сортируем по цвету");
      expect(round.prompt).toContain(`Предмет: ${round.item.label}`);
      expect(round.prompt).not.toContain(answerTitle);
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
