import { shuffleItems } from "../../core/random";

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
  return round.targetPreposition.id === choice.id;
}

type WhereObjectDeckEntry = {
  targetObject: WhereObjectItem;
  targetPreposition: WhereObjectPreposition;
};

function buildWhereObjectRound(roundIndex: number, entry: WhereObjectDeckEntry, random: () => number): WhereObjectRound {
  const normalizedIndex = Math.max(1, Math.floor(roundIndex));
  const { targetObject, targetPreposition } = entry;
  const targetPlace = whereObjectPlaces[0];
  const scenePhrase = `${targetObject.word} ${phraseFor(targetPlace, targetPreposition)}`;
  const choices = shuffleItems(whereObjectPrepositions.map<WhereObjectChoice>((preposition) => ({
    id: preposition.id,
    preposition,
    targetObject,
    targetPlace,
    scenePhrase: `${targetObject.word} ${phraseFor(targetPlace, preposition)}`,
    answerAssetId: preposition.id === "beside"
      ? undefined
      : `where-object.answer.${targetObject.id}.${targetPlace.id}.${preposition.id}`
  })), random);

  return {
    roundId: `where-object:round:${normalizedIndex}`,
    prompt: `Покажи: ${scenePhrase}.`,
    targetObject,
    targetPlace,
    targetPreposition,
    choices,
    scenePhrase
  };
}

function createWhereObjectDeck(random: () => number) {
  const objects = shuffleItems(whereObjectItems, random);
  const prepositions = shuffleItems(whereObjectPrepositions, random);
  const phases = shuffleItems(prepositions.map((_, index) => index), random);

  return phases.flatMap((phase) => shuffleItems(objects.map<WhereObjectDeckEntry>((targetObject, objectIndex) => ({
    targetObject,
    targetPreposition: prepositions[(Math.floor(objectIndex / 2) + phase) % prepositions.length]
  })), random));
}

export function createWhereObjectRoundGenerator(random = Math.random) {
  let deck: WhereObjectDeckEntry[] = [];

  return (roundIndex = 1): WhereObjectRound => {
    if (deck.length === 0) deck = createWhereObjectDeck(random);
    const entry = deck.shift();
    if (!entry) throw new Error("Не удалось создать колоду пространственных сцен.");
    return buildWhereObjectRound(roundIndex, entry, random);
  };
}
