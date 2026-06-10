import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type PizzaFractionId = "whole" | "half" | "quarter";

export type PizzaFractionChoice = {
  id: PizzaFractionId;
  label: string;
  promptLabel: string;
  shortLabel: string;
  filledSlices: number;
  totalSlices: number;
  helperText: string;
};

export type PizzaFractionsRound = {
  roundId: string;
  prompt: string;
  targetId: PizzaFractionId;
  choices: PizzaFractionChoice[];
  correctIndex: number;
  mistakeHint: string;
};

export const pizzaFractionChoices: PizzaFractionChoice[] = [
  {
    id: "whole",
    label: "Целое",
    promptLabel: "целую пиццу",
    shortLabel: "1",
    filledSlices: 4,
    totalSlices: 4,
    helperText: "Заполнена вся пицца."
  },
  {
    id: "half",
    label: "Половина",
    promptLabel: "половину пиццы",
    shortLabel: "1/2",
    filledSlices: 2,
    totalSlices: 4,
    helperText: "Заполнены две части из четырёх."
  },
  {
    id: "quarter",
    label: "Четверть",
    promptLabel: "четверть пиццы",
    shortLabel: "1/4",
    filledSlices: 1,
    totalSlices: 4,
    helperText: "Заполнена одна часть из четырёх."
  }
];

const targetOrder: PizzaFractionId[] = ["half", "quarter", "whole"];

function pickTarget(roundIndex: number) {
  return targetOrder[(Math.max(1, roundIndex) - 1) % targetOrder.length];
}

export function generatePizzaFractionsRound(_settings: SessionSettings, roundIndex = 1): PizzaFractionsRound {
  const targetId = pickTarget(roundIndex);
  const target = pizzaFractionChoices.find((choice) => choice.id === targetId) ?? pizzaFractionChoices[0];
  const choices = shuffleItems(pizzaFractionChoices);

  return {
    roundId: `pizza-fractions:round:${roundIndex}`,
    prompt: `Выбери ${target.promptLabel}`,
    targetId,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === targetId),
    mistakeHint: `Почти. Правильная доля: ${target.label.toLowerCase()}.`
  };
}
