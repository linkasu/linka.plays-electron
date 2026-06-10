export type WhatFirstAction = {
  id: string;
  title: string;
  aacLabel: string;
  phrase: string;
  emoji: string;
};

export type WhatFirstScene = {
  id: string;
  title: string;
  context: string;
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
    first: { id: "wash-hands", title: "Вымыть руки", aacLabel: "мыть", phrase: "моем руки", emoji: "🧼" },
    then: { id: "eat", title: "Есть", aacLabel: "есть", phrase: "едим", emoji: "🍽️" }
  },
  {
    id: "shoes-walk",
    title: "На прогулку",
    context: "Мы собираемся выйти на улицу.",
    first: { id: "put-shoes", title: "Надеть обувь", aacLabel: "обувь", phrase: "надеваем обувь", emoji: "👟" },
    then: { id: "walk", title: "Гулять", aacLabel: "гулять", phrase: "идём гулять", emoji: "🌳" }
  },
  {
    id: "brush-sleep",
    title: "Перед сном",
    context: "Вечером пора готовиться ко сну.",
    first: { id: "brush-teeth", title: "Почистить зубы", aacLabel: "зубы", phrase: "чистим зубы", emoji: "🪥" },
    then: { id: "sleep", title: "Спать", aacLabel: "спать", phrase: "ложимся спать", emoji: "🛏️" }
  },
  {
    id: "open-read",
    title: "Книга",
    context: "Мы хотим посмотреть историю.",
    first: { id: "open-book", title: "Открыть книгу", aacLabel: "открыть", phrase: "открываем книгу", emoji: "📖" },
    then: { id: "read", title: "Читать", aacLabel: "читать", phrase: "читаем", emoji: "👀" }
  },
  {
    id: "pour-drink",
    title: "Попить воды",
    context: "В стакане пока пусто.",
    first: { id: "pour-water", title: "Налить воду", aacLabel: "налить", phrase: "наливаем воду", emoji: "💧" },
    then: { id: "drink", title: "Пить", aacLabel: "пить", phrase: "пьём", emoji: "🥤" }
  },
  {
    id: "soap-rinse",
    title: "Моем руки",
    context: "На руках появилась пена.",
    first: { id: "soap", title: "Намылить", aacLabel: "мыло", phrase: "намыливаем руки", emoji: "🫧" },
    then: { id: "rinse", title: "Смыть", aacLabel: "смыть", phrase: "смываем пену", emoji: "🚿" }
  },
  {
    id: "sit-buckle",
    title: "В кресле",
    context: "Нужно безопасно сесть перед дорогой.",
    first: { id: "sit", title: "Сесть", aacLabel: "сесть", phrase: "садимся", emoji: "🪑" },
    then: { id: "buckle", title: "Пристегнуться", aacLabel: "ремень", phrase: "пристёгиваемся", emoji: "🧷" }
  },
  {
    id: "peel-eat",
    title: "Банан",
    context: "Мы хотим съесть банан.",
    first: { id: "peel", title: "Очистить", aacLabel: "чистить", phrase: "чистим банан", emoji: "🍌" },
    then: { id: "bite", title: "Кусать", aacLabel: "есть", phrase: "кушаем банан", emoji: "😋" }
  }
];

export function createWhatFirstExplanation(scene: WhatFirstScene) {
  return `Сначала ${scene.first.phrase}, потом ${scene.then.phrase}.`;
}

export function generateWhatFirstRound(roundIndex = 1): WhatFirstRound {
  if (whatFirstScenes.length === 0) throw new Error("Недостаточно сцен для игры Что сначала?");

  const scene = whatFirstScenes[(roundIndex - 1) % whatFirstScenes.length];
  const choices = roundIndex % 2 === 0 ? [scene.then, scene.first] : [scene.first, scene.then];

  return {
    roundId: `what-first:round:${roundIndex}`,
    scene,
    prompt: "Что сначала?",
    expectedAction: scene.first,
    choices,
    explanation: createWhatFirstExplanation(scene)
  };
}
