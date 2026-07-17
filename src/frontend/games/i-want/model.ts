export type IWantCardKind = "предмет" | "занятие" | "помощь";

export type IWantCard = {
  id: string;
  wordId: string;
  label: string;
  phrase: string;
  emoji: string;
  kind: IWantCardKind;
};

export type IWantRound = {
  roundId: string;
  prompt: string;
  cards: IWantCard[];
};

export const iWantCards: IWantCard[] = [
  { id: "water", wordId: "cup", label: "Воду", phrase: "Я хочу воду", emoji: "💧", kind: "предмет" },
  { id: "apple", wordId: "apple", label: "Яблоко", phrase: "Я хочу яблоко", emoji: "🍎", kind: "предмет" },
  { id: "music", wordId: "drum", label: "Музыку", phrase: "Я хочу музыку", emoji: "🎵", kind: "занятие" },
  { id: "book", wordId: "book", label: "Книгу", phrase: "Я хочу книгу", emoji: "📖", kind: "предмет" },
  { id: "ball", wordId: "ball", label: "Мяч", phrase: "Я хочу мяч", emoji: "🟡", kind: "предмет" },
  { id: "draw", wordId: "pencil", label: "Рисовать", phrase: "Я хочу рисовать", emoji: "🖍️", kind: "занятие" },
  { id: "toy", wordId: "toy", label: "Игрушку", phrase: "Я хочу игрушку", emoji: "🧸", kind: "предмет" },
  { id: "rest", wordId: "bed", label: "Отдых", phrase: "Я хочу отдохнуть", emoji: "🌙", kind: "занятие" },
  { id: "help", wordId: "hand", label: "Помощь", phrase: "Я хочу помощь", emoji: "🤝", kind: "помощь" }
];

export function buildIWantPhrase(card: IWantCard | undefined) {
  return card?.phrase ?? "Я хочу...";
}

export function iWantCardAssetId(card: IWantCard) {
  return `i-want.card.${card.id}`;
}

export function iWantPhraseAssetId(card: IWantCard) {
  return `i-want.phrase.${card.id}`;
}

export function createIWantCommunication(card: IWantCard) {
  return {
    phrase: card.phrase,
    expected: "valid-communication" as const,
    actual: card.phrase,
    isCorrect: true as const,
    noFail: true as const
  };
}

export function generateIWantRound(roundIndex = 1): IWantRound {
  if (iWantCards.length < 6) throw new Error("Недостаточно карточек для игры Я хочу.");

  const offset = (roundIndex - 1) % iWantCards.length;
  return {
    roundId: `i-want:round:${roundIndex}`,
    prompt: "Что ты хочешь сейчас? Любая карточка подходит.",
    cards: [...iWantCards.slice(offset), ...iWantCards.slice(0, offset)].slice(0, 6)
  };
}
