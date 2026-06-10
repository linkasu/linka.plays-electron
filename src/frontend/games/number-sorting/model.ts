import type { SessionSettings } from "../../core/settings";

export type NumberSortingDirection = "ascending" | "descending";

export type NumberSortingCard = {
  id: string;
  value: number;
};

export type NumberSortingRound = {
  roundId: string;
  direction: NumberSortingDirection;
  prompt: string;
  helperText: string;
  cards: NumberSortingCard[];
  correctOrder: number[];
  targetNumber: number;
};

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffleItems<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function numberRange(maxNumber: number) {
  return Array.from({ length: maxNumber }, (_, index) => index + 1);
}

function settingsForPreset(settings: SessionSettings) {
  if (settings.preset === "gentle") return { cardCount: 4, maxNumber: 8 };
  if (settings.preset === "challenge") return { cardCount: 6, maxNumber: 18 };
  return { cardCount: 5, maxNumber: 12 };
}

export function generateNumberSortingRound(settings: SessionSettings, roundIndex = 1): NumberSortingRound {
  const direction: NumberSortingDirection = roundIndex % 2 === 0 ? "descending" : "ascending";
  const { cardCount, maxNumber } = settingsForPreset(settings);
  const values = shuffleItems(numberRange(maxNumber)).slice(0, cardCount);
  const correctOrder = [...values].sort((left, right) => direction === "ascending" ? left - right : right - left);

  return {
    roundId: `number-sorting:round:${roundIndex}`,
    direction,
    prompt: direction === "ascending" ? "Выбирай числа от меньшего к большему" : "Выбирай числа от большего к меньшему",
    helperText: direction === "ascending" ? "Найди самое маленькое оставшееся число." : "Найди самое большое оставшееся число.",
    cards: values.map((value) => ({ id: `number-sorting:card:${roundIndex}:${value}`, value })),
    correctOrder,
    targetNumber: correctOrder[0]
  };
}
