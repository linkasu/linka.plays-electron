import { shuffleItems } from "../../core/random";

export type WhatFirstAction = {
  id: string;
  title: string;
  aacLabel: string;
  phrase: string;
  emoji: string;
};

export type WhatFirstContextVisual = {
  emoji: string;
  label: string;
};

export type WhatFirstScene = {
  id: string;
  title: string;
  context: string;
  contextVisual: WhatFirstContextVisual;
  first: WhatFirstAction;
  then: WhatFirstAction;
};

export type WhatFirstRound = {
  roundId: string;
  scene: WhatFirstScene;
  prompt: string;
  expectedAction: WhatFirstAction;
  choices: WhatFirstAction[];
  explanation: string;
};

export const whatFirstScenes: WhatFirstScene[] = [
  {
    id: "wash-eat",
    title: "Перед едой",
    context: "Мы хотим сесть за стол.",
    contextVisual: { emoji: "🍴", label: "Стол перед едой" },
    first: { id: "wash-hands", title: "Вымыть руки", aacLabel: "мыть", phrase: "моем руки", emoji: "🧼" },
    then: { id: "eat", title: "Есть", aacLabel: "есть", phrase: "едим", emoji: "🍽️" }
  },
  {
    id: "shoes-walk",
    title: "На прогулку",
    context: "Мы собираемся выйти на улицу.",
    contextVisual: { emoji: "🚪", label: "Выход на улицу" },
    first: { id: "put-shoes", title: "Надеть обувь", aacLabel: "обувь", phrase: "надеваем обувь", emoji: "👟" },
    then: { id: "walk", title: "Гулять", aacLabel: "гулять", phrase: "идём гулять", emoji: "🌳" }
  },
  {
    id: "brush-sleep",
    title: "Перед сном",
    context: "Вечером пора готовиться ко сну.",
    contextVisual: { emoji: "🌙", label: "Вечер дома" },
    first: { id: "brush-teeth", title: "Почистить зубы", aacLabel: "зубы", phrase: "чистим зубы", emoji: "🪥" },
    then: { id: "sleep", title: "Спать", aacLabel: "спать", phrase: "ложимся спать", emoji: "🛏️" }
  },
  {
    id: "open-read",
    title: "Книга",
    context: "Мы хотим посмотреть историю.",
    contextVisual: { emoji: "📚", label: "Книжная история" },
    first: { id: "open-book", title: "Открыть книгу", aacLabel: "открыть", phrase: "открываем книгу", emoji: "📖" },
    then: { id: "read", title: "Читать", aacLabel: "читать", phrase: "читаем", emoji: "👀" }
  },
  {
    id: "pour-drink",
    title: "Попить воды",
    context: "В стакане пока пусто.",
    contextVisual: { emoji: "🚰", label: "Вода для питья" },
    first: { id: "pour-water", title: "Налить воду", aacLabel: "налить", phrase: "наливаем воду", emoji: "💧" },
    then: { id: "drink", title: "Пить", aacLabel: "пить", phrase: "пьём", emoji: "🥤" }
  },
  {
    id: "soap-rinse",
    title: "Моем руки",
    context: "На руках появилась пена.",
    contextVisual: { emoji: "👐", label: "Руки у раковины" },
    first: { id: "soap", title: "Намылить", aacLabel: "мыло", phrase: "намыливаем руки", emoji: "🫧" },
    then: { id: "rinse", title: "Смыть", aacLabel: "смыть", phrase: "смываем пену", emoji: "🚿" }
  },
  {
    id: "sit-buckle",
    title: "В кресле",
    context: "Нужно безопасно сесть перед дорогой.",
    contextVisual: { emoji: "🚗", label: "Поездка в машине" },
    first: { id: "sit", title: "Сесть", aacLabel: "сесть", phrase: "садимся", emoji: "🪑" },
    then: { id: "buckle", title: "Пристегнуться", aacLabel: "ремень", phrase: "пристёгиваемся", emoji: "🧷" }
  },
  {
    id: "peel-eat",
    title: "Банан",
    context: "Мы хотим съесть банан.",
    contextVisual: { emoji: "🧺", label: "Корзинка с фруктами" },
    first: { id: "peel", title: "Очистить", aacLabel: "чистить", phrase: "чистим банан", emoji: "🍌" },
    then: { id: "bite", title: "Кусать", aacLabel: "есть", phrase: "кушаем банан", emoji: "😋" }
  }
];

export function createWhatFirstExplanation(scene: WhatFirstScene) {
  return `Сначала ${scene.first.phrase}, потом ${scene.then.phrase}.`;
}

function buildRound(scene: WhatFirstScene, roundIndex: number, random: () => number): WhatFirstRound {
  const choices = shuffleItems([scene.first, scene.then], random);

  return {
    roundId: `what-first:round:${roundIndex}`,
    scene,
    prompt: "Что сначала?",
    expectedAction: scene.first,
    choices,
    explanation: createWhatFirstExplanation(scene)
  };
}

export function createWhatFirstDeck(random = Math.random): WhatFirstRound[] {
  if (whatFirstScenes.length !== 8) throw new Error("Для игры «Что сначала?» нужны ровно восемь сцен.");
  return shuffleItems(whatFirstScenes, random).map((scene, index) => buildRound(scene, index + 1, random));
}

export function generateWhatFirstRound(roundIndex = 1, random = Math.random): WhatFirstRound {
  const safeIndex = Math.max(1, Math.floor(roundIndex));
  const round = createWhatFirstDeck(random)[(safeIndex - 1) % whatFirstScenes.length];
  return { ...round, roundId: `what-first:round:${safeIndex}` };
}
