import { describe, expect, it } from "vitest";
import { createFirstThenExplanation, createFirstThenPairOrder, firstThenPairs, generateFirstThenRound } from "./model";

describe("first-then model", () => {
  it("creates a first phase round with both actions", () => {
    const firstPair = firstThenPairs[0];
    const round = generateFirstThenRound(1, "first", { choiceOrder: [firstPair.first.id, firstPair.then.id] });

    expect(round.roundId).toBe("first-then:round:1:first");
    expect(round.prompt).toBe("Что сначала?");
    expect(round.expectedAction).toBe(firstPair.first);
    expect(round.choices).toEqual([firstPair.first, firstPair.then]);
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

  it("can randomize pair order and choice order", () => {
    const pairOrder = createFirstThenPairOrder(() => 0);
    const round = generateFirstThenRound(1, "first", { pairOrder, random: () => 0 });

    expect(pairOrder).toHaveLength(firstThenPairs.length);
    expect(new Set(pairOrder)).toEqual(new Set(firstThenPairs.map((_, index) => index)));
    expect(round.pair).toBe(firstThenPairs[pairOrder[0]]);
    expect(round.choices).toEqual([round.pair.then, round.pair.first]);
  });

  it("keeps a provided choice order stable across phases", () => {
    const firstPair = firstThenPairs[0];
    const choiceOrder = [firstPair.then.id, firstPair.first.id];

    expect(generateFirstThenRound(1, "first", { choiceOrder }).choices).toEqual([firstPair.then, firstPair.first]);
    expect(generateFirstThenRound(1, "then", { choiceOrder }).choices).toEqual([firstPair.then, firstPair.first]);
  });

  it("explains the order softly", () => {
    const explanation = createFirstThenExplanation(firstThenPairs[0]);

    expect(explanation).toContain(firstThenPairs[0].first.phrase);
    expect(explanation).toContain(firstThenPairs[0].then.phrase);
  });
});
