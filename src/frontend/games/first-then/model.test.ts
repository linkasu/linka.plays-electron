import { describe, expect, it } from "vitest";
import { createFirstThenPairOrder, createFirstThenTimeline, firstThenPairs, generateFirstThenRound } from "./model";

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

  it("does not leak the correct order through choice copy", () => {
    const round = generateFirstThenRound(1, "first", { choiceOrder: [firstThenPairs[0].first.id, firstThenPairs[0].then.id] });
    const choiceCopy = round.choices.map((choice) => `${choice.title} ${choice.emoji}`).join(" ").toLocaleLowerCase("ru");

    expect(choiceCopy).not.toMatch(/сначала|потом/);
    round.choices.forEach((choice) => expect(choice).not.toHaveProperty("phrase"));
  });

  it("keeps the timeline empty until correct phases are revealed", () => {
    const pair = firstThenPairs[0];

    expect(createFirstThenTimeline(pair, []).map((item) => item.action)).toEqual([undefined, undefined]);
    expect(createFirstThenTimeline(pair, ["first"]).map((item) => item.action)).toEqual([pair.first, undefined]);
    expect(createFirstThenTimeline(pair, ["first", "then"]).map((item) => item.action)).toEqual([pair.first, pair.then]);
  });
});
