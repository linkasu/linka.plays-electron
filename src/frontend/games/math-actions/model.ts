import type { SessionSettings } from "../../core/settings";

export type MathRound = {
  expression: string;
  answer: number;
  answerText: string;
};

export function generateMathRound(settings: SessionSettings): MathRound {
  const max = settings.preset === "gentle" ? 5 : 20;
  const subtraction = settings.preset !== "gentle" && Math.random() >= 0.5;
  if (subtraction) {
    const a = 2 + Math.floor(Math.random() * (max - 1));
    const b = 1 + Math.floor(Math.random() * (a - 1));
    const answer = a - b;
    return { expression: `${a} - ${b}`, answer, answerText: String(answer) };
  }
  const a = 1 + Math.floor(Math.random() * max);
  const b = 1 + Math.floor(Math.random() * max);
  const answer = a + b;
  return { expression: `${a} + ${b}`, answer, answerText: String(answer) };
}
