import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import wordImages from "../../../../public/images/words/manifest.json";
import { buildIWantPhrase, createIWantCommunication, generateIWantRound, iWantCardAssetId, iWantCards, iWantPhraseAssetId } from "./model";

describe("i-want model", () => {
  it("creates a no-fail AAC round with six cards", () => {
    const round = generateIWantRound(1);

    expect(round.roundId).toBe("i-want:round:1");
    expect(round.prompt).toContain("Любая карточка подходит");
    expect(round.cards).toHaveLength(6);
    expect(round.cards[0]).toBe(iWantCards[0]);
  });

  it("cycles cards between rounds", () => {
    expect(generateIWantRound(2).cards[0]).toBe(iWantCards[1]);
    expect(generateIWantRound(iWantCards.length + 1).cards[0]).toBe(iWantCards[0]);
  });

  it("builds spoken AAC phrases", () => {
    expect(buildIWantPhrase(iWantCards[0])).toBe("Я хочу воду");
    expect(buildIWantPhrase(undefined)).toBe("Я хочу...");
    expect(iWantCards.every((card) => buildIWantPhrase(card) === card.phrase && !buildIWantPhrase(card).endsWith("..."))).toBe(true);
  });

  it("keeps every card grammatical and backed by image, card and phrase assets", () => {
    const imageIds = new Set(wordImages.map((image) => image.id));
    const ttsIds = new Set(ttsAssets.map((asset) => asset.id));

    for (const card of iWantCards) {
      expect(card.phrase).toMatch(/^Я хочу \S/);
      expect(imageIds.has(card.wordId), `${card.id} image`).toBe(true);
      expect(ttsIds.has(iWantCardAssetId(card)), `${card.id} card TTS`).toBe(true);
      expect(ttsIds.has(iWantPhraseAssetId(card)), `${card.id} phrase TTS`).toBe(true);
    }
  });

  it("treats every card as successful communication without mistakes", () => {
    for (const card of iWantCards) {
      expect(createIWantCommunication(card)).toEqual({
        phrase: card.phrase,
        expected: "valid-communication",
        actual: card.phrase,
        isCorrect: true,
        noFail: true
      });
    }
  });
});
