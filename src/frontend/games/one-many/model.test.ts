import { describe, expect, it } from "vitest";
import { generateOneManyRound, type OneManyRound } from "./model";

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

  it("uses random source for the requested concept", () => {
    expect(generateOneManyRound(1, () => 0).target).toBe("many");
    expect(generateOneManyRound(1, () => 0.99).target).toBe("one");
  });

  it("includes item identity for telemetry and speech", () => {
    const round = generateOneManyRound(1, () => 0.99);

    expect(round.itemId).toBeTruthy();
    expect(round.itemName).toBeTruthy();
    expect(new Set(round.choices.flatMap((item) => item.items))).toEqual(new Set([round.choices[0].emoji]));
  });

  it("keeps left and right choices distinct", () => {
    for (let index = 1; index <= 8; index += 1) {
      const round = generateOneManyRound(index);

      expect(new Set(round.choices.map((item) => item.side))).toEqual(new Set(["left", "right"]));
    }
  });
});
