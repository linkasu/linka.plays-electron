import { describe, expect, it } from "vitest";
import { buildIWantPhrase, generateIWantRound, iWantCards } from "./model";

describe("i-want model", () => {
  it("creates a no-fail AAC round with six cards", () => {
    const round = generateIWantRound(1);

    expect(round.roundId).toBe("i-want:round:1");
    expect(round.prompt).toContain("Любая карточка подходит");
    expect(round.cards).toHaveLength(6);
    expect(round.cards[0]).toBe(iWantCards[0]);
  });

  it("cycles cards between rounds", () => {
    expect(generateIWantRound(2).cards[0]).toBe(iWantCards[1]);
    expect(generateIWantRound(iWantCards.length + 1).cards[0]).toBe(iWantCards[0]);
  });

  it("builds spoken AAC phrases", () => {
    expect(buildIWantPhrase(iWantCards[0])).toBe("Я хочу воду");
    expect(buildIWantPhrase(undefined)).toBe("Я хочу ...");
  });
});
