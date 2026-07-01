import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateNumberLineRound, numberLineNumbers } from "./model";

describe("number-line model", () => {
  it("always shows a full number line from 1 to 10", () => {
    const round = generateNumberLineRound(settingsFromPreset("standard"));

    expect(round.numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(numberLineNumbers).toHaveLength(10);
  });

  it("creates search rounds with a target on the line", () => {
    const round = generateNumberLineRound(settingsFromPreset("standard"), 1);

    expect(round.roundId).toBe("number-line:round:1");
    expect(round.taskKind).toBe("find");
    expect(round.currentNumber).toBeUndefined();
    expect(round.numbers).toContain(round.targetNumber);
    expect(round.prompt).toBe(`Найди число ${round.targetNumber}`);
  });

  it("creates next-number rounds where target follows current", () => {
    const round = generateNumberLineRound(settingsFromPreset("standard"), 2);

    expect(round.roundId).toBe("number-line:round:2");
    expect(round.taskKind).toBe("next");
    expect(round.currentNumber).toBeGreaterThanOrEqual(1);
    expect(round.currentNumber).toBeLessThanOrEqual(9);
    expect(round.targetNumber).toBe((round.currentNumber ?? 0) + 1);
    expect(round.numbers).toContain(round.targetNumber);
  });

  it("creates previous-number rounds where target comes before current", () => {
    const round = generateNumberLineRound(settingsFromPreset("standard"), 3);

    expect(round.roundId).toBe("number-line:round:3");
    expect(round.taskKind).toBe("previous");
    expect(round.currentNumber).toBeGreaterThanOrEqual(2);
    expect(round.currentNumber).toBeLessThanOrEqual(10);
    expect(round.targetNumber).toBe((round.currentNumber ?? 0) - 1);
    expect(round.numbers).toContain(round.targetNumber);
    expect(round.prompt).toBe(`Что идёт перед ${round.currentNumber}?`);
  });

  it("cycles find, next and previous tasks", () => {
    const settings = settingsFromPreset("standard");

    expect(Array.from({ length: 6 }, (_, index) => generateNumberLineRound(settings, index + 1).taskKind)).toEqual(["find", "next", "previous", "find", "next", "previous"]);
  });

  it("keeps generated targets within the 1-10 road", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateNumberLineRound(settings, index);

      expect(round.targetNumber).toBeGreaterThanOrEqual(1);
      expect(round.targetNumber).toBeLessThanOrEqual(10);
      expect(round.numbers).toContain(round.targetNumber);
    }
  });
});
