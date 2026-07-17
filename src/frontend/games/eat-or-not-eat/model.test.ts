import { describe, expect, it } from "vitest";
import { createEatOrNotEatRoundGenerator, generateEatOrNotEatRound } from "./model";

describe("generateEatOrNotEatRound", () => {
  it("keeps round ids stable for telemetry", () => {
    expect(generateEatOrNotEatRound(1).roundId).toBe("eat-or-not-eat:round:1");
    expect(generateEatOrNotEatRound(8).roundId).toBe("eat-or-not-eat:round:8");
  });

  it("classifies food words at the random threshold", () => {
    const round = generateEatOrNotEatRound(2, () => 0.5);

    expect(round.correctAnswer).toBe("food");
    expect(round.item.category).toBe("food");
    expect(round.item.word).toBeTruthy();
    expect(round.item.emoji).toBeTruthy();
  });

  it("classifies thing words below the random threshold", () => {
    const round = generateEatOrNotEatRound(3, () => 0.49);

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
      expect(round.prompt).toContain(round.item.word);
    }
  });

  it("builds a balanced non-repeating food and thing deck", () => {
    const generateRound = createEatOrNotEatRoundGenerator(() => 0.42);
    const rounds = Array.from({ length: 8 }, (_, index) => generateRound(index + 1));

    expect(new Set(rounds.map((round) => round.item.id)).size).toBe(rounds.length);
    expect(rounds.filter((round) => round.correctAnswer === "food")).toHaveLength(4);
    expect(rounds.filter((round) => round.correctAnswer === "thing")).toHaveLength(4);
  });

  it("does not repeat an item during a complete balanced deck", () => {
    const generateRound = createEatOrNotEatRoundGenerator(() => 0);
    const rounds = Array.from({ length: 80 }, (_, index) => generateRound(index + 1));

    expect(new Set(rounds.map((round) => round.item.id)).size).toBe(80);
    expect(rounds.filter((round) => round.correctAnswer === "food")).toHaveLength(40);
    expect(rounds.filter((round) => round.correctAnswer === "thing")).toHaveLength(40);
  });
});
