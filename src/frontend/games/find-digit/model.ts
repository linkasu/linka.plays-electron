import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";

export type FindDigitOption = {
  id: string;
  digit: number;
  label: string;
  sceneLabel: string;
};

export type FindDigitRound = ChoiceRound<FindDigitOption>;

const sceneLabels = ["звёздочка", "окошко", "лист", "облако", "камешек", "капля", "фонарик", "ракушка", "ягода", "лучик"];

export const findDigitOptions: FindDigitOption[] = Array.from({ length: 10 }, (_, digit) => ({
  id: `digit-${digit}`,
  digit,
  label: String(digit),
  sceneLabel: sceneLabels[digit]
}));

export function generateFindDigitRound(settings: SessionSettings, roundIndex = 1): FindDigitRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 3, standard: 4, challenge: 6 });
  if (findDigitOptions.length < choiceCount) throw new Error("Недостаточно цифр для игры.");

  return buildChoiceRound({
    idPrefix: "find-digit",
    roundIndex,
    items: findDigitOptions,
    choiceCount,
    pickTarget: (items) => pickRandom(items),
    isSame: idEquality,
    prompt: (target) => `Найди цифру ${target.label}`
  });
}
