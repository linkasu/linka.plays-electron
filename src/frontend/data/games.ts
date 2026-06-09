export type GameInfo = {
  id: string;
  title: string;
  description: string;
  selfDescription: string;
  route: string;
  category: GameCategoryId;
  icon: string;
  skills: GameSkill[];
  status: GameStatus;
  recommendedSessionSeconds: number;
  minTargetSizePx: number;
  defaultDwellMs: number;
};

export type GameStatus = "planned" | "mvp" | "therapy-ready" | "polished";

export const gameCategoryOrder = [
  "gaze-basics",
  "visual-search",
  "sequencing",
  "language-aac",
  "numeracy",
  "strategy",
  "continuous-control"
] as const;

export type GameCategoryId = (typeof gameCategoryOrder)[number];

export type GameSkill =
  | "fixation"
  | "smooth-pursuit"
  | "attention-shift"
  | "visual-search"
  | "choice"
  | "aac"
  | "vocabulary"
  | "classification"
  | "sequence"
  | "counting"
  | "math"
  | "typing"
  | "continuous-control";

export const gameCategories: Record<GameCategoryId, string> = {
  "gaze-basics": "Основы взгляда",
  "visual-search": "Поиск и внимание",
  sequencing: "Последовательности",
  "language-aac": "Слова и AAC",
  numeracy: "Счёт и математика",
  strategy: "Спокойные настольные игры",
  "continuous-control": "Непрерывное управление"
};

export const gameCategoryDescriptions: Record<GameCategoryId, string> = {
  "gaze-basics": "Первые спокойные игры для фиксации, переключения и мягкого попадания взглядом.",
  "visual-search": "Задания, где нужно найти объект, удержать цель и не спешить.",
  sequencing: "Игры с порядком действий, сборкой и понятной очередностью шагов.",
  "language-aac": "Выбор картинок, слов и смысловых категорий для коммуникации.",
  numeracy: "Количество, числа и простые арифметические действия крупными целями.",
  strategy: "Очередность, планирование хода и спокойный выбор без давления времени.",
  "continuous-control": "Плавное слежение и мягкое управление движением взглядом."
};

export const selfMenuCategoryLabels: Record<GameCategoryId, string> = {
  "gaze-basics": "Смотреть",
  "visual-search": "Искать",
  sequencing: "Собирать",
  "language-aac": "Слова",
  numeracy: "Считать",
  strategy: "Играть вместе",
  "continuous-control": "Управлять"
};

export const selfMenuCategoryDescriptions: Record<GameCategoryId, string> = {
  "gaze-basics": "Смотри спокойно, цель откликнется.",
  "visual-search": "Найди, кто спрятался.",
  sequencing: "Выбирай по порядку.",
  "language-aac": "Выбери картинку или слово.",
  numeracy: "Посчитай и выбери ответ.",
  strategy: "Сделай ход без спешки.",
  "continuous-control": "Веди движение взглядом."
};

export const gameSkillLabels: Record<GameSkill, string> = {
  fixation: "фиксация",
  "smooth-pursuit": "слежение",
  "attention-shift": "переключение",
  "visual-search": "поиск",
  choice: "выбор",
  aac: "AAC",
  vocabulary: "словарь",
  classification: "классификация",
  sequence: "последовательность",
  counting: "счёт",
  math: "арифметика",
  typing: "печать",
  "continuous-control": "непрерывное управление"
};

export const gameStatusLabels: Record<GameStatus, string> = {
  planned: "Запланировано",
  mvp: "MVP",
  "therapy-ready": "Для занятий",
  polished: "Готово"
};

export const games: GameInfo[] = [
  {
    id: "butterfly",
    title: "Бабочки",
    description: "Смотри на мягкие световые пятна и буди бабочек взглядом.",
    selfDescription: "Разбуди бабочек взглядом.",
    route: "/games/butterfly",
    category: "gaze-basics",
    icon: "mdi-butterfly",
    skills: ["fixation", "attention-shift"],
    status: "polished",
    recommendedSessionSeconds: 60,
    minTargetSizePx: 180,
    defaultDwellMs: 900
  },
  {
    id: "flowers",
    title: "Цветы",
    description: "Находи новый росток на лугу и мягко выращивай цветок взглядом.",
    selfDescription: "Вырасти цветок.",
    route: "/games/flowers",
    category: "gaze-basics",
    icon: "mdi-flower",
    skills: ["fixation", "attention-shift", "visual-search"],
    status: "therapy-ready",
    recommendedSessionSeconds: 75,
    minTargetSizePx: 170,
    defaultDwellMs: 1100
  },
  {
    id: "ducks",
    title: "Утки",
    description: "Следи за утками на волнах и мягко попадай по ним взглядом.",
    selfDescription: "Найди утку на воде.",
    route: "/games/ducks",
    category: "gaze-basics",
    icon: "mdi-duck",
    skills: ["visual-search", "fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 60,
    minTargetSizePx: 160,
    defaultDwellMs: 850
  },
  {
    id: "fishes",
    title: "Рыбки",
    description: "Лови спокойных рыбок взглядом в мягком подводном мире.",
    selfDescription: "Поймай рыбку взглядом.",
    route: "/games/fishes",
    category: "gaze-basics",
    icon: "mdi-fish",
    skills: ["smooth-pursuit", "fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 60,
    minTargetSizePx: 160,
    defaultDwellMs: 850
  },
  {
    id: "frog",
    title: "Жаба",
    description: "Помоги жабе ловить светлячков взглядом без спешки и стресса.",
    selfDescription: "Помоги жабе поймать огонёк.",
    route: "/games/frog",
    category: "gaze-basics",
    icon: "mdi-bug",
    skills: ["attention-shift", "choice"],
    status: "polished",
    recommendedSessionSeconds: 90,
    minTargetSizePx: 140,
    defaultDwellMs: 900
  },
  {
    id: "hide-and-seek",
    title: "Прятки",
    description: "Ищи спрятанных персонажей на спокойных иллюстрациях.",
    selfDescription: "Найди спрятанного друга.",
    route: "/games/hide-and-seek",
    category: "visual-search",
    icon: "mdi-magnify",
    skills: ["visual-search", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 130,
    defaultDwellMs: 1200
  },
  {
    id: "memory-cards",
    title: "Пары",
    description: "Открывай две карточки и находи одинаковые пары без спешки.",
    selfDescription: "Найди одинаковые карточки.",
    route: "/games/memory-cards",
    category: "visual-search",
    icon: "mdi-cards",
    skills: ["visual-search", "choice", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 180,
    minTargetSizePx: 150,
    defaultDwellMs: 1300
  },
  {
    id: "pyramid",
    title: "Пирамидка",
    description: "Собирай кольца по порядку и тренируй последовательность.",
    selfDescription: "Собери кольца по порядку.",
    route: "/games/pyramid",
    category: "sequencing",
    icon: "mdi-pyramid",
    skills: ["sequence", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 120,
    defaultDwellMs: 1200
  },
  {
    id: "choose-picture",
    title: "Выбери картинку",
    description: "Слушай слово и выбирай подходящую картинку взглядом.",
    selfDescription: "Найди нужную картинку.",
    route: "/games/choose-picture",
    category: "language-aac",
    icon: "mdi-image-search",
    skills: ["aac", "vocabulary", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1200
  },
  {
    id: "eat-or-not-eat",
    title: "Съедобное",
    description: "Сортируй предметы на съедобные и несъедобные.",
    selfDescription: "Выбери, что можно есть.",
    route: "/games/eat-or-not-eat",
    category: "language-aac",
    icon: "mdi-food-apple",
    skills: ["classification", "aac", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1200
  },
  {
    id: "type-word",
    title: "Печать слов",
    description: "Собирай короткие слова из крупных букв взглядом.",
    selfDescription: "Собери слово.",
    route: "/games/type-word",
    category: "language-aac",
    icon: "mdi-keyboard",
    skills: ["typing", "vocabulary", "sequence"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 96,
    defaultDwellMs: 1200
  },
  {
    id: "count-items",
    title: "Счёт",
    description: "Посчитай предметы и выбери правильное число.",
    selfDescription: "Посчитай предметы.",
    route: "/games/count-items",
    category: "numeracy",
    icon: "mdi-counter",
    skills: ["counting", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 160,
    defaultDwellMs: 1200
  },
  {
    id: "math-actions",
    title: "Математика. Операции",
    description: "Решай простые примеры и вводи ответ крупными кнопками.",
    selfDescription: "Выбери ответ.",
    route: "/games/math-actions",
    category: "numeracy",
    icon: "mdi-calculator-variant",
    skills: ["math", "typing"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 96,
    defaultDwellMs: 1200
  },
  {
    id: "tic-tac-toe",
    title: "Крестики-нолики",
    description: "Играй крестиками против спокойного Deep-Q агента на классическом поле 3×3.",
    selfDescription: "Сделай ход.",
    route: "/games/tic-tac-toe",
    category: "strategy",
    icon: "mdi-grid-large",
    skills: ["choice", "sequence", "attention-shift"],
    status: "polished",
    recommendedSessionSeconds: 180,
    minTargetSizePx: 128,
    defaultDwellMs: 1300
  },
  {
    id: "connect-four",
    title: "4 в ряд",
    description: "Собирай четыре фишки в ряд против спокойного Deep-Q агента.",
    selfDescription: "Поставь фишку.",
    route: "/games/connect-four",
    category: "strategy",
    icon: "mdi-dots-grid",
    skills: ["choice", "sequence", "attention-shift"],
    status: "polished",
    recommendedSessionSeconds: 180,
    minTargetSizePx: 140,
    defaultDwellMs: 1450
  },
  {
    id: "table-tennis",
    title: "Теннис",
    description: "Веди мягкую ракетку взглядом и вместе с партнёром спокойно держи мяч в игре.",
    selfDescription: "Веди ракетку.",
    route: "/games/table-tennis",
    category: "continuous-control",
    icon: "mdi-table-tennis",
    skills: ["continuous-control", "smooth-pursuit"],
    status: "polished",
    recommendedSessionSeconds: 90,
    minTargetSizePx: 160,
    defaultDwellMs: 1000
  }
];

export function groupGamesByCategory(inputGames: GameInfo[] = games) {
  return gameCategoryOrder
    .map((category) => ({
      category,
      label: gameCategories[category],
      description: gameCategoryDescriptions[category],
      selfLabel: selfMenuCategoryLabels[category],
      selfDescription: selfMenuCategoryDescriptions[category],
      games: inputGames.filter((game) => game.category === category)
    }))
    .filter((group) => group.games.length > 0);
}

export function findGame(gameId: string | string[]) {
  const id = Array.isArray(gameId) ? gameId[0] : gameId;
  return games.find((game) => game.id === id);
}
