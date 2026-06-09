import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateShapesRound } from "./model";

describe("generateShapesRound", () => {
  it("includes the correct shape in every round", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 16; index += 1) {
      const round = generateShapesRound(settings, index + 1);

      expect(round.choices).toContainEqual(round.target);
      expect(round.correctIndex).toBe(round.choices.findIndex((choice) => choice.id === round.target.id));
      expect(round.prompt).toBe(`Найди ${round.target.label}`);
    }
  });

  it("keeps distractors unique", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 16; index += 1) {
      const round = generateShapesRound(settings, index + 1);
      const distractors = round.choices.filter((choice) => choice.id !== round.target.id);

      expect(new Set(distractors.map((choice) => choice.id)).size).toBe(distractors.length);
    }
  });

  it("uses three choices for gentle rounds", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 16; index += 1) {
      const round = generateShapesRound(settings, index + 1);

      expect(round.choices).toHaveLength(3);
      expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(3);
    }
  });

  it("uses four choices for standard and challenge rounds", () => {
    for (const preset of ["standard", "challenge"] as const) {
      const settings = settingsFromPreset(preset);

      for (let index = 0; index < 16; index += 1) {
        const round = generateShapesRound(settings, index + 1);

        expect(round.choices).toHaveLength(4);
        expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(4);
      }
    }
  });
});
