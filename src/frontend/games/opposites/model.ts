import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../data/wordBank";

export type OppositeConcept = {
  id: string;
  label: string;
  emoji: string;
  tone: string;
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
  mistakeHint: string;
};

function concept(id: string, label: string, emoji: string, tone: string): OppositeConcept {
  return { id, label, emoji, tone };
}

export const oppositePairs: OppositePair[] = [
  { id: "temperature", concepts: [concept("hot", "горячий", "🔥", "deep-orange"), concept("cold", "холодный", "❄️", "light-blue")] },
  { id: "size", concepts: [concept("big", "большой", "🐘", "indigo"), concept("small", "маленький", "🐭", "teal")] },
  { id: "light", concepts: [concept("day", "день", "☀️", "amber"), concept("night", "ночь", "🌙", "blue")] },
  { id: "state", concepts: [concept("open", "открытый", "🚪", "green"), concept("closed", "закрытый", "🔒", "blue-grey")] },
  { id: "direction", concepts: [concept("up", "вверх", "⬆️", "purple"), concept("down", "вниз", "⬇️", "cyan")] },
  { id: "speed", concepts: [concept("fast", "быстрый", "🐇", "pink"), concept("slow", "медленный", "🐢", "lime")] },
  { id: "amount", concepts: [concept("full", "полный", "🧺", "brown"), concept("empty", "пустой", "⭕", "grey")] },
  { id: "emotion", concepts: [concept("happy", "весёлый", "🙂", "yellow"), concept("sad", "грустный", "🙁", "blue")] }
];

function choiceCountFor(settings: SessionSettings) {
  if (settings.preset === "gentle" || settings.distractors === "none") return 3;
  return 4;
}

export function generateOppositesRound(settings: SessionSettings, roundIndex = 1): OppositesRound {
  const choiceCount = choiceCountFor(settings);
  const [pair] = shuffleItems(oppositePairs);
  const sourceIndex = Math.random() < 0.5 ? 0 : 1;
  const source = pair.concepts[sourceIndex];
  const target = pair.concepts[sourceIndex === 0 ? 1 : 0];
  const distractorPool = shuffleItems(oppositePairs.filter((item) => item.id !== pair.id).flatMap((item) => item.concepts));
  const choices = shuffleItems([target, ...distractorPool.slice(0, choiceCount - 1)]);

  return {
    roundId: `opposites:round:${roundIndex}`,
    prompt: `Что наоборот к слову «${source.label}»?`,
    source,
    target,
    choices,
    correctIndex: choices.indexOf(target),
    pairId: pair.id,
    mistakeHint: `Почти. Противоположность к слову «${source.label}» — «${target.label}».`
  };
}
