import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateNumberBondsRound } from "./model";

describe("generateNumberBondsRound", () => {
  it("keeps gentle number bonds within 5", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateNumberBondsRound(settings, index + 1);

      expect(round.roundId).toBe(`number-bonds:round:${index + 1}`);
      expect(round.total).toBeGreaterThanOrEqual(2);
      expect(round.total).toBeLessThanOrEqual(5);
      expect(round.knownPart + round.missingPart).toBe(round.total);
      expect(round.choices).toHaveLength(3);
      expect(round.choices.every((choice) => choice >= 1 && choice <= 5)).toBe(true);
    }
  });

  it("keeps standard number bonds within 10", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateNumberBondsRound(settings, index + 1);

      expect(round.total).toBeGreaterThanOrEqual(2);
      expect(round.total).toBeLessThanOrEqual(10);
      expect(round.knownPart).toBeGreaterThanOrEqual(1);
      expect(round.missingPart).toBeGreaterThanOrEqual(1);
      expect(round.knownPart + round.missingPart).toBe(round.total);
      expect(round.prompt).toContain(String(round.knownPart));
      expect(round.prompt).toContain(String(round.total));
      expect(round.choices).toHaveLength(4);
      expect(round.choices.every((choice) => choice >= 1 && choice <= 10)).toBe(true);
    }
  });

  it("always includes and indexes the missing part", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateNumberBondsRound(settings, index + 1);

      expect(round.choices).toContain(round.missingPart);
      expect(round.choices[round.correctIndex]).toBe(round.missingPart);
      expect(new Set(round.choices).size).toBe(round.choices.length);
    }
  });

  it("uses injected randomness for parts and choices", () => {
    const settings = settingsFromPreset("standard");
    const first = generateNumberBondsRound(settings, 1, () => 0);
    const again = generateNumberBondsRound(settings, 1, () => 0);

    expect(again.total).toBe(first.total);
    expect(again.knownPart).toBe(first.knownPart);
    expect(again.choices).toEqual(first.choices);
  });
});
