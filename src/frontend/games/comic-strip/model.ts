export type ComicFrame = {
  id: string;
  caption: string;
  icon: string;
  color: string;
  hint: string;
};

export type ComicStory = {
  id: string;
  title: string;
  prompt: string;
  finalMessage: string;
  frames: [ComicFrame, ComicFrame, ComicFrame];
};

export type ComicStripRound = {
  roundId: string;
  story: ComicStory;
};

export const comicStories: ComicStory[] = [
  {
    id: "seed",
    title: "Росток",
    prompt: "Собери историю: семечко становится цветком.",
    finalMessage: "Цветок вырос спокойно и красиво.",
    frames: [
      { id: "seed-plant", caption: "Посадили семечко", icon: "mdi-seed-outline", color: "brown-lighten-5", hint: "сначала появляется семечко" },
      { id: "seed-water", caption: "Полили землю", icon: "mdi-watering-can-outline", color: "blue-lighten-5", hint: "потом семечко поливают" },
      { id: "seed-flower", caption: "Вырос цветок", icon: "mdi-flower", color: "pink-lighten-5", hint: "в конце распускается цветок" }
    ]
  },
  {
    id: "tea",
    title: "Тёплый чай",
    prompt: "Собери историю: чашка ждёт тёплый чай.",
    finalMessage: "Чай готов, можно сделать спокойный глоток.",
    frames: [
      { id: "tea-cup", caption: "Поставили чашку", icon: "mdi-cup-outline", color: "teal-lighten-5", hint: "сначала ставят пустую чашку" },
      { id: "tea-kettle", caption: "Налили чай", icon: "mdi-kettle-outline", color: "amber-lighten-5", hint: "потом наливают тёплый чай" },
      { id: "tea-smile", caption: "Улыбнулись", icon: "mdi-emoticon-happy-outline", color: "yellow-lighten-5", hint: "в конце становится приятно" }
    ]
  },
  {
    id: "rainbow",
    title: "После дождя",
    prompt: "Собери историю: дождик уходит и появляется радуга.",
    finalMessage: "После дождя небо стало ярким.",
    frames: [
      { id: "rainbow-cloud", caption: "Набежала тучка", icon: "mdi-weather-cloudy", color: "blue-grey-lighten-5", hint: "сначала небо закрывает тучка" },
      { id: "rainbow-rain", caption: "Пошёл дождик", icon: "mdi-weather-pouring", color: "light-blue-lighten-5", hint: "потом идёт мягкий дождик" },
      { id: "rainbow-sun", caption: "Засияла радуга", icon: "mdi-weather-rainy", color: "purple-lighten-5", hint: "в конце появляется радуга" }
    ]
  },
  {
    id: "mail",
    title: "Письмо другу",
    prompt: "Собери историю: письмо отправляется другу.",
    finalMessage: "Друг получил письмо и обрадовался.",
    frames: [
      { id: "mail-write", caption: "Написали письмо", icon: "mdi-pencil-outline", color: "indigo-lighten-5", hint: "сначала письмо пишут" },
      { id: "mail-send", caption: "Опустили в ящик", icon: "mdi-mailbox-outline", color: "red-lighten-5", hint: "потом письмо отправляют" },
      { id: "mail-friend", caption: "Друг получил", icon: "mdi-account-heart-outline", color: "green-lighten-5", hint: "в конце друг получает письмо" }
    ]
  },
  {
    id: "bread",
    title: "Свежий хлеб",
    prompt: "Собери историю: тесто становится хлебом.",
    finalMessage: "Хлеб испёкся тёплым и мягким.",
    frames: [
      { id: "bread-flour", caption: "Насыпали муку", icon: "mdi-sack-outline", color: "brown-lighten-5", hint: "сначала берут муку" },
      { id: "bread-oven", caption: "Поставили в печь", icon: "mdi-stove", color: "deep-orange-lighten-5", hint: "потом хлеб печётся" },
      { id: "bread-ready", caption: "Достали хлеб", icon: "mdi-bread-slice-outline", color: "amber-lighten-5", hint: "в конце хлеб готов" }
    ]
  },
  {
    id: "snowman",
    title: "Снеговик",
    prompt: "Собери историю: снежный ком становится снеговиком.",
    finalMessage: "Снеговик стоит и улыбается.",
    frames: [
      { id: "snowman-snow", caption: "Выпал снег", icon: "mdi-snowflake", color: "light-blue-lighten-5", hint: "сначала появляется снег" },
      { id: "snowman-roll", caption: "Скатали ком", icon: "mdi-circle-outline", color: "blue-lighten-5", hint: "потом катают снежный ком" },
      { id: "snowman-ready", caption: "Собрали снеговика", icon: "mdi-snowman", color: "cyan-lighten-5", hint: "в конце получается снеговик" }
    ]
  },
  {
    id: "house",
    title: "Домик",
    prompt: "Собери историю: строим маленький домик.",
    finalMessage: "Домик готов, внутри спокойно и тепло.",
    frames: [
      { id: "house-bricks", caption: "Принесли кирпичи", icon: "mdi-wall", color: "red-lighten-5", hint: "сначала нужны кирпичи" },
      { id: "house-roof", caption: "Поставили крышу", icon: "mdi-home-roof", color: "orange-lighten-5", hint: "потом ставят крышу" },
      { id: "house-ready", caption: "Зажгли свет", icon: "mdi-home-heart", color: "yellow-lighten-5", hint: "в конце в доме горит свет" }
    ]
  },
  {
    id: "gift",
    title: "Подарок",
    prompt: "Собери историю: подарок готовят и дарят.",
    finalMessage: "Подарок подарили с улыбкой.",
    frames: [
      { id: "gift-box", caption: "Взяли коробку", icon: "mdi-package-variant-closed", color: "purple-lighten-5", hint: "сначала нужна коробка" },
      { id: "gift-ribbon", caption: "Завязали бант", icon: "mdi-ribbon", color: "pink-lighten-5", hint: "потом завязывают бант" },
      { id: "gift-smile", caption: "Подарили другу", icon: "mdi-gift-outline", color: "green-lighten-5", hint: "в конце подарок дарят" }
    ]
  },
  {
    id: "boat",
    title: "Кораблик",
    prompt: "Собери историю: бумажный кораблик плывёт.",
    finalMessage: "Кораблик спокойно поплыл по воде.",
    frames: [
      { id: "boat-paper", caption: "Взяли бумагу", icon: "mdi-file-outline", color: "grey-lighten-4", hint: "сначала берут лист бумаги" },
      { id: "boat-fold", caption: "Сложили кораблик", icon: "mdi-sail-boat", color: "indigo-lighten-5", hint: "потом складывают кораблик" },
      { id: "boat-water", caption: "Пустили на воду", icon: "mdi-waves", color: "blue-lighten-5", hint: "в конце кораблик плывёт" }
    ]
  },
  {
    id: "kitten",
    title: "Котёнок",
    prompt: "Собери историю: котёнок находит уютное место.",
    finalMessage: "Котёнок лёг отдыхать и замурлыкал.",
    frames: [
      { id: "kitten-walk", caption: "Котёнок гулял", icon: "mdi-cat", color: "orange-lighten-5", hint: "сначала котёнок гуляет" },
      { id: "kitten-bowl", caption: "Попил молоко", icon: "mdi-bowl-mix-outline", color: "blue-grey-lighten-5", hint: "потом котёнок пьёт молоко" },
      { id: "kitten-sleep", caption: "Уснул на коврике", icon: "mdi-sleep", color: "deep-purple-lighten-5", hint: "в конце котёнок отдыхает" }
    ]
  }
];

export function rotateComicItems<T>(items: T[], offset: number): T[] {
  if (!items.length) return [];
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function getComicStory(roundIndex = 1): ComicStory {
  if (!comicStories.length) throw new Error("Недостаточно историй для игры.");
  const safeRoundIndex = Number.isFinite(roundIndex) ? Math.max(1, Math.floor(roundIndex)) : 1;
  return comicStories[(safeRoundIndex - 1) % comicStories.length];
}

export function getComicFrameChoices(story: ComicStory, nextFrameIndex: number, roundIndex = 1): ComicFrame[] {
  const correctFrame = story.frames[nextFrameIndex];
  if (!correctFrame) throw new RangeError("Нет следующего кадра для выбора.");

  const decoys = rotateComicItems(
    comicStories.flatMap((comicStory) => comicStory.frames).filter((frame) => frame.id !== correctFrame.id),
    roundIndex + nextFrameIndex * 2
  ).slice(0, 2);

  return rotateComicItems([correctFrame, ...decoys], roundIndex + nextFrameIndex);
}

export function generateComicStripRound(roundIndex = 1): ComicStripRound {
  return {
    roundId: `comic-strip:round:${roundIndex}`,
    story: getComicStory(roundIndex)
  };
}
