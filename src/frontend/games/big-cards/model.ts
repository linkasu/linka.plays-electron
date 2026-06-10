export type BigCard = {
  id: string;
  label: string;
  emoji: string;
  color: string;
};

export type BigCardsRound = {
  roundId: string;
  prompt: string;
  suggested: BigCard;
  choices: BigCard[];
};

const bigCards: BigCard[] = [
  { id: "sun", label: "Солнце", emoji: "☀️", color: "yellow-lighten-4" },
  { id: "flower", label: "Цветок", emoji: "🌸", color: "pink-lighten-4" },
  { id: "cat", label: "Кот", emoji: "🐱", color: "orange-lighten-4" },
  { id: "moon", label: "Луна", emoji: "🌙", color: "indigo-lighten-4" },
  { id: "tree", label: "Дерево", emoji: "🌳", color: "green-lighten-4" },
  { id: "duck", label: "Утка", emoji: "🦆", color: "cyan-lighten-4" },
  { id: "star", label: "Звезда", emoji: "⭐", color: "amber-lighten-4" },
  { id: "bear", label: "Мишка", emoji: "🐻", color: "brown-lighten-4" }
];

export function generateBigCardsRound(roundIndex = 1): BigCardsRound {
  const choiceCount = 2 + ((roundIndex - 1) % 3);
  const start = (roundIndex * 2) % bigCards.length;
  const choices = Array.from({ length: choiceCount }, (_, index) => bigCards[(start + index) % bigCards.length]);
  const suggested = choices[(roundIndex - 1) % choices.length];

  return {
    roundId: `big-cards:round:${roundIndex}`,
    prompt: `Можно посмотреть на ${suggested.label.toLowerCase()}. Любая карточка подойдёт.`,
    suggested,
    choices
  };
}
