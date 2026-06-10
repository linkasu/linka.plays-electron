import { shuffleItems } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type NumberBondsRound = {
  roundId: string;
  prompt: string;
  total: number;
  knownPart: number;
  missingPart: number;
  choices: number[];
  correctIndex: number;
};

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildNumberBondsChoices(missingPart: number, maxPart: number, choiceCount: number) {
  const choices = new Set([missingPart]);
  const nearby = [missingPart - 1, missingPart + 1, missingPart - 2, missingPart + 2]
    .filter((value) => value >= 1 && value <= maxPart && value !== missingPart);

  for (const value of shuffleItems(nearby)) {
    if (choices.size < choiceCount) choices.add(value);
  }

  for (const value of shuffleItems(Array.from({ length: maxPart }, (_, index) => index + 1))) {
    if (choices.size < choiceCount && value !== missingPart) choices.add(value);
  }

  return shuffleItems([...choices]).slice(0, choiceCount);
}

export function generateNumberBondsRound(settings: SessionSettings, roundIndex = 1): NumberBondsRound {
  const maxTotal = settings.preset === "gentle" ? 5 : 10;
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const total = randomInt(2, maxTotal);
  const knownPart = randomInt(1, total - 1);
  const missingPart = total - knownPart;
  const choices = buildNumberBondsChoices(missingPart, maxTotal, choiceCount);

  return {
    roundId: `number-bonds:round:${roundIndex}`,
    prompt: `Сколько добавить к ${knownPart}, чтобы было ${total}?`,
    total,
    knownPart,
    missingPart,
    choices,
    correctIndex: choices.indexOf(missingPart)
  };
}
