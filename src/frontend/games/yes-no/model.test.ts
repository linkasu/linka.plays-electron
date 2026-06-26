import { describe, expect, it } from "vitest";
import { generateYesNoRound } from "./model";

describe("generateYesNoRound", () => {
  it("creates a yes/no round with both answer choices", () => {
    const round = generateYesNoRound(1);

    expect(round.roundId).toBe("yes-no:round:1");
    expect(round.prompt).toContain(round.askedItem.word);
    expect(round.item.emoji).toBeTruthy();
    expect(round.answer).toBe("yes");
    expect(round.choices.map((choice) => choice.id)).toEqual(["yes", "no"]);
  });

  it("makes yes rounds ask about the displayed item", () => {
    const round = generateYesNoRound(3);

    expect(round.answer).toBe("yes");
    expect(round.askedItem).toBe(round.item);
  });

  it("makes no rounds ask about a different item", () => {
    const round = generateYesNoRound(2);

    expect(round.answer).toBe("no");
    expect(round.askedItem.id).not.toBe(round.item.id);
  });

  it("covers both answer types across generated rounds", () => {
    const answers = new Set(Array.from({ length: 8 }, (_, index) => generateYesNoRound(index + 1).answer));

    expect(answers).toEqual(new Set(["yes", "no"]));
  });

  it("uses injected randomness for deterministic items", () => {
    const first = generateYesNoRound(2, () => 0);

    expect(generateYesNoRound(2, () => 0).item.id).toBe(first.item.id);
    expect(generateYesNoRound(2, () => 0.99).item.id).not.toBe(first.item.id);
  });
});
