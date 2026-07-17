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

export type MemoryCardsRoundSettings = {
  pairCount: 3 | 4;
  columns: 3 | 4;
};

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
  { id: "heart", label: "Сердце", emoji: "❤️" }
];

export function getMemoryCardsRoundSettings(settings: SessionSettings): MemoryCardsRoundSettings {
  const pairCount = settings.preset === "gentle" || settings.distractors !== "medium" ? 3 : 4;
  return { pairCount, columns: pairCount };
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
  const safePreferredPadding = Number.isFinite(preferredPadding) ? Math.max(0, preferredPadding) : 0;
  return Math.min(safePreferredPadding, safeGap / 2);
}

export function createMemoryCardDeck(sources: MemoryCardSource[], pairCount: number, roundIndex = 1, random = Math.random): MemoryCard[] {
  if (pairCount < 1) throw new Error("Memory cards need at least one pair.");
  if (sources.length < pairCount) throw new Error("Not enough memory card sources.");

  const selectedSources = shuffleMemoryCards(sources, random).slice(0, pairCount);
  return selectedSources.flatMap((source) => [0, 1].map((copyIndex) => ({
    id: `memory-cards:${roundIndex}:${source.id}:${copyIndex}`,
    pairId: source.id,
    label: source.label,
    emoji: source.emoji
  })));
}

export function createMemoryCardsRound(settings: SessionSettings, roundIndex = 1, random = Math.random): MemoryCardsRound {
  const roundSettings = getMemoryCardsRoundSettings(settings);
  const deck = createMemoryCardDeck(memoryCardSources, roundSettings.pairCount, roundIndex, random);
  return {
    roundId: `memory-cards:round:${roundIndex}`,
    pairCount: roundSettings.pairCount,
    columns: roundSettings.columns,
    cards: shuffleMemoryCards(deck, random)
  };
}
