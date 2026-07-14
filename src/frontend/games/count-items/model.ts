import { randomInt, shuffleItems } from "../../core/random";
import type { SessionSettings } from "../../core/settings";

export type CountItemsRound = {
  roundId: string;
  targetCount: number;
  itemId: string;
  itemName: string;
  itemEmoji: string;
  choices: number[];
  correctIndex: number;
};

const countItems = [
  { id: "apple", name: "яблоко", emoji: "🍎" },
  { id: "star", name: "звезда", emoji: "⭐" },
  { id: "flower", name: "цветок", emoji: "🌸" },
  { id: "fish", name: "рыба", emoji: "🐟" },
  { id: "butterfly", name: "бабочка", emoji: "🦋" },
  { id: "ball", name: "мяч", emoji: "🟡" }
];

export function generateCountItemsRound(settings: SessionSettings, roundIndex = 1, random = Math.random): CountItemsRound {
  const max = settings.preset === "gentle" ? 3 : 9;
  const choiceCount = settings.preset === "gentle" ? 2 : 4;
  const targetCount = randomInt(1, max, random);
  const nearby = [targetCount - 1, targetCount + 1, targetCount + 2, targetCount - 2]
   .filter((value) => value >= 1 && value <= 9 && value !== targetCount);
  const choices = new Set([targetCount]);
  for (const value of shuffleItems(nearby, random)) {
    if (choices.size < choiceCount) choices.add(value);
  }
  for (const value of shuffleItems([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
    if (choices.size < choiceCount && value !== targetCount) choices.add(value);
  }
  const shuffled = shuffleItems([...choices], random).slice(0, choiceCount);
  const item = countItems[randomInt(0, countItems.length - 1, random)];
  return {
    roundId: `count-items:round:${roundIndex}`,
    targetCount,
    itemId: item.id,
    itemName: item.name,
    itemEmoji: item.emoji,
    choices: shuffled,
    correctIndex: shuffled.indexOf(targetCount)
  };
}
