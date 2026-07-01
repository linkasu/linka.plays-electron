import { describe, expect, it } from "vitest";
import { createObjectActionExplanation, generateObjectActionRound, isObjectActionCorrect, objectActionPairs, phraseForAction } from "./model";

describe("object-action model", () => {
  it("creates four action choices with the matching action", () => {
    const round = generateObjectActionRound(1);

    expect(round.roundId).toBe("object-action:round:1");
    expect(round.choices).toHaveLength(4);
    expect(round.correctChoices.length).toBeGreaterThan(0);
    for (const correctChoice of round.correctChoices) expect(round.choices).toContainEqual(correctChoice);
  });

  it("cycles through object action pairs", () => {
    const afterLast = generateObjectActionRound(objectActionPairs.length + 1);

    expect(afterLast.pair).toBe(objectActionPairs[0]);
  });

  it("keeps choice ids unique", () => {
    const round = generateObjectActionRound(3);
    const ids = new Set(round.choices.map((choice) => choice.id));

    expect(ids.size).toBe(round.choices.length);
  });

  it("explains the correct pair softly", () => {
    const explanation = createObjectActionExplanation(objectActionPairs[1]);

    expect(explanation).toContain(phraseForAction(objectActionPairs[1], objectActionPairs[1].validActionIds[0]));
  });

  it("allows opening and reading a book", () => {
    const round = generateObjectActionRound(4);
    const titles = round.correctChoices.map((choice) => choice.title).sort();

    expect(round.pair.id).toBe("book");
    expect(titles).toEqual(["открывать", "читать"]);
    expect(isObjectActionCorrect(round.pair, { id: "open", title: "открывать", emoji: "🚪" })).toBe(true);
    expect(isObjectActionCorrect(round.pair, { id: "read", title: "читать", emoji: "👀" })).toBe(true);
  });

  it("allows washing and drinking from a cup", () => {
    const round = generateObjectActionRound(3);
    const titles = round.correctChoices.map((choice) => choice.title).sort();

    expect(round.pair.id).toBe("cup");
    expect(titles).toEqual(["мыть", "пить"]);
    expect(isObjectActionCorrect(round.pair, { id: "wash", title: "мыть", emoji: "🫧" })).toBe(true);
    expect(isObjectActionCorrect(round.pair, { id: "drink", title: "пить", emoji: "💧" })).toBe(true);
  });

  it("allows eating with and washing a spoon", () => {
    const round = generateObjectActionRound(2);
    const titles = round.correctChoices.map((choice) => choice.title).sort();

    expect(round.pair.id).toBe("spoon");
    expect(titles).toEqual(["есть", "мыть"]);
    expect(isObjectActionCorrect(round.pair, { id: "eat", title: "есть", emoji: "🍽️" })).toBe(true);
    expect(isObjectActionCorrect(round.pair, { id: "wash", title: "мыть", emoji: "🫧" })).toBe(true);
  });
});
