import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generatePizzaFractionsRound, pizzaFractionChoices, type PizzaFractionId } from "./model";

describe("generatePizzaFractionsRound", () => {
  it("offers whole, half, and quarter pizza cards", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 24; index += 1) {
      const round = generatePizzaFractionsRound(settings, index);
      const ids = new Set(round.choices.map((choice) => choice.id));

      expect(round.choices).toHaveLength(3);
      expect(ids).toEqual(new Set(["whole", "half", "quarter"]));
      expect(round.choices[round.correctIndex].id).toBe(round.targetId);
      expect(round.roundId).toBe(`pizza-fractions:round:${index}`);
    }
  });

  it("cycles the requested target through the eight-step session", () => {
    const settings = settingsFromPreset("gentle");
    const targets: PizzaFractionId[] = [];

    for (let index = 1; index <= 8; index += 1) {
      targets.push(generatePizzaFractionsRound(settings, index).targetId);
    }

    expect(targets).toEqual(["half", "quarter", "whole", "half", "quarter", "whole", "half", "quarter"]);
  });

  it("keeps visual slice data clear and bounded", () => {
    expect(pizzaFractionChoices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "whole", filledSlices: 4, totalSlices: 4, shortLabel: "1" }),
      expect.objectContaining({ id: "half", filledSlices: 2, totalSlices: 4, shortLabel: "1/2" }),
      expect.objectContaining({ id: "quarter", filledSlices: 1, totalSlices: 4, shortLabel: "1/4" })
    ]));
    expect(pizzaFractionChoices.every((choice) => choice.filledSlices >= 1 && choice.filledSlices <= choice.totalSlices)).toBe(true);
  });

  it("uses injected randomness for choice order and stores no answer-revealing hint", () => {
    const settings = settingsFromPreset("standard");
    const round = generatePizzaFractionsRound(settings, 1, () => 0);

    expect(generatePizzaFractionsRound(settings, 1, () => 0).choices.map((choice) => choice.id)).toEqual(round.choices.map((choice) => choice.id));
    expect("mistakeHint" in round).toBe(false);
  });
});
