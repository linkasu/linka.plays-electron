export type ScheduleCard = {
  id: string;
  title: string;
  aacLabel: string;
  imageId: string;
  emoji: string;
  color: string;
  hint: string;
};

export const scheduleMaxSteps = 8;

export const dailyScheduleSteps: ScheduleCard[] = [
  { id: "wake", title: "Проснуться", aacLabel: "утро", imageId: "clock", emoji: "🕘", color: "#ffcc80", hint: "Сначала начинается утро." },
  { id: "wash", title: "Умыться", aacLabel: "умыться", imageId: "soap", emoji: "🧼", color: "#80deea", hint: "После подъёма умываемся." },
  { id: "breakfast", title: "Завтрак", aacLabel: "есть", imageId: "porridge", emoji: "🥣", color: "#ffe082", hint: "Потом завтрак." },
  { id: "dress", title: "Одеться", aacLabel: "одежда", imageId: "shirt", emoji: "👕", color: "#b39ddb", hint: "После завтрака надеваем одежду." },
  { id: "therapy", title: "Занятие", aacLabel: "занятие", imageId: "book", emoji: "📘", color: "#90caf9", hint: "Дальше идёт занятие." },
  { id: "lunch", title: "Обед", aacLabel: "обед", imageId: "soup", emoji: "🍲", color: "#a5d6a7", hint: "После занятия время обеда." },
  { id: "play", title: "Игра", aacLabel: "играть", imageId: "toy", emoji: "🧸", color: "#f48fb1", hint: "Потом можно играть." },
  { id: "sleep", title: "Сон", aacLabel: "спать", imageId: "bed", emoji: "🛏️", color: "#9fa8da", hint: "Последний шаг дня — сон." }
];

const cardChoiceOrder = ["lunch", "wake", "play", "wash", "therapy", "breakfast", "sleep", "dress"];

export function createScheduleCards(): ScheduleCard[] {
  return cardChoiceOrder.map((id) => dailyScheduleSteps.find((step) => step.id === id)).filter((step): step is ScheduleCard => Boolean(step));
}

export function createScheduleCandidates<T extends ScheduleCard>(cards: readonly T[], placedIds: readonly string[], maxVisible = cards.length): T[] {
  const placed = new Set(placedIds);
  const available = cards.filter((card) => !placed.has(card.id));
  const limit = Math.min(available.length, Math.max(1, Math.floor(maxVisible)));
  if (available.length <= limit) return available;

  const expectedId = nextScheduleStep(placedIds)?.id;
  const expectedIndex = Math.max(0, available.findIndex((card) => card.id === expectedId));
  const start = Math.min(Math.max(0, expectedIndex - Math.floor(limit / 2)), available.length - limit);
  return available.slice(start, start + limit);
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

export function schedulePromptAssetId(card: Pick<ScheduleCard, "id">) {
  return `schedule.prompt.${card.id}`;
}
