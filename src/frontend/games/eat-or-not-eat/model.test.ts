import { afterEach, describe, expect, it, vi } from "vitest";
import { generateEatOrNotEatRound } from "./model";

describe("generateEatOrNotEatRound", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps round ids stable for telemetry", () => {
    expect(generateEatOrNotEatRound(1).roundId).toBe("eat-or-not-eat:round:1");
    expect(generateEatOrNotEatRound(8).roundId).toBe("eat-or-not-eat:round:8");
  });

  it("classifies food words at the random threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const round = generateEatOrNotEatRound(2);

    expect(round.correctAnswer).toBe("food");
    expect(round.item.category).toBe("food");
    expect(round.item.word).toBeTruthy();
    expect(round.item.emoji).toBeTruthy();
  });

  it("classifies thing words below the random threshold", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.49);

    const round = generateEatOrNotEatRound(3);

    expect(round.correctAnswer).toBe("thing");
    expect(round.item.category).toBe("thing");
    expect(round.item.word).toBeTruthy();
    expect(round.item.emoji).toBeTruthy();
  });

  it("never returns categories outside the two answer buttons", () => {
    for (let index = 0; index < 100; index += 1) {
      const round = generateEatOrNotEatRound(index + 1);

      expect(["food", "thing"]).toContain(round.correctAnswer);
      expect(round.item.category).toBe(round.correctAnswer);
      expect(round.item.id).toBeTruthy();
      expect(round.item.word).toBeTruthy();
      expect(round.item.emoji).toBeTruthy();
    }
  });
});
