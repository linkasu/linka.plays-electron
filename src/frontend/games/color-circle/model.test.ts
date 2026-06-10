import { describe, expect, it } from "vitest";
import { generateColorCircleRound } from "./model";

describe("generateColorCircleRound", () => {
  it("builds a four-sector circle with the target included", () => {
    const round = generateColorCircleRound(3);

    expect(round.roundId).toBe("color-circle:round:3");
    expect(round.sectors).toHaveLength(4);
    expect(round.sectors[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Выбери ${round.target.label} цвет`);
  });

  it("keeps sector colors unique", () => {
    for (let roundIndex = 1; roundIndex <= 16; roundIndex += 1) {
      const round = generateColorCircleRound(roundIndex);

      expect(new Set(round.sectors.map((color) => color.id)).size).toBe(round.sectors.length);
    }
  });

  it("changes the target on the next round", () => {
    for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
      const current = generateColorCircleRound(roundIndex);
      const next = generateColorCircleRound(roundIndex + 1);

      expect(next.target.id).not.toBe(current.target.id);
    }
  });
});
