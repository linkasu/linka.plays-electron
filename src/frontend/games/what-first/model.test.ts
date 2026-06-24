import { describe, expect, it } from "vitest";
import { createWhatFirstExplanation, generateWhatFirstRound, whatFirstScenes } from "./model";

describe("what-first model", () => {
  it("creates a round that expects the first action", () => {
    const round = generateWhatFirstRound(1, () => 0.99);

    expect(round.roundId).toBe("what-first:round:1");
    expect(round.prompt).toBe("Что сначала?");
    expect(round.expectedAction).toBe(whatFirstScenes[0].first);
    expect(round.choices).toEqual([whatFirstScenes[0].first, whatFirstScenes[0].then]);
  });

  it("randomizes choice order without changing the expected action", () => {
    const round = generateWhatFirstRound(1, () => 0);

    expect(round.expectedAction).toBe(whatFirstScenes[1].first);
    expect(round.choices).toEqual([whatFirstScenes[1].then, whatFirstScenes[1].first]);
  });

  it("uses the random source for scene order", () => {
    const lowRandomRound = generateWhatFirstRound(1, () => 0);
    const highRandomRound = generateWhatFirstRound(1, () => 0.99);

    expect(lowRandomRound.scene).not.toBe(highRandomRound.scene);
    expect(whatFirstScenes).toContain(lowRandomRound.scene);
    expect(whatFirstScenes).toContain(highRandomRound.scene);
  });

  it("softly explains the sequence", () => {
    const explanation = createWhatFirstExplanation(whatFirstScenes[0]);

    expect(explanation).toContain(whatFirstScenes[0].first.phrase);
    expect(explanation).toContain(whatFirstScenes[0].then.phrase);
    expect(explanation).toContain("Сначала");
  });
});
