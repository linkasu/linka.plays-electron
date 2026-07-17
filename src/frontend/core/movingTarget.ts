import { advanceDwellMachine, type DwellMachineResult, type DwellMachineState } from "./dwellStateMachine";

export type MovingTargetPoint = { x: number; y: number };
export type MovingTargetPointer = MovingTargetPoint & { valid: boolean };

type MovingTargetSpawnOptions = {
  direction: -1 | 1;
  edgeOffset: number;
  fromEdge: boolean;
  index: number;
  targetCount: number;
  targetRadius: number;
  viewportWidth: number;
};

type MovingTargetDwellOptions<T extends { id: string }> = {
  now: number;
  pointer: MovingTargetPointer;
  targets: readonly T[];
  point: (target: T) => MovingTargetPoint;
  hitRadius: (target: T) => number;
  enabled?: (target: T) => boolean;
  dwellMs: number;
  graceMs?: number;
  cooldownMs?: number;
};

export function movingTargetSpawnX(options: MovingTargetSpawnOptions) {
  if (options.fromEdge) {
    return options.direction === 1 ? -options.edgeOffset : options.viewportWidth + options.edgeOffset;
  }

  const count = Math.max(1, options.targetCount);
  const index = Math.min(count - 1, Math.max(0, options.index));
  const radius = Math.min(Math.max(0, options.targetRadius), options.viewportWidth / 2);
  const safeWidth = Math.max(0, options.viewportWidth - radius * 2);
  return radius + safeWidth * ((index + 1) / (count + 1));
}

export function advanceMovingTargetX(x: number, direction: -1 | 1, speed: number, deltaSeconds: number) {
  return x + direction * speed * deltaSeconds;
}

export function alternatingMovingTargetDirection(sequence: number): -1 | 1 {
  return Math.abs(Math.trunc(sequence)) % 2 === 0 ? 1 : -1;
}

export function closestMovingTarget<T extends { id: string }>(options: Pick<MovingTargetDwellOptions<T>, "pointer" | "targets" | "point" | "hitRadius" | "enabled">) {
  if (!options.pointer.valid) return undefined;

  let closest: T | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const target of options.targets) {
    if (options.enabled && !options.enabled(target)) continue;
    const point = options.point(target);
    const distance = Math.hypot(point.x - options.pointer.x, point.y - options.pointer.y);
    if (distance <= options.hitRadius(target) && distance < closestDistance) {
      closest = target;
      closestDistance = distance;
    }
  }
  return closest;
}

export function advanceMovingTargetDwell<T extends { id: string }>(current: DwellMachineState, options: MovingTargetDwellOptions<T>): DwellMachineResult {
  const target = closestMovingTarget(options);
  return advanceDwellMachine(current, {
    now: options.now,
    targetId: target?.id,
    pointerValid: options.pointer.valid,
    dwellMs: options.dwellMs,
    graceMs: options.graceMs ?? 140,
    cooldownMs: options.cooldownMs ?? 500
  });
}
