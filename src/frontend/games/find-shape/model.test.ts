import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateFindShapeRound } from "./model";

describe("find-shape model", () => {
  it("uses two to five choices in standard rounds", () => {
    const settings = settingsFromPreset("standard");
    const counts = Array.from({ length: 8 }, (_, index) => generateFindShapeRound(settings, index + 1).choices.length);

    expect(counts).toEqual([2, 3, 4, 5, 2, 3, 4, 5]);
  });

  it("keeps gentle rounds simpler", () => {
    const settings = settingsFromPreset("gentle");
    const counts = Array.from({ length: 4 }, (_, index) => generateFindShapeRound(settings, index + 1).choices.length);

    expect(counts).toEqual([2, 3, 2, 3]);
  });

  it("includes one target and points correctIndex to it", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 12; index += 1) {
      const round = generateFindShapeRound(settings, index);
      const targetMatches = round.choices.filter((choice) => choice.id === round.target.id);

      expect(round.roundId).toBe(`find-shape:round:${index}`);
      expect(round.prompt).toBe(`Найди ${round.target.promptLabel}`);
      expect(targetMatches).toHaveLength(1);
      expect(round.choices[round.correctIndex]).toBe(round.target);
    }
  });

  it("does not repeat distractors", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 1; index <= 12; index += 1) {
      const round = generateFindShapeRound(settings, index);
      const uniqueChoiceIds = new Set(round.choices.map((choice) => choice.id));

      expect(uniqueChoiceIds.size).toBe(round.choices.length);
    }
  });
});
