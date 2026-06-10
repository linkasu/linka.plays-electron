import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { buildCoinCountingSuggestion, generateCoinCountingRound } from "./model";

describe("generateCoinCountingRound", () => {
  it("asks for a target total from 1 to 10", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateCoinCountingRound(settings, index + 1);

      expect(round.roundId).toBe(`coin-counting:round:${index + 1}`);
      expect(round.targetTotal).toBeGreaterThanOrEqual(1);
      expect(round.targetTotal).toBeLessThanOrEqual(10);
      expect(round.prompt).toContain(String(round.targetTotal));
    }
  });

  it("offers calm coin choices that can build every target", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 0; index < 100; index += 1) {
      const round = generateCoinCountingRound(settings, index + 1);

      expect(round.coins.map((coin) => coin.value)).toEqual([1, 2, 5]);
      expect(round.suggestedCoins.reduce((sum, coin) => sum + coin, 0)).toBe(round.targetTotal);
      expect(round.suggestedCoins.every((coin) => [1, 2, 5].includes(coin))).toBe(true);
    }
  });
});

describe("buildCoinCountingSuggestion", () => {
  it("keeps suggestions inside the supported 1 to 10 range", () => {
    expect(buildCoinCountingSuggestion(0).reduce((sum, coin) => sum + coin, 0)).toBe(1);
    expect(buildCoinCountingSuggestion(11).reduce((sum, coin) => sum + coin, 0)).toBe(10);
  });
});
