import type { SessionSettings } from "../../core/settings";

export type MemoryCardSource = {
  id: string;
  label: string;
  emoji: string;
};

export type MemoryCard = {
  id: string;
  pairId: string;
  label: string;
  emoji: string;
};

export type MemoryCardsPairCount = 2 | 3 | 4;

export type MemoryCardsRoundSettings = {
  pairCount: MemoryCardsPairCount;
  columns: 3 | 4;
};

// Testers: «сделать возможность выбора 4 карточки, 6 карточек, 8 карточек».
export const memoryCardCountChoices = [4, 6, 8] as const;
export type MemoryCardCount = (typeof memoryCardCountChoices)[number];

export type MemoryCardsRound = {
  roundId: string;
  pairCount: number;
  columns: number;
  cards: MemoryCard[];
};

export const memoryCardSources: MemoryCardSource[] = [
  { id: "sun", label: "Солнце", emoji: "☀️" },
  { id: "star", label: "Звезда", emoji: "⭐" },
  { id: "flower", label: "Цветок", emoji: "🌸" },
  { id: "leaf", label: "Лист", emoji: "🍃" },
  { id: "fish", label: "Рыбка", emoji: "🐟" },
  { id: "duck", label: "Утка", emoji: "🦆" },
  { id: "butterfly", label: "Бабочка", emoji: "🦋" },
  { id: "heart", label: "Сердце", emoji: "❤️" },
];

export function getMemoryCardsRoundSettings(
  settings: SessionSettings,
  cardCount?: MemoryCardCount,
): MemoryCardsRoundSettings {
  const pairCount: MemoryCardsPairCount = cardCount
    ? ((cardCount / 2) as MemoryCardsPairCount)
    : settings.preset === "gentle" || settings.distractors !== "medium"
      ? 3
      : 4;
  // Four cards stand in one row of four, six in rows of three, eight in rows of four.
  return { pairCount, columns: pairCount === 3 ? 3 : 4 };
}

export function shuffleMemoryCards<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function memoryCardHitPaddingForGap(gap: number, preferredPadding = 36) {
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  const safePreferredPadding = Number.isFinite(preferredPadding)
    ? Math.max(0, preferredPadding)
    : 0;
  return Math.min(safePreferredPadding, safeGap / 2);
}

export function createMemoryCardDeck(
  sources: MemoryCardSource[],
  pairCount: number,
  roundIndex = 1,
  random = Math.random,
): MemoryCard[] {
  if (pairCount < 1) throw new Error("Memory cards need at least one pair.");
  if (sources.length < pairCount) throw new Error("Not enough memory card sources.");

  const selectedSources = shuffleMemoryCards(sources, random).slice(0, pairCount);
  return selectedSources.flatMap((source) =>
    [0, 1].map((copyIndex) => ({
      id: `memory-cards:${roundIndex}:${source.id}:${copyIndex}`,
      pairId: source.id,
      label: source.label,
      emoji: source.emoji,
    })),
  );
}

export function createMemoryCardsRound(
  settings: SessionSettings,
  roundIndex = 1,
  random = Math.random,
  cardCount?: MemoryCardCount,
): MemoryCardsRound {
  const roundSettings = getMemoryCardsRoundSettings(settings, cardCount);
  const deck = createMemoryCardDeck(memoryCardSources, roundSettings.pairCount, roundIndex, random);
  return {
    roundId: `memory-cards:round:${roundIndex}`,
    pairCount: roundSettings.pairCount,
    columns: roundSettings.columns,
    cards: shuffleMemoryCards(deck, random),
  };
}
