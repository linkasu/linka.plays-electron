import type { SessionSettings } from "../../core/settings";

export type LinesAnglesTaskId = "straight" | "curved" | "angle" | "no-angle" | "vertical" | "horizontal";
export type LinesAnglesLineKind = "straight" | "curved" | "angular";
export type LinesAnglesOrientation = "vertical" | "horizontal" | "diagonal" | "mixed";
export type LinesAnglesShapeId =
  | "straight-vertical"
  | "straight-horizontal"
  | "straight-diagonal"
  | "curved-vertical"
  | "curved-horizontal"
  | "smooth-wave"
  | "soft-arc"
  | "right-angle"
  | "open-angle"
  | "wide-angle"
  | "zigzag";

export type LinesAnglesOption = {
  id: LinesAnglesShapeId;
  label: string;
  lineKind: LinesAnglesLineKind;
  hasAngle: boolean;
  orientation: LinesAnglesOrientation;
};

export type LinesAnglesTask = {
  id: LinesAnglesTaskId;
  prompt: string;
  hint: string;
  targetIds: LinesAnglesShapeId[];
  distractorIds: LinesAnglesShapeId[];
};

export type LinesAnglesRound = {
  roundId: string;
  prompt: string;
  hint: string;
  task: LinesAnglesTask;
  target: LinesAnglesOption;
  choices: LinesAnglesOption[];
  correctIndex: number;
};

export const linesAnglesOptions: LinesAnglesOption[] = [
  { id: "straight-vertical", label: "Вертикальная прямая", lineKind: "straight", hasAngle: false, orientation: "vertical" },
  { id: "straight-horizontal", label: "Горизонтальная прямая", lineKind: "straight", hasAngle: false, orientation: "horizontal" },
  { id: "straight-diagonal", label: "Наклонная прямая", lineKind: "straight", hasAngle: false, orientation: "diagonal" },
  { id: "curved-vertical", label: "Вертикальная кривая", lineKind: "curved", hasAngle: false, orientation: "vertical" },
  { id: "curved-horizontal", label: "Горизонтальная кривая", lineKind: "curved", hasAngle: false, orientation: "horizontal" },
  { id: "smooth-wave", label: "Плавная волна", lineKind: "curved", hasAngle: false, orientation: "horizontal" },
  { id: "soft-arc", label: "Мягкая дуга", lineKind: "curved", hasAngle: false, orientation: "mixed" },
  { id: "right-angle", label: "Прямой угол", lineKind: "angular", hasAngle: true, orientation: "mixed" },
  { id: "open-angle", label: "Острый угол", lineKind: "angular", hasAngle: true, orientation: "mixed" },
  { id: "wide-angle", label: "Широкий угол", lineKind: "angular", hasAngle: true, orientation: "mixed" },
  { id: "zigzag", label: "Ломаная с углами", lineKind: "angular", hasAngle: true, orientation: "mixed" }
];

export const linesAnglesTasks: LinesAnglesTask[] = [
  {
    id: "straight",
    prompt: "Где прямая линия?",
    hint: "Прямая линия не изгибается.",
    targetIds: ["straight-vertical", "straight-horizontal", "straight-diagonal"],
    distractorIds: ["curved-vertical", "curved-horizontal", "smooth-wave", "soft-arc"]
  },
  {
    id: "curved",
    prompt: "Где кривая линия?",
    hint: "Кривая линия мягко изгибается.",
    targetIds: ["curved-vertical", "curved-horizontal", "smooth-wave", "soft-arc"],
    distractorIds: ["straight-vertical", "straight-horizontal", "straight-diagonal", "right-angle"]
  },
  {
    id: "angle",
    prompt: "Где есть угол?",
    hint: "Угол появляется там, где две линии встречаются.",
    targetIds: ["right-angle", "open-angle", "wide-angle", "zigzag"],
    distractorIds: ["straight-horizontal", "curved-horizontal", "smooth-wave", "soft-arc"]
  },
  {
    id: "no-angle",
    prompt: "Где без угла?",
    hint: "Без угла значит без резкого поворота.",
    targetIds: ["straight-vertical", "straight-horizontal", "curved-horizontal", "soft-arc"],
    distractorIds: ["right-angle", "open-angle", "wide-angle", "zigzag"]
  },
  {
    id: "vertical",
    prompt: "Где вертикально?",
    hint: "Вертикальная линия идёт сверху вниз.",
    targetIds: ["straight-vertical", "curved-vertical"],
    distractorIds: ["straight-horizontal", "curved-horizontal", "smooth-wave", "straight-diagonal"]
  },
  {
    id: "horizontal",
    prompt: "Где горизонтально?",
    hint: "Горизонтальная линия идёт слева направо.",
    targetIds: ["straight-horizontal", "curved-horizontal", "smooth-wave"],
    distractorIds: ["straight-vertical", "curved-vertical", "straight-diagonal", "right-angle"]
  }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 5;
  return 4;
}

function optionById(id: LinesAnglesShapeId) {
  const option = linesAnglesOptions.find((candidate) => candidate.id === id);
  if (!option) throw new Error(`Не найдена фигура ${id}.`);
  return option;
}

function rotateItems<T>(items: T[], offset: number) {
  const normalizedOffset = offset % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

export function isCorrectLinesAnglesChoice(choice: LinesAnglesOption, task: LinesAnglesTask) {
  return task.targetIds.includes(choice.id);
}

export function generateLinesAnglesRound(settings: SessionSettings, roundIndex = 1): LinesAnglesRound {
  const task = linesAnglesTasks[(roundIndex - 1) % linesAnglesTasks.length];
  const choiceCount = choiceCountFor(settings);
  if (task.distractorIds.length < choiceCount - 1) throw new Error("Недостаточно вариантов для игры Линии и углы.");

  const target = optionById(task.targetIds[(roundIndex - 1) % task.targetIds.length]);
  const distractorOffset = roundIndex % task.distractorIds.length;
  const distractors = rotateItems(task.distractorIds.map(optionById), distractorOffset).slice(0, choiceCount - 1);
  const choices = rotateItems([target, ...distractors], roundIndex % choiceCount);

  return {
    roundId: `lines-angles:round:${roundIndex}`,
    prompt: task.prompt,
    hint: task.hint,
    task,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === target.id)
  };
}
