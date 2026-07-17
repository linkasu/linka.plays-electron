export type LeavesWindPoint = { x: number; y: number };

export type LeavesWindBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function leavesWindSceneBounds(viewportWidth: number, viewportHeight: number): LeavesWindBounds {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const horizontalMargin = Math.max(40, width * 0.05);
  const topReserve = Math.max(136, height * 0.22);
  const bottomReserve = Math.max(112, height * 0.18);
  const left = Math.min(width / 2, horizontalMargin);
  const top = Math.min(height / 2, topReserve);

  return {
    left,
    top,
    right: Math.max(left, width - horizontalMargin),
    bottom: Math.max(top, height - bottomReserve)
  };
}

export function leavesWindTargetRadius(viewportWidth: number, viewportHeight: number, targetScale: number) {
  const scene = leavesWindSceneBounds(viewportWidth, viewportHeight);
  const baseRadius = clamp(Math.min(viewportWidth, viewportHeight) * 0.12, 72, 96);
  const scaledRadius = Math.max(90, baseRadius * clamp(targetScale, 0.8, 2));
  const availableRadius = Math.max(1, Math.min((scene.right - scene.left) / 2, (scene.bottom - scene.top) / 2));
  return Math.min(scaledRadius, availableRadius);
}

export function leavesWindTargetBounds(viewportWidth: number, viewportHeight: number, targetRadius: number): LeavesWindBounds {
  const scene = leavesWindSceneBounds(viewportWidth, viewportHeight);
  const radius = Math.min(
    Math.max(0, targetRadius),
    Math.max(0, (scene.right - scene.left) / 2),
    Math.max(0, (scene.bottom - scene.top) / 2)
  );
  return {
    left: scene.left + radius,
    top: scene.top + radius,
    right: scene.right - radius,
    bottom: scene.bottom - radius
  };
}

export function clampLeavesWindPoint(point: LeavesWindPoint, bounds: LeavesWindBounds): LeavesWindPoint {
  return {
    x: clamp(point.x, bounds.left, bounds.right),
    y: clamp(point.y, bounds.top, bounds.bottom)
  };
}

const targetPositions: readonly LeavesWindPoint[] = [
  { x: 0.1, y: 0.5 },
  { x: 0.9, y: 0.2 },
  { x: 0.1, y: 0.8 },
  { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.2 },
  { x: 0.9, y: 0.8 },
  { x: 0.1, y: 0.5 },
  { x: 0.9, y: 0.5 }
];

export function leavesWindTargetPoint(bounds: LeavesWindBounds, sequence: number): LeavesWindPoint {
  const normalizedSequence = Math.abs(Math.trunc(sequence));
  const position = targetPositions[normalizedSequence % targetPositions.length];
  return {
    x: bounds.left + (bounds.right - bounds.left) * position.x,
    y: bounds.top + (bounds.bottom - bounds.top) * position.y
  };
}

export function leavesWindMotionPoint(anchor: LeavesWindPoint, bounds: LeavesWindBounds, elapsedSeconds: number, sequence: number) {
  const phase = Math.max(0, elapsedSeconds) * 0.42 + Math.abs(Math.trunc(sequence)) * 0.73;
  const horizontalTravel = Math.min(32, (bounds.right - bounds.left) * 0.055);
  const verticalTravel = Math.min(22, (bounds.bottom - bounds.top) * 0.1);
  return clampLeavesWindPoint({
    x: anchor.x + Math.sin(phase) * horizontalTravel,
    y: anchor.y + Math.cos(phase * 0.78) * verticalTravel
  }, bounds);
}

export function advanceLeavesWindTarget(options: {
  current: LeavesWindPoint;
  destination: LeavesWindPoint;
  bounds: LeavesWindBounds;
  deltaSeconds: number;
  motionSpeed: number;
  reduceMotion: boolean;
}) {
  const current = clampLeavesWindPoint(options.current, options.bounds);
  const destination = clampLeavesWindPoint(options.destination, options.bounds);
  if (options.reduceMotion) return destination;

  const dx = destination.x - current.x;
  const dy = destination.y - current.y;
  const distance = Math.hypot(dx, dy);
  const maxTravel = Math.max(0, options.deltaSeconds) * Math.max(0, options.motionSpeed) * 44;
  if (distance === 0 || distance <= maxTravel) return destination;

  return clampLeavesWindPoint({
    x: current.x + dx / distance * maxTravel,
    y: current.y + dy / distance * maxTravel
  }, options.bounds);
}

export function isLeavesWindTargetHit(point: LeavesWindPoint, target: LeavesWindPoint, radius: number) {
  return Math.hypot(point.x - target.x, point.y - target.y) <= Math.max(0, radius);
}

export function isLeavesWindGazeInput(pointer: { valid: boolean; source: string }) {
  return pointer.valid && pointer.source === "tobii";
}
