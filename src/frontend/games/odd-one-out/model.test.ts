import { describe, expect, it } from "vitest";
import wordImageManifest from "../../../../public/images/words/manifest.json";
import { settingsFromPreset } from "../../core/settings";
import { generateOddOneOutRound, oddOneOutCategories } from "./model";

describe("generateOddOneOutRound", () => {
  it("creates gentle rounds with three choices and one odd item", () => {
    const settings = settingsFromPreset("gentle");

    for (let index = 0; index < 100; index += 1) {
      const round = generateOddOneOutRound(settings, index + 1);
      const choiceIds = round.choices.map((choice) => choice.id);
      const commonChoices = round.choices.filter((choice) => choice.categoryId === round.commonCategory.id);
      const oddChoices = round.choices.filter((choice) => choice.categoryId !== round.commonCategory.id);

      expect(round.choices).toHaveLength(3);
      expect(new Set(choiceIds).size).toBe(3);
      expect(commonChoices).toHaveLength(2);
      expect(oddChoices).toEqual([round.oddItem]);
      expect(round.choices[round.correctIndex]).toBe(round.oddItem);
      expect(round.oddCategory.id).toBe(round.oddItem.categoryId);
      expect(round.oddCategory.id).not.toBe(round.commonCategory.id);
    }
  });

  it("creates standard rounds with four choices and category hints", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateOddOneOutRound(settings, index + 1);
      const commonChoices = round.choices.filter((choice) => choice.categoryId === round.commonCategory.id);

      expect(round.choices).toHaveLength(4);
      expect(commonChoices).toHaveLength(3);
      expect(round.mistakeHint).toContain(round.commonCategory.label);
      expect(round.mistakeHint).toContain(round.commonCategory.helper);
    }
  });

  it("creates challenge rounds with five choices", () => {
    const settings = settingsFromPreset("challenge");

    for (let index = 0; index < 100; index += 1) {
      const round = generateOddOneOutRound(settings, index + 1);
      const commonChoices = round.choices.filter((choice) => choice.categoryId === round.commonCategory.id);

      expect(round.choices).toHaveLength(5);
      expect(commonChoices).toHaveLength(4);
      expect(round.choices[round.correctIndex].categoryId).not.toBe(round.commonCategory.id);
    }
  });

  it("keeps enough items in every category for five-card rounds", () => {
    for (const category of oddOneOutCategories) {
      expect(category.items).toHaveLength(5);
      expect(new Set(category.items.map((item) => item.id)).size).toBe(5);
    }
  });

  it("uses one available asset mode for every choice in a round", () => {
    const packagedImageIds = new Set(wordImageManifest.map((item) => item.id));

    for (let index = 1; index <= 100; index += 1) {
      const round = generateOddOneOutRound(settingsFromPreset("challenge"), index);

      if (round.assetMode === "image") {
        expect(round.choices.every((choice) => choice.wordId && packagedImageIds.has(choice.wordId))).toBe(true);
      } else {
        expect(round.choices.every((choice) => Boolean(choice.emoji))).toBe(true);
      }
    }
  });

  it("keeps the round id stable for telemetry", () => {
    const round = generateOddOneOutRound(settingsFromPreset("standard"), 6);

    expect(round.roundId).toBe("odd-one-out:round:6");
  });
});
