import type { SessionSettings } from "../../core/settings";
import { createNonRepeatingRandomIndexGenerator, shuffleItems } from "../../core/random";

export type ChooseEmotionMode = "face" | "situation";

export type ChooseEmotionOption = {
  id: string;
  label: string;
  emoji: string;
};

export type ChooseEmotionScenario = {
  id: string;
  mode: ChooseEmotionMode;
  prompt: string;
  detail: string;
  cueEmoji: string;
  targetId: string;
};

export type ChooseEmotionRound = {
  roundId: string;
  scenarioId: string;
  mode: ChooseEmotionMode;
  prompt: string;
  detail: string;
  cueEmoji: string;
  target: ChooseEmotionOption;
  choices: ChooseEmotionOption[];
  correctIndex: number;
};

export const chooseEmotionFaces: ChooseEmotionOption[] = [
  { id: "joy", label: "радость", emoji: "😊" },
  { id: "sadness", label: "грусть", emoji: "😢" },
  { id: "anger", label: "злость", emoji: "😠" },
  { id: "surprise", label: "удивление", emoji: "😮" },
  { id: "calm", label: "спокойствие", emoji: "🙂" },
  { id: "fear", label: "страх", emoji: "😟" },
  { id: "tired", label: "усталость", emoji: "😴" },
  { id: "pride", label: "гордость", emoji: "☺️" }
];

export const chooseEmotionFacePrompt = "Что чувствует лицо?";

export const chooseEmotionFaceScenarios: ChooseEmotionScenario[] = chooseEmotionFaces.map((face) => ({
  id: `face-${face.id}`,
  mode: "face",
  prompt: chooseEmotionFacePrompt,
  detail: "Посмотри на выражение лица.",
  cueEmoji: face.emoji,
  targetId: face.id
}));

export const chooseEmotionSituationScenarios: ChooseEmotionScenario[] = [
  { id: "gift", mode: "situation", prompt: "Лена получила подарок.", detail: "Что она чувствует?", cueEmoji: "🎁", targetId: "joy" },
  { id: "broken-toy", mode: "situation", prompt: "У Саши сломалась любимая машинка.", detail: "Что он чувствует?", cueEmoji: "🚗", targetId: "sadness" },
  { id: "loud-noise", mode: "situation", prompt: "За окном внезапно громко хлопнуло.", detail: "Что чувствует ребёнок?", cueEmoji: "⚡", targetId: "fear" },
  { id: "tower-fell", mode: "situation", prompt: "Башня упала, хотя Миша старался.", detail: "Что он может чувствовать?", cueEmoji: "🧱", targetId: "anger" },
  { id: "new-puppy", mode: "situation", prompt: "На пороге появился маленький щенок.", detail: "Что чувствует ребёнок?", cueEmoji: "🐶", targetId: "surprise" },
  { id: "rain-blanket", mode: "situation", prompt: "Аня сидит под пледом и слушает дождь.", detail: "Что она чувствует?", cueEmoji: "☔", targetId: "calm" },
  { id: "long-walk", mode: "situation", prompt: "После длинной прогулки Паша зевает.", detail: "Что он чувствует?", cueEmoji: "🥱", targetId: "tired" },
  { id: "finished-drawing", mode: "situation", prompt: "Ника сама закончила красивый рисунок.", detail: "Что она чувствует?", cueEmoji: "🖍️", targetId: "pride" }
];

export const chooseEmotionScenarioDecks: Record<ChooseEmotionMode, ChooseEmotionScenario[]> = {
  face: chooseEmotionFaceScenarios,
  situation: chooseEmotionSituationScenarios
};

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

function balancedCorrectIndex(choiceCount: number, roundIndex: number) {
  if (choiceCount === 2) return (roundIndex - 1) % 2;
  const zone = (roundIndex - 1) % 3;
  if (zone === 0) return 0;
  if (zone === 2) return choiceCount - 1;
  const centerOffset = Math.floor((roundIndex - 1) / 3);
  return Math.floor((choiceCount - 1) / 2) + centerOffset % (choiceCount % 2 === 0 ? 2 : 1);
}

function buildChooseEmotionRound(settings: SessionSettings, scenario: ChooseEmotionScenario, roundIndex: number, correctIndex: number, random = Math.random): ChooseEmotionRound {
  const choiceCount = choiceCountFor(settings);
  if (chooseEmotionFaces.length < choiceCount) throw new Error("Недостаточно эмоций для игры.");

  const target = chooseEmotionFaces.find((emotion) => emotion.id === scenario.targetId);
  if (!target) throw new Error(`Не найдена эмоция для сценария ${scenario.id}.`);

  const distractors = shuffleItems(chooseEmotionFaces.filter((emotion) => emotion.id !== target.id), random).slice(0, choiceCount - 1);
  const choices = [...distractors];
  choices.splice(correctIndex, 0, target);

  return {
    roundId: `choose-emotion:round:${roundIndex}`,
    scenarioId: scenario.id,
    mode: scenario.mode,
    prompt: scenario.prompt,
    detail: scenario.detail,
    cueEmoji: scenario.cueEmoji,
    target,
    choices,
    correctIndex
  };
}

export function generateChooseEmotionRound(settings: SessionSettings, mode: ChooseEmotionMode, roundIndex = 1, random = Math.random): ChooseEmotionRound {
  const scenarios = chooseEmotionScenarioDecks[mode];
  const scenario = scenarios[(roundIndex - 1) % scenarios.length];
  const choiceCount = choiceCountFor(settings);
  return buildChooseEmotionRound(settings, scenario, roundIndex, balancedCorrectIndex(choiceCount, roundIndex), random);
}

export function createChooseEmotionRoundGenerator(mode: ChooseEmotionMode, random = Math.random) {
  const scenarios = chooseEmotionScenarioDecks[mode];
  const scenarioIndexes = createNonRepeatingRandomIndexGenerator(scenarios.length, random);
  const positionStates = new Map<number, { zones: ReturnType<typeof createNonRepeatingRandomIndexGenerator>; centerOffset: number }>();

  return (settings: SessionSettings, roundIndex = 1) => {
    const scenarioIndex = scenarioIndexes.next();
    if (scenarioIndex === undefined) throw new Error(`Нет сценариев для режима ${mode}.`);

    const choiceCount = choiceCountFor(settings);
    let positionState = positionStates.get(choiceCount);
    if (!positionState) {
      positionState = { zones: createNonRepeatingRandomIndexGenerator(choiceCount === 2 ? 2 : 3, random), centerOffset: 0 };
      positionStates.set(choiceCount, positionState);
    }
    const zone = positionState.zones.next();
    if (zone === undefined) throw new Error("Нет доступных позиций для правильного ответа.");

    let correctIndex = zone;
    if (choiceCount > 2 && zone === 2) correctIndex = choiceCount - 1;
    if (choiceCount > 2 && zone === 1) {
      const centerIndexes = choiceCount % 2 === 0 ? [choiceCount / 2 - 1, choiceCount / 2] : [Math.floor(choiceCount / 2)];
      correctIndex = centerIndexes[positionState.centerOffset % centerIndexes.length];
      positionState.centerOffset += 1;
    }

    return buildChooseEmotionRound(settings, scenarios[scenarioIndex], roundIndex, correctIndex, random);
  };
}
