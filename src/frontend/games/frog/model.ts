export function frogProgression(successes: number) {
  const safeSuccesses = Math.max(0, Math.floor(successes));
  return {
    activeBugLimit: safeSuccesses >= 4 ? 2 : 1,
    spawnDelaySeconds: Math.max(1.1, 2 * Math.pow(0.98, safeSuccesses)),
    speedMultiplier: 1 + Math.min(0.5, safeSuccesses * 0.055),
  };
}
