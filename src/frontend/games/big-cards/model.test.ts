import { describe, expect, it } from "vitest";
import { generateBigCardsRound } from "./model";

describe("big-cards model", () => {
  it("cycles through two to four cards", () => {
    expect(generateBigCardsRound(1).choices).toHaveLength(2);
    expect(generateBigCardsRound(2).choices).toHaveLength(3);
    expect(generateBigCardsRound(3).choices).toHaveLength(4);
    expect(generateBigCardsRound(4).choices).toHaveLength(2);
  });

  it("uses unique choices and includes the suggested card", () => {
    const round = generateBigCardsRound(6);
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(ids.size).toBe(round.choices.length);
    expect(round.choices).toContain(round.suggested);
    expect(round.prompt).toContain(round.suggested.label.toLowerCase());
  });
});
