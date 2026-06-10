import { describe, expect, it } from "vitest";
import { createFirstThenExplanation, firstThenPairs, generateFirstThenRound } from "./model";

describe("first-then model", () => {
  it("creates a first phase round with both actions", () => {
    const round = generateFirstThenRound(1, "first");

    expect(round.roundId).toBe("first-then:round:1:first");
    expect(round.prompt).toBe("Что сначала?");
    expect(round.expectedAction).toBe(firstThenPairs[0].first);
    expect(round.choices).toEqual([firstThenPairs[0].first, firstThenPairs[0].then]);
  });

  it("creates a then phase round for the second action", () => {
    const round = generateFirstThenRound(1, "then");

    expect(round.roundId).toBe("first-then:round:1:then");
    expect(round.prompt).toBe("Что потом?");
    expect(round.expectedAction).toBe(firstThenPairs[0].then);
  });

  it("cycles through action pairs", () => {
    const afterLast = generateFirstThenRound(firstThenPairs.length + 1, "first");

    expect(afterLast.pair).toBe(firstThenPairs[0]);
  });

  it("explains the order softly", () => {
    const explanation = createFirstThenExplanation(firstThenPairs[0]);

    expect(explanation).toContain(firstThenPairs[0].first.phrase);
    expect(explanation).toContain(firstThenPairs[0].then.phrase);
  });
});
