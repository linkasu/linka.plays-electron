import { shuffleItems } from "../../core/random";

export type OneManyAnswer = "one" | "many";

export type OneManySide = "left" | "right";

export type OneManyChoice = {
  id: OneManyAnswer;
  title: string;
  shortTitle: string;
  side: OneManySide;
  emoji: string;
  count: number;
  items: string[];
};

export type OneManyRound = {
  roundId: string;
  prompt: string;
  target: OneManyAnswer;
  itemId: string;
  itemName: string;
  choices: OneManyChoice[];
};

const oneManyItems = [
  { id: "apple", name: "яблоко", emoji: "🍎" },
  { id: "star", name: "звезда", emoji: "⭐" },
  { id: "flower", name: "цветок", emoji: "🌸" },
  { id: "fish", name: "рыбка", emoji: "🐟" },
  { id: "butterfly", name: "бабочка", emoji: "🦋" },
  { id: "ball", name: "мяч", emoji: "🟡" },
  { id: "leaf", name: "лист", emoji: "🍃" },
  { id: "car", name: "машинка", emoji: "🚗" }
] as const;

function choiceSide(answer: OneManyAnswer, oneOnLeft: boolean): OneManySide {
  if (answer === "one") return oneOnLeft ? "left" : "right";
  return oneOnLeft ? "right" : "left";
}

function buildChoice(answer: OneManyAnswer, roundIndex: number, emoji: string, oneOnLeft: boolean): OneManyChoice {
  const count = answer === "one" ? 1 : 4 + (roundIndex % 2);
  return {
    id: answer,
    title: answer === "one" ? "Один" : "Много",
    shortTitle: answer === "one" ? "один" : "много",
    side: choiceSide(answer, oneOnLeft),
    emoji,
    count,
    items: Array.from({ length: count }, () => emoji)
  };
}

export function generateOneManyRound(roundIndex = 1, random = Math.random): OneManyRound {
  const item = shuffleItems([...oneManyItems], random)[(roundIndex - 1) % oneManyItems.length];
  const target = shuffleItems<OneManyAnswer>(["one", "many"], random)[0];
  const oneOnLeft = shuffleItems([true, false], random)[0];
  const choices = [buildChoice("one", roundIndex, item.emoji, oneOnLeft), buildChoice("many", roundIndex, item.emoji, oneOnLeft)]
    .sort((left, right) => left.side.localeCompare(right.side));

  return {
    roundId: `one-many:round:${roundIndex}`,
    prompt: target === "one" ? "Где один предмет?" : "Где много предметов?",
    target,
    itemId: item.id,
    itemName: item.name,
    choices
  };
}
