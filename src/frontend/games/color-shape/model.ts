import type { SessionSettings } from "../../core/settings";

export type ColorShapeColorId = "red" | "blue" | "green" | "yellow";
export type ColorShapeShapeId = "circle" | "square" | "triangle" | "star";
export type ColorShapeTrait = "color" | "shape";
type ColorShapeGender = "masculine" | "feminine";

export type ColorShapeColor = {
  id: ColorShapeColorId;
  label: string;
  forms: Record<ColorShapeGender, string>;
  hex: string;
  textColor: string;
};

export type ColorShapeShape = {
  id: ColorShapeShapeId;
  label: string;
  gender: ColorShapeGender;
};

export type ColorShapeItem = {
  id: string;
  label: string;
  color: ColorShapeColor;
  shape: ColorShapeShape;
};

export type ColorShapeRound = {
  roundId: string;
  prompt: string;
  target: ColorShapeItem;
  choices: ColorShapeItem[];
  correctIndex: number;
};

export const colorShapeColors: ColorShapeColor[] = [
  { id: "red", label: "красный", forms: { masculine: "красный", feminine: "красная" }, hex: "#d83a3a", textColor: "#ffffff" },
  { id: "blue", label: "синий", forms: { masculine: "синий", feminine: "синяя" }, hex: "#2f6fdb", textColor: "#ffffff" },
  { id: "green", label: "зелёный", forms: { masculine: "зелёный", feminine: "зелёная" }, hex: "#2f9e62", textColor: "#ffffff" },
  { id: "yellow", label: "жёлтый", forms: { masculine: "жёлтый", feminine: "жёлтая" }, hex: "#f8c73e", textColor: "#25210c" }
];

export const colorShapeShapes: ColorShapeShape[] = [
  { id: "circle", label: "круг", gender: "masculine" },
  { id: "square", label: "квадрат", gender: "masculine" },
  { id: "triangle", label: "треугольник", gender: "masculine" },
  { id: "star", label: "звезда", gender: "feminine" }
];

export function colorLabelForShape(color: ColorShapeColor, shape: ColorShapeShape) {
  return color.forms[shape.gender];
}

export function createColorShapeItem(color: ColorShapeColor, shape: ColorShapeShape): ColorShapeItem {
  return {
    id: `${color.id}-${shape.id}`,
    label: `${colorLabelForShape(color, shape)} ${shape.label}`,
    color,
    shape
  };
}

export const colorShapeItems: ColorShapeItem[] = colorShapeColors.flatMap((color) => colorShapeShapes.map((shape) => createColorShapeItem(color, shape)));

export function getColorShapeMismatch(choice: ColorShapeItem, target: ColorShapeItem): ColorShapeTrait[] {
  const traits: ColorShapeTrait[] = [];
  if (choice.color.id !== target.color.id) traits.push("color");
  if (choice.shape.id !== target.shape.id) traits.push("shape");
  return traits;
}

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 3;
  if (settings.preset === "challenge") return 5;
  return 4;
}

function rotateItems<T>(items: T[], offset: number) {
  const normalizedOffset = offset % items.length;
  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function pushCandidate(choices: ColorShapeItem[], target: ColorShapeItem, startOffset: number, predicate: (item: ColorShapeItem) => boolean) {
  const targetIndex = colorShapeItems.findIndex((item) => item.id === target.id);
  for (let step = 1; step <= colorShapeItems.length; step += 1) {
    const candidate = colorShapeItems[(targetIndex + startOffset + step) % colorShapeItems.length];
    if (candidate.id !== target.id && !choices.some((choice) => choice.id === candidate.id) && predicate(candidate)) {
      choices.push(candidate);
      return;
    }
  }
}

export function generateColorShapeRound(settings: SessionSettings, roundIndex = 1): ColorShapeRound {
  const choiceCount = choiceCountFor(settings);
  if (colorShapeItems.length < choiceCount) throw new Error("Недостаточно цветных форм для игры.");

  const target = colorShapeItems[(roundIndex - 1) % colorShapeItems.length];
  const choices = [target];

  pushCandidate(choices, target, roundIndex, (item) => item.shape.id === target.shape.id && item.color.id !== target.color.id);
  pushCandidate(choices, target, roundIndex + 2, (item) => item.color.id === target.color.id && item.shape.id !== target.shape.id);

  while (choices.length < choiceCount) {
    pushCandidate(choices, target, roundIndex + choices.length * 3, (item) => item.color.id !== target.color.id && item.shape.id !== target.shape.id);
  }

  const rotatedChoices = rotateItems(choices, roundIndex % choices.length);

  return {
    roundId: `color-shape:round:${roundIndex}`,
    prompt: `Найди ${target.label}`,
    target,
    choices: rotatedChoices,
    correctIndex: rotatedChoices.findIndex((choice) => choice.id === target.id)
  };
}
