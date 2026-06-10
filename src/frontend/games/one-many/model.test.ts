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

  it("alternates the requested concept", () => {
    expect(generateOneManyRound(1).target).toBe("one");
    expect(generateOneManyRound(2).target).toBe("many");
    expect(generateOneManyRound(3).target).toBe("one");
  });

  it("keeps left and right choices distinct", () => {
    for (let index = 1; index <= 8; index += 1) {
      const round = generateOneManyRound(index);

      expect(new Set(round.choices.map((item) => item.side))).toEqual(new Set(["left", "right"]));
    }
  });
});
