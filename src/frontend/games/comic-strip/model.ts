export type ComicFrame = {
  id: string;
  caption: string;
  color: string;
  scene: ComicScene;
};

export type ComicSceneSetting = "desk" | "earth" | "room" | "sky" | "snow" | "table" | "water";
export type ComicScenePosition = "top-left" | "top-center" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom-center" | "bottom-right";
export type ComicSceneSize = "small" | "medium" | "large";

export type ComicSceneLayer =
  | { kind: "word"; wordId: string; word: string; emoji: string; position: ComicScenePosition; size?: ComicSceneSize }
  | { kind: "icon"; icon: string; color: string; position: ComicScenePosition; size?: ComicSceneSize };

export type ComicScene = {
  setting: ComicSceneSetting;
  layers: [ComicSceneLayer, ComicSceneLayer, ...ComicSceneLayer[]];
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

function word(wordId: string, label: string, emoji: string, position: ComicScenePosition, size: ComicSceneSize = "large"): ComicSceneLayer {
  return { kind: "word", wordId, word: label, emoji, position, size };
}

function icon(iconName: string, color: string, position: ComicScenePosition, size: ComicSceneSize = "medium"): ComicSceneLayer {
  return { kind: "icon", icon: iconName, color, position, size };
}

function scene(setting: ComicSceneSetting, first: ComicSceneLayer, second: ComicSceneLayer, ...rest: ComicSceneLayer[]): ComicScene {
  return { setting, layers: [first, second, ...rest] };
}

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
        scene: scene("earth", icon("mdi-seed-outline", "brown-darken-2", "bottom-center", "large"), icon("mdi-shovel", "blue-grey-darken-1", "left"), icon("mdi-arrow-down-bold", "green-darken-2", "top-center", "small"))
      },
      {
        id: "seed-sprout",
        caption: "Появился росток",
        color: "light-green-lighten-5",
        scene: scene("earth", icon("mdi-sprout", "green-darken-2", "bottom-center", "large"), icon("mdi-watering-can-outline", "light-blue-darken-2", "right"), icon("mdi-water", "light-blue-darken-1", "top-right", "small"))
      },
      {
        id: "seed-flower",
        caption: "Раскрылся цветок",
        color: "pink-lighten-5",
        scene: scene("earth", word("flower", "цветок", "🌸", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), icon("mdi-sprout", "green-darken-2", "bottom-left", "small"))
      }
    ]
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
        scene: scene("table", word("cup", "чашка", "☕", "center"), icon("mdi-table-furniture", "brown-darken-1", "bottom-center", "small"))
      },
      {
        id: "tea-kettle",
        caption: "Налили чай",
        color: "amber-lighten-5",
        scene: scene("table", icon("mdi-kettle-outline", "blue-grey-darken-2", "left", "large"), word("cup", "чашка", "☕", "right"), icon("mdi-arrow-right-bold", "amber-darken-2", "center", "small"))
      },
      {
        id: "tea-ready",
        caption: "Чай готов",
        color: "yellow-lighten-5",
        scene: scene("table", word("tea", "чай", "🍵", "left"), word("cookie", "печенье", "🍪", "right", "medium"), icon("mdi-heat-wave", "orange-darken-1", "top-left", "small"))
      }
    ]
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
        scene: scene("sky", word("cloud", "туча", "☁️", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), icon("mdi-weather-windy", "blue-grey-darken-1", "left", "small"))
      },
      {
        id: "rainbow-rain",
        caption: "Пошёл дождик",
        color: "light-blue-lighten-5",
        scene: scene("sky", word("rain", "дождь", "🌧️", "center"), icon("mdi-water", "light-blue-darken-2", "bottom-left", "small"), icon("mdi-water", "light-blue-darken-2", "bottom-right", "small"))
      },
      {
        id: "rainbow-sky",
        caption: "Засияла радуга",
        color: "purple-lighten-5",
        scene: scene("sky", word("rainbow", "радуга", "🌈", "center"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right"), word("cloud", "облако", "☁️", "bottom-left", "small"))
      }
    ]
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
        scene: scene("desk", word("pencil", "карандаш", "✏️", "left"), icon("mdi-email-outline", "indigo-darken-2", "right", "large"), icon("mdi-draw", "blue-darken-1", "top-center", "small"))
      },
      {
        id: "mail-send",
        caption: "Опустили в ящик",
        color: "red-lighten-5",
        scene: scene("room", icon("mdi-email-outline", "indigo-darken-2", "left", "large"), icon("mdi-mailbox-outline", "red-darken-2", "right", "large"), icon("mdi-arrow-right-bold", "blue-grey-darken-1", "center", "small"))
      },
      {
        id: "mail-friend",
        caption: "Друг получил письмо",
        color: "green-lighten-5",
        scene: scene("room", icon("mdi-account-outline", "green-darken-2", "left", "large"), icon("mdi-email-heart-outline", "red-darken-1", "right", "large"), icon("mdi-heart", "pink-darken-1", "top-center", "small"))
      }
    ]
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
        scene: scene("table", icon("mdi-sack-outline", "brown-darken-2", "left", "large"), icon("mdi-bowl-mix-outline", "blue-grey-darken-1", "right", "large"), icon("mdi-spoon-sugar", "amber-darken-2", "top-center", "small"))
      },
      {
        id: "bread-oven",
        caption: "Поставили в печь",
        color: "deep-orange-lighten-5",
        scene: scene("room", word("bread", "хлеб", "🍞", "left"), icon("mdi-stove", "deep-orange-darken-2", "right", "large"), icon("mdi-arrow-right-bold", "brown-darken-1", "center", "small"))
      },
      {
        id: "bread-ready",
        caption: "Достали хлеб",
        color: "amber-lighten-5",
        scene: scene("table", word("bread", "хлеб", "🍞", "center"), icon("mdi-heat-wave", "orange-darken-1", "top-left", "small"), icon("mdi-heat-wave", "orange-darken-1", "top-right", "small"))
      }
    ]
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
        scene: scene("snow", word("snow", "снег", "❄️", "center"), icon("mdi-weather-cloudy", "blue-grey-darken-1", "top-center"), icon("mdi-snowflake", "light-blue-darken-1", "bottom-right", "small"))
      },
      {
        id: "snowman-roll",
        caption: "Скатали комы",
        color: "blue-lighten-5",
        scene: scene("snow", icon("mdi-circle", "blue-grey-lighten-4", "bottom-left", "large"), icon("mdi-circle", "blue-grey-lighten-4", "bottom-right", "medium"), icon("mdi-hand-back-right-outline", "blue-darken-1", "top-right", "small"))
      },
      {
        id: "snowman-ready",
        caption: "Собрали снеговика",
        color: "cyan-lighten-5",
        scene: scene("snow", icon("mdi-snowman", "blue-grey-darken-2", "center", "large"), word("snow", "снег", "❄️", "bottom-left", "small"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-right", "small"))
      }
    ]
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
        scene: scene("earth", icon("mdi-wall", "red-darken-2", "center", "large"), icon("mdi-hammer", "blue-grey-darken-1", "right"), icon("mdi-shovel", "brown-darken-1", "left", "small"))
      },
      {
        id: "house-roof",
        caption: "Поставили крышу",
        color: "orange-lighten-5",
        scene: scene("earth", word("door", "дверь", "🚪", "bottom-center", "medium"), icon("mdi-home-roof", "orange-darken-2", "top-center", "large"), icon("mdi-hammer", "blue-grey-darken-1", "right", "small"))
      },
      {
        id: "house-ready",
        caption: "Зажгли свет",
        color: "yellow-lighten-5",
        scene: scene("earth", word("door", "дверь", "🚪", "left", "medium"), word("window", "окно", "🪟", "right", "medium"), icon("mdi-home-heart", "amber-darken-2", "top-center", "large"))
      }
    ]
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
        scene: scene("room", word("box", "коробка", "📦", "center"), icon("mdi-hand-back-right-outline", "purple-darken-1", "right", "small"))
      },
      {
        id: "gift-ribbon",
        caption: "Завязали бант",
        color: "pink-lighten-5",
        scene: scene("room", word("box", "коробка", "📦", "center"), icon("mdi-ribbon", "pink-darken-2", "top-center", "large"), icon("mdi-gesture-tap", "purple-darken-1", "right", "small"))
      },
      {
        id: "gift-friend",
        caption: "Подарили другу",
        color: "green-lighten-5",
        scene: scene("room", icon("mdi-account-outline", "green-darken-2", "left", "large"), icon("mdi-gift-outline", "pink-darken-2", "right", "large"), icon("mdi-heart", "red-darken-1", "top-center", "small"))
      }
    ]
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
        scene: scene("desk", icon("mdi-file-outline", "blue-grey-darken-1", "center", "large"), word("scissors", "ножницы", "✂️", "right", "medium"))
      },
      {
        id: "boat-fold",
        caption: "Сложили кораблик",
        color: "indigo-lighten-5",
        scene: scene("desk", word("boat", "лодка", "🚣", "center"), icon("mdi-file-outline", "blue-grey-darken-1", "left", "small"), icon("mdi-gesture-tap", "indigo-darken-1", "right", "small"))
      },
      {
        id: "boat-water",
        caption: "Пустили на воду",
        color: "blue-lighten-5",
        scene: scene("water", word("boat", "лодка", "🚣", "center"), word("wave", "волна", "🌊", "bottom-center", "medium"), icon("mdi-weather-windy", "light-blue-darken-2", "top-right", "small"))
      }
    ]
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
        scene: scene("earth", word("cat", "котёнок", "🐱", "center"), word("tree", "дерево", "🌳", "right", "medium"), icon("mdi-white-balance-sunny", "amber-darken-1", "top-left", "small"))
      },
      {
        id: "kitten-milk",
        caption: "Попил молоко",
        color: "blue-grey-lighten-5",
        scene: scene("room", word("cat", "котёнок", "🐱", "left"), word("milk", "молоко", "🥛", "right", "medium"), icon("mdi-bowl-outline", "blue-grey-darken-1", "bottom-center", "small"))
      },
      {
        id: "kitten-sleep",
        caption: "Уснул на кроватке",
        color: "deep-purple-lighten-5",
        scene: scene("room", word("cat", "котёнок", "🐱", "left", "medium"), word("bed", "кровать", "🛏️", "right"), icon("mdi-sleep", "deep-purple-darken-1", "top-center", "small"))
      }
    ]
  }
];

export function createComicStripSlots(story: ComicStory, placedFrameIds: readonly string[]): [ComicFrame | undefined, ComicFrame | undefined, ComicFrame | undefined] {
  const placed = new Set(placedFrameIds);
  return story.frames.map((frame) => placed.has(frame.id) ? frame : undefined) as [ComicFrame | undefined, ComicFrame | undefined, ComicFrame | undefined];
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
