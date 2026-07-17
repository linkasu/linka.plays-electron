import { describe, expect, it } from "vitest";
import { createWhatFirstDeck, createWhatFirstExplanation, generateWhatFirstRound, whatFirstScenes } from "./model";

describe("what-first model", () => {
  it("creates a round that expects the first action", () => {
    const round = generateWhatFirstRound(1, () => 0.99);

    expect(round.roundId).toBe("what-first:round:1");
    expect(round.prompt).toBe("Что сначала?");
    expect(round.expectedAction).toBe(round.scene.first);
    expect(new Set(round.choices)).toEqual(new Set([round.scene.first, round.scene.then]));
  });

  it("randomizes choice order without changing the expected action", () => {
    const round = generateWhatFirstRound(1, () => 0);

    expect(round.expectedAction).toBe(round.scene.first);
    expect(round.choices).toEqual([round.scene.then, round.scene.first]);
  });

  it("uses the random source for scene order", () => {
    const lowRandomRound = generateWhatFirstRound(1, () => 0);
    const highRandomRound = generateWhatFirstRound(1, () => 0.99);

    expect(lowRandomRound.scene).not.toBe(highRandomRound.scene);
    expect(whatFirstScenes).toContain(lowRandomRound.scene);
    expect(whatFirstScenes).toContain(highRandomRound.scene);
  });

  it("builds one shuffled deck containing all eight scenes without repeats", () => {
    const deck = createWhatFirstDeck(() => 0.42);

    expect(deck).toHaveLength(8);
    expect(new Set(deck.map((round) => round.scene.id)).size).toBe(8);
    expect(new Set(deck.map((round) => round.scene.id))).toEqual(new Set(whatFirstScenes.map((scene) => scene.id)));
    expect(deck.map((round) => round.roundId)).toEqual(Array.from({ length: 8 }, (_, index) => `what-first:round:${index + 1}`));
  });

  it("softly explains the sequence", () => {
    const explanation = createWhatFirstExplanation(whatFirstScenes[0]);

    expect(explanation).toContain(whatFirstScenes[0].first.phrase);
    expect(explanation).toContain(whatFirstScenes[0].then.phrase);
    expect(explanation).toContain("Сначала");
  });
});
