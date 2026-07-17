import type { SessionSettings } from "../../core/settings";

export type WhatMissingItem = {
  id: string;
  label: string;
  emoji: string;
  color: string;
};

export type WhatMissingRound = {
  roundId: string;
  prompt: string;
  displayItems: WhatMissingItem[];
  missingItem: WhatMissingItem;
  missingIndex: number;
  choices: WhatMissingItem[];
  correctIndex: number;
};

export type WhatMissingPhase = "instruction" | "observe" | "transition" | "choose" | "feedback";

export type WhatMissingPhaseEvent = "reset" | "instruction-complete" | "observe-complete" | "transition-complete" | "answer" | "retry" | "next-round";

export const DEFAULT_WHAT_MISSING_OBSERVE_MS = 5000;

const phaseTransitions: Record<WhatMissingPhase, Partial<Record<WhatMissingPhaseEvent, WhatMissingPhase>>> = {
  instruction: { reset: "instruction", "instruction-complete": "observe" },
  observe: { reset: "instruction", "observe-complete": "transition" },
  transition: { reset: "instruction", "transition-complete": "choose" },
  choose: { reset: "instruction", answer: "feedback" },
  feedback: { reset: "instruction", retry: "choose", "next-round": "instruction" }
};

export function transitionWhatMissingPhase(phase: WhatMissingPhase, event: WhatMissingPhaseEvent) {
  return phaseTransitions[phase][event] ?? phase;
}

export const whatMissingItems: WhatMissingItem[] = [
  { id: "ball", label: "мяч", emoji: "⚽", color: "blue-lighten-5" },
  { id: "book", label: "книга", emoji: "📘", color: "indigo-lighten-5" },
  { id: "cup", label: "чашка", emoji: "☕", color: "brown-lighten-5" },
  { id: "key", label: "ключ", emoji: "🔑", color: "amber-lighten-5" },
  { id: "lamp", label: "лампа", emoji: "💡", color: "yellow-lighten-5" },
  { id: "box", label: "коробка", emoji: "📦", color: "orange-lighten-5" },
  { id: "backpack", label: "рюкзак", emoji: "🎒", color: "red-lighten-5" },
  { id: "clock", label: "часы", emoji: "🕘", color: "cyan-lighten-5" },
  { id: "camera", label: "камера", emoji: "📷", color: "grey-lighten-4" },
  { id: "umbrella", label: "зонт", emoji: "☂️", color: "purple-lighten-5" }
];

export function shuffleWhatMissingItems<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function generateWhatMissingRound(_settings: SessionSettings, roundIndex = 1, random = Math.random): WhatMissingRound {
  const displayCount = 3;
  if (whatMissingItems.length < displayCount) throw new Error("Недостаточно предметов для игры.");

  const displayItems = shuffleWhatMissingItems(whatMissingItems, random).slice(0, displayCount);
  const missingIndex = Math.floor(random() * displayItems.length);
  const missingItem = displayItems[missingIndex];
  const decoyItems = whatMissingItems.filter((item) => !displayItems.some((displayItem) => displayItem.id === item.id));
  const decoy = decoyItems[Math.floor(random() * decoyItems.length)];
  const choices = shuffleWhatMissingItems([...displayItems, decoy], random);

  return {
    roundId: `what-missing:round:${roundIndex}`,
    prompt: "Запомни предметы. Что пропало?",
    displayItems,
    missingItem,
    missingIndex,
    choices,
    correctIndex: choices.indexOf(missingItem)
  };
}
