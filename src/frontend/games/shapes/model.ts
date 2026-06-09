import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type ShapeId = "circle" | "square" | "triangle" | "star";

export type ShapeOption = {
  id: ShapeId;
  label: string;
};

export type ShapesRound = {
  roundId: string;
  prompt: string;
  target: ShapeOption;
  choices: ShapeOption[];
  correctIndex: number;
};

export const shapeOptions: ShapeOption[] = [
  { id: "circle", label: "круг" },
  { id: "square", label: "квадрат" },
  { id: "triangle", label: "треугольник" },
  { id: "star", label: "звезду" }
];

export function generateShapesRound(settings: SessionSettings, roundIndex = 1): ShapesRound {
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const target = shapeOptions[(roundIndex - 1) % shapeOptions.length];
  const distractors = shuffleItems(shapeOptions.filter((shape) => shape.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `shapes:round:${roundIndex}`,
    prompt: `Найди ${target.label}`,
    target,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === target.id)
  };
}
