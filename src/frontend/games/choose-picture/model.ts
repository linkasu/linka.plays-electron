import { buildChoiceRound, idEquality, pickRandom, type ChoiceRound } from "../../core/round";
import { getAllWords, type WordItem } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type ChoosePictureRound = ChoiceRound<WordItem>;

export function generateChoosePictureRound(settings: SessionSettings, roundIndex = 1, random = Math.random): ChoosePictureRound {
  const words = getAllWords();
  const choiceCount = 4;
  if (words.length < choiceCount) throw new Error("Недостаточно слов для игры.");

  return buildChoiceRound({
    idPrefix: "choose-picture",
    roundIndex,
    items: words,
    choiceCount,
    pickTarget: (items) => pickRandom(items, random),
    isSame: idEquality,
    prompt: (target) => `Где ${target.word}?`,
    random
  });
}
