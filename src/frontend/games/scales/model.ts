import type { SessionSettings } from "../../core/settings";

export type ScalesSide = "left" | "right";
export type ScalesQuestion = "heavier" | "lighter";
export type ScalesAnswer = ScalesSide | "equal";

export type ScalesPan = {
  side: ScalesSide;
  weight: number;
  emoji: string;
  items: string[];
};

export type ScalesRound = {
  roundId: string;
  prompt: string;
  question: ScalesQuestion;
  left: ScalesPan;
  right: ScalesPan;
  correctAnswer: ScalesAnswer;
  tiltDeg: number;
};

export const scalesAnswers: ScalesAnswer[] = ["left", "equal", "right"];

const panEmojis = ["🍎", "⭐", "🟡", "🧸", "🪙", "🌸"];

function randomInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function maxWeight(settings: SessionSettings) {
  if (settings.preset === "gentle") return 5;
  if (settings.preset === "challenge") return 10;
  return 8;
}

function minDifference(settings: SessionSettings) {
  return settings.preset === "gentle" ? 2 : 1;
}

function pickDifferentWeights(settings: SessionSettings) {
  const pairs: Array<[number, number]> = [];
  const max = maxWeight(settings);
  const minDiff = minDifference(settings);

  for (let left = 1; left <= max; left += 1) {
    for (let right = 1; right <= max; right += 1) {
      if (Math.abs(left - right) >= minDiff) pairs.push([left, right]);
    }
  }

  return pairs[randomInt(0, pairs.length - 1)];
}

function buildPan(side: ScalesSide, weight: number, emoji: string): ScalesPan {
  return {
    side,
    weight,
    emoji,
    items: Array.from({ length: weight }, () => emoji)
  };
}

export function correctScalesAnswer(question: ScalesQuestion, leftWeight: number, rightWeight: number): ScalesAnswer {
  if (leftWeight === rightWeight) return "equal";
  if (question === "heavier") return leftWeight > rightWeight ? "left" : "right";
  return leftWeight < rightWeight ? "left" : "right";
}

export function answerLabel(answer: ScalesAnswer, question: ScalesQuestion) {
  if (answer === "equal") return "Равны";
  const side = answer === "left" ? "Левая" : "Правая";
  return question === "heavier" ? `${side} тяжелее` : `${side} легче`;
}

export function generateScalesRound(settings: SessionSettings, roundIndex = 1): ScalesRound {
  const question: ScalesQuestion = roundIndex % 2 === 0 ? "lighter" : "heavier";
  const emoji = panEmojis[randomInt(0, panEmojis.length - 1)];
  const equalRound = roundIndex % 4 === 0;
  const [leftWeight, rightWeight] = equalRound
    ? (() => {
      const weight = randomInt(1, maxWeight(settings));
      return [weight, weight] as [number, number];
    })()
    : pickDifferentWeights(settings);
  const correctAnswer = correctScalesAnswer(question, leftWeight, rightWeight);
  const tiltDeg = leftWeight === rightWeight ? 0 : leftWeight > rightWeight ? -7 : 7;

  return {
    roundId: `scales:round:${roundIndex}`,
    prompt: question === "heavier" ? "Какая сторона тяжелее?" : "Какая сторона легче?",
    question,
    left: buildPan("left", leftWeight, emoji),
    right: buildPan("right", rightWeight, emoji),
    correctAnswer,
    tiltDeg
  };
}
