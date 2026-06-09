import type { SessionSettings } from "../../core/settings";

export type GreaterLessSide = "left" | "right";
export type GreaterLessComparison = "more" | "less";

export type GreaterLessGroup = {
  side: GreaterLessSide;
  count: number;
  emoji: string;
  items: string[];
};

export type GreaterLessRound = {
  roundId: string;
  prompt: string;
  comparison: GreaterLessComparison;
  left: GreaterLessGroup;
  right: GreaterLessGroup;
  correctSide: GreaterLessSide;
};

const groupEmojis = ["🍎", "⭐", "🌸", "🐟", "🦋", "🟡"];

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickDifferentCounts(settings: SessionSettings) {
  const maxCount = settings.preset === "gentle" ? 5 : settings.preset === "challenge" ? 10 : 8;
  const minDifference = settings.preset === "gentle" ? 2 : 1;
  const pairs: Array<[number, number]> = [];

  for (let left = 1; left <= maxCount; left += 1) {
    for (let right = 1; right <= maxCount; right += 1) {
      if (Math.abs(left - right) >= minDifference) pairs.push([left, right]);
    }
  }

  return pairs[randomInt(0, pairs.length - 1)];
}

function buildGroup(side: GreaterLessSide, count: number, emoji: string): GreaterLessGroup {
  return {
    side,
    count,
    emoji,
    items: Array.from({ length: count }, () => emoji)
  };
}

export function generateGreaterLessRound(settings: SessionSettings, roundIndex = 1): GreaterLessRound {
  const [leftCount, rightCount] = pickDifferentCounts(settings);
  const comparison: GreaterLessComparison = roundIndex % 2 === 0 ? "less" : "more";
  const emoji = groupEmojis[randomInt(0, groupEmojis.length - 1)];
  const correctSide: GreaterLessSide = comparison === "more"
    ? leftCount > rightCount ? "left" : "right"
    : leftCount < rightCount ? "left" : "right";

  return {
    roundId: `greater-less:round:${roundIndex}`,
    prompt: comparison === "more" ? "Где больше?" : "Где меньше?",
    comparison,
    left: buildGroup("left", leftCount, emoji),
    right: buildGroup("right", rightCount, emoji),
    correctSide
  };
}
