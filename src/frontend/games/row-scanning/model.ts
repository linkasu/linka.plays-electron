import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type RowScanningItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export type RowScanningRound = {
  roundId: string;
  prompt: string;
  target: RowScanningItem;
  choices: RowScanningItem[];
  correctIndex: number;
};

export const rowScanningItems: RowScanningItem[] = [
  { id: "sun", label: "солнце", icon: "mdi-white-balance-sunny", color: "amber" },
  { id: "moon", label: "луна", icon: "mdi-moon-waning-crescent", color: "indigo" },
  { id: "star", label: "звезда", icon: "mdi-star", color: "yellow-darken-2" },
  { id: "leaf", label: "лист", icon: "mdi-leaf", color: "green" },
  { id: "flower", label: "цветок", icon: "mdi-flower", color: "pink" },
  { id: "heart", label: "сердце", icon: "mdi-heart", color: "red" },
  { id: "cloud", label: "облако", icon: "mdi-cloud", color: "light-blue" },
  { id: "umbrella", label: "зонт", icon: "mdi-umbrella", color: "deep-purple" },
  { id: "bell", label: "колокольчик", icon: "mdi-bell", color: "orange" },
  { id: "fish", label: "рыбка", icon: "mdi-fish", color: "teal" }
];

function choiceCountFor(settings: SessionSettings, roundIndex: number) {
  if (settings.preset === "gentle") return 4;
  if (settings.preset === "challenge") return 7;
  return 5 + (roundIndex % 2);
}

export function generateRowScanningRound(settings: SessionSettings, roundIndex = 1): RowScanningRound {
  const choiceCount = choiceCountFor(settings, roundIndex);
  if (rowScanningItems.length < choiceCount) throw new Error("Недостаточно объектов для сканирования ряда.");

  const choices = shuffleItems(rowScanningItems).slice(0, choiceCount);
  const target = choices[(roundIndex * 2) % choices.length];

  return {
    roundId: `row-scanning:round:${roundIndex}`,
    prompt: `Найди: ${target.label}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
