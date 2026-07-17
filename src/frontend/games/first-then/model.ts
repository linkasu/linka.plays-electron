import { shuffleItems } from "../../core/random";

export type FirstThenPhase = "first" | "then";

export type FirstThenAction = {
  id: string;
  title: string;
  emoji: string;
};

export type FirstThenPair = {
  id: string;
  first: FirstThenAction;
  then: FirstThenAction;
};

export type FirstThenRound = {
  roundId: string;
  pair: FirstThenPair;
  phase: FirstThenPhase;
  prompt: string;
  expectedAction: FirstThenAction;
  choices: FirstThenAction[];
};

export type FirstThenTimelineItem = {
  phase: FirstThenPhase;
  label: string;
  action?: FirstThenAction;
};

export type FirstThenRoundOptions = {
  pairOrder?: number[];
  choiceOrder?: string[];
  random?: () => number;
};

export const firstThenPairs: FirstThenPair[] = [
  {
    id: "wash-eat",
    first: { id: "wash-hands", title: "Вымыть руки", emoji: "🧼" },
    then: { id: "eat", title: "Покушать", emoji: "🍽️" }
  },
  {
    id: "shoes-walk",
    first: { id: "put-shoes", title: "Надеть обувь", emoji: "👟" },
    then: { id: "walk", title: "Идти гулять", emoji: "🌳" }
  },
  {
    id: "toothbrush-bed",
    first: { id: "brush-teeth", title: "Почистить зубы", emoji: "🪥" },
    then: { id: "sleep", title: "Лечь спать", emoji: "🌙" }
  },
  {
    id: "open-read",
    first: { id: "open-book", title: "Открыть книгу", emoji: "📖" },
    then: { id: "read", title: "Читать", emoji: "👀" }
  },
  {
    id: "pour-drink",
    first: { id: "pour-water", title: "Налить воду", emoji: "💧" },
    then: { id: "drink", title: "Попить", emoji: "🥤" }
  },
  {
    id: "paint-clean",
    first: { id: "paint", title: "Порисовать", emoji: "🖍️" },
    then: { id: "clean-up", title: "Убрать карандаши", emoji: "🧺" }
  },
  {
    id: "soap-rinse",
    first: { id: "soap", title: "Намылить руки", emoji: "🫧" },
    then: { id: "rinse", title: "Смыть пену", emoji: "🚿" }
  },
  {
    id: "sit-buckle",
    first: { id: "sit", title: "Сесть", emoji: "🪑" },
    then: { id: "buckle", title: "Пристегнуться", emoji: "🧷" }
  }
];

export function createFirstThenTimeline(pair: FirstThenPair, revealedPhases: FirstThenPhase[]): FirstThenTimelineItem[] {
  const revealed = new Set(revealedPhases);
  return [
    { phase: "first", label: "Сначала", action: revealed.has("first") ? pair.first : undefined },
    { phase: "then", label: "Потом", action: revealed.has("then") ? pair.then : undefined }
  ];
}

export function createFirstThenPairOrder(random = Math.random) {
  return shuffleItems(firstThenPairs.map((_, index) => index), random);
}

export function generateFirstThenRound(roundIndex = 1, phase: FirstThenPhase = "first", options: FirstThenRoundOptions = {}): FirstThenRound {
  if (firstThenPairs.length === 0) throw new Error("Недостаточно пар действий для игры Сначала-потом.");

  const pairOrder = options.pairOrder?.length ? options.pairOrder : firstThenPairs.map((_, index) => index);
  const pairIndex = pairOrder[(roundIndex - 1) % pairOrder.length] ?? 0;
  const pair = firstThenPairs[pairIndex] ?? firstThenPairs[0];
  const expectedAction = phase === "first" ? pair.first : pair.then;
  const choices = options.choiceOrder?.length
    ? [pair.first, pair.then].sort((left, right) => options.choiceOrder!.indexOf(left.id) - options.choiceOrder!.indexOf(right.id))
    : shuffleItems([pair.first, pair.then], options.random);

  return {
    roundId: `first-then:round:${roundIndex}:${phase}`,
    pair,
    phase,
    prompt: phase === "first" ? "Что сначала?" : "Что потом?",
    expectedAction,
    choices
  };
}
