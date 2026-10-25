import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type OppositeConcept = {
  id: string;
  label: string;
  emoji: string;
  tone: string;
  referenceId: string;
  visualState: string;
  assetId?: string;
  stateMarker?: string;
  /** Drawn picture of this exact state (core/gameArt.ts); no marker or CSS state needed. */
  artId?: string;
};

export type OppositePair = {
  id: string;
  concepts: [OppositeConcept, OppositeConcept];
};

export type OppositesRound = {
  roundId: string;
  prompt: string;
  source: OppositeConcept;
  target: OppositeConcept;
  choices: OppositeConcept[];
  correctIndex: number;
  pairId: string;
};

function concept(
  id: string,
  label: string,
  emoji: string,
  tone: string,
  referenceId: string,
  visualState: string,
  assetId?: string,
  stateMarker?: string,
): OppositeConcept {
  return { id, label, emoji, tone, referenceId, visualState, assetId, stateMarker };
}

function drawn(
  id: string,
  label: string,
  emoji: string,
  tone: string,
  referenceId: string,
): OppositeConcept {
  return { id, label, emoji, tone, referenceId, visualState: id, artId: `opposites/${id}` };
}

// Testers: «заменить картинки». Only drawn pairs are used; happy/sad waits for
// its pictures. Wet/dry came with the drawings.
export const oppositePairs: OppositePair[] = [
  {
    id: "temperature",
    concepts: [
      drawn("hot", "горячий", "☕", "deep-orange", "cup"),
      drawn("cold", "холодный", "☕", "light-blue", "cup"),
    ],
  },
  {
    id: "size",
    concepts: [
      drawn("big", "большой", "⚽", "indigo", "ball"),
      drawn("small", "маленький", "⚽", "teal", "ball"),
    ],
  },
  {
    id: "light",
    concepts: [
      drawn("day", "день", "🏠", "amber", "house"),
      drawn("night", "ночь", "🏠", "blue", "house"),
    ],
  },
  {
    id: "state",
    concepts: [
      drawn("open", "открытый", "🚪", "green", "door"),
      drawn("closed", "закрытый", "🚪", "blue-grey", "door"),
    ],
  },
  {
    id: "amount",
    concepts: [
      drawn("full", "полный", "🧺", "brown", "basket"),
      drawn("empty", "пустой", "🧺", "grey", "basket"),
    ],
  },
  {
    id: "wetness",
    concepts: [
      drawn("wet", "мокрый", "💧", "cyan", "towel"),
      drawn("dry", "сухой", "☀️", "orange", "towel"),
    ],
  },
  {
    id: "direction",
    concepts: [
      drawn("up", "вверх", "⬆️", "purple", "balloon"),
      drawn("down", "вниз", "⬇️", "cyan", "balloon"),
    ],
  },
  {
    id: "speed",
    concepts: [
      drawn("fast", "быстрый", "🚗", "pink", "car"),
      drawn("slow", "медленный", "🐢", "lime", "car"),
    ],
  },
];

export const oppositesArtIds = oppositePairs.flatMap((pair) =>
  pair.concepts.map((item) => item.artId).filter((artId): artId is string => Boolean(artId)),
);

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle" || settings.distractors === "none") return 3;
  return 4;
}

export function generateOppositesRound(
  settings: SessionSettings,
  roundIndex = 1,
  random = Math.random,
): OppositesRound {
  const choiceCount = choiceCountFor(settings);
  const [pair] = shuffleItems(oppositePairs, random);
  const sourceIndex = random() < 0.5 ? 0 : 1;
  const source = pair.concepts[sourceIndex];
  const target = pair.concepts[sourceIndex === 0 ? 1 : 0];
  const distractorPool = shuffleItems(
    oppositePairs.filter((item) => item.id !== pair.id).flatMap((item) => item.concepts),
    random,
  );
  const choices = shuffleItems([target, ...distractorPool.slice(0, choiceCount - 1)], random);

  return {
    roundId: `opposites:round:${roundIndex}`,
    prompt: `Найди противоположность слову «${source.label}»`,
    source,
    target,
    choices,
    correctIndex: choices.indexOf(target),
    pairId: pair.id,
  };
}
