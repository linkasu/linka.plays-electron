import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type ShapeDanceFigure = {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  surfaceColor: string;
  motionClass: string;
};

export type ShapeDanceRound = {
  roundId: string;
  sequence: ShapeDanceFigure[];
  choices: ShapeDanceFigure[];
  sequenceLength: number;
};

export const shapeDanceFigures: ShapeDanceFigure[] = [
  { id: "circle", label: "круг", icon: "mdi-circle", iconColor: "#5c6bc0", surfaceColor: "indigo-lighten-5", motionClass: "shape-dance-rise" },
  { id: "square", label: "квадрат", icon: "mdi-square", iconColor: "#26a69a", surfaceColor: "teal-lighten-5", motionClass: "shape-dance-sway" },
  { id: "triangle", label: "треугольник", icon: "mdi-triangle", iconColor: "#ffb300", surfaceColor: "amber-lighten-5", motionClass: "shape-dance-turn" },
  { id: "diamond", label: "ромб", icon: "mdi-rhombus", iconColor: "#ab47bc", surfaceColor: "purple-lighten-5", motionClass: "shape-dance-rise" },
  { id: "star", label: "звезда", icon: "mdi-star", iconColor: "#fb8c00", surfaceColor: "orange-lighten-5", motionClass: "shape-dance-turn" },
  { id: "hexagon", label: "шестиугольник", icon: "mdi-hexagon", iconColor: "#66bb6a", surfaceColor: "green-lighten-5", motionClass: "shape-dance-sway" }
];

export function shuffleShapeDanceItems<T>(items: T[], random = Math.random): T[] {
  return shuffleItems(items, random);
}

function sequenceLengthFor(settings: SessionSettings, roundIndex: number) {
  if (settings.preset === "gentle") return 2;
  const growth = Math.floor(Math.max(0, roundIndex - 1) / 3);
  if (settings.preset === "challenge") return Math.min(5, 3 + growth);
  return Math.min(4, 2 + growth);
}

function pickFigure(previous: ShapeDanceFigure | undefined, random: () => number) {
  let index = Math.min(shapeDanceFigures.length - 1, Math.floor(random() * shapeDanceFigures.length));
  if (previous && shapeDanceFigures[index].id === previous.id) index = (index + 1) % shapeDanceFigures.length;
  return shapeDanceFigures[index];
}

export function generateShapeDanceRound(settings: SessionSettings, roundIndex = 1, random = Math.random): ShapeDanceRound {
  const sequenceLength = sequenceLengthFor(settings, roundIndex);
  const sequence: ShapeDanceFigure[] = [];

  for (let index = 0; index < sequenceLength; index += 1) {
    sequence.push(pickFigure(sequence[index - 1], random));
  }

  const sequenceFigureIds = new Set(sequence.map((figure) => figure.id));
  const requiredChoices = shapeDanceFigures.filter((figure) => sequenceFigureIds.has(figure.id));
  const choiceCount = Math.min(shapeDanceFigures.length, Math.max(requiredChoices.length, settings.preset === "gentle" ? 3 : 4));
  const distractors = shuffleShapeDanceItems(shapeDanceFigures.filter((figure) => !sequenceFigureIds.has(figure.id)), random).slice(0, choiceCount - requiredChoices.length);

  return {
    roundId: `shape-dance:round:${roundIndex}`,
    sequence,
    choices: shuffleShapeDanceItems([...requiredChoices, ...distractors], random),
    sequenceLength
  };
}
