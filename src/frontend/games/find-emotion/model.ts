import type { SessionSettings } from "../../core/settings";
import {
  buildChoiceRound,
  choiceCountByPreset,
  idEquality,
  pickRandom,
  type ChoiceRound,
} from "../../core/round";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";

export type FindEmotionOption = {
  id: string;
  label: string;
  emoji: string;
  /** Picture drawn for this game, see core/gameArt.ts; the emoji is the fallback. */
  artId?: string;
};

export type FindEmotionRound = ChoiceRound<FindEmotionOption>;

export const findEmotionOptions: FindEmotionOption[] = [
  // Testers: «отрисовать эмоции». The drawn set has no sleepy face, so calm
  // takes its place; its prompt (find-emotion.prompt.calm) was already recorded.
  { id: "joy", label: "радость", emoji: "😊", artId: "find-emotion/joy" },
  { id: "sadness", label: "грусть", emoji: "😢", artId: "find-emotion/sadness" },
  { id: "anger", label: "злость", emoji: "😠", artId: "find-emotion/anger" },
  { id: "surprise", label: "удивление", emoji: "😮", artId: "find-emotion/surprise" },
  { id: "fear", label: "страх", emoji: "😨", artId: "find-emotion/fear" },
  { id: "calm", label: "спокойствие", emoji: "🙂", artId: "find-emotion/calm" },
];

function buildFindEmotionRound(
  settings: SessionSettings,
  roundIndex: number,
  target: FindEmotionOption,
  random = Math.random,
): FindEmotionRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, {
    gentle: 2,
    standard: 3,
    challenge: 4,
  });
  if (findEmotionOptions.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  return buildChoiceRound({
    idPrefix: "find-emotion",
    roundIndex,
    items: findEmotionOptions,
    choiceCount,
    pickTarget: () => target,
    isSame: idEquality,
    prompt: (roundTarget) => `Найди эмоцию: ${roundTarget.label}`,
    random,
  });
}

export function generateFindEmotionRound(
  settings: SessionSettings,
  roundIndex = 1,
): FindEmotionRound {
  return buildFindEmotionRound(settings, roundIndex, pickRandom(findEmotionOptions));
}

export function createFindEmotionRoundGenerator(random = Math.random) {
  const targetIndexes = createNonRepeatingRandomIndexGenerator(findEmotionOptions.length, random);
  return (settings: SessionSettings, roundIndex = 1) => {
    const targetIndex = targetIndexes.next();
    if (targetIndex === undefined) throw new Error("Недостаточно эмоций для игры.");
    return buildFindEmotionRound(settings, roundIndex, findEmotionOptions[targetIndex], random);
  };
}
