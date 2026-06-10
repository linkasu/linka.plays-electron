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

function choiceSide(answer: OneManyAnswer, roundIndex: number): OneManySide {
  const oneOnLeft = roundIndex % 2 === 1;
  if (answer === "one") return oneOnLeft ? "left" : "right";
  return oneOnLeft ? "right" : "left";
}

function buildChoice(answer: OneManyAnswer, roundIndex: number, emoji: string): OneManyChoice {
  const count = answer === "one" ? 1 : 4 + (roundIndex % 2);
  return {
    id: answer,
    title: answer === "one" ? "Один" : "Много",
    shortTitle: answer === "one" ? "один" : "много",
    side: choiceSide(answer, roundIndex),
    emoji,
    count,
    items: Array.from({ length: count }, () => emoji)
  };
}

export function generateOneManyRound(roundIndex = 1): OneManyRound {
  const item = oneManyItems[(roundIndex - 1) % oneManyItems.length];
  const target: OneManyAnswer = roundIndex % 2 === 1 ? "one" : "many";
  const choices = [buildChoice("one", roundIndex, item.emoji), buildChoice("many", roundIndex, item.emoji)]
    .sort((left, right) => left.side.localeCompare(right.side));

  return {
    roundId: `one-many:round:${roundIndex}`,
    prompt: target === "one" ? "Где один предмет?" : "Где много предметов?",
    target,
    itemName: item.name,
    choices
  };
}
