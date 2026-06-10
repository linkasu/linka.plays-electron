import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type FindDigitOption = {
  id: string;
  digit: number;
  label: string;
  sceneLabel: string;
};

export type FindDigitRound = {
  roundId: string;
  prompt: string;
  target: FindDigitOption;
  choices: FindDigitOption[];
  correctIndex: number;
};

const sceneLabels = ["звёздочка", "окошко", "лист", "облако", "камешек", "капля", "фонарик", "ракушка", "ягода", "лучик"];

export const findDigitOptions: FindDigitOption[] = Array.from({ length: 10 }, (_, digit) => ({
  id: `digit-${digit}`,
  digit,
  label: String(digit),
  sceneLabel: sceneLabels[digit]
}));

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 6;
  return 4;
}

export function generateFindDigitRound(settings: SessionSettings, roundIndex = 1): FindDigitRound {
  const choiceCount = choiceCountFor(settings);
  if (findDigitOptions.length < choiceCount) throw new Error("Недостаточно цифр для игры.");

  const [target] = shuffleItems(findDigitOptions).slice(0, 1);
  const distractors = shuffleItems(findDigitOptions.filter((option) => option.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-digit:round:${roundIndex}`,
    prompt: `Найди цифру ${target.label}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
