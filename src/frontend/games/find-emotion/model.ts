import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type FindEmotionOption = {
  id: string;
  label: string;
  emoji: string;
};

export type FindEmotionRound = {
  roundId: string;
  prompt: string;
  target: FindEmotionOption;
  choices: FindEmotionOption[];
  correctIndex: number;
};

export const findEmotionOptions: FindEmotionOption[] = [
  { id: "joy", label: "радость", emoji: "😊" },
  { id: "sadness", label: "грусть", emoji: "😢" },
  { id: "anger", label: "злость", emoji: "😠" },
  { id: "surprise", label: "удивление", emoji: "😮" },
  { id: "calm", label: "спокойствие", emoji: "🙂" },
  { id: "fear", label: "страх", emoji: "😨" },
  { id: "sleepy", label: "сонливость", emoji: "😴" },
  { id: "shy", label: "смущение", emoji: "☺️" }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

export function generateFindEmotionRound(settings: SessionSettings, roundIndex = 1): FindEmotionRound {
  const choiceCount = choiceCountFor(settings);
  if (findEmotionOptions.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  const [target] = shuffleItems(findEmotionOptions).slice(0, 1);
  const distractors = shuffleItems(findEmotionOptions.filter((emotion) => emotion.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `find-emotion:round:${roundIndex}`,
    prompt: `Найди эмоцию: ${target.label}`,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
