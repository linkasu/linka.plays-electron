import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type OppositeConcept = {
  id: string;
  label: string;
  emoji: string;
  tone: string;
  referenceId: string;
  visualState: string;
  assetId?: string;
  stateMarker?: string;
};

export type OppositePair = {
  id: string;
  concepts: [OppositeConcept, OppositeConcept];
};

export type OppositesRound = {
  roundId: string;
  prompt: string;
  source: OppositeConcept;
  target: OppositeConcept;
  choices: OppositeConcept[];
  correctIndex: number;
  pairId: string;
};

function concept(
  id: string,
  label: string,
  emoji: string,
  tone: string,
  referenceId: string,
  visualState: string,
  assetId?: string,
  stateMarker?: string
): OppositeConcept {
  return { id, label, emoji, tone, referenceId, visualState, assetId, stateMarker };
}

export const oppositePairs: OppositePair[] = [
  { id: "temperature", concepts: [concept("hot", "горячий", "☕", "deep-orange", "cup", "hot", "cup", "🔥"), concept("cold", "холодный", "☕", "light-blue", "cup", "cold", "cup", "❄️")] },
  { id: "size", concepts: [concept("big", "большой", "⚽", "indigo", "ball", "big", "ball"), concept("small", "маленький", "⚽", "teal", "ball", "small", "ball")] },
  { id: "light", concepts: [concept("day", "день", "🏠", "amber", "house", "day", "house", "☀️"), concept("night", "ночь", "🏠", "blue", "house", "night", "house", "🌙")] },
  { id: "state", concepts: [concept("open", "открытый", "🚪", "green", "door", "open", "door"), concept("closed", "закрытый", "🚪", "blue-grey", "door", "closed", "door", "🔒")] },
  { id: "direction", concepts: [concept("up", "вверх", "⬆️", "purple", "arrow", "up"), concept("down", "вниз", "⬆️", "cyan", "arrow", "down")] },
  { id: "speed", concepts: [concept("fast", "быстрый", "🚗", "pink", "car", "fast", "car", "💨"), concept("slow", "медленный", "🚗", "lime", "car", "slow", "car", "•••")] },
  { id: "amount", concepts: [concept("full", "полный", "🧺", "brown", "basket", "full", "basket", "🍎"), concept("empty", "пустой", "🧺", "grey", "basket", "empty", "basket")] },
  { id: "emotion", concepts: [concept("happy", "весёлый", "🙂", "yellow", "face", "happy"), concept("sad", "грустный", "🙁", "blue", "face", "sad")] }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle" || settings.distractors === "none") return 3;
  return 4;
}

export function generateOppositesRound(settings: SessionSettings, roundIndex = 1, random = Math.random): OppositesRound {
  const choiceCount = choiceCountFor(settings);
  const [pair] = shuffleItems(oppositePairs, random);
  const sourceIndex = random() < 0.5 ? 0 : 1;
  const source = pair.concepts[sourceIndex];
  const target = pair.concepts[sourceIndex === 0 ? 1 : 0];
  const distractorPool = shuffleItems(oppositePairs.filter((item) => item.id !== pair.id).flatMap((item) => item.concepts), random);
  const choices = shuffleItems([target, ...distractorPool.slice(0, choiceCount - 1)], random);

  return {
    roundId: `opposites:round:${roundIndex}`,
    prompt: `Найди противоположность слову «${source.label}»`,
    source,
    target,
    choices,
    correctIndex: choices.indexOf(target),
    pairId: pair.id
  };
}
