import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";

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

export function generateFindEmotionRound(settings: SessionSettings, roundIndex = 1): FindEmotionRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 2, standard: 3, challenge: 4 });
  if (findEmotionOptions.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  return buildChoiceRound({
    idPrefix: "find-emotion",
    roundIndex,
    items: findEmotionOptions,
    choiceCount,
    pickTarget: (items) => pickRandom(items),
    isSame: idEquality,
    prompt: (target) => `Найди эмоцию: ${target.label}`
  });
}
