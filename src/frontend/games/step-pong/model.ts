export const stepPongMaxMisses = 3;

export type StepPongChoiceOutcome = "return" | "miss" | "loss";

export function stepPongChoiceOutcome(isCorrect: boolean, mistakesAfterChoice: number): StepPongChoiceOutcome {
  if (isCorrect) return "return";
  return mistakesAfterChoice >= stepPongMaxMisses ? "loss" : "miss";
}
