import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateUnoLikeRound, getUnoLikeMatchTraits, isUnoLikePlayable, unoLikeDeck } from "./model";

describe("uno-like model", () => {
  it("scales hand size by preset", () => {
    expect(generateUnoLikeRound(settingsFromPreset("gentle")).choices).toHaveLength(3);
    expect(generateUnoLikeRound(settingsFromPreset("standard")).choices).toHaveLength(4);
    expect(generateUnoLikeRound(settingsFromPreset("challenge")).choices).toHaveLength(5);
  });

  it("offers playable cards by color and by number", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 12; index += 1) {
      const round = generateUnoLikeRound(settings, index);
      const playableCards = round.choices.filter((card) => isUnoLikePlayable(card, round.openCard));
      const matchKinds = playableCards.flatMap((card) => getUnoLikeMatchTraits(card, round.openCard));

      expect(playableCards.map((card) => card.id)).toEqual(round.playableIds);
      expect(matchKinds).toContain("color");
      expect(matchKinds).toContain("number");
    }
  });

  it("keeps choices unique and separate from the open card", () => {
    const round = generateUnoLikeRound(settingsFromPreset("challenge"), 5);
    const choiceIds = new Set(round.choices.map((card) => card.id));

    expect(choiceIds.size).toBe(round.choices.length);
    expect(choiceIds.has(round.openCard.id)).toBe(false);
  });

  it("points correctIndexes to every playable card", () => {
    const round = generateUnoLikeRound(settingsFromPreset("standard"), 3);

    expect(round.correctIndexes).toHaveLength(round.playableIds.length);
    expect(round.correctIndexes.map((index) => round.choices[index].id)).toEqual(round.playableIds);
  });

  it("detects color, number and non-matches", () => {
    const openCard = unoLikeDeck.find((card) => card.id === "red-3");
    const sameColor = unoLikeDeck.find((card) => card.id === "red-5");
    const sameNumber = unoLikeDeck.find((card) => card.id === "blue-3");
    const wrong = unoLikeDeck.find((card) => card.id === "green-6");

    expect(openCard && sameColor && getUnoLikeMatchTraits(sameColor, openCard)).toEqual(["color"]);
    expect(openCard && sameNumber && getUnoLikeMatchTraits(sameNumber, openCard)).toEqual(["number"]);
    expect(openCard && wrong && getUnoLikeMatchTraits(wrong, openCard)).toEqual([]);
  });
});
