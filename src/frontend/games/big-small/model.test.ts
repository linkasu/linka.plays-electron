import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { bigSmallObjects, generateBigSmallRound } from "./model";

describe("generateBigSmallRound", () => {
  it("creates two size choices for the same object", () => {
    const settings = settingsFromPreset("standard");

    for (let index = 1; index <= 40; index += 1) {
      const round = generateBigSmallRound(settings, index);
      const sizes = new Set(round.choices.map((choice) => choice.size));
      const objectIds = new Set(round.choices.map((choice) => choice.id));

      expect(round.choices).toHaveLength(2);
      expect(sizes).toEqual(new Set(["big", "small"]));
      expect(objectIds).toEqual(new Set([round.object.id]));
      expect(round.choices[round.correctIndex].size).toBe(round.targetSize);
    }
  });

  it("uses random source for requested size and keeps stable telemetry ids", () => {
    const settings = settingsFromPreset("gentle");
    const zeroRandom = () => 0;
    const first = generateBigSmallRound(settings, 1, zeroRandom);
    const second = generateBigSmallRound(settings, 2, zeroRandom);

    expect(first.roundId).toBe("big-small:round:1");
    expect(second.roundId).toBe("big-small:round:2");
    expect(first.object.id).not.toBe(second.object.id);
    expect(first.targetSize).toBe("small");
    expect(second.targetSize).toBe("small");
    expect(first.prompt).toContain(first.targetPhrase);
    expect(second.prompt).toContain("маленький");
  });

  it("builds grammatically correct target phrases for object labels", () => {
    const settings = settingsFromPreset("standard");
    const round = generateBigSmallRound(settings, 1, () => 0);

    expect(round.targetPhrase).toBe(round.object.sizePhrases[round.targetSize]);
    expect(round.prompt).toBe(`Выбери: ${round.targetPhrase}`);
  });

  it("has enough AAC vocabulary objects for an eight-step session", () => {
    expect(bigSmallObjects.length).toBeGreaterThanOrEqual(8);
    expect(new Set(bigSmallObjects.map((object) => object.id)).size).toBe(bigSmallObjects.length);
  });

  it("uses an existing visual asset when the word-image house asset is unavailable", () => {
    expect(bigSmallObjects.find((object) => object.id === "house")?.visualSrc).toBe("./images/shadow-match/house.png");
  });
});
