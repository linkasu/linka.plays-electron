import { shuffleItems } from "../../core/random";

export type DayRoutinePeriodId = "morning" | "day" | "evening";

export type DayRoutinePeriod = {
  id: DayRoutinePeriodId;
  label: string;
  questionForm: string;
  title: string;
  helper: string;
  icon: string;
  color: string;
};

export type DayRoutineItem = {
  id: string;
  label: string;
  imageId: string;
  periodId: DayRoutinePeriodId;
  hint: string;
};

export type DayRoutineBoard = {
  roundId: string;
  periods: DayRoutinePeriod[];
  items: DayRoutineItem[];
  choices: DayRoutineItem[];
};

export const dayRoutineAudioCues = {
  prompt: {
    id: "day-routine.prompt",
    text: "Начинаем с утра. Выбери картинку, которая бывает утром."
  },
  correct: {
    id: "day-routine.correct",
    text: "Верно. Продолжаем собирать день."
  },
  mistake: {
    id: "day-routine.mistake",
    text: "Посмотри на часть дня и попробуй выбрать другую картинку."
  },
  complete: {
    id: "day-routine.complete",
    text: "Готово. Утро, день и вечер собраны."
  }
} as const;

export const dayRoutinePeriods: DayRoutinePeriod[] = [
  {
    id: "morning",
    label: "утро",
    questionForm: "утром",
    title: "Утро",
    helper: "Сначала просыпаемся, умываемся и завтракаем.",
    icon: "mdi-weather-sunset-up",
    color: "amber-lighten-5"
  },
  {
    id: "day",
    label: "день",
    questionForm: "днём",
    title: "День",
    helper: "Днём играем, гуляем и обедаем.",
    icon: "mdi-white-balance-sunny",
    color: "light-blue-lighten-5"
  },
  {
    id: "evening",
    label: "вечер",
    questionForm: "вечером",
    title: "Вечер",
    helper: "Вечером ужинаем, умываемся и готовимся ко сну.",
    icon: "mdi-weather-night",
    color: "deep-purple-lighten-5"
  }
];

export const dayRoutineItems: DayRoutineItem[] = [
  { id: "wake-up", label: "проснуться", imageId: "clock", periodId: "morning", hint: "Будильник помогает начать утро." },
  { id: "wash-face", label: "умыться", imageId: "soap", periodId: "morning", hint: "Умываемся утром после сна." },
  { id: "breakfast", label: "завтрак", imageId: "porridge", periodId: "morning", hint: "Завтрак бывает утром." },
  { id: "play", label: "играть", imageId: "toy", periodId: "day", hint: "Днём есть время для игры." },
  { id: "walk", label: "гулять", imageId: "tree", periodId: "day", hint: "На прогулку часто выходят днём." },
  { id: "lunch", label: "обед", imageId: "soup", periodId: "day", hint: "Обед бывает в середине дня." },
  { id: "dinner", label: "ужин", imageId: "plate", periodId: "evening", hint: "Ужин ждёт вечером." },
  { id: "sleep", label: "спать", imageId: "bed", periodId: "evening", hint: "Спать ложатся вечером или ночью." }
];

export function dayRoutineQuestion(period: DayRoutinePeriod) {
  return `Что бывает ${period.questionForm}?`;
}

export function createDayRoutineBoard(maxSteps = 8, random = Math.random): DayRoutineBoard {
  const items = dayRoutineItems.slice(0, maxSteps);

  return {
    roundId: "day-routine:board",
    periods: dayRoutinePeriods,
    items,
    choices: shuffleItems(items, random)
  };
}

export function findDayRoutinePeriod(periodId: DayRoutinePeriodId) {
  return dayRoutinePeriods.find((period) => period.id === periodId);
}
