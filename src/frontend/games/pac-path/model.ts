export type PacPathWaypoint = {
  id: string;
  order: number;
  label: string;
  cue: string;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  icon: string;
  color: string;
};

export type PacPathDetour = Omit<PacPathWaypoint, "order"> & {
  detourId: string;
};

export type PacPathChoice = PacPathWaypoint & {
  safe: true;
} | PacPathDetour & {
  safe: false;
};

export type PacPathRound = {
  roundId: string;
  stepIndex: number;
  expected: PacPathWaypoint;
  choices: PacPathChoice[];
};

export const pacPathMaxSteps = 10;
export const pacPathMaxDetours = 3;
export type PacPathChoiceOutcome = "safe" | "detour" | "loss";

export const pacPathWaypoints: PacPathWaypoint[] = [
  { id: "start", order: 0, label: "Старт", cue: "Пак готов к спокойному пути.", x: 10, y: 76, mobileX: 20, mobileY: 86, icon: "mdi-pac-man", color: "amber" },
  { id: "crumb-one", order: 1, label: "Крошка 1", cue: "Первый безопасный шаг рядом со стартом.", x: 22, y: 76, mobileX: 54, mobileY: 82, icon: "mdi-circle-small", color: "amber" },
  { id: "upper-turn", order: 2, label: "Верхний поворот", cue: "Здесь дорожка мягко уходит вверх.", x: 22, y: 52, mobileX: 54, mobileY: 68, icon: "mdi-arrow-up-bold-circle-outline", color: "light-blue" },
  { id: "long-lane", order: 3, label: "Длинная дорожка", cue: "Идём по широкой светлой линии.", x: 40, y: 52, mobileX: 28, mobileY: 60, icon: "mdi-road-variant", color: "cyan" },
  { id: "fruit-corner", order: 4, label: "Фруктовый угол", cue: "Поворот у спокойной вишни.", x: 40, y: 28, mobileX: 62, mobileY: 52, icon: "mdi-fruit-cherries", color: "pink" },
  { id: "middle-dot", order: 5, label: "Средняя крошка", cue: "Центр пути, без погони и таймера.", x: 58, y: 28, mobileX: 36, mobileY: 44, icon: "mdi-circle-small", color: "yellow" },
  { id: "calm-gate", order: 6, label: "Тихие ворота", cue: "Проходим через открытые ворота.", x: 58, y: 60, mobileX: 68, mobileY: 36, icon: "mdi-gate-open", color: "teal" },
  { id: "safe-bridge", order: 7, label: "Безопасный мост", cue: "Мост ведёт дальше по лабиринту.", x: 74, y: 60, mobileX: 40, mobileY: 28, icon: "mdi-bridge", color: "green" },
  { id: "lower-turn", order: 8, label: "Нижний поворот", cue: "Поворачиваем вниз без спешки.", x: 74, y: 80, mobileX: 72, mobileY: 20, icon: "mdi-arrow-down-bold-circle-outline", color: "deep-purple" },
  { id: "last-lane", order: 9, label: "Последняя линия", cue: "Ещё один спокойный шаг к дому.", x: 88, y: 80, mobileX: 44, mobileY: 12, icon: "mdi-road-variant", color: "indigo" },
  { id: "home", order: 10, label: "Домик", cue: "Финишный безопасный домик.", x: 88, y: 36, mobileX: 76, mobileY: 8, icon: "mdi-home-heart", color: "orange" }
];

export const pacPathDetours: PacPathDetour[] = [
  { id: "quiet-dead-end", detourId: "quiet-dead-end", label: "Тихий тупик", cue: "Эта ветка подождёт, она не ведёт дальше.", x: 10, y: 52, mobileX: 20, mobileY: 70, icon: "mdi-sign-direction-remove", color: "blue-grey" },
  { id: "closed-arcade", detourId: "closed-arcade", label: "Закрытая арка", cue: "Арка закрыта, лучше выбрать светлую крошку.", x: 32, y: 28, mobileX: 82, mobileY: 62, icon: "mdi-arch", color: "brown" },
  { id: "sleepy-corner", detourId: "sleepy-corner", label: "Сонный угол", cue: "Здесь можно отдохнуть позже.", x: 50, y: 76, mobileX: 18, mobileY: 48, icon: "mdi-weather-night", color: "indigo" },
  { id: "side-loop", detourId: "side-loop", label: "Боковая петля", cue: "Петля длинная, сейчас нужен ближний waypoint.", x: 66, y: 40, mobileX: 82, mobileY: 40, icon: "mdi-autorenew", color: "purple" },
  { id: "late-corner", detourId: "late-corner", label: "Поздний поворот", cue: "Этот поворот пригодится не сейчас.", x: 82, y: 20, mobileX: 18, mobileY: 28, icon: "mdi-arrow-decision-outline", color: "deep-orange" }
];

export function createPacPathRound(stepIndex: number): PacPathRound {
  const safeIndex = Math.max(1, Math.min(pacPathMaxSteps, stepIndex + 1));
  const expected = pacPathWaypoints[safeIndex];
  const firstDetourIndex = stepIndex % pacPathDetours.length;
  const safeChoice: PacPathChoice = { ...expected, safe: true };
  const choices: PacPathChoice[] = [
    safeChoice,
    { ...pacPathDetours[firstDetourIndex], safe: false },
    { ...pacPathDetours[(firstDetourIndex + 2) % pacPathDetours.length], safe: false },
    { ...pacPathDetours[(firstDetourIndex + 4) % pacPathDetours.length], safe: false }
  ];
  const shift = stepIndex % choices.length;

  return {
    roundId: `pac-path:round:${safeIndex}`,
    stepIndex,
    expected,
    choices: [choices[shift], choices[(shift + 1) % choices.length], choices[(shift + 2) % choices.length], choices[(shift + 3) % choices.length]]
  };
}

export function isPacPathSafeChoice(choice: PacPathChoice, round: PacPathRound): choice is PacPathWaypoint & { safe: true } {
  return choice.safe === true && choice.id === round.expected.id;
}

export function pacPathChoiceOutcome(choice: PacPathChoice, round: PacPathRound, mistakesAfterChoice: number): PacPathChoiceOutcome {
  if (isPacPathSafeChoice(choice, round)) return "safe";
  return mistakesAfterChoice >= pacPathMaxDetours ? "loss" : "detour";
}
