import { describe, expect, it } from "vitest";
import { createWhatFirstExplanation, generateWhatFirstRound, whatFirstScenes } from "./model";

describe("what-first model", () => {
  it("creates a round that expects the first action", () => {
    const round = generateWhatFirstRound(1);

    expect(round.roundId).toBe("what-first:round:1");
    expect(round.prompt).toBe("Что сначала?");
    expect(round.expectedAction).toBe(whatFirstScenes[0].first);
    expect(round.choices).toEqual([whatFirstScenes[0].first, whatFirstScenes[0].then]);
  });

  it("alternates choice order without changing the expected action", () => {
    const round = generateWhatFirstRound(2);

    expect(round.expectedAction).toBe(whatFirstScenes[1].first);
    expect(round.choices).toEqual([whatFirstScenes[1].then, whatFirstScenes[1].first]);
  });

  it("cycles through scenes", () => {
    const afterLast = generateWhatFirstRound(whatFirstScenes.length + 1);

    expect(afterLast.scene).toBe(whatFirstScenes[0]);
  });

  it("softly explains the sequence", () => {
    const explanation = createWhatFirstExplanation(whatFirstScenes[0]);

    expect(explanation).toContain(whatFirstScenes[0].first.phrase);
    expect(explanation).toContain(whatFirstScenes[0].then.phrase);
    expect(explanation).toContain("Сначала");
  });
});
