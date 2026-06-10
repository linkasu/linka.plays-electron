import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { findLetterAlphabet, generateFindLetterRound } from "./model";

describe("find-letter model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateFindLetterRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four choices in standard mode", () => {
    const round = generateFindLetterRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(4);
  });

  it("uses six choices in challenge mode", () => {
    const round = generateFindLetterRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(6);
  });

  it("keeps target inside unique choices and points correctIndex to it", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateFindLetterRound(settings, index + 1);
      const letters = new Set(round.choices.map((choice) => choice.letter));

      expect(round.roundId).toBe(`find-letter:round:${index + 1}`);
      expect(letters.size).toBe(round.choices.length);
      expect(findLetterAlphabet).toContain(round.target.letter as (typeof findLetterAlphabet)[number]);
      expect(round.choices[round.correctIndex]).toMatchObject(round.target);
      expect(round.prompt).toContain(round.target.letter);
    }
  });
});
