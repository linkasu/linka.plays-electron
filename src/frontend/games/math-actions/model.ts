import type { SessionSettings } from "../../core/settings";

export type MathRound = {
  roundId: string;
  expression: string;
  answer: number;
  answerText: string;
};

export function generateMathRound(settings: SessionSettings, roundIndex = 1): MathRound {
  const max = settings.preset === "gentle" ? 5 : 20;
  const subtraction = settings.preset !== "gentle" && Math.random() >= 0.5;
  if (subtraction) {
    const a = 2 + Math.floor(Math.random() * (max - 1));
    const b = 1 + Math.floor(Math.random() * (a - 1));
    const answer = a - b;
    return { roundId: `math-actions:round:${roundIndex}`, expression: `${a} - ${b}`, answer, answerText: String(answer) };
  }
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * max);
  const answer = a + b;
  return { roundId: `math-actions:round:${roundIndex}`, expression: `${a} + ${b}`, answer, answerText: String(answer) };
}
