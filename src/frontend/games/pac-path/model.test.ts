import { describe, expect, it } from "vitest";
import { createPacPathRound, isPacPathSafeChoice, pacPathMaxSteps, pacPathWaypoints } from "./model";

describe("pac-path model", () => {
  it("contains exactly ten safe moves after start", () => {
    expect(pacPathMaxSteps).toBe(10);
    expect(pacPathWaypoints).toHaveLength(pacPathMaxSteps + 1);
    expect(pacPathWaypoints.map((waypoint) => waypoint.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("points each round to the next safe waypoint", () => {
    for (let step = 0; step < pacPathMaxSteps; step += 1) {
      const round = createPacPathRound(step);

      expect(round.roundId).toBe(`pac-path:round:${step + 1}`);
      expect(round.expected.order).toBe(step + 1);
      expect(round.choices.some((choice) => isPacPathSafeChoice(choice, round))).toBe(true);
    }
  });

  it("keeps the expected safe choice unique among options", () => {
    const round = createPacPathRound(4);
    const safeChoices = round.choices.filter((choice) => isPacPathSafeChoice(choice, round));

    expect(round.choices).toHaveLength(4);
    expect(safeChoices).toHaveLength(1);
    expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(round.choices.length);
  });

  it("clamps rounds after the final safe waypoint", () => {
    const round = createPacPathRound(99);

    expect(round.expected.order).toBe(pacPathMaxSteps);
    expect(round.roundId).toBe("pac-path:round:10");
  });
});
