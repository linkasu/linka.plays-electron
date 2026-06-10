import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type ChooseEmotionOption = {
  id: string;
  label: string;
  emoji: string;
};

export type ChooseEmotionScenario = {
  id: string;
  prompt: string;
  detail: string;
  cueEmoji: string;
  targetId: string;
};

export type ChooseEmotionRound = {
  roundId: string;
  prompt: string;
  detail: string;
  cueEmoji: string;
  target: ChooseEmotionOption;
  choices: ChooseEmotionOption[];
  correctIndex: number;
};

export const chooseEmotionOptions: ChooseEmotionOption[] = [
  { id: "joy", label: "радость", emoji: "😊" },
  { id: "sadness", label: "грусть", emoji: "😢" },
  { id: "anger", label: "злость", emoji: "😠" },
  { id: "surprise", label: "удивление", emoji: "😮" },
  { id: "calm", label: "спокойствие", emoji: "🙂" },
  { id: "fear", label: "страх", emoji: "😟" },
  { id: "tired", label: "усталость", emoji: "😴" },
  { id: "pride", label: "гордость", emoji: "☺️" }
];

export const chooseEmotionScenarios: ChooseEmotionScenario[] = [
  { id: "gift", prompt: "Лена получила подарок.", detail: "Что она чувствует?", cueEmoji: "🎁", targetId: "joy" },
  { id: "broken-toy", prompt: "У Саши сломалась любимая машинка.", detail: "Что он чувствует?", cueEmoji: "🚗", targetId: "sadness" },
  { id: "loud-noise", prompt: "За окном внезапно громко хлопнуло.", detail: "Что чувствует ребёнок?", cueEmoji: "⚡", targetId: "fear" },
  { id: "tower-fell", prompt: "Башня упала, хотя Миша старался.", detail: "Что он может чувствовать?", cueEmoji: "🧱", targetId: "anger" },
  { id: "new-puppy", prompt: "На пороге появился маленький щенок.", detail: "Что чувствует лицо?", cueEmoji: "😮", targetId: "surprise" },
  { id: "quiet-blanket", prompt: "Аня сидит под мягким пледом и слушает дождь.", detail: "Что она чувствует?", cueEmoji: "☔", targetId: "calm" },
  { id: "long-walk", prompt: "После длинной прогулки Паша зевает.", detail: "Что он чувствует?", cueEmoji: "🥱", targetId: "tired" },
  { id: "finished-drawing", prompt: "Ника сама закончила красивый рисунок.", detail: "Что она чувствует?", cueEmoji: "🖍️", targetId: "pride" },
  { id: "happy-face", prompt: "Посмотри на лицо.", detail: "Какую эмоцию оно показывает?", cueEmoji: "😊", targetId: "joy" },
  { id: "sad-face", prompt: "Посмотри на лицо.", detail: "Какую эмоцию оно показывает?", cueEmoji: "😢", targetId: "sadness" },
  { id: "calm-face", prompt: "Посмотри на лицо.", detail: "Какую эмоцию оно показывает?", cueEmoji: "🙂", targetId: "calm" },
  { id: "surprised-face", prompt: "Посмотри на лицо.", detail: "Какую эмоцию оно показывает?", cueEmoji: "😮", targetId: "surprise" }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

export function generateChooseEmotionRound(settings: SessionSettings, roundIndex = 1): ChooseEmotionRound {
  const choiceCount = choiceCountFor(settings);
  if (chooseEmotionOptions.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  const scenario = chooseEmotionScenarios[(roundIndex - 1) % chooseEmotionScenarios.length];
  const target = chooseEmotionOptions.find((emotion) => emotion.id === scenario.targetId);
  if (!target) throw new Error(`Не найдена эмоция для сценария ${scenario.id}.`);

  const distractors = shuffleItems(chooseEmotionOptions.filter((emotion) => emotion.id !== target.id)).slice(0, choiceCount - 1);
  const choices = shuffleItems([target, ...distractors]);

  return {
    roundId: `choose-emotion:round:${roundIndex}`,
    prompt: scenario.prompt,
    detail: scenario.detail,
    cueEmoji: scenario.cueEmoji,
    target,
    choices,
    correctIndex: choices.indexOf(target)
  };
}
