import { shuffleItems } from "../../data/wordBank";
import type { SessionSettings } from "../../core/settings";

export type CountItemsRound = {
  roundId: string;
  targetCount: number;
  itemEmoji: string;
  choices: number[];
  correctIndex: number;
};

const itemEmojis = ["🍎", "⭐", "🌸", "🐟", "🦋", "🟡"];

export function generateCountItemsRound(settings: SessionSettings, roundIndex = 1): CountItemsRound {
  const max = settings.preset === "gentle" ? 3 : 9;
  const choiceCount = settings.preset === "gentle" ? 2 : 4;
  const targetCount = 1 + Math.floor(Math.random() * max);
  const nearby = [targetCount - 1, targetCount + 1, targetCount + 2, targetCount - 2]
    .filter((value) => value >= 1 && value <= 9 && value !== targetCount);
  const choices = new Set([targetCount]);
  for (const value of shuffleItems(nearby)) {
    if (choices.size < choiceCount) choices.add(value);
  }
  for (const value of shuffleItems([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (choices.size < choiceCount && value !== targetCount) choices.add(value);
  }
  const shuffled = shuffleItems([...choices]).slice(0, choiceCount);
  return {
    roundId: `count-items:round:${roundIndex}`,
    targetCount,
    itemEmoji: itemEmojis[Math.floor(Math.random() * itemEmojis.length)],
    choices: shuffled,
    correctIndex: shuffled.indexOf(targetCount)
  };
}
