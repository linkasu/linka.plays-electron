import type { SessionSettings } from "../../core/settings";
import { randomInt, shuffleItems } from "../../core/random";

export type PatternKind = "ABAB" | "ABCABC" | "AAB";

export type PatternItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export type PatternRound = {
  roundId: string;
  patternKind: PatternKind;
  sequence: PatternItem[];
  answer: PatternItem;
  choices: PatternItem[];
  correctIndex: number;
};

const patternItems: PatternItem[] = [
  { id: "red-circle", label: "красный круг", icon: "mdi-circle", color: "#ef5350" },
  { id: "blue-square", label: "синий квадрат", icon: "mdi-square", color: "#42a5f5" },
  { id: "yellow-triangle", label: "жёлтый треугольник", icon: "mdi-triangle", color: "#fbc02d" },
  { id: "purple-diamond", label: "фиолетовый ромб", icon: "mdi-rhombus", color: "#7e57c2" },
  { id: "green-hexagon", label: "зелёный шестиугольник", icon: "mdi-hexagon", color: "#66bb6a" },
  { id: "orange-star", label: "оранжевая звезда", icon: "mdi-star", color: "#fb8c00" }
];

const standardPatternKinds: PatternKind[] = ["ABCABC", "AAB"];

function patternKindFor(settings: SessionSettings, random = Math.random): PatternKind {
  if (settings.preset === "gentle") return "ABAB";
  return standardPatternKinds[randomInt(0, standardPatternKinds.length - 1, random)];
}

function buildSequence(patternKind: PatternKind, items: PatternItem[]) {
  if (patternKind === "ABAB") return { sequence: [items[0], items[1], items[0]], answer: items[1] };
  if (patternKind === "ABCABC") return { sequence: [items[0], items[1], items[2], items[0], items[1]], answer: items[2] };
  return { sequence: [items[0], items[0], items[1], items[0], items[0]], answer: items[1] };
}

export function generatePatternRound(settings: SessionSettings, roundIndex = 1, random = Math.random): PatternRound {
  const patternKind = patternKindFor(settings, random);
  const unitSize = patternKind === "ABCABC" ? 3 : 2;
  const unit = shuffleItems(patternItems, random).slice(0, unitSize);
  const { sequence, answer } = buildSequence(patternKind, unit);
  const choiceCount = settings.preset === "gentle" ? 3 : 4;
  const distractors = shuffleItems(patternItems.filter((item) => item.id !== answer.id), random).slice(0, choiceCount - 1);
  const choices = shuffleItems([answer, ...distractors], random);

  return {
    roundId: `patterns:round:${roundIndex}`,
    patternKind,
    sequence,
    answer,
    choices,
    correctIndex: choices.indexOf(answer)
  };
}
