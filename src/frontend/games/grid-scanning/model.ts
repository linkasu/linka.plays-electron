import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type GridScanningSymbol = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export type GridScanningCell = {
  id: string;
  item: GridScanningSymbol;
  isTarget: boolean;
};

export type GridScanningRound = {
  roundId: string;
  prompt: string;
  dimension: number;
  target: GridScanningSymbol;
  cells: GridScanningCell[];
  correctIndex: number;
};

export const gridScanningSymbols: GridScanningSymbol[] = [
  { id: "star", label: "звезда", icon: "mdi-star-four-points-outline", color: "amber" },
  { id: "heart", label: "сердце", icon: "mdi-heart-outline", color: "pink" },
  { id: "leaf", label: "лист", icon: "mdi-leaf", color: "success" },
  { id: "moon", label: "луна", icon: "mdi-moon-waning-crescent", color: "indigo" },
  { id: "flower", label: "цветок", icon: "mdi-flower-outline", color: "secondary" },
  { id: "bell", label: "колокольчик", icon: "mdi-bell-outline", color: "warning" },
  { id: "fish", label: "рыбка", icon: "mdi-fish", color: "cyan" },
  { id: "cloud", label: "облако", icon: "mdi-cloud-outline", color: "info" },
  { id: "home", label: "домик", icon: "mdi-home-outline", color: "deep-purple" },
  { id: "tree", label: "дерево", icon: "mdi-tree-outline", color: "green" },
  { id: "sun", label: "солнце", icon: "mdi-white-balance-sunny", color: "orange" },
  { id: "water", label: "капля", icon: "mdi-water-outline", color: "blue" },
  { id: "butterfly", label: "бабочка", icon: "mdi-butterfly", color: "purple" },
  { id: "mushroom", label: "грибок", icon: "mdi-mushroom-outline", color: "brown" },
  { id: "music", label: "нота", icon: "mdi-music-note", color: "teal" },
  { id: "diamond", label: "ромб", icon: "mdi-diamond-stone", color: "light-blue" },
  { id: "sprout", label: "росток", icon: "mdi-sprout-outline", color: "light-green" },
  { id: "circle", label: "круг", icon: "mdi-circle-outline", color: "primary" }
];

export function gridDimensionForRound(settings: SessionSettings, roundIndex: number) {
  const roundsPerSize = settings.preset === "challenge" ? 2 : settings.preset === "gentle" ? 4 : 3;
  return Math.min(4, 2 + Math.floor(Math.max(0, roundIndex - 1) / roundsPerSize));
}

export function generateGridScanningRound(settings: SessionSettings, roundIndex = 1): GridScanningRound {
  const dimension = gridDimensionForRound(settings, roundIndex);
  const cellCount = dimension * dimension;
  if (gridScanningSymbols.length < cellCount) throw new Error("Недостаточно символов для сетки.");

  const [target] = shuffleItems(gridScanningSymbols).slice(0, 1);
  const distractors = shuffleItems(gridScanningSymbols.filter((symbol) => symbol.id !== target.id)).slice(0, cellCount - 1);
  const correctIndex = ((roundIndex - 1) * 5 + dimension) % cellCount;
  const cells: GridScanningCell[] = [];
  let distractorIndex = 0;

  for (let index = 0; index < cellCount; index += 1) {
    const item = index === correctIndex ? target : distractors[distractorIndex];
    cells.push({
      id: `grid-scanning:${roundIndex}:${index}`,
      item,
      isTarget: index === correctIndex
    });
    if (index !== correctIndex) distractorIndex += 1;
  }

  return {
    roundId: `grid-scanning:round:${roundIndex}`,
    prompt: `Найди ${target.label}`,
    dimension,
    target,
    cells,
    correctIndex
  };
}
