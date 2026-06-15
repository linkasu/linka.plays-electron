import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickRandom, type ChoiceRound } from "../../core/round";

export type FindLetterOption = {
  id: string;
  letter: string;
};

export type FindLetterRound = ChoiceRound<FindLetterOption>;

export const findLetterAlphabet = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Я"] as const;

function buildOption(letter: string): FindLetterOption {
  return {
    id: `letter-${findLetterAlphabet.indexOf(letter as (typeof findLetterAlphabet)[number]) + 1}`,
    letter
  };
}

const findLetterOptions = findLetterAlphabet.map(buildOption);

export function generateFindLetterRound(settings: SessionSettings, roundIndex = 1): FindLetterRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, { gentle: 3, standard: 4, challenge: 6 });
  if (findLetterOptions.length < choiceCount) throw new Error("Недостаточно букв для игры.");

  return buildChoiceRound({
    idPrefix: "find-letter",
    roundIndex,
    items: findLetterOptions,
    choiceCount,
    pickTarget: (items) => pickRandom(items),
    isSame: idEquality,
    prompt: (target) => `Найди букву ${target.letter}`
  });
}
