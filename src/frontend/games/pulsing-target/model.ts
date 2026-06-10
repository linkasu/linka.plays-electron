export type Point = { x: number; y: number };

export type StageSize = {
  width: number;
  height: number;
};

export type PulsingTargetRadii = {
  coreRadius: number;
  holdRadius: number;
  hintRadius: number;
};

export type TargetAssistState = {
  pointerValid: boolean;
  inside: boolean;
  near: boolean;
  speedScale: number;
  glow: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function calculatePulsingTargetRadii(stage: StageSize, targetScale: number): PulsingTargetRadii {
  const viewport = Math.min(stage.width, stage.height);
  const coreRadius = Math.min(128, Math.max(84, Math.min(viewport * 0.15, 78 * targetScale)));
  const holdRadius = Math.min(196, Math.max(150, coreRadius * 1.34));

  return {
    coreRadius,
    holdRadius,
    hintRadius: holdRadius * 1.46
  };
}

export function targetPathPoint(phase: number, stage: StageSize): Point {
  const safeTop = Math.min(148, Math.max(112, stage.height * 0.17));
  const centerX = stage.width * 0.5;
  const centerY = Math.max(safeTop + 120, stage.height * 0.55);
  const travelX = Math.min(stage.width * 0.3, Math.max(92, stage.width * 0.22));
  const travelY = Math.min(stage.height * 0.21, Math.max(64, stage.height * 0.16));
  const x = centerX + Math.cos(phase * 0.72) * travelX + Math.sin(phase * 0.31) * travelX * 0.28;
  const y = centerY + Math.sin(phase * 0.9) * travelY;

  return {
    x: clamp(x, 40, stage.width - 40),
    y: clamp(y, safeTop, stage.height - 56)
  };
}

export function advanceHoldProgress(current: number, options: {
  deltaSeconds: number;
  dwellMs: number;
  inside: boolean;
  releaseDecayPerSecond?: number;
}) {
  const dwellSeconds = Math.max(0.1, options.dwellMs / 1000);
  if (options.inside) return clamp(current + options.deltaSeconds / dwellSeconds, 0, 1);

  const decay = options.releaseDecayPerSecond ?? 0.16;
  return clamp(current - options.deltaSeconds * decay, 0, 1);
}

export function computeTargetAssistState(distancePx: number, holdRadiusPx: number, pointerValid: boolean): TargetAssistState {
  if (!pointerValid || !Number.isFinite(distancePx)) {
    return { pointerValid: false, inside: false, near: false, speedScale: 0.34, glow: 0.2 };
  }

  const inside = distancePx <= holdRadiusPx;
  const near = distancePx <= holdRadiusPx * 1.48;

  return {
    pointerValid: true,
    inside,
    near,
    speedScale: inside ? 0.92 : near ? 0.54 : 0.36,
    glow: inside ? 1 : near ? 0.58 : 0.28
  };
}
