import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { generateShapeDanceRound, shapeDanceFigures, shuffleShapeDanceItems } from "./model";

describe("shape-dance model", () => {
  it("creates gentle rounds with two steps and enough choices", () => {
    const round = generateShapeDanceRound(settingsFromPreset("gentle"), 1, () => 0.1);
    const choiceIds = new Set(round.choices.map((figure) => figure.id));

    expect(round.roundId).toBe("shape-dance:round:1");
    expect(round.sequence).toHaveLength(2);
    expect(round.sequenceLength).toBe(2);
    expect(round.choices.length).toBeGreaterThanOrEqual(3);
    round.sequence.forEach((figure) => expect(choiceIds.has(figure.id)).toBe(true));
  });

  it("grows standard sequence length without exceeding four steps", () => {
    expect(generateShapeDanceRound(settingsFromPreset("standard"), 1, () => 0.2).sequence).toHaveLength(2);
    expect(generateShapeDanceRound(settingsFromPreset("standard"), 4, () => 0.2).sequence).toHaveLength(3);
    expect(generateShapeDanceRound(settingsFromPreset("standard"), 8, () => 0.2).sequence).toHaveLength(4);
  });

  it("allows challenge rounds up to five steps", () => {
    expect(generateShapeDanceRound(settingsFromPreset("challenge"), 1, () => 0.3).sequence).toHaveLength(3);
    expect(generateShapeDanceRound(settingsFromPreset("challenge"), 7, () => 0.3).sequence).toHaveLength(5);
  });

  it("avoids immediate repeated figures in the shown sequence", () => {
    const round = generateShapeDanceRound(settingsFromPreset("challenge"), 8, () => 0);

    for (let index = 1; index < round.sequence.length; index += 1) {
      expect(round.sequence[index].id).not.toBe(round.sequence[index - 1].id);
    }
  });

  it("keeps all figures while shuffling", () => {
    const shuffled = shuffleShapeDanceItems(shapeDanceFigures.slice(0, 4), () => 0.6);

    expect(shuffled).toHaveLength(4);
    expect(new Set(shuffled.map((figure) => figure.id))).toEqual(new Set(shapeDanceFigures.slice(0, 4).map((figure) => figure.id)));
  });
});
