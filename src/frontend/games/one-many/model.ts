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

const sideDeck: Array<{ target: OneManyAnswer; targetSide: OneManySide }> = [
  { target: "one", targetSide: "left" },
  { target: "one", targetSide: "right" },
  { target: "many", targetSide: "left" },
  { target: "many", targetSide: "right" },
  { target: "one", targetSide: "left" },
  { target: "one", targetSide: "right" },
  { target: "many", targetSide: "left" },
  { target: "many", targetSide: "right" }
];

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

function buildRound(roundIndex: number, item: typeof oneManyItems[number], target: OneManyAnswer, targetSide: OneManySide): OneManyRound {
  const oneOnLeft = target === "one" ? targetSide === "left" : targetSide === "right";
  const choices = [buildChoice("one", roundIndex, item.emoji, oneOnLeft), buildChoice("many", roundIndex, item.emoji, oneOnLeft)]
    .sort((left, right) => left.side === "left" ? -1 : right.side === "left" ? 1 : 0);

  return {
    roundId: `one-many:round:${roundIndex}`,
    prompt: target === "one" ? "Где один предмет?" : "Где много предметов?",
    target,
    itemId: item.id,
    itemName: item.name,
    choices
  };
}

export function createOneManyDeck(random = Math.random): OneManyRound[] {
  const items = shuffleItems([...oneManyItems], random);
  const sides = shuffleItems(sideDeck, random);
  return sides.map(({ target, targetSide }, index) => buildRound(index + 1, items[index], target, targetSide));
}

export function generateOneManyRound(roundIndex = 1, random = Math.random): OneManyRound {
  const safeIndex = Math.max(1, Math.floor(roundIndex));
  const round = createOneManyDeck(random)[(safeIndex - 1) % oneManyItems.length];
  return { ...round, roundId: `one-many:round:${safeIndex}` };
}
