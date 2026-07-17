import { describe, expect, it } from "vitest";
import { evaluateBigCardChoice, generateBigCardsRound } from "./model";

describe("big-cards model", () => {
  it("cycles through two to four cards", () => {
    expect(generateBigCardsRound(1).choices).toHaveLength(2);
    expect(generateBigCardsRound(2).choices).toHaveLength(3);
    expect(generateBigCardsRound(3).choices).toHaveLength(4);
    expect(generateBigCardsRound(4).choices).toHaveLength(2);
  });

  it("keeps the mode free-choice and treats every card as success", () => {
    for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
      const round = generateBigCardsRound(roundIndex);
      const ids = new Set(round.choices.map((choice) => choice.id));

      expect(round.prompt).toBe("Выбери любую картинку");
      expect(ids.size).toBe(round.choices.length);
      expect(round.choices.map(evaluateBigCardChoice)).toEqual(round.choices.map((card) => ({
        cardId: card.id,
        label: card.label,
        isCorrect: true
      })));
    }
  });
});
