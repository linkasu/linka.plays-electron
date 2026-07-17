import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type BigSmallSize = "big" | "small";

export type BigSmallObject = {
  id: string;
  label: string;
  emoji: string;
  visualSrc?: string;
  sizePhrases: Record<BigSmallSize, string>;
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
  targetPhrase: string;
  object: BigSmallObject;
  choices: BigSmallChoice[];
  correctIndex: number;
};

export const bigSmallObjects: BigSmallObject[] = [
  { id: "apple", label: "яблоко", emoji: "🍎", sizePhrases: { big: "большое яблоко", small: "маленькое яблоко" } },
  { id: "ball", label: "мяч", emoji: "⚽", sizePhrases: { big: "большой мяч", small: "маленький мяч" } },
  { id: "flower", label: "цветок", emoji: "🌸", sizePhrases: { big: "большой цветок", small: "маленький цветок" } },
  { id: "car", label: "машина", emoji: "🚗", sizePhrases: { big: "большая машина", small: "маленькая машина" } },
  { id: "duck", label: "утка", emoji: "🦆", sizePhrases: { big: "большая утка", small: "маленькая утка" } },
  { id: "star", label: "звезда", emoji: "⭐", sizePhrases: { big: "большая звезда", small: "маленькая звезда" } },
  { id: "fish", label: "рыбка", emoji: "🐟", sizePhrases: { big: "большая рыбка", small: "маленькая рыбка" } },
  { id: "house", label: "дом", emoji: "🏠", visualSrc: "./images/shadow-match/house.png", sizePhrases: { big: "большой дом", small: "маленький дом" } }
];

const sizeLabels: Record<BigSmallSize, string> = {
  big: "большой",
  small: "маленький"
};

function pickObject(roundIndex: number, random: () => number) {
  return shuffleItems(bigSmallObjects, random)[(roundIndex - 1) % bigSmallObjects.length];
}

function buildChoice(object: BigSmallObject, size: BigSmallSize): BigSmallChoice {
  return {
   ...object,
    choiceId: `${object.id}:${size}`,
    size,
    sizeLabel: sizeLabels[size]
  };
}

export function generateBigSmallRound(_settings: SessionSettings, roundIndex = 1, random = Math.random): BigSmallRound {
  const object = pickObject(roundIndex, random);
  const targetSize = shuffleItems<BigSmallSize>(["big", "small"], random)[0];
  const choices = shuffleItems([buildChoice(object, "big"), buildChoice(object, "small")], random);
  const correctChoiceId = `${object.id}:${targetSize}`;
  const targetPhrase = object.sizePhrases[targetSize];

  return {
    roundId: `big-small:round:${roundIndex}`,
    prompt: `Выбери: ${targetPhrase}`,
    targetSize,
    targetPhrase,
    object,
    choices,
    correctIndex: choices.findIndex((choice) => choice.choiceId === correctChoiceId)
  };
}
