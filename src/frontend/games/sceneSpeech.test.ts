import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../core/settings";
import { getAllWords } from "../data/wordBank";
import { miniDialogGraph } from "./mini-dialog/model";
import { objectActionChoices } from "./object-action/model";
import { findSceneRecordings } from "./sceneSpeech";
import { generateShelfSortingRound } from "./shelf-sorting/model";
import { generateShopRound } from "./shop/model";
import {
  createSocialPhraseDeck,
  evaluateSocialPhraseChoice,
  socialPhrasesInstruction,
} from "./social-phrases/model";
import { wantDontWantItems, wantDontWantPhrase } from "./want-dont-want/model";
import { createWhereObjectRoundGenerator } from "./where-object/model";
import { generateYesNoRound } from "./yes-no/model";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Voice = "jane" | "alena" | "filipp" | "julia";
type ScenePhrase = { text: string; voice: Voice };

// Role voices follow the recordings these games already have: the partner and
// the narrator are alena, the child's own phrase is filipp, a hint is julia.
function collect(build: (add: (text: string, voice?: Voice) => void) => void) {
  const phrases = new Map<string, Voice>();
  build((text, voice = "jane") => {
    if (!phrases.has(text)) phrases.set(text, voice);
  });
  return [...phrases].map(([text, voice]): ScenePhrase => ({ text, voice }));
}

// A new phrase fails the test below with its text: add it to ttsAssets.json
// (id "<game>.scene.<hash>", voice from the list) and run
// `node scripts/generate-tts-assets.mjs --game <game>`.
// Every phrase a game can pass to speakSceneText. Generators run on many seeds
// so the list follows the real prompt templates instead of copying them.
const scenePhrases: Record<string, ScenePhrase[]> = {
  "mini-dialog": collect((add) => {
    for (const node of Object.values(miniDialogGraph)) {
      add(node.partnerLine, "alena");
      for (const choice of node.choices) add(choice.text, "filipp");
    }
    add("Я помогу. Послушай вопрос ещё раз; можно ответить или отказаться.", "julia");
  }),
  "object-action": collect((add) => {
    for (const action of objectActionChoices) {
      add(`Покажи действие: ${action.title}.`);
      add(action.successText);
      add(`Это другое действие. Покажи: ${action.title}.`);
    }
  }),
  "shop": collect((add) => {
    for (const preset of ["gentle", "standard", "challenge"] as const)
      for (let seed = 1; seed <= 200; seed += 1)
        for (const roundIndex of [1, 2])
          add(generateShopRound(settingsFromPreset(preset), roundIndex, seededRandom(seed)).prompt);
  }),
  "social-phrases": collect((add) => {
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const round of createSocialPhraseDeck(seededRandom(seed))) {
        for (const includeInstruction of [true, false])
          add(
            [
              includeInstruction ? socialPhrasesInstruction : "",
              round.scene,
              round.partner,
              round.prompt,
            ]
              .filter(Boolean)
              .join(" "),
            "alena",
          );
        for (const choice of round.choices) {
          const evaluation = evaluateSocialPhraseChoice(round, choice);
          add(evaluation.phrase, "filipp");
          add(evaluation.feedback, "julia");
        }
      }
    }
    add("Я помогу. Послушай ситуацию ещё раз и выбери в своём темпе.", "julia");
    add("Я услышал тебя. Останавливаемся.", "julia");
    add("Спасибо. Все ситуации закончились.", "julia");
  }),
  "type-word": collect((add) => add("Собери название предмета. Выбирай буквы слева направо.")),
  "want-dont-want": collect((add) => {
    for (const item of wantDontWantItems)
      for (const answer of ["want", "dont-want"] as const) add(wantDontWantPhrase(item, answer));
  }),
  "where-object": collect((add) => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const next = createWhereObjectRoundGenerator(seededRandom(seed));
      for (let roundIndex = 1; roundIndex <= 40; roundIndex += 1) {
        const round = next(roundIndex);
        add(round.prompt);
        add(`Это другая картинка. ${round.prompt}`);
        for (const choice of round.choices) add(`${choice.scenePhrase}.`);
      }
    }
  }),
  "shelf-sorting": collect((add) => {
    for (let seed = 1; seed <= 200; seed += 1)
      for (const roundIndex of [1, 2])
        add(generateShelfSortingRound(roundIndex, seededRandom(seed)).prompt);
  }),
  "yes-no": collect((add) => {
    for (const word of getAllWords()) add(`Это ${word.word}?`);
  }),
};

describe("scene speech recordings", () => {
  it("builds yes-no questions the way the list above expects", () => {
    const round = generateYesNoRound(1, seededRandom(7));
    expect(round.prompt).toBe(`Это ${round.askedItem.word}?`);
  });

  it.each(Object.entries(scenePhrases))(
    "%s has a recording for every phrase it can say",
    (gameId, phrases) => {
      const missing = phrases
        .map((phrase) => phrase.text)
        .filter((text) => !findSceneRecordings(text, gameId));
      expect(missing).toEqual([]);
    },
  );
});
