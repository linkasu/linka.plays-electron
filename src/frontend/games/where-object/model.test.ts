import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import { createWhereObjectRoundGenerator, isWhereObjectCorrect, phraseFor, whereObjectItems, whereObjectPrepositions } from "./model";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("generateWhereObjectRound", () => {
  it("makes the visible cue match exactly one visual mini-scene", () => {
    const generateRound = createWhereObjectRoundGenerator(seededRandom(11));

    for (let index = 1; index <= whereObjectItems.length; index += 1) {
      const round = generateRound(index);
      const cueMatches = round.choices.filter((choice) => round.prompt === `Покажи: ${choice.scenePhrase}.`);

      expect(round.choices).toHaveLength(4);
      expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(4);
      expect(cueMatches).toHaveLength(1);
      expect(isWhereObjectCorrect(round, cueMatches[0])).toBe(true);
      expect(round.choices.every((choice) => choice.targetObject === round.targetObject)).toBe(true);
      expect(round.choices.every((choice) => choice.targetPlace === round.targetPlace)).toBe(true);
    }
  });

  it("uses on, under, in and beside in every round", () => {
    expect(whereObjectPrepositions.map((item) => item.id)).toEqual(["on", "under", "in", "beside"]);
    const round = createWhereObjectRoundGenerator(seededRandom(12))(1);

    expect(new Set(round.choices.map((choice) => choice.preposition.id))).toEqual(new Set(["on", "under", "in", "beside"]));
  });

  it("deals a balanced shuffled relation/object deck without repeats", () => {
    const generateRound = createWhereObjectRoundGenerator(seededRandom(13));
    const deckSize = whereObjectItems.length * whereObjectPrepositions.length;
    const rounds = Array.from({ length: deckSize }, (_, index) => generateRound(index + 1));

    expect(new Set(rounds.map((round) => `${round.targetObject.id}:${round.targetPreposition.id}`))).toHaveLength(deckSize);

    for (let index = 0; index < rounds.length; index += whereObjectItems.length) {
      const batch = rounds.slice(index, index + whereObjectItems.length);
      expect(new Set(batch.map((round) => round.targetObject.id))).toHaveLength(whereObjectItems.length);
      for (const preposition of whereObjectPrepositions) {
        expect(batch.filter((round) => round.targetPreposition.id === preposition.id)).toHaveLength(2);
      }
    }
  });

  it("uses randomness instead of deriving the deck and card positions from the round index", () => {
    const firstGenerator = createWhereObjectRoundGenerator(seededRandom(21));
    const secondGenerator = createWhereObjectRoundGenerator(seededRandom(22));
    const signature = (generateRound: ReturnType<typeof createWhereObjectRoundGenerator>) => Array.from({ length: 8 }, (_, index) => {
      const round = generateRound(index + 1);
      const correctPosition = round.choices.findIndex((choice) => isWhereObjectCorrect(round, choice));
      return `${round.targetObject.id}:${round.targetPreposition.id}:${correctPosition}`;
    });

    expect(signature(firstGenerator)).not.toEqual(signature(secondGenerator));
  });

  it("builds grammatical scene phrases", () => {
    const generateRound = createWhereObjectRoundGenerator(seededRandom(14));
    const rounds = Array.from({ length: whereObjectItems.length }, (_, index) => generateRound(index + 1));

    for (const round of rounds) {
      expect(round.scenePhrase).toBe(`${round.targetObject.word} ${phraseFor(round.targetPlace, round.targetPreposition)}`);
      expect(round.prompt).toBe(`Покажи: ${round.scenePhrase}.`);
    }
  });

  it("uses existing full-scene TTS assets and marks beside for exact speech fallback", () => {
    const assetIds = new Set(ttsAssets.map((asset) => asset.id));
    const round = createWhereObjectRoundGenerator(seededRandom(15))(1);

    for (const choice of round.choices) {
      if (choice.id === "beside") expect(choice.answerAssetId).toBeUndefined();
      else expect(assetIds.has(choice.answerAssetId ?? "")).toBe(true);
    }
  });
});
