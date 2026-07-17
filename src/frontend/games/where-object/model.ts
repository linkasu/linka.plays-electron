export type WhereObjectPrepositionId = "on" | "under" | "in" | "beside";
export type WhereObjectPlaceId = "box";

export type WhereObjectPreposition = {
  id: WhereObjectPrepositionId;
  label: string;
};

export type WhereObjectPlace = {
  id: WhereObjectPlaceId;
  label: string;
  phrases: Record<WhereObjectPrepositionId, string>;
};

export type WhereObjectItem = {
  id: string;
  word: string;
  emoji: string;
};

export type WhereObjectRound = {
  roundId: string;
  prompt: string;
  targetObject: WhereObjectItem;
  targetPlace: WhereObjectPlace;
  targetPreposition: WhereObjectPreposition;
  choices: WhereObjectChoice[];
  correctChoice: WhereObjectChoice;
  correctId: WhereObjectPrepositionId;
  scenePhrase: string;
};

export type WhereObjectChoice = {
  id: WhereObjectPrepositionId;
  preposition: WhereObjectPreposition;
  targetObject: WhereObjectItem;
  targetPlace: WhereObjectPlace;
  scenePhrase: string;
  answerAssetId?: string;
};

export const whereObjectPrepositions: WhereObjectPreposition[] = [
  { id: "on", label: "на" },
  { id: "under", label: "под" },
  { id: "in", label: "в" },
  { id: "beside", label: "рядом" }
];

export const whereObjectPlaces: WhereObjectPlace[] = [
  {
    id: "box",
    label: "коробка",
    phrases: { on: "на коробке", under: "под коробкой", in: "в коробке", beside: "рядом с коробкой" }
  }
];

export const whereObjectItems: WhereObjectItem[] = [
  { id: "ball", word: "мяч", emoji: "⚽" },
  { id: "book", word: "книга", emoji: "📘" },
  { id: "toy", word: "игрушка", emoji: "🧸" },
  { id: "key", word: "ключ", emoji: "🔑" },
  { id: "cup", word: "чашка", emoji: "☕" },
  { id: "spoon", word: "ложка", emoji: "🥄" },
  { id: "phone", word: "телефон", emoji: "📱" },
  { id: "brush", word: "щётка", emoji: "🪥" }
];

export function phraseFor(place: WhereObjectPlace, preposition: WhereObjectPreposition) {
  return place.phrases[preposition.id];
}

export function isWhereObjectCorrect(round: WhereObjectRound, choice: WhereObjectChoice) {
  return round.correctId === choice.id;
}

export function generateWhereObjectRound(roundIndex = 1): WhereObjectRound {
  const normalizedIndex = Math.max(1, Math.floor(roundIndex));
  const targetObject = whereObjectItems[(normalizedIndex - 1) % whereObjectItems.length];
  const targetPlace = whereObjectPlaces[0];
  const targetPreposition = whereObjectPrepositions[(normalizedIndex - 1) % whereObjectPrepositions.length];
  const scenePhrase = `${targetObject.word} ${phraseFor(targetPlace, targetPreposition)}`;
  const unorderedChoices = whereObjectPrepositions.map<WhereObjectChoice>((preposition) => ({
    id: preposition.id,
    preposition,
    targetObject,
    targetPlace,
    scenePhrase: `${targetObject.word} ${phraseFor(targetPlace, preposition)}`,
    answerAssetId: preposition.id === "beside"
      ? undefined
      : `where-object.answer.${targetObject.id}.${targetPlace.id}.${preposition.id}`
  }));
  const choices = unorderedChoices;
  const correctChoice = choices.find((choice) => choice.id === targetPreposition.id);
  if (!correctChoice) throw new Error("Не удалось создать правильную пространственную сцену.");

  return {
    roundId: `where-object:round:${normalizedIndex}`,
    prompt: `Где ${targetObject.word}? Покажи картинку.`,
    targetObject,
    targetPlace,
    targetPreposition,
    choices,
    correctChoice,
    correctId: targetPreposition.id,
    scenePhrase
  };
}
