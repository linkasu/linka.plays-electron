import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickByRoundIndex, type ChoiceRound } from "../../core/round";

export type ShapeId = "circle" | "square" | "triangle" | "star";

export type ShapeOption = {
  id: ShapeId;
  label: string;
};

export type ShapesRound = ChoiceRound<ShapeOption>;

export const shapeOptions: ShapeOption[] = [
  { id: "circle", label: "круг" },
  { id: "square", label: "квадрат" },
  { id: "triangle", label: "треугольник" },
  { id: "star", label: "звезду" }
];

export function generateShapesRound(settings: SessionSettings, roundIndex = 1): ShapesRound {
  return buildChoiceRound({
    idPrefix: "shapes",
    roundIndex,
    items: shapeOptions,
    choiceCount: choiceCountByPreset(settings, roundIndex, { gentle: 3, standard: 4, challenge: 4 }),
    pickTarget: (items, index) => pickByRoundIndex(items, index),
    isSame: idEquality,
    prompt: (target) => `Найди ${target.label}`
  });
}
