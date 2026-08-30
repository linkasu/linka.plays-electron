export function ambientStepTargetMs(
  sessionSeconds: number,
  maxSteps: number,
  completionRatio = 0.9,
) {
  const durationMs = Math.max(1, sessionSeconds) * 1000;
  return (durationMs * Math.min(1, Math.max(0.1, completionRatio))) / Math.max(1, maxSteps);
}
