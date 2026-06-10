import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateSimpleGraphsRound, type SimpleGraphsRound } from "./model";

function correctChoice(round: SimpleGraphsRound) {
  return round.choices.find((choice) => choice.choiceId === round.correctChoiceId);
}

describe("generateSimpleGraphsRound", () => {
  it("builds three simple graph bars with different values", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateSimpleGraphsRound(settings, index + 1);
      const values = round.bars.map((bar) => bar.value);

      expect(round.roundId).toBe(`simple-graphs:round:${index + 1}`);
      expect(round.bars).toHaveLength(3);
      expect(new Set(values).size).toBe(3);
      expect(values.every((value) => value >= 1 && value <= 7)).toBe(true);
      expect(round.correctIndex).toBeGreaterThanOrEqual(0);
      expect(round.correctIndex).toBeLessThan(round.choices.length);
      expect(round.mistakeHint.length).toBeGreaterThan(10);
    }
  });

  it("keeps gentle values small", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateSimpleGraphsRound(settings, index + 1);

      expect(round.bars.every((bar) => bar.value >= 1 && bar.value <= 5)).toBe(true);
    }
  });

  it("alternates more, less and count questions", () => {
    const settings = settingsFromPreset("standard");

    expect(generateSimpleGraphsRound(settings, 1).questionKind).toBe("more");
    expect(generateSimpleGraphsRound(settings, 2).questionKind).toBe("less");
    expect(generateSimpleGraphsRound(settings, 3).questionKind).toBe("count");
    expect(generateSimpleGraphsRound(settings, 4).questionKind).toBe("more");
  });

  it("points more and less answers to the correct bar", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const moreRound = generateSimpleGraphsRound(settings, index * 3 + 1);
      const lessRound = generateSimpleGraphsRound(settings, index * 3 + 2);
      const maxValue = Math.max(...moreRound.bars.map((bar) => bar.value));
      const minValue = Math.min(...lessRound.bars.map((bar) => bar.value));

      expect(correctChoice(moreRound)?.value).toBe(maxValue);
      expect(correctChoice(lessRound)?.value).toBe(minValue);
    }
  });

  it("offers number choices for count questions", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateSimpleGraphsRound(settings, index * 3 + 3);

      expect(round.questionKind).toBe("count");
      expect(round.targetBar).toBeDefined();
      expect(round.choices).toHaveLength(4);
      expect(correctChoice(round)?.value).toBe(round.targetBar?.value);
      expect(round.choices.every((choice) => typeof choice.value === "number" && choice.choiceId.startsWith("count:"))).toBe(true);
    }
  });
});
