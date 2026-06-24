export type IWantCardKind = "предмет" | "занятие" | "помощь";

export type IWantCard = {
  id: string;
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
  { id: "water", label: "Воду", phrase: "воду", emoji: "💧", kind: "предмет" },
  { id: "apple", label: "Яблоко", phrase: "яблоко", emoji: "🍎", kind: "предмет" },
  { id: "music", label: "Музыку", phrase: "музыку", emoji: "🎵", kind: "занятие" },
  { id: "book", label: "Книгу", phrase: "книгу", emoji: "📖", kind: "предмет" },
  { id: "ball", label: "Мяч", phrase: "мяч", emoji: "🟡", kind: "предмет" },
  { id: "draw", label: "Рисовать", phrase: "рисовать", emoji: "🖍️", kind: "занятие" },
  { id: "toy", label: "Игрушку", phrase: "игрушку", emoji: "🧸", kind: "предмет" },
  { id: "rest", label: "Отдых", phrase: "отдохнуть", emoji: "🌙", kind: "занятие" },
  { id: "help", label: "Помощь", phrase: "помощь", emoji: "🤝", kind: "помощь" }
];

export function buildIWantPhrase(card: IWantCard | undefined) {
  return card ? `Я хочу ${card.phrase}` : "Я хочу ...";
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
