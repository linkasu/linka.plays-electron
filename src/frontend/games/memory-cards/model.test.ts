import { describe, expect, it } from "vitest";
import wordImageManifest from "../../../../public/images/words/manifest.json";
import { resolveGazeTarget, type GazeTargetCandidate } from "../../core/gazeTargetResolver";
import { settingsFromPreset } from "../../core/settings";
import { wordImageSrc } from "../../core/wordImage";
import { createMemoryCardDeck, createMemoryCardsRound, memoryCardHitPaddingForGap, memoryCardSources, shuffleMemoryCards } from "./model";

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

  it("limits gaze hit padding to half of the actual card gap", () => {
    expect(memoryCardHitPaddingForGap(12)).toBe(6);
    expect(memoryCardHitPaddingForGap(100, 18)).toBe(18);
    expect(memoryCardHitPaddingForGap(-4)).toBe(0);
  });

  it("resolves the exact gap boundary to one card through the shared arbiter", () => {
    const hitPadding = memoryCardHitPaddingForGap(12);
    const candidates: GazeTargetCandidate[] = [
      { id: "left", rect: { left: 0, top: 0, right: 100, bottom: 100 }, enabled: true, visible: true, hitPadding },
      { id: "right", rect: { left: 112, top: 0, right: 212, bottom: 100 }, enabled: true, visible: true, hitPadding }
    ];

    expect(resolveGazeTarget(candidates, { x: 106, y: 50 })?.id).toBe("left");
  });

  it("uses word images that are available in packaged builds", () => {
    const packagedImageIds = new Set(wordImageManifest.map((item) => item.id));

    expect(memoryCardSources.every((source) => packagedImageIds.has(source.id))).toBe(true);
    expect(wordImageSrc(memoryCardSources[0].id, "./", "file:///app/dist/index.html")).toBe(`file:///app/dist/images/words/${memoryCardSources[0].id}.png`);
  });
});
