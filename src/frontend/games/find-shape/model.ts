import type { SessionSettings } from "../../core/settings";
import { buildChoiceRound, choiceCountByPreset, idEquality, pickByRoundIndex, type ChoiceRound } from "../../core/round";

export type FindShapeId = "circle" | "square" | "triangle" | "star" | "heart" | "diamond";

export type FindShapeOption = {
  id: FindShapeId;
  label: string;
  promptLabel: string;
};

export type FindShapeRound = ChoiceRound<FindShapeOption>;

export const findShapeOptions: FindShapeOption[] = [
  { id: "circle", label: "круг", promptLabel: "круг" },
  { id: "square", label: "квадрат", promptLabel: "квадрат" },
  { id: "triangle", label: "треугольник", promptLabel: "треугольник" },
  { id: "star", label: "звезда", promptLabel: "звезду" },
  { id: "heart", label: "сердце", promptLabel: "сердце" },
  { id: "diamond", label: "ромб", promptLabel: "ромб" }
];

export function generateFindShapeRound(settings: SessionSettings, roundIndex = 1): FindShapeRound {
  const choiceCount = choiceCountByPreset(settings, roundIndex, {
    gentle: (index) => 2 + ((index - 1) % 2),
    standard: (index) => 2 + ((index - 1) % 4),
    challenge: (index) => 3 + ((index - 1) % 3)
  });
  if (findShapeOptions.length < choiceCount) throw new Error("Недостаточно форм для игры.");

  return buildChoiceRound({
    idPrefix: "find-shape",
    roundIndex,
    items: findShapeOptions,
    choiceCount,
    pickTarget: (items, index) => pickByRoundIndex(items, index),
    isSame: idEquality,
    prompt: (target) => `Покажи: ${target.promptLabel}`
  });
}
