export type GameInfo = {
  id: string;
  title: string;
  description: string;
  route: string;
  category: string;
  icon: string;
  skills: GameSkill[];
  status: GameStatus;
  recommendedSessionSeconds: number;
  minTargetSizePx: number;
  defaultDwellMs: number;
};

export type GameStatus = "planned" | "mvp" | "therapy-ready" | "polished";

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

export const gameCategories: Record<string, string> = {
  "tracker-basics": "Знакомство с трекером",
  words: "Учим слова",
  math: "Математика",
  adventure: "Приключения"
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
    route: "/games/butterfly",
    category: "tracker-basics",
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
    route: "/games/flowers",
    category: "tracker-basics",
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
    route: "/games/ducks",
    category: "tracker-basics",
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
    description: "Смотри на рыбку и мягко следуй за её движением.",
    route: "/games/fishes",
    category: "tracker-basics",
    icon: "mdi-fish",
    skills: ["smooth-pursuit", "attention-shift"],
    status: "mvp",
    recommendedSessionSeconds: 90,
    minTargetSizePx: 140,
    defaultDwellMs: 1200
  },
  {
    id: "frog",
    title: "Жаба",
    description: "Помоги жабе ловить светлячков взглядом без спешки и стресса.",
    route: "/games/frog",
    category: "tracker-basics",
    icon: "mdi-frog",
    skills: ["attention-shift", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 90,
    minTargetSizePx: 140,
    defaultDwellMs: 900
  },
  {
    id: "hide-and-seek",
    title: "Прятки",
    description: "Ищи спрятанных персонажей на спокойных иллюстрациях.",
    route: "/games/hide-and-seek",
    category: "tracker-basics",
    icon: "mdi-eye-search",
    skills: ["visual-search", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 130,
    defaultDwellMs: 1200
  },
  {
    id: "pyramid",
    title: "Пирамидка",
    description: "Собирай кольца по порядку и тренируй последовательность.",
    route: "/games/pyramid",
    category: "tracker-basics",
    icon: "mdi-pyramid",
    skills: ["sequence", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 120,
    defaultDwellMs: 1200
  },
  {
    id: "choose-picture",
    title: "Выбери картинку",
    description: "Слушай слово и выбирай подходящую картинку взглядом.",
    route: "/games/choose-picture",
    category: "words",
    icon: "mdi-image-search",
    skills: ["aac", "vocabulary", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1200
  },
  {
    id: "eat-or-not-eat",
    title: "Съедобное",
    description: "Сортируй предметы на съедобные и несъедобные.",
    route: "/games/eat-or-not-eat",
    category: "words",
    icon: "mdi-food-apple",
    skills: ["classification", "aac", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 180,
    defaultDwellMs: 1200
  },
  {
    id: "type-word",
    title: "Печать слов",
    description: "Собирай короткие слова из крупных букв взглядом.",
    route: "/games/type-word",
    category: "words",
    icon: "mdi-keyboard",
    skills: ["typing", "vocabulary", "sequence"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 96,
    defaultDwellMs: 1200
  },
  {
    id: "count-items",
    title: "Счёт",
    description: "Посчитай предметы и выбери правильное число.",
    route: "/games/count-items",
    category: "math",
    icon: "mdi-counter",
    skills: ["counting", "choice"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 160,
    defaultDwellMs: 1200
  },
  {
    id: "math-actions",
    title: "Математика. Операции",
    description: "Решай простые примеры и вводи ответ крупными кнопками.",
    route: "/games/math-actions",
    category: "math",
    icon: "mdi-calculator-variant",
    skills: ["math", "typing"],
    status: "mvp",
    recommendedSessionSeconds: 120,
    minTargetSizePx: 96,
    defaultDwellMs: 1200
  },
  {
    id: "table-tennis",
    title: "Теннис",
    description: "Веди ракетку взглядом и удерживай мяч в игре.",
    route: "/games/table-tennis",
    category: "adventure",
    icon: "mdi-table-tennis",
    skills: ["continuous-control", "smooth-pursuit"],
    status: "mvp",
    recommendedSessionSeconds: 90,
    minTargetSizePx: 160,
    defaultDwellMs: 1000
  }
];

export function findGame(gameId: string | string[]) {
  const id = Array.isArray(gameId) ? gameId[0] : gameId;
  return games.find((game) => game.id === id);
}
