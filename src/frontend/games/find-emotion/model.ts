import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";
import { createNonRepeatingRandomIndexGenerator } from "../../core/random";

export type FindEmotionOption = {
  id: string;
  label: string;
  emoji: string;
};

export type FindEmotionRound = ChoiceRound<FindEmotionOption>;

export const findEmotionOptions: FindEmotionOption[] = [
  { id: "joy", label: "радость", emoji: "😊" },
  { id: "sadness", label: "грусть", emoji: "😢" },
  { id: "anger", label: "злость", emoji: "😠" },
  { id: "surprise", label: "удивление", emoji: "😮" },
  { id: "calm", label: "спокойствие", emoji: "🙂" },
  { id: "fear", label: "страх", emoji: "😨" },
  { id: "sleepy", label: "сонливость", emoji: "😴" },
  { id: "shy", label: "смущение", emoji: "☺️" }
];

function buildFindEmotionRound(settings: SessionSettings, roundIndex: number, target: FindEmotionOption, random = Math.random): FindEmotionRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 2, standard: 3, challenge: 4 });
  if (findEmotionOptions.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  return buildChoiceRound({
    idPrefix: "find-emotion",
    roundIndex,
    items: findEmotionOptions,
    choiceCount,
    pickTarget: () => target,
    isSame: idEquality,
    prompt: (roundTarget) => `Найди эмоцию: ${roundTarget.label}`,
    random
  });
}

export function generateFindEmotionRound(settings: SessionSettings, roundIndex = 1): FindEmotionRound {
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
