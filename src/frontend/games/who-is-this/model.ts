import type { SessionSettings } from "../../core/settings";
import { sampleItems, shuffleItems } from "../../core/random";

export type WhoIsThisChoice = {
  id: string;
  label: string;
  accusative: string;
  icon: string;
  color: string;
  setting: string;
};

export type WhoIsThisRound = {
  roundId: string;
  prompt: string;
  target: WhoIsThisChoice;
  choices: WhoIsThisChoice[];
  correctIndex: number;
};

export const whoIsThisVocabulary: WhoIsThisChoice[] = [
  { id: "mom", label: "мама", accusative: "маму", icon: "mdi-human-female", color: "#b95f9d", setting: "дома" },
  { id: "dad", label: "папа", accusative: "папу", icon: "mdi-human-male", color: "#5f7fc7", setting: "дома" },
  { id: "doctor", label: "врач", accusative: "врача", icon: "mdi-medical-bag", color: "#2c9ca3", setting: "в кабинете" },
  { id: "friend", label: "друг", accusative: "друга", icon: "mdi-account-heart", color: "#43a047", setting: "рядом" },
  { id: "cat", label: "кот", accusative: "кота", icon: "mdi-cat", color: "#8d6e63", setting: "на коврике" },
  { id: "dog", label: "пёс", accusative: "пса", icon: "mdi-dog", color: "#a66a3f", setting: "у двери" },
  { id: "teacher", label: "учитель", accusative: "учителя", icon: "mdi-school", color: "#6d65c7", setting: "в классе" },
  { id: "grandma", label: "бабушка", accusative: "бабушку", icon: "mdi-human-cane", color: "#c47d3c", setting: "в комнате" }
];

export function generateWhoIsThisRound(settings: SessionSettings, roundIndex = 1, random = Math.random): WhoIsThisRound {
  const choiceCount = settings.distractors === "none" ? 3 : 4;
  if (whoIsThisVocabulary.length < choiceCount) throw new Error("Недостаточно слов для игры 'Кто это?'.");

  const target = shuffleItems(whoIsThisVocabulary, random)[(roundIndex - 1) % whoIsThisVocabulary.length];
  const decoys = sampleItems(whoIsThisVocabulary, choiceCount - 1, [target], random);
  const choices = shuffleItems([target, ...decoys], random);

  return {
    roundId: `who-is-this:round:${roundIndex}`,
    prompt: "Кто это на картинке?",
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
