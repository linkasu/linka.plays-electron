import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type FindNumberOption = {
  id: string;
  digit: number;
  label: string;
};

export type FindNumberRound = {
  roundId: string;
  prompt: string;
  target: FindNumberOption;
  choices: FindNumberOption[];
  correctIndex: number;
};

export const findNumberOptions: FindNumberOption[] = Array.from({ length: 10 }, (_, digit) => ({
  id: `digit-${digit}`,
  digit,
  label: String(digit)
}));

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 6;
  return 4;
}

export function generateFindNumberRound(settings: SessionSettings, roundIndex = 1): FindNumberRound {
  const choiceCount = choiceCountFor(settings);
  if (findNumberOptions.length < choiceCount) throw new Error("Недостаточно цифр для игры.");

  const [target] = shuffleItems(findNumberOptions).slice(0, 1);
  const distractors = shuffleItems(findNumberOptions.filter((option) => option.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-number:round:${roundIndex}`,
    prompt: `Найди цифру ${target.label}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
