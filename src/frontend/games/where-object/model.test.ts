import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import { generateWhereObjectRound, isWhereObjectCorrect, phraseFor, whereObjectItems, whereObjectPrepositions } from "./model";

describe("generateWhereObjectRound", () => {
  it("creates four visual mini-scenes with one correct relation", () => {
    for (let index = 1; index <= whereObjectPrepositions.length; index += 1) {
      const round = generateWhereObjectRound(index);
      const correctChoices = round.choices.filter((choice) => isWhereObjectCorrect(round, choice));

      expect(round.choices).toHaveLength(4);
      expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(4);
      expect(correctChoices).toEqual([round.correctChoice]);
      expect(round.choices.every((choice) => choice.targetObject === round.targetObject)).toBe(true);
      expect(round.choices.every((choice) => choice.targetPlace === round.targetPlace)).toBe(true);
    }
  });

  it("uses on, under, in and beside", () => {
    expect(whereObjectPrepositions.map((item) => item.id)).toEqual(["on", "under", "in", "beside"]);
    const rounds = [1, 2, 3, 4].map(generateWhereObjectRound);

    expect(rounds.map((round) => round.targetPreposition.id)).toEqual(["on", "under", "in", "beside"]);
    expect(rounds.map((round) => round.choices.indexOf(round.correctChoice))).toEqual([0, 1, 2, 3]);
  });

  it("cycles through objects", () => {
    expect(generateWhereObjectRound(whereObjectItems.length + 1).targetObject.id).toBe(whereObjectItems[0].id);
  });

  it("builds grammatical scene phrases", () => {
    const insideRound = generateWhereObjectRound(3);
    const besideRound = generateWhereObjectRound(4);

    expect(insideRound.scenePhrase).toBe(`${insideRound.targetObject.word} ${phraseFor(insideRound.targetPlace, insideRound.targetPreposition)}`);
    expect(besideRound.scenePhrase).toBe(`${besideRound.targetObject.word} рядом с коробкой`);
  });

  it("uses existing full-scene TTS assets and marks beside for exact speech fallback", () => {
    const assetIds = new Set(ttsAssets.map((asset) => asset.id));
    const round = generateWhereObjectRound(1);

    for (const choice of round.choices) {
      if (choice.id === "beside") expect(choice.answerAssetId).toBeUndefined();
      else expect(assetIds.has(choice.answerAssetId ?? "")).toBe(true);
    }
  });
});
