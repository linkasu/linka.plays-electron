import { shuffleItems } from "../../data/wordBank";

export type DayRoutinePeriodId = "morning" | "day" | "evening";

export type DayRoutinePeriod = {
  id: DayRoutinePeriodId;
  label: string;
  title: string;
  helper: string;
  icon: string;
  color: string;
};

export type DayRoutineItem = {
  id: string;
  label: string;
  emoji: string;
  periodId: DayRoutinePeriodId;
  hint: string;
};

export type DayRoutineBoard = {
  roundId: string;
  periods: DayRoutinePeriod[];
  items: DayRoutineItem[];
  choices: DayRoutineItem[];
};

export const dayRoutinePeriods: DayRoutinePeriod[] = [
  {
    id: "morning",
    label: "утро",
    title: "Утро",
    helper: "Сначала просыпаемся, умываемся и завтракаем.",
    icon: "mdi-weather-sunset-up",
    color: "amber-lighten-5"
  },
  {
    id: "day",
    label: "день",
    title: "День",
    helper: "Днём играем, гуляем и обедаем.",
    icon: "mdi-white-balance-sunny",
    color: "light-blue-lighten-5"
  },
  {
    id: "evening",
    label: "вечер",
    title: "Вечер",
    helper: "Вечером ужинаем, умываемся и готовимся ко сну.",
    icon: "mdi-weather-night",
    color: "deep-purple-lighten-5"
  }
];

export const dayRoutineItems: DayRoutineItem[] = [
  { id: "wake-up", label: "проснуться", emoji: "⏰", periodId: "morning", hint: "Будильник помогает начать утро." },
  { id: "wash-face", label: "умыться", emoji: "🫧", periodId: "morning", hint: "Умываемся утром после сна." },
  { id: "breakfast", label: "завтрак", emoji: "🥣", periodId: "morning", hint: "Завтрак бывает утром." },
  { id: "play", label: "играть", emoji: "🧸", periodId: "day", hint: "Днём есть время для игры." },
  { id: "walk", label: "гулять", emoji: "🌳", periodId: "day", hint: "На прогулку часто выходят днём." },
  { id: "lunch", label: "обед", emoji: "🍲", periodId: "day", hint: "Обед бывает в середине дня." },
  { id: "dinner", label: "ужин", emoji: "🍽️", periodId: "evening", hint: "Ужин ждёт вечером." },
  { id: "sleep", label: "спать", emoji: "🛏️", periodId: "evening", hint: "Спать ложатся вечером или ночью." }
];

export function createDayRoutineBoard(maxSteps = 8): DayRoutineBoard {
  const items = dayRoutineItems.slice(0, maxSteps);

  return {
    roundId: "day-routine:board",
    periods: dayRoutinePeriods,
    items,
    choices: shuffleItems(items)
  };
}

export function findDayRoutinePeriod(periodId: DayRoutinePeriodId) {
  return dayRoutinePeriods.find((period) => period.id === periodId);
}
