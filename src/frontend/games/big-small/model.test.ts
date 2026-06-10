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

  it("alternates the requested size and keeps stable telemetry ids", () => {
    const settings = settingsFromPreset("gentle");
    const first = generateBigSmallRound(settings, 1);
    const second = generateBigSmallRound(settings, 2);

    expect(first.roundId).toBe("big-small:round:1");
    expect(second.roundId).toBe("big-small:round:2");
    expect(first.targetSize).toBe("big");
    expect(second.targetSize).toBe("small");
    expect(first.prompt).toContain("большой");
    expect(second.prompt).toContain("маленький");
  });

  it("has enough AAC vocabulary objects for an eight-step session", () => {
    expect(bigSmallObjects.length).toBeGreaterThanOrEqual(8);
    expect(new Set(bigSmallObjects.map((object) => object.id)).size).toBe(bigSmallObjects.length);
  });
});
