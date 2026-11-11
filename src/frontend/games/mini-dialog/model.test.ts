import { describe, expect, it } from "vitest";
import ttsAssets from "../../data/ttsAssets.json";
import {
  createMiniDialogRoundGenerator,
  miniDialogPromptAssetId,
  miniDialogReplies,
  miniDialogReplyAssetId,
  miniDialogSituations,
} from "./model";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("mini-dialog", () => {
  it("follows the testers' scheme: four reply cards and Mira's situations", () => {
    expect(miniDialogReplies.map((reply) => reply.text)).toEqual([
      "Привет",
      "Пока",
      "Спасибо",
      "Пожалуйста",
    ]);
    expect(miniDialogSituations.map((situation) => situation.prompt)).toEqual([
      "Мира сказала тебе привет. Выбери, как ей ответить.",
      "Мира говорит тебе пока. Что нужно ответить?",
      "Мира угостила тебя яблоком. Что нужно ответить?",
      "Мира сказала тебе спасибо. Что нужно ответить?",
      // Testers (recheck): «добавим ещё аналогичных».
      "Мира дала тебе поиграть свою игрушку. Что нужно ответить?",
      "Мира дала тебе карандаш. Что нужно ответить?",
      "Мира пришла к тебе в гости. Что нужно сказать?",
      "Мира уходит домой. Что нужно сказать?",
      "Мира говорит тебе спасибо за конфету. Что нужно ответить?",
    ]);
  });

  it("offers all four replies with exactly one right answer", () => {
    const generate = createMiniDialogRoundGenerator(seededRandom(3));
    for (let index = 1; index <= 12; index += 1) {
      const round = generate(index);
      expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(4);
      expect(round.choices[round.correctIndex].id).toBe(round.situation.answer);
    }
  });

  it("meets every situation before repeating and never repeats one in a row", () => {
    const generate = createMiniDialogRoundGenerator(seededRandom(5));
    const rounds = Array.from({ length: miniDialogSituations.length * 3 }, (_, index) =>
      generate(index + 1),
    );
    for (let start = 0; start < rounds.length; start += miniDialogSituations.length) {
      const pass = rounds.slice(start, start + miniDialogSituations.length);
      expect(new Set(pass.map((round) => round.situation.id)).size).toBe(
        miniDialogSituations.length,
      );
    }
    for (let index = 1; index < rounds.length; index += 1) {
      expect(rounds[index].situation.id).not.toBe(rounds[index - 1].situation.id);
    }
  });

  it("has a recording for every task and every reply", () => {
    const ids = new Set(ttsAssets.map((asset) => asset.id));
    for (const situation of miniDialogSituations) {
      expect(ids.has(miniDialogPromptAssetId(situation))).toBe(true);
    }
    for (const reply of miniDialogReplies)
      expect(ids.has(miniDialogReplyAssetId(reply))).toBe(true);
    expect(ids.has("mini-dialog.mistake")).toBe(true);
  });
});
