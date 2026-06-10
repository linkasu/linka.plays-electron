import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type BigSmallSize = "big" | "small";

export type BigSmallObject = {
  id: string;
  label: string;
  emoji: string;
};

export type BigSmallChoice = BigSmallObject & {
  choiceId: string;
  size: BigSmallSize;
  sizeLabel: string;
};

export type BigSmallRound = {
  roundId: string;
  prompt: string;
  targetSize: BigSmallSize;
  object: BigSmallObject;
  choices: BigSmallChoice[];
  correctIndex: number;
  mistakeHint: string;
};

export const bigSmallObjects: BigSmallObject[] = [
  { id: "apple", label: "яблоко", emoji: "🍎" },
  { id: "ball", label: "мяч", emoji: "⚽" },
  { id: "flower", label: "цветок", emoji: "🌸" },
  { id: "car", label: "машина", emoji: "🚗" },
  { id: "duck", label: "утка", emoji: "🦆" },
  { id: "star", label: "звезда", emoji: "⭐" },
  { id: "fish", label: "рыбка", emoji: "🐟" },
  { id: "house", label: "дом", emoji: "🏠" }
];

const sizeLabels: Record<BigSmallSize, string> = {
  big: "большой",
  small: "маленький"
};

function pickObject(roundIndex: number) {
  return bigSmallObjects[(roundIndex - 1) % bigSmallObjects.length];
}

function buildChoice(object: BigSmallObject, size: BigSmallSize): BigSmallChoice {
  return {
    ...object,
    choiceId: `${object.id}:${size}`,
    size,
    sizeLabel: sizeLabels[size]
  };
}

export function generateBigSmallRound(_settings: SessionSettings, roundIndex = 1): BigSmallRound {
  const object = pickObject(roundIndex);
  const targetSize: BigSmallSize = roundIndex % 2 === 0 ? "small" : "big";
  const choices = shuffleItems([buildChoice(object, "big"), buildChoice(object, "small")]);
  const correctChoiceId = `${object.id}:${targetSize}`;

  return {
    roundId: `big-small:round:${roundIndex}`,
    prompt: targetSize === "big" ? `Выбери большой предмет: ${object.label}` : `Выбери маленький предмет: ${object.label}`,
    targetSize,
    object,
    choices,
    correctIndex: choices.findIndex((choice) => choice.choiceId === correctChoiceId),
    mistakeHint: targetSize === "big" ? "Почти. Нужен большой объект." : "Почти. Нужен маленький объект."
  };
}
