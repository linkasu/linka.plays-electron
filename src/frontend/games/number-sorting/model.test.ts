import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateNumberSortingRound } from "./model";

function cardValues(round: ReturnType<typeof generateNumberSortingRound>) {
  return round.cards.map((card) => card.value);
}

describe("number-sorting model", () => {
  it("creates unique large-card numbers for the selected preset", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateNumberSortingRound(settings, index);
      const values = cardValues(round);

      expect(round.cards).toHaveLength(4);
      expect(new Set(values).size).toBe(values.length);
      expect(values.every((value) => value >= 1 && value <= 8)).toBe(true);
      expect(round.correctOrder).toHaveLength(round.cards.length);
    }
  });

  it("sorts odd rounds ascending and targets the first number", () => {
    const round = generateNumberSortingRound(settingsFromPreset("standard"), 1);
    const expectedOrder = [...cardValues(round)].sort((left, right) => left - right);

    expect(round.roundId).toBe("number-sorting:round:1");
    expect(round.direction).toBe("ascending");
    expect(round.correctOrder).toEqual(expectedOrder);
    expect(round.targetNumber).toBe(expectedOrder[0]);
    expect(round.prompt).toContain("меньшего к большему");
  });

  it("sorts even rounds descending and targets the first number", () => {
    const round = generateNumberSortingRound(settingsFromPreset("standard"), 2);
    const expectedOrder = [...cardValues(round)].sort((left, right) => right - left);

    expect(round.roundId).toBe("number-sorting:round:2");
    expect(round.direction).toBe("descending");
    expect(round.correctOrder).toEqual(expectedOrder);
    expect(round.targetNumber).toBe(expectedOrder[0]);
    expect(round.prompt).toContain("большего к меньшему");
  });

  it("uses more cards and a wider range for challenge rounds", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateNumberSortingRound(settings, index);
      const values = cardValues(round);

      expect(round.cards).toHaveLength(6);
      expect(new Set(values).size).toBe(values.length);
      expect(values.every((value) => value >= 1 && value <= 18)).toBe(true);
    }
  });

  it("uses injected randomness for card selection", () => {
    const settings = settingsFromPreset("standard");
    const first = generateNumberSortingRound(settings, 1, () => 0);
    const again = generateNumberSortingRound(settings, 1, () => 0);

    expect(cardValues(again)).toEqual(cardValues(first));
  });
});
