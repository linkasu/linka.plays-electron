import { describe, expect, it } from "vitest";
import { createObjectActionExplanation, generateObjectActionRound, objectActionPairs } from "./model";

describe("object-action model", () => {
  it("creates four action choices with the matching action", () => {
    const round = generateObjectActionRound(1);

    expect(round.roundId).toBe("object-action:round:1");
    expect(round.choices).toHaveLength(4);
    expect(round.choices).toContainEqual(round.correctChoice);
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

    expect(explanation).toContain(objectActionPairs[1].phrase);
  });
});
