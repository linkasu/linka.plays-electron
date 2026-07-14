export type WantDontWantAnswer = "want" | "dont-want";

export type WantDontWantItem = {
  id: string;
  wordId?: string;
  title: string;
  emoji: string;
  kind: "предмет" | "занятие";
};

export type WantDontWantChoice = {
  id: WantDontWantAnswer;
  title: string;
  emoji: string;
  confirmation: string;
};

export type WantDontWantRound = {
  roundId: string;
  prompt: string;
  item: WantDontWantItem;
  choices: WantDontWantChoice[];
};

export const wantDontWantChoices: WantDontWantChoice[] = [
  { id: "want", title: "Хочу", emoji: "💛", confirmation: "Хочу" },
  { id: "dont-want", title: "Не хочу", emoji: "🤍", confirmation: "Не хочу" }
];

export const wantDontWantItems: WantDontWantItem[] = [
  { id: "water", title: "пить воду", emoji: "💧", kind: "предмет" },
  { id: "apple", wordId: "apple", title: "есть яблоко", emoji: "🍎", kind: "предмет" },
  { id: "music", title: "слушать музыку", emoji: "🎵", kind: "занятие" },
  { id: "book", wordId: "book", title: "читать книгу", emoji: "📖", kind: "предмет" },
  { id: "ball", wordId: "ball", title: "играть в мяч", emoji: "🟡", kind: "предмет" },
  { id: "draw", title: "рисовать", emoji: "🖍️", kind: "занятие" },
  { id: "toy", wordId: "toy", title: "играть с игрушкой", emoji: "🧸", kind: "предмет" },
  { id: "rest", title: "отдыхать", emoji: "🌙", kind: "занятие" },
  { id: "hug", title: "обнять", emoji: "🫶", kind: "занятие" }
];

export function generateWantDontWantRound(roundIndex = 1): WantDontWantRound {
  if (wantDontWantItems.length === 0) throw new Error("Недостаточно предметов для игры Хочу / не хочу.");

  const item = wantDontWantItems[(roundIndex - 1) % wantDontWantItems.length];
  return {
    roundId: `want-dont-want:round:${roundIndex}`,
    prompt: "Скажи, подходит тебе сейчас?",
    item,
    choices: wantDontWantChoices
  };
}
