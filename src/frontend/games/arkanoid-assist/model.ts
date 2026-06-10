export const arkanoidAssistMaxMisses = 3;

export type ArkanoidAssistChoiceOutcome = "hit" | "miss" | "loss";

export function arkanoidAssistChoiceOutcome(isCorrect: boolean, mistakesAfterChoice: number): ArkanoidAssistChoiceOutcome {
  if (isCorrect) return "hit";
  return mistakesAfterChoice >= arkanoidAssistMaxMisses ? "loss" : "miss";
}
