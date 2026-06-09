import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type FindColorOption = {
  id: string;
  label: string;
  hex: string;
  textColor: string;
};

export type FindColorRound = {
  roundId: string;
  prompt: string;
  target: FindColorOption;
  choices: FindColorOption[];
  correctIndex: number;
};

export const findColorOptions: FindColorOption[] = [
  { id: "red", label: "красный", hex: "#D32F2F", textColor: "#FFFFFF" },
  { id: "blue", label: "синий", hex: "#1976D2", textColor: "#FFFFFF" },
  { id: "green", label: "зелёный", hex: "#2E7D32", textColor: "#FFFFFF" },
  { id: "yellow", label: "жёлтый", hex: "#F9A825", textColor: "#1A1A1A" },
  { id: "purple", label: "фиолетовый", hex: "#7B1FA2", textColor: "#FFFFFF" },
  { id: "orange", label: "оранжевый", hex: "#EF6C00", textColor: "#1A1A1A" },
  { id: "teal", label: "бирюзовый", hex: "#00897B", textColor: "#FFFFFF" },
  { id: "pink", label: "розовый", hex: "#C2185B", textColor: "#FFFFFF" }
];

function choiceCountFor(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

export function generateFindColorRound(settings: SessionSettings, roundIndex = 1): FindColorRound {
  const choiceCount = choiceCountFor(settings);
  if (findColorOptions.length < choiceCount) throw new Error("Недостаточно цветов для игры.");

  const [target] = shuffleItems(findColorOptions).slice(0, 1);
  const distractors = shuffleItems(findColorOptions.filter((color) => color.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-color:round:${roundIndex}`,
    prompt: `Найди ${target.label}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
