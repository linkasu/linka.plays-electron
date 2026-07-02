import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { buildShopPaymentSuggestion, generateShopRound, validateShopShoppingCart } from "./model";

describe("generateShopRound", () => {
  it("alternates shopping list and coin payment tasks", () => {
    const settings = settingsFromPreset("standard");

    expect(generateShopRound(settings, 1).taskKind).toBe("shopping-list");
    expect(generateShopRound(settings, 2).taskKind).toBe("pay-coins");
    expect(generateShopRound(settings, 3).taskKind).toBe("shopping-list");
  });

  it("builds shopping lists that fit inside the wallet", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 40; index += 2) {
      const round = generateShopRound(settings, index);
      const targetTotal = round.targetItems.reduce((sum, item) => sum + item.price, 0);

      expect(round.roundId).toBe(`shop:round:${index}`);
      expect(round.taskKind).toBe("shopping-list");
      expect(round.choices).toHaveLength(4);
      expect(round.targetItems).toHaveLength(2);
      expect(targetTotal).toBe(round.targetPrice);
      expect(targetTotal).toBeLessThanOrEqual(round.walletTotal);
      expect(round.correctItemIds).toEqual(round.targetItems.map((item) => item.id));
      expect(round.targetItems.every((item) => round.choices.some((choice) => choice.id === item.id))).toBe(true);
    }
  });

  it("uses three choices for gentle sessions", () => {
    const settings = settingsFromPreset("gentle");
    const round = generateShopRound(settings, 1);

    expect(round.choices).toHaveLength(3);
    expect(new Set(round.choices.map((item) => item.id)).size).toBe(3);
  });

  it("validates exact shopping carts", () => {
    const settings = settingsFromPreset("standard");
    const round = generateShopRound(settings, 1, () => 0);
    const extra = round.choices.find((item) => !round.correctItemIds.includes(item.id));

    expect(validateShopShoppingCart(round, round.correctItemIds)).toBe(true);
    expect(validateShopShoppingCart(round, round.correctItemIds.slice(0, 1))).toBe(false);
    if (extra) expect(validateShopShoppingCart(round, [...round.correctItemIds, extra.id])).toBe(false);
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
