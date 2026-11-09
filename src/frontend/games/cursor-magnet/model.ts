// Testers: «убрать, играть невозможно». The owner kept the game (2026-11-06): «интересная, но
// взгляд плохо выделяет нужное поле — продумать». Reworked 2026-11-09 without changing the idea:
// the child looks at a magnet on the field to switch it (тянет → толкает → выключен), then looks
// at «Пуск»; the ball rolls to the star. No separate station list, sign buttons or strength.

export type MagnetMode = "pull" | "push" | "off";
export type SimulationMode = "editing" | "running" | "success" | "failed";
export type FailureReason = "bounds" | "wall" | "stalled";

export type Point = {
  x: number;
  y: number;
};

export type MagnetConfig = Point & {
  id: string;
  mode: MagnetMode;
  /** Fixed for the level: a strong magnet is drawn bigger. */
  strength: 1 | 2;
};

export type LabWall = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MagneticLevel = {
  id: string;
  start: Point;
  goal: Point & { radius: number };
  magnets: MagnetConfig[];
  walls: LabWall[];
};

export type CapsuleState = Point & {
  vx: number;
  vy: number;
};

export type MagneticLabState = {
  levelIndex: number;
  mode: SimulationMode;
  capsule: CapsuleState;
  magnets: MagnetConfig[];
  elapsedSeconds: number;
  failureReason?: FailureReason;
};

export type StepResult = {
  state: MagneticLabState;
  event: "running" | "success" | "failed";
};

/** The order a magnet takes when the child looks at it. */
export const magnetModeOrder: MagnetMode[] = ["pull", "push", "off"];

// The magnet that pulls the ball home stands just behind the star, not on it, so the star
// and the magnet are both seen and both can be looked at.
export const magneticLevels: MagneticLevel[] = [
  {
    id: "pull-gate",
    start: { x: 0.18, y: 0.55 },
    goal: { x: 0.74, y: 0.55, radius: 0.06 },
    magnets: [{ id: "alpha", x: 0.9, y: 0.55, mode: "push", strength: 2 }],
    walls: [],
  },
  {
    id: "repulse-turn",
    start: { x: 0.2, y: 0.7 },
    goal: { x: 0.74, y: 0.32, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.08, y: 0.86, mode: "pull", strength: 2 },
      { id: "beta", x: 0.9, y: 0.26, mode: "push", strength: 2 },
    ],
    walls: [{ x: 0.4, y: 0.52, width: 0.14, height: 0.16 }],
  },
  {
    id: "s-curve",
    start: { x: 0.16, y: 0.28 },
    goal: { x: 0.76, y: 0.74, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.32, y: 0.12, mode: "push", strength: 1 },
      { id: "beta", x: 0.56, y: 0.48, mode: "pull", strength: 1 },
      { id: "gamma", x: 0.9, y: 0.8, mode: "push", strength: 2 },
    ],
    walls: [
      { x: 0.42, y: 0.16, width: 0.08, height: 0.22 },
      { x: 0.62, y: 0.68, width: 0.08, height: 0.22 },
    ],
  },
  {
    id: "interference-zone",
    start: { x: 0.17, y: 0.48 },
    goal: { x: 0.76, y: 0.48, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.34, y: 0.22, mode: "push", strength: 2 },
      { id: "beta", x: 0.5, y: 0.82, mode: "pull", strength: 1 },
      { id: "gamma", x: 0.9, y: 0.48, mode: "push", strength: 2 },
    ],
    walls: [
      { x: 0.3, y: 0.6, width: 0.28, height: 0.08 },
      { x: 0.56, y: 0.32, width: 0.24, height: 0.08 },
    ],
  },
  {
    id: "upper-gate",
    start: { x: 0.16, y: 0.7 },
    goal: { x: 0.78, y: 0.22, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.08, y: 0.9, mode: "pull", strength: 2 },
      { id: "beta", x: 0.92, y: 0.16, mode: "push", strength: 2 },
      { id: "gamma", x: 0.46, y: 0.42, mode: "pull", strength: 2 },
    ],
    walls: [
      { x: 0.34, y: 0.58, width: 0.24, height: 0.08 },
      { x: 0.58, y: 0.3, width: 0.08, height: 0.28 },
    ],
  },
  {
    id: "narrow-channel",
    start: { x: 0.12, y: 0.5 },
    goal: { x: 0.78, y: 0.5, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.46, y: 0.16, mode: "pull", strength: 2 },
      { id: "beta", x: 0.46, y: 0.84, mode: "push", strength: 2 },
      { id: "gamma", x: 0.92, y: 0.5, mode: "push", strength: 1 },
    ],
    walls: [
      { x: 0.24, y: 0.32, width: 0.44, height: 0.06 },
      { x: 0.24, y: 0.62, width: 0.44, height: 0.06 },
    ],
  },
  {
    id: "core-bypass",
    start: { x: 0.18, y: 0.24 },
    goal: { x: 0.78, y: 0.72, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.08, y: 0.84, mode: "pull", strength: 2 },
      { id: "beta", x: 0.58, y: 0.46, mode: "pull", strength: 2 },
      { id: "gamma", x: 0.92, y: 0.78, mode: "push", strength: 2 },
    ],
    walls: [
      { x: 0.42, y: 0.12, width: 0.08, height: 0.25 },
      { x: 0.62, y: 0.64, width: 0.08, height: 0.25 },
    ],
  },
  {
    id: "final-reactor",
    start: { x: 0.18, y: 0.8 },
    goal: { x: 0.8, y: 0.22, radius: 0.06 },
    magnets: [
      { id: "alpha", x: 0.07, y: 0.84, mode: "pull", strength: 2 },
      { id: "beta", x: 0.46, y: 0.52, mode: "push", strength: 1 },
      { id: "gamma", x: 0.7, y: 0.86, mode: "push", strength: 1 },
      { id: "delta", x: 0.93, y: 0.14, mode: "push", strength: 2 },
    ],
    walls: [
      { x: 0.34, y: 0.7, width: 0.22, height: 0.08 },
      { x: 0.58, y: 0.24, width: 0.08, height: 0.18 },
      { x: 0.24, y: 0.28, width: 0.24, height: 0.08 },
    ],
  },
];

export function createMagneticLabState(levelIndex = 0): MagneticLabState {
  const safeIndex = wrapLevelIndex(levelIndex);
  const level = magneticLevels[safeIndex];
  return {
    levelIndex: safeIndex,
    mode: "editing",
    capsule: { ...level.start, vx: 0, vy: 0 },
    magnets: level.magnets.map((magnet) => ({ ...magnet })),
    elapsedSeconds: 0,
  };
}

export function currentLevel(state: MagneticLabState) {
  return magneticLevels[state.levelIndex];
}

/** Looking at a magnet switches it: тянет → толкает → выключен → тянет. */
export function cycleMagnet(state: MagneticLabState, magnetId: string): MagneticLabState {
  if (state.mode === "running") return state;
  return {
    ...state,
    // A changed field is a new try: the ball waits at the start again.
    mode: "editing",
    capsule: { ...currentLevel(state).start, vx: 0, vy: 0 },
    failureReason: undefined,
    magnets: state.magnets.map((magnet) =>
      magnet.id === magnetId
        ? {
            ...magnet,
            mode: magnetModeOrder[
              (magnetModeOrder.indexOf(magnet.mode) + 1) % magnetModeOrder.length
            ],
          }
        : magnet,
    ),
  };
}

export function startSimulation(state: MagneticLabState): MagneticLabState {
  if (state.mode === "running") return state;
  const level = currentLevel(state);
  return {
    ...state,
    mode: "running",
    capsule: { ...level.start, vx: 0, vy: 0 },
    elapsedSeconds: 0,
    failureReason: undefined,
  };
}

export function stopSimulation(state: MagneticLabState): MagneticLabState {
  if (state.mode !== "running") return state;
  return {
    ...state,
    mode: "editing",
    capsule: { ...currentLevel(state).start, vx: 0, vy: 0 },
    elapsedSeconds: 0,
  };
}

export function resetLevel(state: MagneticLabState): MagneticLabState {
  return createMagneticLabState(state.levelIndex);
}

export function nextLevel(state: MagneticLabState): MagneticLabState {
  return createMagneticLabState(state.levelIndex + 1);
}

export function stepSimulation(state: MagneticLabState, deltaSeconds: number): StepResult {
  if (state.mode !== "running")
    return {
      state,
      event: state.mode === "success" ? "success" : state.mode === "failed" ? "failed" : "running",
    };

  const level = currentLevel(state);
  const delta = Math.min(0.04, Math.max(0, deltaSeconds));
  const force = magneticForce(state.capsule, state.magnets);
  const nextCapsule = integrateCapsule(state.capsule, force, delta);
  const elapsedSeconds = state.elapsedSeconds + delta;

  const nextBase = { ...state, capsule: nextCapsule, elapsedSeconds };
  if (distance(nextCapsule, level.goal) <= level.goal.radius)
    return { state: { ...nextBase, mode: "success" }, event: "success" };
  if (isOutOfBounds(nextCapsule))
    return { state: { ...nextBase, mode: "failed", failureReason: "bounds" }, event: "failed" };
  if (level.walls.some((wall) => pointInWall(nextCapsule, wall)))
    return { state: { ...nextBase, mode: "failed", failureReason: "wall" }, event: "failed" };
  if (elapsedSeconds > 3 && Math.hypot(nextCapsule.vx, nextCapsule.vy) < 0.008)
    return { state: { ...nextBase, mode: "failed", failureReason: "stalled" }, event: "failed" };
  return { state: nextBase, event: "running" };
}

export function magneticForce(capsule: CapsuleState, magnets: MagnetConfig[]): Point {
  return magnets.reduce<Point>(
    (total, magnet) => {
      if (magnet.mode === "off") return total;
      const dx = magnet.x - capsule.x;
      const dy = magnet.y - capsule.y;
      const distanceSquared = Math.max(0.006, dx * dx + dy * dy);
      const distanceValue = Math.sqrt(distanceSquared);
      const direction = magnet.mode === "push" ? -1 : 1;
      const power = (direction * magnet.strength * 0.3) / distanceSquared;
      return {
        x: total.x + (dx / distanceValue) * power,
        y: total.y + (dy / distanceValue) * power,
      };
    },
    { x: 0, y: 0 },
  );
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInWall(point: Point, wall: LabWall) {
  return (
    point.x >= wall.x &&
    point.x <= wall.x + wall.width &&
    point.y >= wall.y &&
    point.y <= wall.y + wall.height
  );
}

function integrateCapsule(capsule: CapsuleState, force: Point, delta: number): CapsuleState {
  const vx = clamp((capsule.vx + force.x * delta) * Math.pow(0.82, delta * 60), -0.72, 0.72);
  const vy = clamp((capsule.vy + force.y * delta) * Math.pow(0.82, delta * 60), -0.72, 0.72);
  return { ...capsule, x: capsule.x + vx * delta, y: capsule.y + vy * delta, vx, vy };
}

function isOutOfBounds(point: Point) {
  return point.x < 0.05 || point.x > 0.95 || point.y < 0.12 || point.y > 0.92;
}

function wrapLevelIndex(index: number) {
  return ((index % magneticLevels.length) + magneticLevels.length) % magneticLevels.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
