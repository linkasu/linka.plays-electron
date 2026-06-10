import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type CalendarTaskKind = "weekday" | "relative";
export type CalendarWeekdayId = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type CalendarRelativeId = "yesterday" | "today" | "tomorrow";

export type CalendarWeekday = {
  id: CalendarWeekdayId;
  label: string;
  shortLabel: string;
};

export type CalendarRelativeDay = {
  id: CalendarRelativeId;
  label: string;
  offset: -1 | 0 | 1;
  questionText: string;
  icon: string;
};

export type CalendarChoice = {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
  weekdayId?: CalendarWeekdayId;
  relativeId?: CalendarRelativeId;
};

export type CalendarRound = {
  roundId: string;
  taskKind: CalendarTaskKind;
  prompt: string;
  contextText: string;
  helperText: string;
  correctionText: string;
  choices: CalendarChoice[];
  correctChoiceId: string;
  correctIndex: number;
  today: CalendarWeekday;
  targetDay: CalendarWeekday;
  targetRelative: CalendarRelativeDay;
};

export const calendarWeekdays: CalendarWeekday[] = [
  { id: "monday", label: "Понедельник", shortLabel: "Пн" },
  { id: "tuesday", label: "Вторник", shortLabel: "Вт" },
  { id: "wednesday", label: "Среда", shortLabel: "Ср" },
  { id: "thursday", label: "Четверг", shortLabel: "Чт" },
  { id: "friday", label: "Пятница", shortLabel: "Пт" },
  { id: "saturday", label: "Суббота", shortLabel: "Сб" },
  { id: "sunday", label: "Воскресенье", shortLabel: "Вс" }
];

export const calendarRelativeDays: CalendarRelativeDay[] = [
  { id: "yesterday", label: "Вчера", offset: -1, questionText: "был вчера", icon: "mdi-calendar-arrow-left" },
  { id: "today", label: "Сегодня", offset: 0, questionText: "сегодня", icon: "mdi-calendar-today" },
  { id: "tomorrow", label: "Завтра", offset: 1, questionText: "будет завтра", icon: "mdi-calendar-arrow-right" }
];

const weekdayChoiceColors = ["blue-lighten-5", "green-lighten-5", "amber-lighten-5", "purple-lighten-5"];

export function wrapWeekdayIndex(index: number) {
  return ((index % calendarWeekdays.length) + calendarWeekdays.length) % calendarWeekdays.length;
}

export function getWeekdayByOffset(baseIndex: number, offset: number) {
  return calendarWeekdays[wrapWeekdayIndex(baseIndex + offset)];
}

export function getRelativeWeekday(todayId: CalendarWeekdayId, relativeId: CalendarRelativeId) {
  const todayIndex = calendarWeekdays.findIndex((day) => day.id === todayId);
  const relative = calendarRelativeDays.find((day) => day.id === relativeId);
  if (todayIndex < 0 || !relative) return undefined;
  return getWeekdayByOffset(todayIndex, relative.offset);
}

function choiceCount(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function createWeekdayChoice(day: CalendarWeekday, index: number): CalendarChoice {
  return {
    id: `weekday:${day.id}`,
    label: day.label,
    sublabel: day.shortLabel,
    icon: "mdi-calendar-check",
    color: weekdayChoiceColors[index % weekdayChoiceColors.length],
    weekdayId: day.id
  };
}

function createRelativeChoice(todayIndex: number, relative: CalendarRelativeDay): CalendarChoice {
  const day = getWeekdayByOffset(todayIndex, relative.offset);
  return {
    id: `relative:${relative.id}`,
    label: relative.label,
    sublabel: day.label,
    icon: relative.icon,
    color: relative.id === "today" ? "green-lighten-5" : relative.id === "tomorrow" ? "blue-lighten-5" : "amber-lighten-5",
    weekdayId: day.id,
    relativeId: relative.id
  };
}

function generateWeekdayChoices(settings: SessionSettings, targetIndex: number) {
  const selected = new Set<number>([wrapWeekdayIndex(targetIndex)]);
  const offsets = [-1, 1, -2, 2, -3, 3];

  for (const offset of offsets) {
    if (selected.size >= choiceCount(settings)) break;
    selected.add(wrapWeekdayIndex(targetIndex + offset));
  }

  return shuffleItems([...selected].map((index, choiceIndex) => createWeekdayChoice(calendarWeekdays[index], choiceIndex)));
}

export function generateCalendarRound(settings: SessionSettings, roundIndex = 1): CalendarRound {
  const todayIndex = wrapWeekdayIndex(roundIndex * 2 + (settings.preset === "gentle" ? 0 : 1));
  const today = calendarWeekdays[todayIndex];
  const targetRelative = calendarRelativeDays[(roundIndex - 1) % calendarRelativeDays.length];
  const targetDay = getWeekdayByOffset(todayIndex, targetRelative.offset);
  const taskKind: CalendarTaskKind = roundIndex % 2 === 0 ? "relative" : "weekday";

  if (taskKind === "relative") {
    const choices = calendarRelativeDays.map((relative) => createRelativeChoice(todayIndex, relative));
    const correctChoiceId = `relative:${targetRelative.id}`;

    return {
      roundId: `calendar:round:${roundIndex}`,
      taskKind,
      prompt: `Сегодня ${today.label.toLowerCase()}. Где ${targetDay.label.toLowerCase()}?`,
      contextText: `Сегодня: ${today.label}`,
      helperText: "Выбери карточку: вчера, сегодня или завтра.",
      correctionText: `${targetDay.label} — это ${targetRelative.label.toLowerCase()}.`,
      choices,
      correctChoiceId,
      correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId),
      today,
      targetDay,
      targetRelative
    };
  }

  const targetIndex = wrapWeekdayIndex(todayIndex + targetRelative.offset);
  const choices = generateWeekdayChoices(settings, targetIndex);
  const correctChoiceId = `weekday:${targetDay.id}`;

  return {
    roundId: `calendar:round:${roundIndex}`,
    taskKind,
    prompt: `Сегодня ${today.label.toLowerCase()}. Какой день ${targetRelative.questionText}?`,
    contextText: `Сегодня: ${today.label}`,
    helperText: "Смотри на порядок дней: вчера, сегодня, завтра.",
    correctionText: `${targetRelative.label} — это ${targetDay.label.toLowerCase()}.`,
    choices,
    correctChoiceId,
    correctIndex: choices.findIndex((choice) => choice.id === correctChoiceId),
    today,
    targetDay,
    targetRelative
  };
}
