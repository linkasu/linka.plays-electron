import { describe, expect, it } from "vitest";
import { createSocialPhraseDeck, evaluateSocialPhraseChoice, getSocialPhraseChoice, socialPhraseScenes, socialPhrasesInstruction, validateSocialPhraseScenes } from "./model";

describe("social-phrases model", () => {
  it("provides the complete child-facing instruction", () => {
    expect(socialPhrasesInstruction).toBe("Посмотри на ситуацию и выбери, что можно сказать. Если тебе нужна помощь, ты не хочешь или хочешь остановиться, выбери такую карточку: это тоже важный ответ.");
  });

  it("builds four visually distinct situations with three or four visual options", () => {
    expect(validateSocialPhraseScenes()).toEqual([]);
    expect(socialPhraseScenes).toHaveLength(4);
    expect(new Set(socialPhraseScenes.map((scene) => scene.sceneIcon))).toHaveLength(socialPhraseScenes.length);
    expect(new Set(socialPhraseScenes.map((scene) => scene.sceneColor))).toHaveLength(socialPhraseScenes.length);

    for (const scene of socialPhraseScenes) {
      expect(scene.choices.length).toBeGreaterThanOrEqual(3);
      expect(scene.choices.length).toBeLessThanOrEqual(4);
      expect(new Set(scene.choices.map((choice) => choice.icon))).toHaveLength(scene.choices.length);
      expect(new Set(scene.choices.map((choice) => choice.color))).toHaveLength(scene.choices.length);
    }
  });

  it("does not mix semantic roles among situation answers", () => {
    for (const scene of socialPhraseScenes) {
      const situationKinds = new Set(scene.choices.filter((choice) => choice.kind !== "functional").map((choice) => choice.kind));
      expect(situationKinds).toEqual(new Set([scene.expectedKind]));
    }
  });

  it("deals a complete unique scene deck and copies its options", () => {
    const deck = createSocialPhraseDeck(() => 0.37);

    expect(deck).toHaveLength(socialPhraseScenes.length);
    expect(new Set(deck.map((round) => round.id))).toHaveLength(deck.length);
    expect(new Set(deck.map((round) => round.roundId))).toHaveLength(deck.length);
    for (const round of deck) {
      expect(round.choices).not.toBe(socialPhraseScenes.find((scene) => scene.id === round.id)?.choices);
      expect(round.choices).toHaveLength(4);
    }
  });

  it("counts refusal, help, and stop as no-fail communication", () => {
    const deck = createSocialPhraseDeck(() => 0.37);
    const functionalChoices = deck.flatMap((round) => round.choices.filter((choice) => choice.kind === "functional").map((choice) => ({ round, choice })));
    const functions = new Set(functionalChoices.map(({ choice }) => choice.function));

    expect(functions).toEqual(new Set(["refusal", "help", "stop"]));
    for (const { round, choice } of functionalChoices) {
      const evaluation = evaluateSocialPhraseChoice(round, choice);
      expect(evaluation.type).toBe("communication");
      expect(evaluation.phrase).toBe(choice.text);
      expect(evaluation.isCorrect).toBe(true);
      expect(evaluation.noFail).toBe(true);
    }
  });

  it("returns only a gentle no-fail hint for a mismatched situation phrase", () => {
    const round = createSocialPhraseDeck(() => 0.42)[0];
    const mismatch = round.choices.find((choice) => !choice.accepted)!;
    const evaluation = evaluateSocialPhraseChoice(round, mismatch);

    expect(evaluation).toMatchObject({ type: "hint", phrase: mismatch.text, isCorrect: false, noFail: true, endsSession: false });
    expect(evaluation.feedback).toBe(round.mistakeFeedback);
    expect(evaluation.feedback).not.toMatch(/ошиб|невер/i);
  });

  it("keeps every option retrievable", () => {
    const round = createSocialPhraseDeck(() => 0.99)[0];

    for (const choice of round.choices) expect(getSocialPhraseChoice(round, choice.id)).toEqual(choice);
    expect(() => getSocialPhraseChoice(round, "missing")).toThrow("Нет фразы missing");
  });
});
