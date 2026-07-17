export type WantDontWantAnswer = "want" | "dont-want";

export type WantDontWantItem = {
  id: string;
  wordId: string;
  title: string;
  emoji: string;
  kind: "предмет" | "занятие";
  phrases: {
    want: string;
    dontWant: string;
  };
};

export type WantDontWantChoice = {
  id: WantDontWantAnswer;
  title: string;
  emoji: string;
};

export type WantDontWantRound = {
  roundId: string;
  prompt: string;
  item: WantDontWantItem;
  choices: WantDontWantChoice[];
};

export const wantDontWantChoices: WantDontWantChoice[] = [
  { id: "want", title: "Я хочу", emoji: "💛" },
  { id: "dont-want", title: "Я не хочу", emoji: "🤍" }
];

export const wantDontWantItems: WantDontWantItem[] = [
  { id: "water", wordId: "cup", title: "пить воду", emoji: "💧", kind: "предмет", phrases: { want: "Я хочу пить воду", dontWant: "Я не хочу пить воду" } },
  { id: "apple", wordId: "apple", title: "есть яблоко", emoji: "🍎", kind: "предмет", phrases: { want: "Я хочу есть яблоко", dontWant: "Я не хочу есть яблоко" } },
  { id: "music", wordId: "drum", title: "слушать музыку", emoji: "🎵", kind: "занятие", phrases: { want: "Я хочу слушать музыку", dontWant: "Я не хочу слушать музыку" } },
  { id: "book", wordId: "book", title: "читать книгу", emoji: "📖", kind: "предмет", phrases: { want: "Я хочу читать книгу", dontWant: "Я не хочу читать книгу" } },
  { id: "ball", wordId: "ball", title: "играть в мяч", emoji: "🟡", kind: "предмет", phrases: { want: "Я хочу играть в мяч", dontWant: "Я не хочу играть в мяч" } },
  { id: "draw", wordId: "pencil", title: "рисовать", emoji: "🖍️", kind: "занятие", phrases: { want: "Я хочу рисовать", dontWant: "Я не хочу рисовать" } },
  { id: "toy", wordId: "toy", title: "играть с игрушкой", emoji: "🧸", kind: "предмет", phrases: { want: "Я хочу играть с игрушкой", dontWant: "Я не хочу играть с игрушкой" } },
  { id: "rest", wordId: "bed", title: "отдыхать", emoji: "🌙", kind: "занятие", phrases: { want: "Я хочу отдыхать", dontWant: "Я не хочу отдыхать" } },
  { id: "hug", wordId: "heart", title: "обниматься", emoji: "🫶", kind: "занятие", phrases: { want: "Я хочу обниматься", dontWant: "Я не хочу обниматься" } }
];

export function wantDontWantPhrase(item: WantDontWantItem, answer: WantDontWantAnswer) {
  return answer === "want" ? item.phrases.want : item.phrases.dontWant;
}

export function wantDontWantPhraseAssetId(item: WantDontWantItem, answer: WantDontWantAnswer) {
  return `want-dont-want.phrase.${answer}.${item.id}`;
}

export function createWantDontWantCommunication(item: WantDontWantItem, answer: WantDontWantAnswer) {
  const phrase = wantDontWantPhrase(item, answer);
  return {
    phrase,
    expected: "valid-communication" as const,
    actual: phrase,
    isCorrect: true as const,
    noFail: true as const
  };
}

export function generateWantDontWantRound(roundIndex = 1): WantDontWantRound {
  if (wantDontWantItems.length === 0) throw new Error("Недостаточно предметов для игры Хочу / не хочу.");

  const item = wantDontWantItems[(roundIndex - 1) % wantDontWantItems.length];
  return {
    roundId: `want-dont-want:round:${roundIndex}`,
    prompt: "Что ты выбираешь сейчас?",
    item,
    choices: wantDontWantChoices
  };
}
