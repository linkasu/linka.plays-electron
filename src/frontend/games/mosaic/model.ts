import type { SessionSettings } from "../../core/settings";

export type MosaicShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star";

export type MosaicTile = {
  id: string;
  label: string;
  colorName: string;
  shapeName: string;
  shape: MosaicShape;
  icon: string;
  color: string;
  background: string;
};

export type MosaicStep = {
  roundId: string;
  slotIndex: number;
  target: MosaicTile;
  choices: MosaicTile[];
  correctIndex: number;
  prompt: string;
  hint: string;
};

export const mosaicTiles: MosaicTile[] = [
  { id: "red-circle", label: "красный круг", colorName: "красный", shapeName: "круг", shape: "circle", icon: "mdi-circle", color: "#e53935", background: "#ffebee" },
  { id: "blue-square", label: "синий квадрат", colorName: "синий", shapeName: "квадрат", shape: "square", icon: "mdi-square-rounded", color: "#1e88e5", background: "#e3f2fd" },
  { id: "yellow-triangle", label: "жёлтый треугольник", colorName: "жёлтый", shapeName: "треугольник", shape: "triangle", icon: "mdi-triangle", color: "#fbc02d", background: "#fff8e1" },
  { id: "green-circle", label: "зелёный круг", colorName: "зелёный", shapeName: "круг", shape: "circle", icon: "mdi-circle", color: "#43a047", background: "#e8f5e9" },
  { id: "red-diamond", label: "красный ромб", colorName: "красный", shapeName: "ромб", shape: "diamond", icon: "mdi-rhombus", color: "#d81b60", background: "#fce4ec" },
  { id: "blue-hexagon", label: "синий шестиугольник", colorName: "синий", shapeName: "шестиугольник", shape: "hexagon", icon: "mdi-hexagon", color: "#3949ab", background: "#e8eaf6" },
  { id: "purple-star", label: "фиолетовая звезда", colorName: "фиолетовый", shapeName: "звезда", shape: "star", icon: "mdi-star", color: "#8e24aa", background: "#f3e5f5" },
  { id: "orange-square", label: "оранжевый квадрат", colorName: "оранжевый", shapeName: "квадрат", shape: "square", icon: "mdi-square-rounded", color: "#fb8c00", background: "#fff3e0" }
];

const mosaicPatternIds = ["red-circle", "blue-square", "yellow-triangle", "green-circle", "red-diamond", "blue-hexagon", "purple-star", "orange-square"];

export function getMosaicPattern(settings: SessionSettings): MosaicTile[] {
  const maxSlots = Math.min(settings.maxSteps, mosaicPatternIds.length);
  return mosaicPatternIds.slice(0, maxSlots).map((id) => tileById(id));
}

export function createMosaicStep(settings: SessionSettings, stepIndex: number): MosaicStep {
  const pattern = getMosaicPattern(settings);
  const slotIndex = Math.max(0, Math.min(stepIndex, pattern.length - 1));
  const target = pattern[slotIndex];
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const choices = buildChoices(target, choiceCount, slotIndex);

  return {
    roundId: `mosaic:round:${slotIndex + 1}`,
    slotIndex,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === target.id),
    prompt: `Найди плитку: ${target.label}.`,
    hint: `Нужны цвет ${target.colorName} и форма ${target.shapeName}.`
  };
}

function buildChoices(target: MosaicTile, choiceCount: number, offset: number) {
  const sameColor = mosaicTiles.find((tile) => tile.id !== target.id && tile.colorName === target.colorName);
  const sameShape = mosaicTiles.find((tile) => tile.id !== target.id && tile.shape === target.shape);
  const otherTiles = mosaicTiles.filter((tile) => tile.id !== target.id && tile.id !== sameColor?.id && tile.id !== sameShape?.id);
  const distractors = [sameColor, sameShape, ...rotate(otherTiles, offset)].filter((tile): tile is MosaicTile => Boolean(tile));
  const uniqueChoices = [target, ...distractors].filter((tile, index, list) => list.findIndex((item) => item.id === tile.id) === index).slice(0, choiceCount);

  return rotate(uniqueChoices, offset % uniqueChoices.length);
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return items;
  const shift = offset % items.length;
  return [...items.slice(shift), ...items.slice(0, shift)];
}

function tileById(id: string) {
  const tile = mosaicTiles.find((item) => item.id === id);
  if (!tile) throw new Error(`Unknown mosaic tile: ${id}`);
  return tile;
}
