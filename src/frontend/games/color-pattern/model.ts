import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type ColorPatternKind = "AB" | "ABC" | "ABB";

export type ColorPatternColor = {
  id: string;
  label: string;
  hex: string;
  textColor: string;
};

export type ColorPatternRound = {
  roundId: string;
  patternKind: ColorPatternKind;
  sequence: ColorPatternColor[];
  answer: ColorPatternColor;
  choices: ColorPatternColor[];
  correctIndex: number;
};

export const colorPatternColors: ColorPatternColor[] = [
  { id: "red", label: "красный", hex: "#C62828", textColor: "#FFFFFF" },
  { id: "blue", label: "синий", hex: "#256BD8", textColor: "#FFFFFF" },
  { id: "green", label: "зелёный", hex: "#17683F", textColor: "#FFFFFF" },
  { id: "yellow", label: "жёлтый", hex: "#F7C948", textColor: "#2A2106" },
  { id: "purple", label: "фиолетовый", hex: "#6D3DB5", textColor: "#FFFFFF" },
  { id: "orange", label: "оранжевый", hex: "#F28B2E", textColor: "#2B1708" },
  { id: "teal", label: "бирюзовый", hex: "#075A56", textColor: "#FFFFFF" },
  { id: "pink", label: "розовый", hex: "#B8326E", textColor: "#FFFFFF" }
];

const patternKinds: ColorPatternKind[] = ["AB", "ABC", "ABB"];

function choiceCountFor(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function patternKindFor(roundIndex: number) {
  return patternKinds[(roundIndex - 1) % patternKinds.length];
}

function colorForSymbol(symbol: string, unit: ColorPatternColor[]) {
  if (symbol === "A") return unit[0];
  if (symbol === "B") return unit[1];
  return unit[2];
}

function buildPattern(patternKind: ColorPatternKind, unit: ColorPatternColor[]) {
  const visibleLength = patternKind === "AB" ? 3 : 5;
  const completedLength = visibleLength + 1;
  const completed = Array.from({ length: completedLength }, (_, index) => colorForSymbol(patternKind[index % patternKind.length], unit));

  return {
    sequence: completed.slice(0, visibleLength),
    answer: completed[visibleLength]
  };
}

export function generateColorPatternRound(settings: SessionSettings, roundIndex = 1): ColorPatternRound {
  const patternKind = patternKindFor(roundIndex);
  const unitSize = patternKind === "ABC" ? 3 : 2;
  const choiceCount = choiceCountFor(settings);

  if (colorPatternColors.length < Math.max(unitSize, choiceCount)) throw new Error("Недостаточно цветов для игры.");

  const unit = shuffleItems(colorPatternColors).slice(0, unitSize);
  const { sequence, answer } = buildPattern(patternKind, unit);
  const distractors = shuffleItems(colorPatternColors.filter((color) => color.id !== answer.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([answer, ...distractors]);

  return {
    roundId: `color-pattern:round:${roundIndex}`,
    patternKind,
    sequence,
    answer,
    choices,
    correctIndex: choices.indexOf(answer)
  };
}
