import type { SessionSettings } from "../../core/settings";
import { getWordsByCategory, shuffleItems, type WordItem } from "../../data/wordBank";

export type WhereObjectPrepositionId = "on" | "under" | "in";
export type WhereObjectMode = "place" | "preposition";

export type WhereObjectPreposition = {
  id: WhereObjectPrepositionId;
  label: string;
  promptLabel: string;
};

export type WhereObjectPlace = {
  id: string;
  label: string;
  icon: string;
  color: string;
  phrases: Record<WhereObjectPrepositionId, string>;
};

export type WhereObjectRound = {
  roundId: string;
  mode: WhereObjectMode;
  prompt: string;
  targetObject: WordItem;
  targetPlace: WhereObjectPlace;
  targetPreposition: WhereObjectPreposition;
  places: WhereObjectPlace[];
  prepositions: WhereObjectPreposition[];
  correctId: string;
};

export const whereObjectPrepositions: WhereObjectPreposition[] = [
  { id: "on", label: "на", promptLabel: "на" },
  { id: "under", label: "под", promptLabel: "под" },
  { id: "in", label: "в", promptLabel: "в" }
];

export const whereObjectPlaces: WhereObjectPlace[] = [
  {
    id: "box",
    label: "коробка",
    icon: "mdi-package-variant-closed",
    color: "brown-lighten-3",
    phrases: { on: "на коробке", under: "под коробкой", in: "в коробке" }
  },
  {
    id: "basket",
    label: "корзина",
    icon: "mdi-basket-outline",
    color: "amber-lighten-3",
    phrases: { on: "на корзине", under: "под корзиной", in: "в корзине" }
  },
  {
    id: "bag",
    label: "сумка",
    icon: "mdi-bag-personal-outline",
    color: "pink-lighten-4",
    phrases: { on: "на сумке", under: "под сумкой", in: "в сумке" }
  },
  {
    id: "house",
    label: "домик",
    icon: "mdi-home-outline",
    color: "blue-lighten-4",
    phrases: { on: "на домике", under: "под домиком", in: "в домике" }
  },
  {
    id: "table",
    label: "стол",
    icon: "mdi-table-furniture",
    color: "green-lighten-4",
    phrases: { on: "на столе", under: "под столом", in: "в ящике стола" }
  }
];

const objectWords = getWordsByCategory("thing").filter((word) => !["chair", "sofa", "bed", "door", "window"].includes(word.id));

function placeCountFor(settings: SessionSettings, roundIndex: number) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3 + (roundIndex % 2);
}

export function phraseFor(place: WhereObjectPlace, preposition: WhereObjectPreposition) {
  return place.phrases[preposition.id];
}

export function generateWhereObjectRound(settings: SessionSettings, roundIndex = 1): WhereObjectRound {
  if (objectWords.length < 2) throw new Error("WhereObjectGame needs at least two object words.");

  const placeCount = Math.min(whereObjectPlaces.length, placeCountFor(settings, roundIndex));
  const targetObject = objectWords[(roundIndex - 1) % objectWords.length];
  const targetPreposition = whereObjectPrepositions[(roundIndex - 1) % whereObjectPrepositions.length];
  const places = shuffleItems(whereObjectPlaces).slice(0, placeCount);
  const targetPlace = places[(roundIndex + targetPreposition.id.length) % places.length];
  const mode: WhereObjectMode = roundIndex % 2 === 0 ? "preposition" : "place";

  return {
    roundId: `where-object:round:${roundIndex}`,
    mode,
    prompt: mode === "place"
      ? `Где ${targetObject.word}?`
      : `Где ${targetObject.word}: на, под или в?`,
    targetObject,
    targetPlace,
    targetPreposition,
    places,
    prepositions: whereObjectPrepositions,
    correctId: mode === "place" ? targetPlace.id : targetPreposition.id
  };
}
