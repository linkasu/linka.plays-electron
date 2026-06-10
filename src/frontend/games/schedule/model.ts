export type ScheduleCard = {
  id: string;
  title: string;
  aacLabel: string;
  icon: string;
  color: string;
  hint: string;
};

export const scheduleMaxSteps = 8;

export const dailyScheduleSteps: ScheduleCard[] = [
  { id: "wake", title: "Проснуться", aacLabel: "утро", icon: "mdi-alarm", color: "#ffcc80", hint: "Сначала начинается утро." },
  { id: "wash", title: "Умыться", aacLabel: "умыться", icon: "mdi-toothbrush", color: "#80deea", hint: "После подъёма умываемся." },
  { id: "breakfast", title: "Завтрак", aacLabel: "есть", icon: "mdi-food", color: "#ffe082", hint: "Потом завтрак." },
  { id: "dress", title: "Одеться", aacLabel: "одежда", icon: "mdi-tshirt-crew", color: "#b39ddb", hint: "После завтрака надеваем одежду." },
  { id: "therapy", title: "Занятие", aacLabel: "занятие", icon: "mdi-school", color: "#90caf9", hint: "Дальше идёт занятие." },
  { id: "lunch", title: "Обед", aacLabel: "обед", icon: "mdi-silverware-fork-knife", color: "#a5d6a7", hint: "После занятия время обеда." },
  { id: "play", title: "Игра", aacLabel: "играть", icon: "mdi-gamepad-variant", color: "#f48fb1", hint: "Потом можно играть." },
  { id: "sleep", title: "Сон", aacLabel: "спать", icon: "mdi-bed", color: "#9fa8da", hint: "Последний шаг дня — сон." }
];

const cardChoiceOrder = ["lunch", "wake", "play", "wash", "therapy", "breakfast", "sleep", "dress"];

export function createScheduleCards(): ScheduleCard[] {
  return cardChoiceOrder.map((id) => dailyScheduleSteps.find((step) => step.id === id)).filter((step): step is ScheduleCard => Boolean(step));
}

export function nextScheduleStep(placedIds: readonly string[]): ScheduleCard | undefined {
  const placed = new Set(placedIds);
  return dailyScheduleSteps.find((step) => !placed.has(step.id));
}

export function isExpectedScheduleChoice(choiceId: string, placedIds: readonly string[]) {
  return nextScheduleStep(placedIds)?.id === choiceId;
}

export function scheduleTargetId(card: Pick<ScheduleCard, "id">) {
  return `schedule:card:${card.id}`;
}
