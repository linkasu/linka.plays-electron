export type FirstThenPhase = "first" | "then";

export type FirstThenAction = {
  id: string;
  title: string;
  phrase: string;
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
  explanation: string;
};

export type FirstThenRoundOptions = {
  pairOrder?: number[];
  choiceOrder?: string[];
  random?: () => number;
};

export const firstThenPairs: FirstThenPair[] = [
  {
    id: "wash-eat",
    first: { id: "wash-hands", title: "Вымыть руки", phrase: "сначала моем руки", emoji: "🧼" },
    then: { id: "eat", title: "Покушать", phrase: "потом едим", emoji: "🍽️" }
  },
  {
    id: "shoes-walk",
    first: { id: "put-shoes", title: "Надеть обувь", phrase: "сначала надеваем обувь", emoji: "👟" },
    then: { id: "walk", title: "Идти гулять", phrase: "потом идём гулять", emoji: "🌳" }
  },
  {
    id: "toothbrush-bed",
    first: { id: "brush-teeth", title: "Почистить зубы", phrase: "сначала чистим зубы", emoji: "🪥" },
    then: { id: "sleep", title: "Лечь спать", phrase: "потом ложимся спать", emoji: "🌙" }
  },
  {
    id: "open-read",
    first: { id: "open-book", title: "Открыть книгу", phrase: "сначала открываем книгу", emoji: "📖" },
    then: { id: "read", title: "Читать", phrase: "потом читаем", emoji: "👀" }
  },
  {
    id: "pour-drink",
    first: { id: "pour-water", title: "Налить воду", phrase: "сначала наливаем воду", emoji: "💧" },
    then: { id: "drink", title: "Попить", phrase: "потом пьём", emoji: "🥤" }
  },
  {
    id: "paint-clean",
    first: { id: "paint", title: "Порисовать", phrase: "сначала рисуем", emoji: "🖍️" },
    then: { id: "clean-up", title: "Убрать карандаши", phrase: "потом убираем карандаши", emoji: "🧺" }
  },
  {
    id: "soap-rinse",
    first: { id: "soap", title: "Намылить руки", phrase: "сначала намыливаем руки", emoji: "🫧" },
    then: { id: "rinse", title: "Смыть пену", phrase: "потом смываем пену", emoji: "🚿" }
  },
  {
    id: "sit-buckle",
    first: { id: "sit", title: "Сесть", phrase: "сначала садимся", emoji: "🪑" },
    then: { id: "buckle", title: "Пристегнуться", phrase: "потом пристёгиваемся", emoji: "🧷" }
  }
];

export function createFirstThenExplanation(pair: FirstThenPair) {
  return `Порядок такой: ${pair.first.phrase}, ${pair.then.phrase}.`;
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
    choices,
    explanation: createFirstThenExplanation(pair)
  };
}
import { shuffleItems } from "../../core/random";
