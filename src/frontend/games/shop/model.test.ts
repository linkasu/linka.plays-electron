import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { buildShopPaymentSuggestion, generateShopRound } from "./model";

describe("generateShopRound", () => {
  it("alternates price choice and coin payment tasks", () => {
    const settings = settingsFromPreset("standard");

    expect(generateShopRound(settings, 1).taskKind).toBe("choose-item");
    expect(generateShopRound(settings, 2).taskKind).toBe("pay-coins");
    expect(generateShopRound(settings, 3).taskKind).toBe("choose-item");
  });

  it("includes one correct priced item in every choice round", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateShopRound(settings, index);
      const matchingPrices = round.choices.filter((item) => item.price === round.targetPrice);

      expect(round.roundId).toBe(`shop:round:${index}`);
      expect(round.choices).toHaveLength(4);
      expect(round.choices).toContainEqual(round.targetItem);
      expect(round.correctIndex).toBe(round.choices.findIndex((item) => item.id === round.targetItem.id));
      expect(matchingPrices).toHaveLength(1);
    }
  });

  it("uses three choices for gentle sessions", () => {
    const settings = settingsFromPreset("gentle");
    const round = generateShopRound(settings, 1);

    expect(round.choices).toHaveLength(3);
    expect(new Set(round.choices.map((item) => item.id)).size).toBe(3);
  });

  it("offers supported coins that can pay every target price", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateShopRound(settings, index);

      expect(round.coins.map((coin) => coin.value)).toEqual([1, 2, 5]);
      expect(round.suggestedCoins.reduce((sum, coin) => sum + coin, 0)).toBe(round.targetPrice);
      expect(round.suggestedCoins.every((coin) => [1, 2, 5].includes(coin))).toBe(true);
    }
  });

  it("uses injected randomness for target and choices", () => {
    const settings = settingsFromPreset("standard");
    const first = generateShopRound(settings, 1, () => 0);
    const again = generateShopRound(settings, 1, () => 0);

    expect(again.targetItem).toEqual(first.targetItem);
    expect(again.choices.map((item) => item.id)).toEqual(first.choices.map((item) => item.id));
  });
});

describe("buildShopPaymentSuggestion", () => {
  it("keeps suggestions inside the shop price range", () => {
    expect(buildShopPaymentSuggestion(1).reduce((sum, coin) => sum + coin, 0)).toBe(2);
    expect(buildShopPaymentSuggestion(11).reduce((sum, coin) => sum + coin, 0)).toBe(10);
  });
});
