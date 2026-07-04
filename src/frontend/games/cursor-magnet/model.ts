export type MagneticPole = "positive" | "negative";
export type SimulationMode = "editing" | "running" | "success" | "failed";
export type FailureReason = "bounds" | "wall" | "stalled";

export type Point = {
  x: number;
  y: number;
};

export type MagnetConfig = Point & {
  id: string;
  label: string;
  pole: MagneticPole;
  strength: 0 | 1 | 2;
};

export type LabWall = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MagneticLevel = {
  id: string;
  title: string;
  brief: string;
  start: Point;
  goal: Point & { radius: number };
  magnets: MagnetConfig[];
  walls: LabWall[];
};

export type CapsuleState = Point & {
  vx: number;
  vy: number;
  pole: MagneticPole;
};

export type MagneticLabState = {
  levelIndex: number;
  selectedMagnetId: string;
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

export const magneticLevels: MagneticLevel[] = [
  {
    id: "pull-gate",
    title: "Притяжение",
    brief: "Капсула положительная. Поставь отрицательный заряд у реактора и притяни капсулу.",
    start: { x: 0.18, y: 0.55 },
    goal: { x: 0.78, y: 0.55, radius: 0.055 },
    magnets: [{ id: "alpha", label: "A", x: 0.78, y: 0.55, pole: "positive", strength: 2 }],
    walls: []
  },
  {
    id: "repulse-turn",
    title: "Отталкивание",
    brief: "Нижний положительный заряд толкает капсулу вверх, правый отрицательный тянет к реактору.",
    start: { x: 0.18, y: 0.72 },
    goal: { x: 0.78, y: 0.34, radius: 0.06 },
    magnets: [
      { id: "alpha", label: "A", x: 0.12, y: 0.84, pole: "negative", strength: 2 },
      { id: "beta", label: "B", x: 0.78, y: 0.34, pole: "positive", strength: 2 }
    ],
    walls: [{ x: 0.4, y: 0.52, width: 0.14, height: 0.16 }]
  },
  {
    id: "s-curve",
    title: "Извилистый коридор",
    brief: "Выключи боковые помехи и оставь отрицательный заряд у реактора, чтобы капсула прошла между перегородками.",
    start: { x: 0.16, y: 0.28 },
    goal: { x: 0.82, y: 0.74, radius: 0.052 },
    magnets: [
      { id: "alpha", label: "A", x: 0.34, y: 0.2, pole: "positive", strength: 1 },
      { id: "beta", label: "B", x: 0.56, y: 0.5, pole: "negative", strength: 1 },
      { id: "gamma", label: "C", x: 0.82, y: 0.74, pole: "positive", strength: 1 }
    ],
    walls: [
      { x: 0.42, y: 0.16, width: 0.08, height: 0.22 },
      { x: 0.62, y: 0.68, width: 0.08, height: 0.22 }
    ]
  },
  {
    id: "interference-zone",
    title: "Зона помех",
    brief: "Проведи капсулу между двумя стенами: выключи лишние поля и оставь отрицательный заряд у реактора.",
    start: { x: 0.17, y: 0.48 },
    goal: { x: 0.84, y: 0.48, radius: 0.055 },
    magnets: [
      { id: "alpha", label: "A", x: 0.34, y: 0.3, pole: "positive", strength: 2 },
      { id: "beta", label: "B", x: 0.54, y: 0.48, pole: "negative", strength: 1 },
      { id: "gamma", label: "C", x: 0.84, y: 0.48, pole: "positive", strength: 1 }
    ],
    walls: [
      { x: 0.3, y: 0.6, width: 0.28, height: 0.08 },
      { x: 0.56, y: 0.32, width: 0.24, height: 0.08 }
    ]
  },
  {
    id: "upper-gate",
    title: "Верхний шлюз",
    brief: "Положительный заряд снизу выталкивает капсулу вверх, отрицательный у реактора забирает её в шлюз.",
    start: { x: 0.15, y: 0.78 },
    goal: { x: 0.84, y: 0.24, radius: 0.055 },
    magnets: [
      { id: "alpha", label: "A", x: 0.12, y: 0.9, pole: "negative", strength: 1 },
      { id: "beta", label: "B", x: 0.84, y: 0.24, pole: "positive", strength: 1 },
      { id: "gamma", label: "C", x: 0.46, y: 0.46, pole: "positive", strength: 2 }
    ],
    walls: [
      { x: 0.34, y: 0.58, width: 0.24, height: 0.08 },
      { x: 0.58, y: 0.3, width: 0.08, height: 0.28 }
    ]
  },
  {
    id: "narrow-channel",
    title: "Узкий канал",
    brief: "Не включай верхнюю и нижнюю помехи. Отрицательный заряд справа тянет капсулу по каналу.",
    start: { x: 0.12, y: 0.5 },
    goal: { x: 0.88, y: 0.5, radius: 0.052 },
    magnets: [
      { id: "alpha", label: "A", x: 0.5, y: 0.25, pole: "positive", strength: 2 },
      { id: "beta", label: "B", x: 0.5, y: 0.75, pole: "negative", strength: 2 },
      { id: "gamma", label: "C", x: 0.88, y: 0.5, pole: "positive", strength: 1 }
    ],
    walls: [
      { x: 0.24, y: 0.32, width: 0.44, height: 0.06 },
      { x: 0.24, y: 0.62, width: 0.44, height: 0.06 }
    ]
  },
  {
    id: "core-bypass",
    title: "Обход ядра",
    brief: "Отключи боковые ловушки и оставь отрицательный заряд у реактора, чтобы капсула обошла ядро.",
    start: { x: 0.18, y: 0.22 },
    goal: { x: 0.84, y: 0.72, radius: 0.052 },
    magnets: [
      { id: "alpha", label: "A", x: 0.2, y: 0.14, pole: "positive", strength: 2 },
      { id: "beta", label: "B", x: 0.54, y: 0.44, pole: "negative", strength: 2 },
      { id: "gamma", label: "C", x: 0.84, y: 0.72, pole: "positive", strength: 1 }
    ],
    walls: [
      { x: 0.42, y: 0.12, width: 0.08, height: 0.25 },
      { x: 0.62, y: 0.64, width: 0.08, height: 0.25 }
    ]
  },
  {
    id: "final-reactor",
    title: "Финальный реактор",
    brief: "Оставь сильный положительный толчок снизу, мягкий отрицательный проводник и сильный отрицательный реактор.",
    start: { x: 0.12, y: 0.84 },
    goal: { x: 0.86, y: 0.22, radius: 0.055 },
    magnets: [
      { id: "alpha", label: "A", x: 0.1, y: 0.92, pole: "negative", strength: 1 },
      { id: "beta", label: "B", x: 0.5, y: 0.52, pole: "positive", strength: 1 },
      { id: "gamma", label: "C", x: 0.66, y: 0.72, pole: "positive", strength: 1 },
      { id: "delta", label: "D", x: 0.86, y: 0.22, pole: "positive", strength: 2 }
    ],
    walls: [
      { x: 0.34, y: 0.7, width: 0.22, height: 0.08 },
      { x: 0.58, y: 0.24, width: 0.08, height: 0.18 },
      { x: 0.24, y: 0.28, width: 0.24, height: 0.08 }
    ]
  }
];

export function createMagneticLabState(levelIndex = 0): MagneticLabState {
  const safeIndex = wrapLevelIndex(levelIndex);
  const level = magneticLevels[safeIndex];
  return {
    levelIndex: safeIndex,
    selectedMagnetId: level.magnets[0]?.id ?? "",
    mode: "editing",
    capsule: { ...level.start, vx: 0, vy: 0, pole: "positive" },
    magnets: level.magnets.map((magnet) => ({ ...magnet })),
    elapsedSeconds: 0
  };
}

export function currentLevel(state: MagneticLabState) {
  return magneticLevels[state.levelIndex];
}

export function selectedMagnet(state: MagneticLabState) {
  return state.magnets.find((magnet) => magnet.id === state.selectedMagnetId) ?? state.magnets[0];
}

export function selectMagnet(state: MagneticLabState, magnetId: string): MagneticLabState {
  if (!state.magnets.some((magnet) => magnet.id === magnetId) || state.mode === "running") return state;
  return { ...state, selectedMagnetId: magnetId };
}

export function setSelectedPole(state: MagneticLabState, pole: MagneticPole): MagneticLabState {
  if (state.mode === "running") return state;
  return updateSelectedMagnet(state, (magnet) => ({ ...magnet, pole }));
}

export function cycleSelectedStrength(state: MagneticLabState): MagneticLabState {
  if (state.mode === "running") return state;
  return updateSelectedMagnet(state, (magnet) => ({ ...magnet, strength: ((magnet.strength + 1) % 3) as 0 | 1 | 2 }));
}

export function startSimulation(state: MagneticLabState): MagneticLabState {
  if (state.mode === "running") return state;
  const level = currentLevel(state);
  return {
    ...state,
    mode: "running",
    capsule: { ...level.start, vx: 0, vy: 0, pole: "positive" },
    elapsedSeconds: 0,
    failureReason: undefined
  };
}

export function stopSimulation(state: MagneticLabState): MagneticLabState {
  if (state.mode !== "running") return state;
  return { ...state, mode: "editing", capsule: { ...currentLevel(state).start, vx: 0, vy: 0, pole: "positive" }, elapsedSeconds: 0 };
}

export function resetLevel(state: MagneticLabState): MagneticLabState {
  return createMagneticLabState(state.levelIndex);
}

export function nextLevel(state: MagneticLabState): MagneticLabState {
  return createMagneticLabState(state.levelIndex + 1);
}

export function stepSimulation(state: MagneticLabState, deltaSeconds: number): StepResult {
  if (state.mode !== "running") return { state, event: state.mode === "success" ? "success" : state.mode === "failed" ? "failed" : "running" };

  const level = currentLevel(state);
  const delta = Math.min(0.04, Math.max(0, deltaSeconds));
  const force = magneticForce(state.capsule, state.magnets);
  const nextCapsule = integrateCapsule(state.capsule, force, delta);
  const elapsedSeconds = state.elapsedSeconds + delta;

  const nextBase = { ...state, capsule: nextCapsule, elapsedSeconds };
  if (distance(nextCapsule, level.goal) <= level.goal.radius) return { state: { ...nextBase, mode: "success" }, event: "success" };
  if (isOutOfBounds(nextCapsule)) return { state: { ...nextBase, mode: "failed", failureReason: "bounds" }, event: "failed" };
  if (level.walls.some((wall) => pointInWall(nextCapsule, wall))) return { state: { ...nextBase, mode: "failed", failureReason: "wall" }, event: "failed" };
  if (elapsedSeconds > 14 && Math.hypot(nextCapsule.vx, nextCapsule.vy) < 0.008) return { state: { ...nextBase, mode: "failed", failureReason: "stalled" }, event: "failed" };
  return { state: nextBase, event: "running" };
}

export function magneticForce(capsule: CapsuleState, magnets: MagnetConfig[]): Point {
  return magnets.reduce<Point>((total, magnet) => {
    if (magnet.strength === 0) return total;
    const dx = magnet.x - capsule.x;
    const dy = magnet.y - capsule.y;
    const distanceSquared = Math.max(0.006, dx * dx + dy * dy);
    const distanceValue = Math.sqrt(distanceSquared);
    const direction = magnet.pole === capsule.pole ? -1 : 1;
    const power = direction * magnet.strength * 0.12 / distanceSquared;
    return {
      x: total.x + dx / distanceValue * power,
      y: total.y + dy / distanceValue * power
    };
  }, { x: 0, y: 0 });
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInWall(point: Point, wall: LabWall) {
  return point.x >= wall.x && point.x <= wall.x + wall.width && point.y >= wall.y && point.y <= wall.y + wall.height;
}

function updateSelectedMagnet(state: MagneticLabState, update: (magnet: MagnetConfig) => MagnetConfig): MagneticLabState {
  return {
    ...state,
    magnets: state.magnets.map((magnet) => magnet.id === state.selectedMagnetId ? update(magnet) : magnet)
  };
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
