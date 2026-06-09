import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateCountItemsRound } from "./model";

describe("generateCountItemsRound", () => {
  it("keeps gentle rounds to two answer choices", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateCountItemsRound(settings, index + 1);
      expect(round.choices).toHaveLength(2);
      expect(round.choices).toContain(round.targetCount);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetCount));
    }
  });

  it("keeps standard rounds to four answer choices", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateCountItemsRound(settings, index + 1);
      expect(round.choices).toHaveLength(4);
      expect(new Set(round.choices).size).toBe(4);
      expect(round.choices).toContain(round.targetCount);
      expect(round.correctIndex).toBe(round.choices.indexOf(round.targetCount));
    }
  });
});
