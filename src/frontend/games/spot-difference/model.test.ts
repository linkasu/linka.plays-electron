import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateSpotDifferenceRound } from "./model";

describe("spot-difference model", () => {
  it("uses two cards in gentle mode", () => {
    const round = generateSpotDifferenceRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(2);
  });

  it("uses three cards in standard mode", () => {
    const round = generateSpotDifferenceRound(settingsFromPreset("standard"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four cards in challenge mode", () => {
    const round = generateSpotDifferenceRound(settingsFromPreset("challenge"));

    expect(round.choices).toHaveLength(4);
  });

  it("marks exactly one different choice", () => {
    const round = generateSpotDifferenceRound(settingsFromPreset("standard"), 4);
    const differentChoices = round.choices.filter((choice) => choice.isDifferent);

    expect(differentChoices).toHaveLength(1);
    expect(round.choices[round.correctIndex]).toBe(round.target);
    expect(round.target).toBe(differentChoices[0]);
  });

  it("keeps same choices visually identical and target visually different", () => {
    const round = generateSpotDifferenceRound(settingsFromPreset("challenge"), 2);
    const sameChoices = round.choices.filter((choice) => !choice.isDifferent);
    const [sampleSame] = sameChoices;

    expect(sameChoices.every((choice) => choice.icon === sampleSame.icon)).toBe(true);
    expect(sameChoices.every((choice) => choice.color === sampleSame.color)).toBe(true);
    expect(sameChoices.every((choice) => choice.detailIcon === sampleSame.detailIcon)).toBe(true);
    expect(round.target.detailIcon).not.toBe(sampleSame.detailIcon);
  });
});
