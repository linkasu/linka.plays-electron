import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { dominoTiles, generateDominoMatchingRound } from "./model";

function randomFrom(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("domino-matching model", () => {
  it("uses three choices in gentle mode", () => {
    const round = generateDominoMatchingRound(settingsFromPreset("gentle"));

    expect(round.choices).toHaveLength(3);
  });

  it("uses four unique choices in standard mode", () => {
    const round = generateDominoMatchingRound(settingsFromPreset("standard"));
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(round.choices).toHaveLength(4);
    expect(ids.size).toBe(4);
  });

  it("points correctIndex to the domino side with matching dots", () => {
    const round = generateDominoMatchingRound(settingsFromPreset("challenge"), 9, randomFrom([0, 0.2, 0.4, 0.6, 0.8]));
    const correctChoice = round.choices[round.correctIndex];

    expect(round.roundId).toBe("domino-matching:round:9");
    expect(correctChoice.tile[correctChoice.matchSide]).toBe(round.targetDots);
  });

  it("keeps distractor matching sides away from the target count", () => {
    const round = generateDominoMatchingRound(settingsFromPreset("standard"), 5, randomFrom([0, 0.2, 0.4, 0.6, 0.8]));

    round.choices.forEach((choice, index) => {
      if (index !== round.correctIndex) {
        expect(choice.tile[choice.matchSide]).not.toBe(round.targetDots);
      }
    });
  });

  it("cycles through the full domino set", () => {
    const seen = new Set<string>();

    for (let index = 1; index <= dominoTiles.length; index += 1) {
      seen.add(generateDominoMatchingRound(settingsFromPreset("standard"), index).target.id);
    }

    expect(seen.size).toBe(dominoTiles.length);
  });

  it("supports deterministic choice order", () => {
    const first = generateDominoMatchingRound(settingsFromPreset("standard"), 4, randomFrom([0, 0.2, 0.4, 0.6, 0.8]));
    const second = generateDominoMatchingRound(settingsFromPreset("standard"), 4, randomFrom([0, 0.2, 0.4, 0.6, 0.8]));

    expect(second.choices.map((choice) => choice.id)).toEqual(first.choices.map((choice) => choice.id));
  });
});
