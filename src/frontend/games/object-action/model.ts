export type ObjectActionPair = {
  id: string;
  objectTitle: string;
  objectEmoji: string;
  actionTitle: string;
  actionEmoji: string;
  phrase: string;
};

export type ObjectActionChoice = {
  id: string;
  title: string;
  emoji: string;
};

export type ObjectActionRound = {
  roundId: string;
  prompt: string;
  pair: ObjectActionPair;
  choices: ObjectActionChoice[];
  correctChoice: ObjectActionChoice;
  explanation: string;
};

export const objectActionPairs: ObjectActionPair[] = [
  { id: "ball-roll", objectTitle: "мяч", objectEmoji: "🟡", actionTitle: "катить", actionEmoji: "↔️", phrase: "мяч катить" },
  { id: "spoon-eat", objectTitle: "ложка", objectEmoji: "🥄", actionTitle: "есть", actionEmoji: "🍽️", phrase: "ложкой есть" },
  { id: "cup-drink", objectTitle: "чашка", objectEmoji: "🥤", actionTitle: "пить", actionEmoji: "💧", phrase: "из чашки пить" },
  { id: "book-read", objectTitle: "книга", objectEmoji: "📖", actionTitle: "читать", actionEmoji: "👀", phrase: "книгу читать" },
  { id: "soap-wash", objectTitle: "мыло", objectEmoji: "🧼", actionTitle: "мыть", actionEmoji: "🫧", phrase: "мылом мыть" },
  { id: "pencil-draw", objectTitle: "карандаш", objectEmoji: "🖍️", actionTitle: "рисовать", actionEmoji: "🎨", phrase: "карандашом рисовать" },
  { id: "key-open", objectTitle: "ключ", objectEmoji: "🔑", actionTitle: "открывать", actionEmoji: "🚪", phrase: "ключом открывать" },
  { id: "brush-comb", objectTitle: "щётка", objectEmoji: "🪮", actionTitle: "расчёсывать", actionEmoji: "💇", phrase: "щёткой расчёсывать" }
];

export function createObjectActionExplanation(pair: ObjectActionPair) {
  return `Подходит пара: ${pair.phrase}.`;
}

export function generateObjectActionRound(roundIndex = 1): ObjectActionRound {
  if (objectActionPairs.length < 4) throw new Error("Недостаточно пар предмет-действие для игры.");

  const pair = objectActionPairs[(roundIndex - 1) % objectActionPairs.length];
  const correctChoice = { id: pair.id, title: pair.actionTitle, emoji: pair.actionEmoji };
  const distractors = objectActionPairs
    .filter((item) => item.id !== pair.id)
    .slice(roundIndex % objectActionPairs.length)
    .concat(objectActionPairs.filter((item) => item.id !== pair.id))
    .slice(0, 3)
    .map((item) => ({ id: item.id, title: item.actionTitle, emoji: item.actionEmoji }));
  const choices = [correctChoice, ...distractors].sort((left, right) => left.id.localeCompare(right.id));

  return {
    roundId: `object-action:round:${roundIndex}`,
    prompt: `Что делают с предметом: ${pair.objectTitle}?`,
    pair,
    choices,
    correctChoice,
    explanation: createObjectActionExplanation(pair)
  };
}
