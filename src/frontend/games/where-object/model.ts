export type WhereObjectPrepositionId = "on" | "under" | "in";
export type WhereObjectPlaceId = "house" | "table" | "bag" | "box";

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
  prepositions: WhereObjectPreposition[];
  correctId: WhereObjectPrepositionId;
  scenePhrase: string;
};

export const whereObjectPrepositions: WhereObjectPreposition[] = [
  { id: "on", label: "на" },
  { id: "under", label: "под" },
  { id: "in", label: "в" }
];

export const whereObjectPlaces: WhereObjectPlace[] = [
  {
    id: "house",
    label: "домик",
    phrases: { on: "на домике", under: "под домиком", in: "в домике" }
  },
  {
    id: "table",
    label: "стол",
    phrases: { on: "на столе", under: "под столом", in: "в ящике стола" }
  },
  {
    id: "bag",
    label: "сумка",
    phrases: { on: "на сумке", under: "под сумкой", in: "в сумке" }
  },
  {
    id: "box",
    label: "коробка",
    phrases: { on: "на коробке", under: "под коробкой", in: "в коробке" }
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

export function generateWhereObjectRound(roundIndex = 1): WhereObjectRound {
  const targetObject = whereObjectItems[(roundIndex - 1) % whereObjectItems.length];
  const targetPlace = whereObjectPlaces[(roundIndex - 1) % whereObjectPlaces.length];
  const targetPreposition = whereObjectPrepositions[(roundIndex - 1) % whereObjectPrepositions.length];
  const scenePhrase = `${targetObject.word} ${phraseFor(targetPlace, targetPreposition)}`;

  return {
    roundId: `where-object:round:${roundIndex}`,
    prompt: `Где ${targetObject.word}?`,
    targetObject,
    targetPlace,
    targetPreposition,
    prepositions: whereObjectPrepositions,
    correctId: targetPreposition.id,
    scenePhrase
  };
}
