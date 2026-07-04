export type ObjectActionPair = {
  id: string;
  objectTitle: string;
  objectEmoji: string;
  validActionIds: string[];
  phrases: Record<string, string>;
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
  correctChoices: ObjectActionChoice[];
  explanation: string;
};

export const objectActionChoices: ObjectActionChoice[] = [
  { id: "roll", title: "катить", emoji: "↔️" },
  { id: "eat", title: "есть", emoji: "🍽️" },
  { id: "drink", title: "пить", emoji: "💧" },
  { id: "read", title: "читать", emoji: "👀" },
  { id: "wash", title: "мыть", emoji: "🫧" },
  { id: "draw", title: "рисовать", emoji: "🎨" },
  { id: "open", title: "открывать", emoji: "🚪" },
  { id: "comb", title: "расчёсывать", emoji: "💇" }
];

export const objectActionPairs: ObjectActionPair[] = [
  { id: "ball", objectTitle: "мяч", objectEmoji: "🟡", validActionIds: ["roll"], phrases: { roll: "мяч катить" } },
  { id: "spoon", objectTitle: "ложка", objectEmoji: "🥄", validActionIds: ["eat", "wash"], phrases: { eat: "ложкой есть", wash: "ложку мыть" } },
  { id: "cup", objectTitle: "чашка", objectEmoji: "🥤", validActionIds: ["drink", "wash"], phrases: { drink: "из чашки пить", wash: "чашку мыть" } },
  { id: "book", objectTitle: "книга", objectEmoji: "📖", validActionIds: ["read", "open"], phrases: { read: "книгу читать", open: "книгу открывать" } },
  { id: "soap", objectTitle: "мыло", objectEmoji: "🧼", validActionIds: ["wash"], phrases: { wash: "мылом мыть" } },
  { id: "pencil", objectTitle: "карандаш", objectEmoji: "🖍️", validActionIds: ["draw"], phrases: { draw: "карандашом рисовать" } },
  { id: "key", objectTitle: "ключ", objectEmoji: "🔑", validActionIds: ["open"], phrases: { open: "ключом открывать" } },
  { id: "brush", objectTitle: "щётка", objectEmoji: "🪮", validActionIds: ["comb"], phrases: { comb: "щёткой расчёсывать" } }
];

export function createObjectActionExplanation(pair: ObjectActionPair, actionId = pair.validActionIds[0]) {
  return `Подходит: ${phraseForAction(pair, actionId)}.`;
}

export function isObjectActionCorrect(pair: ObjectActionPair, choice: ObjectActionChoice) {
  return pair.validActionIds.includes(choice.id);
}

export function phraseForAction(pair: ObjectActionPair, actionId: string) {
  return pair.phrases[actionId] ?? `${pair.objectTitle} ${actionTitle(actionId)}`;
}

function actionTitle(actionId: string) {
  return objectActionChoices.find((choice) => choice.id === actionId)?.title ?? actionId;
}

export function generateObjectActionRound(roundIndex = 1): ObjectActionRound {
  if (objectActionPairs.length < 4) throw new Error("Недостаточно пар предмет-действие для игры.");

  const pair = objectActionPairs[(roundIndex - 1) % objectActionPairs.length];
  const correctChoices = objectActionChoices.filter((choice) => pair.validActionIds.includes(choice.id));
  const distractors = objectActionChoices
   .filter((choice) => !pair.validActionIds.includes(choice.id))
   .slice(roundIndex % objectActionChoices.length)
   .concat(objectActionChoices.filter((choice) => !pair.validActionIds.includes(choice.id)))
   .slice(0, Math.max(0, 4 - correctChoices.length));
  const choices = [...correctChoices, ...distractors].sort((left, right) => left.id.localeCompare(right.id));

  return {
    roundId: `object-action:round:${roundIndex}`,
    prompt: `Что можно делать с предметом: ${pair.objectTitle}?`,
    pair,
    choices,
    correctChoices,
    explanation: createObjectActionExplanation(pair)
  };
}
