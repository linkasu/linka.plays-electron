export type ComicFrame = {
  id: string;
  caption: string;
  color: string;
  /** Drawn frame, public/images/comic-strip/<name>.png. */
  artId: string;
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

// Testers asked for drawn pictures: every frame is one picture with the same girl.
export const comicStories: ComicStory[] = [
  {
    id: "seed",
    title: "Росток",
    prompt: "Собери историю о росте цветка.",
    finalMessage: "Цветок вырос и распустился.",
    frames: [
      {
        id: "seed-seed",
        caption: "Семечко в земле",
        color: "brown-lighten-5",
        artId: "comic-strip/garden-1",
      },
      {
        id: "seed-sprout",
        caption: "Появился росток",
        color: "light-green-lighten-5",
        artId: "comic-strip/garden-2",
      },
      {
        id: "seed-flower",
        caption: "Раскрылся цветок",
        color: "pink-lighten-5",
        artId: "comic-strip/garden-3",
      },
    ],
  },
  {
    id: "tea",
    title: "Тёплый чай",
    prompt: "Собери историю о чаепитии.",
    finalMessage: "Чай готов, можно сделать глоток.",
    frames: [
      {
        id: "tea-cup",
        caption: "Поставили чашку",
        color: "teal-lighten-5",
        artId: "comic-strip/tea-1",
      },
      {
        id: "tea-kettle",
        caption: "Налили чай",
        color: "amber-lighten-5",
        artId: "comic-strip/tea-2",
      },
      {
        id: "tea-ready",
        caption: "Чай готов",
        color: "yellow-lighten-5",
        artId: "comic-strip/tea-3",
      },
    ],
  },
  {
    id: "rainbow",
    title: "После дождя",
    prompt: "Собери историю о погоде.",
    finalMessage: "После дождя небо стало ярким.",
    frames: [
      {
        id: "rainbow-cloud",
        caption: "Набежала тучка",
        color: "blue-grey-lighten-5",
        artId: "comic-strip/rain-1",
      },
      {
        id: "rainbow-rain",
        caption: "Пошёл дождик",
        color: "light-blue-lighten-5",
        artId: "comic-strip/rain-2",
      },
      {
        id: "rainbow-sky",
        caption: "Засияла радуга",
        color: "purple-lighten-5",
        artId: "comic-strip/rain-3",
      },
    ],
  },
  {
    id: "mail",
    title: "Письмо другу",
    prompt: "Собери историю о письме другу.",
    finalMessage: "Друг получил письмо и обрадовался.",
    frames: [
      {
        id: "mail-write",
        caption: "Написали письмо",
        color: "indigo-lighten-5",
        artId: "comic-strip/letter-1",
      },
      {
        id: "mail-send",
        caption: "Опустили в ящик",
        color: "red-lighten-5",
        artId: "comic-strip/letter-2",
      },
      {
        id: "mail-friend",
        caption: "Друг получил письмо",
        color: "green-lighten-5",
        artId: "comic-strip/letter-3",
      },
    ],
  },
  {
    id: "bread",
    title: "Свежий хлеб",
    prompt: "Собери историю о свежем хлебе.",
    finalMessage: "Хлеб испёкся, стал тёплым и ароматным.",
    frames: [
      {
        id: "bread-flour",
        caption: "Замесили тесто",
        color: "brown-lighten-5",
        artId: "comic-strip/bread-1",
      },
      {
        id: "bread-oven",
        caption: "Поставили в печь",
        color: "deep-orange-lighten-5",
        artId: "comic-strip/bread-2",
      },
      {
        id: "bread-ready",
        caption: "Достали хлеб",
        color: "amber-lighten-5",
        artId: "comic-strip/bread-3",
      },
    ],
  },
  {
    id: "snowman",
    title: "Снеговик",
    prompt: "Собери историю о снеговике.",
    finalMessage: "Снеговик стоит и улыбается.",
    frames: [
      {
        id: "snowman-snow",
        caption: "Выпал снег",
        color: "light-blue-lighten-5",
        artId: "comic-strip/snowman-1",
      },
      {
        id: "snowman-roll",
        caption: "Скатали комы",
        color: "blue-lighten-5",
        artId: "comic-strip/snowman-2",
      },
      {
        id: "snowman-ready",
        caption: "Собрали снеговика",
        color: "cyan-lighten-5",
        artId: "comic-strip/snowman-3",
      },
    ],
  },
  {
    id: "house",
    title: "Домик",
    prompt: "Собери историю о строительстве домика.",
    finalMessage: "Домик готов, внутри светло и тепло.",
    frames: [
      {
        id: "house-bricks",
        caption: "Сложили стены",
        color: "red-lighten-5",
        artId: "comic-strip/house-1",
      },
      {
        id: "house-roof",
        caption: "Поставили крышу",
        color: "orange-lighten-5",
        artId: "comic-strip/house-2",
      },
      {
        id: "house-ready",
        caption: "Зажгли свет",
        color: "yellow-lighten-5",
        artId: "comic-strip/house-3",
      },
    ],
  },
  {
    id: "gift",
    title: "Подарок",
    prompt: "Собери историю о подарке другу.",
    finalMessage: "Подарок вручили с улыбкой.",
    frames: [
      {
        id: "gift-box",
        caption: "Взяли коробку",
        color: "purple-lighten-5",
        artId: "comic-strip/gift-1",
      },
      {
        id: "gift-ribbon",
        caption: "Завязали бант",
        color: "pink-lighten-5",
        artId: "comic-strip/gift-2",
      },
      {
        id: "gift-friend",
        caption: "Подарили другу",
        color: "green-lighten-5",
        artId: "comic-strip/gift-3",
      },
    ],
  },
  {
    id: "boat",
    title: "Кораблик",
    prompt: "Собери историю о бумажном кораблике.",
    finalMessage: "Кораблик поплыл по воде.",
    frames: [
      {
        id: "boat-paper",
        caption: "Взяли бумагу",
        color: "grey-lighten-4",
        artId: "comic-strip/boat-1",
      },
      {
        id: "boat-fold",
        caption: "Сложили кораблик",
        color: "indigo-lighten-5",
        artId: "comic-strip/boat-2",
      },
      {
        id: "boat-water",
        caption: "Пустили на воду",
        color: "blue-lighten-5",
        artId: "comic-strip/boat-3",
      },
    ],
  },
  {
    id: "kitten",
    title: "Котёнок",
    prompt: "Собери историю о котёнке.",
    finalMessage: "Котёнок лёг отдыхать и замурлыкал.",
    frames: [
      {
        id: "kitten-walk",
        caption: "Котёнок гулял",
        color: "orange-lighten-5",
        artId: "comic-strip/kitten-1",
      },
      {
        id: "kitten-milk",
        caption: "Попил молоко",
        color: "blue-grey-lighten-5",
        artId: "comic-strip/kitten-2",
      },
      {
        id: "kitten-sleep",
        caption: "Уснул на кроватке",
        color: "deep-purple-lighten-5",
        artId: "comic-strip/kitten-3",
      },
    ],
  },
];

export function createComicStripSlots(
  story: ComicStory,
  placedFrameIds: readonly string[],
): [ComicFrame | undefined, ComicFrame | undefined, ComicFrame | undefined] {
  const placed = new Set(placedFrameIds);
  return story.frames.map((frame) => (placed.has(frame.id) ? frame : undefined)) as [
    ComicFrame | undefined,
    ComicFrame | undefined,
    ComicFrame | undefined,
  ];
}

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

export function getComicFrameChoices(
  story: ComicStory,
  nextFrameIndex: number,
  roundIndex = 1,
): ComicFrame[] {
  const correctFrame = story.frames[nextFrameIndex];
  if (!correctFrame) throw new RangeError("Нет следующего кадра для выбора.");

  const decoys = rotateComicItems(
    comicStories
      .flatMap((comicStory) => comicStory.frames)
      .filter((frame) => frame.id !== correctFrame.id),
    roundIndex + nextFrameIndex * 2,
  ).slice(0, 2);

  return rotateComicItems([correctFrame, ...decoys], roundIndex + nextFrameIndex);
}

export function generateComicStripRound(roundIndex = 1): ComicStripRound {
  return {
    roundId: `comic-strip:round:${roundIndex}`,
    story: getComicStory(roundIndex),
  };
}
