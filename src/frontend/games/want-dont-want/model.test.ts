import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import wordImages from "../../../../public/images/words/manifest.json";
import { createWantDontWantCommunication, generateWantDontWantRound, wantDontWantChoices, wantDontWantItems, wantDontWantPhraseAssetId } from "./model";

describe("want-dont-want model", () => {
  it("creates a round with both AAC choices", () => {
    const round = generateWantDontWantRound(1);

    expect(round.roundId).toBe("want-dont-want:round:1");
    expect(round.prompt).toBe("Что ты выбираешь сейчас?");
    expect(round.prompt).not.toMatch(/хочу/i);
    expect(round.item).toBe(wantDontWantItems[0]);
    expect(round.choices.map((choice) => choice.id)).toEqual(["want", "dont-want"]);
  });

  it("cycles through soft items and activities", () => {
    const afterLast = generateWantDontWantRound(wantDontWantItems.length + 1);

    expect(afterLast.item).toBe(wantDontWantItems[0]);
    expect(new Set(wantDontWantItems.map((item) => item.kind))).toEqual(new Set(["предмет", "занятие"]));
  });

  it("stores complete grammatical phrases for every answer", () => {
    for (const item of wantDontWantItems) {
      expect(item.phrases.want).toMatch(/^Я хочу \S/);
      expect(item.phrases.dontWant).toMatch(/^Я не хочу \S/);
    }

    const hugs = wantDontWantItems.find((item) => item.id === "hug");
    expect(hugs?.phrases).toEqual({
      want: "Я хочу обниматься",
      dontWant: "Я не хочу обниматься"
    });
  });

  it("only includes cards covered by an image and both phrase assets", () => {
    const imageIds = new Set(wordImages.map((image) => image.id));
    const ttsIds = new Set(ttsAssets.map((asset) => asset.id));

    expect(wantDontWantItems.map((item) => item.id)).toEqual(["water", "apple", "music", "book", "ball", "draw", "toy", "rest", "hug"]);
    for (const item of wantDontWantItems) {
      expect(imageIds.has(item.wordId), `${item.id} image`).toBe(true);
      for (const choice of wantDontWantChoices) expect(ttsIds.has(wantDontWantPhraseAssetId(item, choice.id)), `${item.id} ${choice.id} TTS`).toBe(true);
    }
  });

  it("treats wants and refusals as successful communication without mistakes", () => {
    for (const item of wantDontWantItems) {
      for (const choice of wantDontWantChoices) {
        expect(createWantDontWantCommunication(item, choice.id)).toMatchObject({
          expected: "valid-communication",
          isCorrect: true,
          noFail: true
        });
      }
    }
  });
});
