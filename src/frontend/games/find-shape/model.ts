import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type FindShapeId = "circle" | "square" | "triangle" | "star" | "heart" | "diamond";

export type FindShapeOption = {
  id: FindShapeId;
  label: string;
  promptLabel: string;
};

export type FindShapeRound = {
  roundId: string;
  prompt: string;
  target: FindShapeOption;
  choices: FindShapeOption[];
  correctIndex: number;
};

export const findShapeOptions: FindShapeOption[] = [
  { id: "circle", label: "круг", promptLabel: "круг" },
  { id: "square", label: "квадрат", promptLabel: "квадрат" },
  { id: "triangle", label: "треугольник", promptLabel: "треугольник" },
  { id: "star", label: "звезда", promptLabel: "звезду" },
  { id: "heart", label: "сердце", promptLabel: "сердце" },
  { id: "diamond", label: "ромб", promptLabel: "ромб" }
];

function choiceCountFor(settings: SessionSettings, roundIndex: number) {
  if (settings.preset === "gentle") return 2 + ((roundIndex - 1) % 2);
  if (settings.preset === "challenge") return 3 + ((roundIndex - 1) % 3);
  return 2 + ((roundIndex - 1) % 4);
}

export function generateFindShapeRound(settings: SessionSettings, roundIndex = 1): FindShapeRound {
  const choiceCount = choiceCountFor(settings, roundIndex);
  if (findShapeOptions.length < choiceCount) throw new Error("Недостаточно форм для игры.");

  const target = findShapeOptions[(roundIndex - 1) % findShapeOptions.length];
  const distractors = shuffleItems(findShapeOptions.filter((shape) => shape.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-shape:round:${roundIndex}`,
    prompt: `Покажи: ${target.promptLabel}`,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === target.id)
  };
}
