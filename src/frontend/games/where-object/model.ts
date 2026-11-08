import { shuffleItems } from "../../core/random";

export type WhereObjectPrepositionId = "on" | "under" | "in" | "beside";
export type WhereObjectPlaceId = "table" | "box";

export type WhereObjectPreposition = {
  id: WhereObjectPrepositionId;
  label: string;
};

export type WhereObjectPlace = {
  id: WhereObjectPlaceId;
  label: string;
  phrases: Partial<Record<WhereObjectPrepositionId, string>>;
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
  { id: "beside", label: "рядом" },
];

// Testers: «непонятна картинка над, под, в». A thing lies on a table, under a table,
// next to a table, and in a box: each picture is one a child already knows.
export const whereObjectPlaces: WhereObjectPlace[] = [
  {
    id: "table",
    label: "стол",
    phrases: {
      on: "на столе",
      under: "под столом",
      beside: "рядом со столом",
    },
  },
  {
    id: "box",
    label: "коробка",
    phrases: {
      in: "в коробке",
    },
  },
];

export function placeFor(preposition: WhereObjectPreposition): WhereObjectPlace {
  const place = whereObjectPlaces.find((item) => item.phrases[preposition.id]);
  if (!place) throw new Error(`Нет места для предлога «${preposition.label}».`);
  return place;
}

export const whereObjectItems: WhereObjectItem[] = [
  { id: "ball", word: "мяч", emoji: "⚽" },
  { id: "book", word: "книга", emoji: "📘" },
  { id: "toy", word: "игрушка", emoji: "🧸" },
  { id: "key", word: "ключ", emoji: "🔑" },
  { id: "cup", word: "чашка", emoji: "☕" },
  { id: "spoon", word: "ложка", emoji: "🥄" },
  { id: "phone", word: "телефон", emoji: "📱" },
  { id: "brush", word: "щётка", emoji: "🪥" },
];

export function phraseFor(place: WhereObjectPlace, preposition: WhereObjectPreposition) {
  const phrase = place.phrases[preposition.id];
  if (!phrase) throw new Error(`У места «${place.label}» нет фразы для «${preposition.label}».`);
  return phrase;
}

export function isWhereObjectCorrect(round: WhereObjectRound, choice: WhereObjectChoice) {
  return round.targetPreposition.id === choice.id;
}

type WhereObjectDeckEntry = {
  targetObject: WhereObjectItem;
  targetPreposition: WhereObjectPreposition;
};

function buildWhereObjectRound(
  roundIndex: number,
  entry: WhereObjectDeckEntry,
  random: () => number,
): WhereObjectRound {
  const normalizedIndex = Math.max(1, Math.floor(roundIndex));
  const { targetObject, targetPreposition } = entry;
  const targetPlace = placeFor(targetPreposition);
  const scenePhrase = `${targetObject.word} ${phraseFor(targetPlace, targetPreposition)}`;
  const choices = shuffleItems(
    whereObjectPrepositions.map<WhereObjectChoice>((preposition) => {
      const place = placeFor(preposition);
      return {
        id: preposition.id,
        preposition,
        targetObject,
        targetPlace: place,
        scenePhrase: `${targetObject.word} ${phraseFor(place, preposition)}`,
        answerAssetId: `where-object.answer.${targetObject.id}.${place.id}.${preposition.id}`,
      };
    }),
    random,
  );

  return {
    roundId: `where-object:round:${normalizedIndex}`,
    prompt: `Покажи: ${scenePhrase}.`,
    targetObject,
    targetPlace,
    targetPreposition,
    choices,
    scenePhrase,
  };
}

function createWhereObjectDeck(random: () => number) {
  const objects = shuffleItems(whereObjectItems, random);
  const prepositions = shuffleItems(whereObjectPrepositions, random);
  const phases = shuffleItems(
    prepositions.map((_, index) => index),
    random,
  );

  return phases.flatMap((phase) =>
    shuffleItems(
      objects.map<WhereObjectDeckEntry>((targetObject, objectIndex) => ({
        targetObject,
        targetPreposition:
          prepositions[(Math.floor(objectIndex / 2) + phase) % prepositions.length],
      })),
      random,
    ),
  );
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
