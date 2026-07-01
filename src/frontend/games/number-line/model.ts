import type { SessionSettings } from "../../core/settings";

export type NumberLineTaskKind = "find" | "next" | "previous";

export type NumberLineRound = {
  roundId: string;
  taskKind: NumberLineTaskKind;
  prompt: string;
  helperText: string;
  numbers: number[];
  targetNumber: number;
  currentNumber?: number;
};

export const numberLineNumbers = Array.from({ length: 10 }, (_, index) => index + 1);

function wrappedNumber(seed: number, max: number) {
  return ((seed - 1) % max) + 1;
}

export function generateNumberLineRound(settings: SessionSettings, roundIndex = 1): NumberLineRound {
  const taskOrder: NumberLineTaskKind[] = ["find", "next", "previous"];
  const taskKind = taskOrder[(Math.max(1, roundIndex) - 1) % taskOrder.length];
  const gentleOffset = settings.preset === "gentle" ? 1 : 0;

  if (taskKind === "next") {
    const currentNumber = wrappedNumber(roundIndex * 2 + gentleOffset, 9);
    const targetNumber = currentNumber + 1;

    return {
      roundId: `number-line:round:${roundIndex}`,
      taskKind,
      prompt: `Что идёт после ${currentNumber}?`,
      helperText: "Выбери следующее число на дорожке.",
      numbers: numberLineNumbers,
      currentNumber,
      targetNumber
    };
  }

  if (taskKind === "previous") {
    const currentNumber = wrappedNumber(roundIndex * 2 + gentleOffset, 9) + 1;
    const targetNumber = currentNumber - 1;

    return {
      roundId: `number-line:round:${roundIndex}`,
      taskKind,
      prompt: `Что идёт перед ${currentNumber}?`,
      helperText: "Выбери предыдущее число на дорожке.",
      numbers: numberLineNumbers,
      currentNumber,
      targetNumber
    };
  }

  const targetNumber = wrappedNumber(roundIndex * 3 + gentleOffset, 10);

  return {
    roundId: `number-line:round:${roundIndex}`,
    taskKind,
    prompt: `Найди число ${targetNumber}`,
    helperText: "Выбери нужное число на дорожке.",
    numbers: numberLineNumbers,
    targetNumber
  };
}
