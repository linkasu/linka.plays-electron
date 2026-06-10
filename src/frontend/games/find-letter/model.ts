import type { SessionSettings } from "../../core/settings";
import { sampleItems, shuffleItems } from "../../data/wordBank";

export type FindLetterOption = {
  id: string;
  letter: string;
};

export type FindLetterRound = {
  roundId: string;
  prompt: string;
  target: FindLetterOption;
  choices: FindLetterOption[];
  correctIndex: number;
};

export const findLetterAlphabet = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Я"] as const;

function choiceCountForSettings(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 6;
  return 4;
}

function buildOption(letter: string): FindLetterOption {
  return {
    id: `letter-${findLetterAlphabet.indexOf(letter as (typeof findLetterAlphabet)[number]) + 1}`,
    letter
  };
}

export function generateFindLetterRound(settings: SessionSettings, roundIndex = 1): FindLetterRound {
  const choiceCount = choiceCountForSettings(settings);
  if (findLetterAlphabet.length < choiceCount) throw new Error("Недостаточно букв для игры.");

  const [targetLetter] = sampleItems([...findLetterAlphabet], 1);
  const distractors = sampleItems([...findLetterAlphabet].filter((letter) => letter !== targetLetter), choiceCount - 1);
  const choices = shuffleItems([targetLetter, ...distractors]).map(buildOption);
  const target = buildOption(targetLetter);

  return {
    roundId: `find-letter:round:${roundIndex}`,
    prompt: `Найди букву ${target.letter}`,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.letter === target.letter)
  };
}
