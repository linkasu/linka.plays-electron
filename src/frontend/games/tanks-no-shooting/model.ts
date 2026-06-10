export type TanksNoShootingDirection = "up" | "down" | "left" | "right";
export const tanksNoShootingMaxWrongTurns = 3;

export type TanksNoShootingChoiceOutcome = "advance" | "wrong-turn" | "loss";

export function tanksNoShootingChoiceOutcome(actual: TanksNoShootingDirection, expected: TanksNoShootingDirection, mistakesAfterChoice: number): TanksNoShootingChoiceOutcome {
  if (actual === expected) return "advance";
  return mistakesAfterChoice >= tanksNoShootingMaxWrongTurns ? "loss" : "wrong-turn";
}
