export type HighwayMode = "running" | "finished" | "crashed";

export type ViewportSize = {
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type HighwayRoad = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  laneWidth: number;
};

export type HighwayObstacle = {
  id: string;
  lane: number;
  y: number;
  length: number;
  kind: "car" | "truck";
};

export type HighwayGoal = {
  id: string;
  lane: number;
  y: number;
  radius: number;
};

export type HighwayCar = {
  lane: number;
  x: number;
  y: number;
  targetLane: number;
  damageFlash: number;
  wheelPhase: number;
};

export type HighwayState = {
  mode: HighwayMode;
  segmentIndex: number;
  hull: number;
  maxHull: number;
  car: HighwayCar;
  obstacles: HighwayObstacle[];
  goal: HighwayGoal;
  roadOffset: number;
  invulnerableSeconds: number;
};

export type HighwayEvent =
  | { type: "none" }
  | { type: "success"; segmentIndex: number; goalId: string; lane: number }
  | { type: "damage"; segmentIndex: number; obstacleId: string; lane: number; hull: number }
  | { type: "crashed"; segmentIndex: number; obstacleId: string; lane: number };

export type HighwayUpdateResult = {
  state: HighwayState;
  event: HighwayEvent;
};

export type HighwaySegment = {
  id: string;
  title: string;
  goalLane: number;
  obstacleLanes: number[];
  speed: number;
};

export const laneCount = 4;

export const highwaySegments: HighwaySegment[] = [
  { id: "warmup", title: "Разгон", goalLane: 1, obstacleLanes: [3], speed: 0.8 },
  { id: "left-pass", title: "Левый объезд", goalLane: 0, obstacleLanes: [1, 3], speed: 0.86 },
  { id: "center-gap", title: "Средний поток", goalLane: 2, obstacleLanes: [0, 1], speed: 0.92 },
  { id: "right-pass", title: "Правый ряд", goalLane: 3, obstacleLanes: [1, 2], speed: 0.96 },
  { id: "busy-road", title: "Плотное шоссе", goalLane: 1, obstacleLanes: [0, 2, 3], speed: 1.02 },
  { id: "fast-left", title: "Быстрый левый", goalLane: 0, obstacleLanes: [1, 2, 3], speed: 1.08 },
  { id: "fast-right", title: "Быстрый правый", goalLane: 3, obstacleLanes: [0, 1, 2], speed: 1.12 },
  { id: "final-line", title: "Финишная прямая", goalLane: 2, obstacleLanes: [0, 1, 3], speed: 1.18 }
];

export function highwayRoad(viewport: ViewportSize): HighwayRoad {
  const roadWidth = Math.min(viewport.width * 0.72, Math.max(420, viewport.height * 0.82));
  const left = (viewport.width - roadWidth) / 2;
  const right = left + roadWidth;
  const top = Math.max(72, viewport.height * 0.12);
  const bottom = viewport.height - Math.max(38, viewport.height * 0.07);
  return { left, right, top, bottom, laneWidth: roadWidth / laneCount };
}

export function laneCenter(road: HighwayRoad, lane: number) {
  return road.left + road.laneWidth * (clamp(Math.round(lane), 0, laneCount - 1) + 0.5);
}

export function laneFromX(road: HighwayRoad, x: number) {
  return clamp(Math.floor((x - road.left) / road.laneWidth), 0, laneCount - 1);
}

export function carSize(viewport: ViewportSize) {
  return Math.min(112, Math.max(72, Math.min(viewport.width, viewport.height) * 0.13));
}

export function laneDashPattern(viewport: ViewportSize) {
  const road = highwayRoad(viewport);
  const dash = Math.max(28, road.laneWidth * 0.34);
  const gap = Math.max(24, road.laneWidth * 0.28);
  return { dash, gap, cycle: dash + gap };
}

export function createHighwayState(viewport: ViewportSize): HighwayState {
  const road = highwayRoad(viewport);
  const carLane = 1;
  const carY = road.bottom - carSize(viewport) * 0.72;
  const base: HighwayState = {
    mode: "running",
    segmentIndex: 0,
    hull: 3,
    maxHull: 3,
    car: { lane: carLane, targetLane: carLane, x: laneCenter(road, carLane), y: carY, damageFlash: 0, wheelPhase: 0 },
    obstacles: [],
    goal: { id: "", lane: 0, y: road.top, radius: 1 },
    roadOffset: 0,
    invulnerableSeconds: 0
  };
  return spawnSegment(base, viewport, 0);
}

export function syncHighwayGeometry(state: HighwayState, viewport: ViewportSize): HighwayState {
  const road = highwayRoad(viewport);
  const nextLane = clamp(state.car.targetLane, 0, laneCount - 1);
  return {
    ...state,
    car: { ...state.car, lane: clamp(state.car.lane, 0, laneCount - 1), targetLane: nextLane, y: road.bottom - carSize(viewport) * 0.72 },
    goal: { ...state.goal, lane: clamp(state.goal.lane, 0, laneCount - 1) },
    obstacles: state.obstacles.map((obstacle) => ({ ...obstacle, lane: clamp(obstacle.lane, 0, laneCount - 1) }))
  };
}

export function updateHighway(state: HighwayState, inputX: number | undefined, deltaSeconds: number, viewport: ViewportSize, motionSpeed = 1): HighwayUpdateResult {
  if (state.mode !== "running") return { state, event: { type: "none" } };
  const delta = Math.min(0.05, Math.max(0, deltaSeconds));
  const road = highwayRoad(viewport);
  const targetLane = inputX === undefined ? state.car.targetLane : laneFromX(road, inputX);
  let next = syncHighwayGeometry({ ...state, car: { ...state.car, targetLane } }, viewport);
  next = moveCar(next, viewport, delta, motionSpeed);
  next = scrollWorld(next, viewport, delta, motionSpeed);

  const hit = next.invulnerableSeconds <= 0 ? detectCollision(next, viewport) : undefined;
  if (hit) return applyDamage(next, hit, viewport);

  if (goalReached(next, viewport)) {
    const segmentIndex = next.segmentIndex;
    const goalId = next.goal.id;
    const lane = next.goal.lane;
    if (segmentIndex >= highwaySegments.length - 1) return { state: { ...next, mode: "finished" }, event: { type: "success", segmentIndex, goalId, lane } };
    return { state: spawnSegment(next, viewport, segmentIndex + 1), event: { type: "success", segmentIndex, goalId, lane } };
  }

  if (next.goal.y > road.bottom + carSize(viewport)) next = spawnSegment(next, viewport, next.segmentIndex);
  return { state: next, event: { type: "none" } };
}

function spawnSegment(state: HighwayState, viewport: ViewportSize, segmentIndex: number): HighwayState {
  const road = highwayRoad(viewport);
  const segment = highwaySegments[segmentIndex];
  const size = carSize(viewport);
  const startY = road.top - size * 1.2;
  return {
    ...state,
    segmentIndex,
    goal: { id: `goal-${segment.id}`, lane: segment.goalLane, y: startY - size * 1.55, radius: size * 0.34 },
    obstacles: segment.obstacleLanes.map((lane, index) => ({ id: `obstacle-${segment.id}-${index}`, lane, y: startY - index * size * 1.18, length: size * (lane === segment.goalLane ? 1.1 : 1.24), kind: index % 3 === 0 ? "truck" : "car" })),
    invulnerableSeconds: Math.min(state.invulnerableSeconds, 0.2)
  };
}

function moveCar(state: HighwayState, viewport: ViewportSize, delta: number, motionSpeed: number): HighwayState {
  const road = highwayRoad(viewport);
  const targetX = laneCenter(road, state.car.targetLane);
  const dx = targetX - state.car.x;
  const maxStep = carSize(viewport) * (3.6 + motionSpeed * 1.8) * delta;
  const moveX = clamp(dx, -maxStep, maxStep);
  const lane = laneFromX(road, state.car.x + moveX);
  return {
    ...state,
    invulnerableSeconds: Math.max(0, state.invulnerableSeconds - delta),
    car: {
      ...state.car,
      lane,
      x: state.car.x + moveX,
      damageFlash: Math.max(0, state.car.damageFlash - delta * 1.8),
      wheelPhase: state.car.wheelPhase + Math.abs(moveX) * 0.08 + delta * 8
    }
  };
}

function scrollWorld(state: HighwayState, viewport: ViewportSize, delta: number, motionSpeed: number): HighwayState {
  const segment = highwaySegments[state.segmentIndex];
  const speed = carSize(viewport) * (1.55 + segment.speed * 1.05) * motionSpeed;
  const dashCycle = laneDashPattern(viewport).cycle;
  return {
    ...state,
    roadOffset: (state.roadOffset + speed * delta) % Math.max(1, dashCycle),
    goal: { ...state.goal, y: state.goal.y + speed * delta },
    obstacles: state.obstacles.map((obstacle) => ({ ...obstacle, y: obstacle.y + speed * delta }))
  };
}

function detectCollision(state: HighwayState, viewport: ViewportSize) {
  const size = carSize(viewport);
  const carHalfWidth = size * 0.31;
  const carHalfHeight = size * 0.44;
  for (const obstacle of state.obstacles) {
    const laneGap = Math.abs(state.car.x - laneCenter(highwayRoad(viewport), obstacle.lane));
    const verticalGap = Math.abs(state.car.y - obstacle.y);
    if (laneGap < carHalfWidth + size * 0.26 && verticalGap < carHalfHeight + obstacle.length * 0.36) return obstacle;
  }
  return undefined;
}

function goalReached(state: HighwayState, viewport: ViewportSize) {
  const road = highwayRoad(viewport);
  const laneGap = Math.abs(state.car.x - laneCenter(road, state.goal.lane));
  const verticalGap = Math.abs(state.car.y - state.goal.y);
  return laneGap < road.laneWidth * 0.34 && verticalGap < carSize(viewport) * 0.58;
}

function applyDamage(state: HighwayState, obstacle: HighwayObstacle, viewport: ViewportSize): HighwayUpdateResult {
  const nextHull = state.hull - 1;
  const road = highwayRoad(viewport);
  const escapeLane = nearestFreeLane(obstacle.lane, state.obstacles.map((item) => item.lane));
  const next = {
    ...state,
    hull: nextHull,
    invulnerableSeconds: 0.95,
    car: { ...state.car, targetLane: escapeLane, x: laneCenter(road, escapeLane), lane: escapeLane, damageFlash: 1 },
    obstacles: state.obstacles.filter((item) => item.id !== obstacle.id)
  };
  if (nextHull <= 0) return { state: { ...next, mode: "crashed" }, event: { type: "crashed", segmentIndex: state.segmentIndex, obstacleId: obstacle.id, lane: obstacle.lane } };
  return { state: next, event: { type: "damage", segmentIndex: state.segmentIndex, obstacleId: obstacle.id, lane: obstacle.lane, hull: nextHull } };
}

function nearestFreeLane(lane: number, blocked: number[]) {
  for (const offset of [1, -1, 2, -2, 3, -3]) {
    const candidate = lane + offset;
    if (candidate >= 0 && candidate < laneCount && !blocked.includes(candidate)) return candidate;
  }
  return clamp(lane, 0, laneCount - 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
