import type { SessionSettings } from "../../core/settings";
import { sampleItems, shuffleItems } from "../../data/wordBank";

export type LogicPairRelation = "meaning" | "shape" | "number";

export type LogicPairCard = {
  id: string;
  label: string;
  visual: string;
};

export type LogicPairDefinition = {
  id: string;
  relation: LogicPairRelation;
  target: LogicPairCard;
  pair: LogicPairCard;
  explanation: string;
};

export type LogicPairsRound = {
  roundId: string;
  prompt: string;
  instruction: string;
  relation: LogicPairRelation;
  target: LogicPairCard;
  pair: LogicPairCard;
  choices: LogicPairCard[];
  correctIndex: number;
  explanation: string;
};

export const logicPairDefinitions: LogicPairDefinition[] = [
  {
    id: "key-lock",
    relation: "meaning",
    target: { id: "key", label: "ключ", visual: "🔑" },
    pair: { id: "lock", label: "замок", visual: "🔒" },
    explanation: "Ключ подходит к замку."
  },
  {
    id: "spoon-bowl",
    relation: "meaning",
    target: { id: "spoon", label: "ложка", visual: "🥄" },
    pair: { id: "bowl", label: "миска", visual: "🥣" },
    explanation: "Ложка подходит к миске."
  },
  {
    id: "hand-glove",
    relation: "meaning",
    target: { id: "hand", label: "рука", visual: "✋" },
    pair: { id: "glove", label: "перчатка", visual: "🧤" },
    explanation: "Перчатка надевается на руку."
  },
  {
    id: "circle-round",
    relation: "shape",
    target: { id: "circle-name", label: "круг", visual: "○" },
    pair: { id: "circle-shape", label: "круглая форма", visual: "●" },
    explanation: "Слово «круг» подходит к круглой форме."
  },
  {
    id: "triangle-shape",
    relation: "shape",
    target: { id: "triangle-name", label: "треугольник", visual: "△" },
    pair: { id: "triangle-shape", label: "треугольная форма", visual: "▲" },
    explanation: "Слово «треугольник» подходит к треугольной форме."
  },
  {
    id: "square-shape",
    relation: "shape",
    target: { id: "square-name", label: "квадрат", visual: "□" },
    pair: { id: "square-shape", label: "квадратная форма", visual: "■" },
    explanation: "Слово «квадрат» подходит к квадратной форме."
  },
  {
    id: "two-dots",
    relation: "number",
    target: { id: "number-2", label: "цифра два", visual: "2" },
    pair: { id: "dots-2", label: "две точки", visual: "••" },
    explanation: "Цифра 2 подходит к двум точкам."
  },
  {
    id: "three-dots",
    relation: "number",
    target: { id: "number-3", label: "цифра три", visual: "3" },
    pair: { id: "dots-3", label: "три точки", visual: "•••" },
    explanation: "Цифра 3 подходит к трём точкам."
  },
  {
    id: "four-dots",
    relation: "number",
    target: { id: "number-4", label: "цифра четыре", visual: "4" },
    pair: { id: "dots-4", label: "четыре точки", visual: "••••" },
    explanation: "Цифра 4 подходит к четырём точкам."
  }
];

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function promptForRelation(relation: LogicPairRelation) {
  if (relation === "meaning") return "Что подходит по смыслу?";
  if (relation === "shape") return "Что подходит по форме?";
  return "Что подходит по числу?";
}

export function generateLogicPairsRound(settings: SessionSettings, roundIndex = 1): LogicPairsRound {
  const choiceCount = choiceCountForSettings(settings);
  if (logicPairDefinitions.length < choiceCount) throw new Error("Недостаточно логических пар для игры.");

  const targetPair = logicPairDefinitions[(roundIndex - 1) % logicPairDefinitions.length];
  const distractorPairs = logicPairDefinitions.filter((pair) => pair.id !== targetPair.id);
  const distractors = sampleItems(distractorPairs, choiceCount - 1).map((pair) => pair.pair);
  const choices = shuffleItems([targetPair.pair, ...distractors]);

  return {
    roundId: `logic-pairs:round:${roundIndex}`,
    prompt: promptForRelation(targetPair.relation),
    instruction: "Выбери карточку, которая образует пару.",
    relation: targetPair.relation,
    target: targetPair.target,
    pair: targetPair.pair,
    choices,
    correctIndex: choices.findIndex((choice) => choice.id === targetPair.pair.id),
    explanation: targetPair.explanation
  };
}
