export type GliderOutcome = "pass" | "miss" | "approach";

export type GliderDifficulty = {
  gapScale: number;
  speedScale: number;
  passRatio: number;
  drift: number;
};

export function gliderDifficulty(step: number, maxSteps: number): GliderDifficulty {
  const progress = maxSteps <= 1 ? 0 : Math.min(1, Math.max(0, step / (maxSteps - 1)));
  return {
    gapScale: 1 - progress * 0.32,
    speedScale: 1 + progress * 0.38,
    passRatio: 0.38 - progress * 0.06,
    drift: 1 + progress * 0.85
  };
}

export function classifyGatePass(gateX: number, gateWidth: number, gateY: number, gateGap: number, gliderX: number, gliderY: number, passRatio: number): GliderOutcome {
  const horizontalDistance = Math.abs(gateX - gliderX);
  if (gateX < gliderX - gateWidth * 1.25) return "miss";
  if (gateX <= gliderX && horizontalDistance <= gateWidth * 0.8 && Math.abs(gateY - gliderY) <= gateGap * passRatio) return "pass";
  return "approach";
}

export function applyGliderDamage(hull: number) {
  return Math.max(0, hull - 1);
}
