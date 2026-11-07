import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateNumberLineRound, numberLineNumbers } from "./model";

describe("number-line model", () => {
  it("shows five numbers in a row that hold every number the task names", () => {
    expect(numberLineNumbers).toHaveLength(10);
    for (let roundIndex = 1; roundIndex <= 30; roundIndex += 1) {
      const round = generateNumberLineRound(settingsFromPreset("standard"), roundIndex);

      expect(round.numbers).toHaveLength(5);
      expect(round.numbers.every((number, index) => number === round.numbers[0] + index)).toBe(
        true,
      );
      expect(round.numbers[0]).toBeGreaterThanOrEqual(1);
      expect(round.numbers[4]).toBeLessThanOrEqual(10);
      expect(round.numbers).toContain(round.targetNumber);
      if (round.currentNumber !== undefined) expect(round.numbers).toContain(round.currentNumber);
    }
  });

  it("does not keep the answer in the same place", () => {
    const places = new Set(
      Array.from({ length: 30 }, (_, index) => {
        const round = generateNumberLineRound(settingsFromPreset("standard"), index + 1);
        return round.numbers.indexOf(round.targetNumber);
      }),
    );

    expect(places.size).toBeGreaterThan(2);
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

    expect(
      Array.from(
        { length: 6 },
        (_, index) => generateNumberLineRound(settings, index + 1).taskKind,
      ),
    ).toEqual(["find", "next", "previous", "find", "next", "previous"]);
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
