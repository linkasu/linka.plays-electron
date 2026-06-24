import { describe, expect, it } from "vitest";
import { generateSocialPhraseRound, getSocialPhraseChoice, isSocialPhraseChoiceCorrect, kindHints, kindLabels, socialPhraseScenes, validateSocialPhraseScenes } from "./model";

describe("social-phrases model", () => {
  it("validates scenes and labels", () => {
    expect(validateSocialPhraseScenes()).toEqual([]);
    expect(kindLabels.greeting).toBe("приветствие");
    expect(kindHints.request).toContain("просьба");
  });

  it("creates a round with one expected social phrase", () => {
    const round = generateSocialPhraseRound(1, () => 0.99);

    expect(round.roundId).toBe("social-phrases:morning-adult:round:1");
    expect(round.choices).toHaveLength(3);
    expect(round.choices[round.correctIndex]).toBe(round.correctChoice);
    expect(isSocialPhraseChoiceCorrect(round, round.correctChoice)).toBe(true);
  });

  it("uses random source for scene and choice order", () => {
    const lowRandomRound = generateSocialPhraseRound(1, () => 0);
    const highRandomRound = generateSocialPhraseRound(1, () => 0.99);

    expect(lowRandomRound.id).not.toBe(highRandomRound.id);
    expect(lowRandomRound.choices.map((choice) => choice.id)).not.toEqual(highRandomRound.choices.map((choice) => choice.id));
  });

  it("keeps every choice retrievable", () => {
    const round = generateSocialPhraseRound(1, () => 0.99);

    for (const choice of round.choices) {
      expect(getSocialPhraseChoice(round, choice.id)).toEqual(choice);
    }
    expect(() => getSocialPhraseChoice(round, "missing")).toThrow("Нет фразы missing");
  });

  it("covers all social phrase kinds", () => {
    const kinds = new Set(socialPhraseScenes.map((scene) => scene.expectedKind));

    expect(kinds).toEqual(new Set(["greeting", "request", "thanks"]));
  });
});
