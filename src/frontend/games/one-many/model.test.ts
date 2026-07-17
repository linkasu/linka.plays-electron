import { describe, expect, it } from "vitest";
import { createOneManyDeck, generateOneManyRound, type OneManyRound } from "./model";

function choice(round: OneManyRound, id: "one" | "many") {
  const found = round.choices.find((item) => item.id === id);
  if (!found) throw new Error(`Missing choice ${id}`);
  return found;
}

describe("generateOneManyRound", () => {
  it("creates one and many choices with matching counts", () => {
    const round = generateOneManyRound(1);

    expect(round.roundId).toBe("one-many:round:1");
    expect(round.choices.map((item) => item.id).sort()).toEqual(["many", "one"]);
    expect(choice(round, "one").items).toHaveLength(1);
    expect(choice(round, "many").items.length).toBeGreaterThan(1);
  });

  it("includes item identity for telemetry and speech", () => {
    const round = generateOneManyRound(1, () => 0.99);

    expect(round.itemId).toBeTruthy();
    expect(round.itemName).toBeTruthy();
    expect(new Set(round.choices.flatMap((item) => item.items))).toEqual(new Set([round.choices[0].emoji]));
  });

  it("keeps left and right choices distinct in every round", () => {
    for (const round of createOneManyDeck()) {
      expect(new Set(round.choices.map((item) => item.side))).toEqual(new Set(["left", "right"]));
    }
  });

  it("balances one and many targets across both sides of the deck", () => {
    const deck = createOneManyDeck(() => 0.42);
    const targetPositions = deck.map((round) => `${round.target}:${choice(round, round.target).side}`);

    expect(deck).toHaveLength(8);
    expect(new Set(deck.map((round) => round.itemId)).size).toBe(8);
    expect(targetPositions.filter((position) => position === "one:left")).toHaveLength(2);
    expect(targetPositions.filter((position) => position === "one:right")).toHaveLength(2);
    expect(targetPositions.filter((position) => position === "many:left")).toHaveLength(2);
    expect(targetPositions.filter((position) => position === "many:right")).toHaveLength(2);
  });
});
