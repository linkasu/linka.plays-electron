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
    id: "breathing-flower",
    title: "Дышащий цветок",
    description: "Смотри спокойно в центр цветка, и он будет мягко раскрываться и закрываться.",
    selfDescription: "Подыши вместе с цветком.",
    route: "/games/breathing-flower",
    category: "gaze-basics",
    icon: "mdi-flower",
    skills: ["fixation", "smooth-pursuit"],
    status: "therapy-ready",
    recommendedSessionSeconds: 85,
    minTargetSizePx: 220,
    defaultDwellMs: 1400
  },
  {
    id: "firefly-meadow",
    title: "Светлячковая поляна",
    description: "Смотри на тихую поляну и мягко зажигай светлячков взглядом.",
    selfDescription: "Зажги светлячков взглядом.",
    route: "/games/firefly-meadow",
    category: "gaze-basics",
    icon: "mdi-lightbulb-night",
    skills: ["fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 75,
    minTargetSizePx: 180,
    defaultDwellMs: 1350
  },
  {
    id: "starry-sky",
    title: "Звёздное небо",
    description: "Смотри на тихое небо и мягко соединяй звёзды световыми линиями.",
    selfDescription: "Зажги звёзды взглядом.",
    route: "/games/starry-sky",
    category: "gaze-basics",
    icon: "mdi-star",
    skills: ["fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 80,
    minTargetSizePx: 170,
    defaultDwellMs: 1200
  },
  {
    id: "big-button",
    title: "Большая кнопка",
    description: "Первая спокойная игра: смотри на одну большую кнопку и получай мягкий отклик.",
    selfDescription: "Посмотри на большую кнопку.",
    route: "/games/big-button",
    category: "gaze-basics",
    icon: "mdi-radiobox-marked",
    skills: ["fixation"],
    status: "therapy-ready",
    recommendedSessionSeconds: 70,
    minTargetSizePx: 240,
    defaultDwellMs: 1500
  },
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
    id: "quiet-bubbles",
    title: "Тихие пузыри",
    description: "Лопай крупные пузыри взглядом на спокойном пастельном фоне.",
    selfDescription: "Лопни пузыри взглядом.",
    route: "/games/quiet-bubbles",
    category: "gaze-basics",
    icon: "mdi-water-circle",
    skills: ["fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 75,
    minTargetSizePx: 190,
    defaultDwellMs: 1200
  },
  {
    id: "rain-garden",
    title: "Сад дождя",
    description: "Смотри на листья и воду, чтобы вызывать мягкие круги под спокойным дождём.",
    selfDescription: "Сделай круги на воде взглядом.",
    route: "/games/rain-garden",
    category: "gaze-basics",
    icon: "mdi-weather-rainy",
    skills: ["fixation", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 75,
    minTargetSizePx: 176,
    defaultDwellMs: 1300
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
    id: "find-color",
    title: "Найди цвет",
    description: "Найди нужный цвет среди крупных карточек.",
    selfDescription: "Найди нужный цвет.",
    route: "/games/find-color",
    category: "visual-search",
    icon: "mdi-palette",
    skills: ["visual-search", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1200
  },
  {
    id: "match-same",
    title: "Где такой же?",
    description: "Найди картинку, которая совпадает с образцом.",
    selfDescription: "Найди такую же картинку.",
    route: "/games/match-same",
    category: "visual-search",
    icon: "mdi-image-search",
    skills: ["visual-search", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
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
    id: "tower",
    title: "Башня",
    description: "Выбирай крупные блоки и спокойно строй башню без ошибок и падений.",
    selfDescription: "Построй башню.",
    route: "/games/tower",
    category: "sequencing",
    icon: "mdi-office-building-outline",
    skills: ["sequence", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 136,
    defaultDwellMs: 1200
  },
  {
    id: "train-sequence",
    title: "Поезд",
    description: "Прицепляй вагоны по подсказанному порядку цвета и номера.",
    selfDescription: "Прицепи вагоны.",
    route: "/games/train-sequence",
    category: "sequencing",
    icon: "mdi-train",
    skills: ["sequence", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 150,
    defaultDwellMs: 1200
  },
  {
    id: "patterns",
    title: "Паттерны",
    description: "Продолжай ряд крупных фигур и цветов по повторяющемуся паттерну.",
    selfDescription: "Продолжи ряд.",
    route: "/games/patterns",
    category: "sequencing",
    icon: "mdi-dots-grid",
    skills: ["sequence", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 150,
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
    id: "yes-no",
    title: "Да / нет",
    description: "Отвечай да или нет на простой вопрос с картинкой.",
    selfDescription: "Ответь да или нет.",
    route: "/games/yes-no",
    category: "language-aac",
    icon: "mdi-check-circle-outline",
    skills: ["aac", "choice", "vocabulary"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1300
  },
  {
    id: "want-dont-want",
    title: "Хочу / не хочу",
    description: "Выбирай, хочешь ли мягкий предмет или занятие: любой ответ считается важной коммуникацией.",
    selfDescription: "Скажи, хочешь или не хочешь.",
    route: "/games/want-dont-want",
    category: "language-aac",
    icon: "mdi-hand-heart",
    skills: ["aac", "choice", "vocabulary"],
    status: "therapy-ready",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 220,
    defaultDwellMs: 1300
  },
  {
    id: "mini-dialog",
    title: "Мини-диалог",
    description: "Выбирай мягкие реплики для короткого AAC-диалога без неправильных ответов.",
    selfDescription: "Ответь партнёру.",
    route: "/games/mini-dialog",
    category: "language-aac",
    icon: "mdi-chat-outline",
    skills: ["aac", "choice", "vocabulary"],
    status: "therapy-ready",
    recommendedSessionSeconds: 135,
    minTargetSizePx: 180,
    defaultDwellMs: 1350
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
    id: "greater-less",
    title: "Больше / меньше",
    description: "Сравни две группы предметов и выбери, где больше или меньше.",
    selfDescription: "Выбери, где больше.",
    route: "/games/greater-less",
    category: "numeracy",
    icon: "mdi-compare-horizontal",
    skills: ["counting", "choice"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 160,
    defaultDwellMs: 1200
  },
  {
    id: "shapes",
    title: "Формы",
    description: "Находи нужную форму среди крупных контрастных карточек.",
    selfDescription: "Найди нужную форму.",
    route: "/games/shapes",
    category: "numeracy",
    icon: "mdi-shape",
    skills: ["choice", "classification"],
    status: "polished",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
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
    id: "calm-2048",
    title: "2048 мягкий",
    description: "Сдвигай плитки 4×4 и спокойно собирай одинаковые числа без резкого проигрыша.",
    selfDescription: "Собери одинаковые плитки.",
    route: "/games/calm-2048",
    category: "strategy",
    icon: "mdi-grid-large",
    skills: ["choice", "sequence", "counting"],
    status: "therapy-ready",
    recommendedSessionSeconds: 180,
    minTargetSizePx: 132,
    defaultDwellMs: 1100
  },
  {
    id: "calm-tetris",
    title: "Тетрис спокойный",
    description: "Ставь фигуры пошагово: выбери колонку, поверни и мягко опусти без спешки.",
    selfDescription: "Поставь фигуру на место.",
    route: "/games/calm-tetris",
    category: "strategy",
    icon: "mdi-view-grid-plus",
    skills: ["choice", "sequence"],
    status: "therapy-ready",
    recommendedSessionSeconds: 180,
    minTargetSizePx: 116,
    defaultDwellMs: 1100
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
    id: "calm-snake",
    title: "Змейка спокойная",
    description: "Веди медленную змейку по мягкой сетке: края и столкновения дают подсказку, а не проигрыш.",
    selfDescription: "Помоги змейке найти листочки.",
    route: "/games/calm-snake",
    category: "strategy",
    icon: "mdi-snake",
    skills: ["choice", "sequence", "attention-shift"],
    status: "therapy-ready",
    recommendedSessionSeconds: 165,
    minTargetSizePx: 150,
    defaultDwellMs: 1100
  },
  {
    id: "boat",
    title: "Лодочка",
    description: "Веди лодочку взглядом по спокойной реке и проходи мягкие checkpoints без столкновений и штрафов.",
    selfDescription: "Веди лодочку по реке.",
    route: "/games/boat",
    category: "continuous-control",
    icon: "mdi-sail-boat",
    skills: ["continuous-control", "smooth-pursuit"],
    status: "therapy-ready",
    recommendedSessionSeconds: 135,
    minTargetSizePx: 150,
    defaultDwellMs: 500
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
  },
  {
    id: "maze-path",
    title: "Лабиринт-дорожка",
    description: "Веди мягкий свет по широкой дорожке к финишу без сбросов и резких ошибок.",
    selfDescription: "Веди свет по дорожке.",
    route: "/games/maze-path",
    category: "continuous-control",
    icon: "mdi-vector-polyline",
    skills: ["continuous-control", "smooth-pursuit"],
    status: "therapy-ready",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1000
  },
  {
    id: "garden-watering",
    title: "Садовая лейка",
    description: "Веди лейку взглядом и мягко поливай цветы в любом порядке.",
    selfDescription: "Полей цветы взглядом.",
    route: "/games/garden-watering",
    category: "continuous-control",
    icon: "mdi-watering-can",
    skills: ["continuous-control", "smooth-pursuit"],
    status: "therapy-ready",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 150,
    defaultDwellMs: 1200
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
