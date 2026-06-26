import type { SessionSettings } from "../../core/settings";
import { randomInt } from "../../core/random";

export type MathRound = {
  roundId: string;
  expression: string;
  answer: number;
  answerText: string;
};

export function generateMathRound(settings: SessionSettings, roundIndex = 1, random = Math.random): MathRound {
  const max = settings.preset === "gentle" ? 5 : 20;
  const subtraction = settings.preset !== "gentle" && random() >= 0.5;
  if (subtraction) {
    const a = randomInt(2, max, random);
    const b = randomInt(1, a - 1, random);
    const answer = a - b;
    return { roundId: `math-actions:round:${roundIndex}`, expression: `${a} - ${b}`, answer, answerText: String(answer) };
  }
  const a = randomInt(1, max, random);
  const b = randomInt(1, max, random);
  const answer = a + b;
  return { roundId: `math-actions:round:${roundIndex}`, expression: `${a} + ${b}`, answer, answerText: String(answer) };
}
