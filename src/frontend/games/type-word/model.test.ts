import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateTypeWordRound } from "./model";

function expectKeyboardIncludesWord(round: ReturnType<typeof generateTypeWordRound>) {
  const keys = new Set(round.keyboardChoices);
  const uniqueLetters = new Set(round.letters);

  expect(keys.size).toBe(round.keyboardChoices.length);
  for (const letter of uniqueLetters) expect(keys.has(letter)).toBe(true);
}

describe("generateTypeWordRound", () => {
  it("keeps round ids stable for telemetry", () => {
    expect(generateTypeWordRound(settingsFromPreset("gentle"), 1).roundId).toBe("type-word:round:1");
    expect(generateTypeWordRound(settingsFromPreset("standard"), 7).roundId).toBe("type-word:round:7");
  });

  it("builds letters from the selected lowercase word", () => {
    const round = generateTypeWordRound(settingsFromPreset("standard"), 1);

    expect(round.letters).toEqual(Array.from(round.item.word.toLowerCase()));
    expect(round.letters.length).toBeGreaterThanOrEqual(2);
    expect(round.letters.every(Boolean)).toBe(true);
  });

  it("keeps gentle words short and keyboard compact", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateTypeWordRound(settings, index + 1);
      const wordLength = Array.from(round.item.word).length;

      expect(round.roundId).toBe(`type-word:round:${index + 1}`);
      expect(wordLength).toBeGreaterThanOrEqual(2);
      expect(wordLength).toBeLessThanOrEqual(4);
      expect(round.keyboardChoices.length).toBeGreaterThanOrEqual(4);
      expect(round.keyboardChoices.length).toBeLessThanOrEqual(8);
      expect(round.keyboardChoices.length % 2).toBe(0);
      expectKeyboardIncludesWord(round);
    }
  });

  it("keeps non-gentle words within six letters and keyboard choices playable", () => {
    for (const preset of ["standard", "challenge", "custom"] as const) {
      const settings = settingsFromPreset(preset);

      for (let index = 0; index < 100; index += 1) {
        const round = generateTypeWordRound(settings, index + 1);
        const wordLength = Array.from(round.item.word).length;

        expect(wordLength).toBeGreaterThanOrEqual(2);
        expect(wordLength).toBeLessThanOrEqual(6);
        expect(round.keyboardChoices.length).toBeGreaterThanOrEqual(6);
        expect(round.keyboardChoices.length).toBeLessThanOrEqual(8);
        expect(round.keyboardChoices.length % 2).toBe(0);
        expectKeyboardIncludesWord(round);
      }
    }
  });

  it("keeps repeated letters as repeated target letters but unique reusable keys", () => {
    for (let index = 0; index < 300; index += 1) {
      const round = generateTypeWordRound(settingsFromPreset("standard"), index + 1);
      const uniqueLetters = new Set(round.letters);
      if (uniqueLetters.size === round.letters.length) continue;

      expect(round.letters.length).toBeGreaterThan(uniqueLetters.size);
      expectKeyboardIncludesWord(round);
      return;
    }

    throw new Error("No repeated-letter word was sampled during the test run.");
  });

  it("uses injected randomness without looping on repeated values", () => {
    const settings = settingsFromPreset("standard");
    const first = generateTypeWordRound(settings, 1, () => 0);

    expect(generateTypeWordRound(settings, 1, () => 0).keyboardChoices).toEqual(first.keyboardChoices);
    expectKeyboardIncludesWord(first);
  });
});
