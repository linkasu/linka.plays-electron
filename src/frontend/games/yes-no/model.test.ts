import { describe, expect, it } from "vitest";
import { findYesNoNameAsset, generateYesNoRound, selectYesNoAnswer, yesNoChoices } from "./model";

describe("generateYesNoRound", () => {
  it("creates a yes/no round with both answer choices", () => {
    const round = generateYesNoRound(1);

    expect(round.roundId).toBe("yes-no:round:1");
    expect(round.prompt).toContain(round.askedItem.word);
    expect(round.item.emoji).toBeTruthy();
    expect(round.answer).toMatch(/yes|no/);
    expect(round.choices.map((choice) => choice.id)).toEqual(["yes", "no"]);
    expect(round.prompt).toBe(`Это ${round.askedItem.word}?`);
  });

  it("uses large-card icon data without external answer images", () => {
    expect(yesNoChoices).toEqual([
      { id: "yes", title: "Да", icon: "mdi-check-bold", color: "green-lighten-4" },
      { id: "no", title: "Нет", icon: "mdi-close-thick", color: "red-lighten-4" }
    ]);
  });

  it("finds an existing word or name asset for the dynamic question", () => {
    const round = generateYesNoRound(1, () => 0);
    const matching = { id: `word-categories.item.${round.askedItem.id}`, text: `${round.askedItem.word}.` };

    expect(findYesNoNameAsset(round.askedItem, [
      { id: "feedback.apple", text: round.askedItem.word },
      matching
    ])).toBe(matching);
    expect(findYesNoNameAsset(round.askedItem, [{ id: "feedback.apple", text: round.askedItem.word }])).toBeUndefined();
  });

  it("makes yes rounds ask about the displayed item", () => {
    const round = generateYesNoRound(3, () => 0);

    expect(round.answer).toBe("yes");
    expect(round.askedItem).toBe(round.item);
  });

  it("makes no rounds ask about a different item", () => {
    const round = generateYesNoRound(2, () => 0.99);

    expect(round.answer).toBe("no");
    expect(round.askedItem.id).not.toBe(round.item.id);
  });

  it("selects answer from injected randomness", () => {
    const answers = new Set([generateYesNoRound(1, () => 0).answer, generateYesNoRound(2, () => 0.99).answer]);

    expect(answers).toEqual(new Set(["yes", "no"]));
  });

  it("avoids three equal answers in a row", () => {
    expect(selectYesNoAnswer(["yes", "yes"], () => 0)).toBe("no");
    expect(selectYesNoAnswer(["no", "no"], () => 0.99)).toBe("yes");
  });

  it("uses injected randomness for deterministic items", () => {
    const first = generateYesNoRound(2, () => 0);

    expect(generateYesNoRound(2, () => 0).item.id).toBe(first.item.id);
    expect(generateYesNoRound(2, () => 0.99).item.id).not.toBe(first.item.id);
  });
});
