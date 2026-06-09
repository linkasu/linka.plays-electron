import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { createMemoryCardDeck, createMemoryCardsRound, memoryCardSources, shuffleMemoryCards } from "./model";

function pairCounts(pairIds: string[]) {
  return pairIds.reduce<Record<string, number>>((counts, pairId) => {
    counts[pairId] = (counts[pairId] ?? 0) + 1;
    return counts;
  }, {});
}

describe("createMemoryCardsRound", () => {
  it("creates paired gentle cards", () => {
    const round = createMemoryCardsRound(settingsFromPreset("gentle"), 1, () => 0.4);

    expect(round.pairCount).toBe(3);
    expect(round.cards).toHaveLength(6);
    expect(Object.values(pairCounts(round.cards.map((card) => card.pairId)))).toEqual([2, 2, 2]);
  });

  it("keeps pairs after shuffle", () => {
    const deck = createMemoryCardDeck(memoryCardSources, 4, 2, () => 0.7);
    const shuffled = shuffleMemoryCards(deck, () => 0.2);

    expect(shuffled).toHaveLength(deck.length);
    expect(pairCounts(shuffled.map((card) => card.pairId))).toEqual(pairCounts(deck.map((card) => card.pairId)));
  });

  it("creates unique card ids", () => {
    const round = createMemoryCardsRound(settingsFromPreset("challenge"), 3, () => 0.6);
    const ids = round.cards.map((card) => card.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
