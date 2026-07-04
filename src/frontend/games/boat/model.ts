export type BoatMode = "running" | "crashed" | "finished";
export type BoatDamageReason = "stone" | "bank";

export type Point = {
  x: number;
  y: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type RiverGeometry = {
  top: number;
  bottom: number;
  centerY: number;
};

export type BoatHazard = {
  id: string;
  x: number;
  width: number;
  gapY: number;
  gapHeight: number;
  phase: number;
};

export type BoatGate = Point & {
  id: string;
  radius: number;
  phase: number;
};

export type BoatPlayer = Point & {
  phase: number;
  glow: number;
  damageFlash: number;
};

export type BoatGameState = {
  mode: BoatMode;
  routeIndex: number;
  hull: number;
  maxHull: number;
  boat: BoatPlayer;
  gate: BoatGate;
  hazards: BoatHazard[];
  invulnerableSeconds: number;
  shakeSeconds: number;
};

export type BoatUpdateEvent =
  | { type: "none" }
  | { type: "success"; routeIndex: number; gateId: string }
  | { type: "damage"; routeIndex: number; hazardId: string; reason: BoatDamageReason; hull: number }
  | { type: "crashed"; routeIndex: number; hazardId: string; reason: BoatDamageReason };

export type BoatUpdateResult = {
  state: BoatGameState;
  event: BoatUpdateEvent;
};

export type BoatRouteSegment = {
  id: string;
  title: string;
  gapY: number;
  gapHeight: number;
  width: number;
};

export const boatRouteSegments: BoatRouteSegment[] = [
  { id: "first-gap", title: "Первый проход", gapY: 0.5, gapHeight: 0.42, width: 0.13 },
  { id: "upper-gap", title: "Верхнее окно", gapY: 0.34, gapHeight: 0.38, width: 0.14 },
  { id: "lower-gap", title: "Нижнее окно", gapY: 0.7, gapHeight: 0.36, width: 0.14 },
  { id: "middle-tight", title: "Узкий пролёт", gapY: 0.5, gapHeight: 0.31, width: 0.15 },
  { id: "high-tight", title: "Высокий пролёт", gapY: 0.28, gapHeight: 0.3, width: 0.15 },
  { id: "low-tight", title: "Низкий пролёт", gapY: 0.72, gapHeight: 0.29, width: 0.16 },
  { id: "final-stones", title: "Финальные камни", gapY: 0.44, gapHeight: 0.27, width: 0.17 }
];

export function riverGeometry(viewport: ViewportSize): RiverGeometry {
  const top = Math.max(126, viewport.height * 0.19);
  const bottom = viewport.height - Math.max(62, viewport.height * 0.09);
  return { top, bottom, centerY: top + (bottom - top) / 2 };
}

export function boatVisualSize(viewport: ViewportSize, targetScale = 1.35) {
  const viewportLimit = Math.min(viewport.width, viewport.height) * 0.17;
  return Math.min(132, Math.max(78, Math.min(viewportLimit, 82 * targetScale)));
}

export function boatScrollSpeed(motionSpeed = 0.78) {
  return 112 * motionSpeed;
}

export function createBoatGameState(viewport: ViewportSize, targetScale = 1.35): BoatGameState {
  const river = riverGeometry(viewport);
  const boatSize = boatVisualSize(viewport, targetScale);
  const base: BoatGameState = {
    mode: "running",
    routeIndex: 0,
    hull: 3,
    maxHull: 3,
    boat: {
      x: boatX(viewport, boatSize),
      y: river.centerY,
      phase: 0,
      glow: 0,
      damageFlash: 0
    },
    gate: { id: "", x: 0, y: river.centerY, radius: 1, phase: 0 },
    hazards: [],
    invulnerableSeconds: 0,
    shakeSeconds: 0
  };
  return spawnRoute(base, viewport, 0, false, targetScale);
}

export function syncBoatGeometry(state: BoatGameState, viewport: ViewportSize, targetScale = 1.35): BoatGameState {
  const river = riverGeometry(viewport);
  const size = boatVisualSize(viewport, targetScale);
  return {
    ...state,
    boat: { ...state.boat, x: boatX(viewport, size), y: clamp(state.boat.y, river.top + size * 0.36, river.bottom - size * 0.36) },
    gate: { ...state.gate, y: clamp(state.gate.y, river.top + state.gate.radius, river.bottom - state.gate.radius) }
  };
}

export function updateBoatGame(state: BoatGameState, inputY: number | undefined, deltaSeconds: number, viewport: ViewportSize, motionSpeed = 0.78, targetScale = 1.35, reduceMotion = false): BoatUpdateResult {
  if (state.mode !== "running") return { state, event: { type: "none" } };

  const delta = Math.min(0.05, Math.max(0, deltaSeconds));
  let next = syncBoatGeometry(state, viewport, targetScale);
  next = updateBoatPosition(next, inputY, delta, viewport, motionSpeed, targetScale, reduceMotion);
  next = scrollRoute(next, delta, motionSpeed, reduceMotion);

  const damage = next.invulnerableSeconds <= 0 ? detectDamage(next, viewport, targetScale) : undefined;
  if (damage) return applyDamage(next, damage, viewport, targetScale);

  const mainHazard = next.hazards[0];
  if (!mainHazard) return { state: spawnRoute(next, viewport, next.routeIndex, true, targetScale), event: { type: "none" } };

  const point = boatPoint(next, targetScale, viewport);
  const gapProgress = Math.max(0, 1 - Math.abs(point.y - mainHazard.gapY) / (mainHazard.gapHeight / 2));
  next = { ...next, boat: { ...next.boat, glow: next.boat.glow + (gapProgress - next.boat.glow) * Math.min(1, delta * 4.2) } };

  if (mainHazard.x + mainHazard.width / 2 < next.boat.x - boatVisualSize(viewport, targetScale) * 0.2) {
    const routeIndex = next.routeIndex;
    const gateId = next.gate.id;
    if (routeIndex >= boatRouteSegments.length - 1) return { state: { ...next, mode: "finished" }, event: { type: "success", routeIndex, gateId } };
    return { state: spawnRoute(next, viewport, routeIndex + 1, true, targetScale), event: { type: "success", routeIndex, gateId } };
  }

  return { state: next, event: { type: "none" } };
}

export function boatPoint(state: BoatGameState, targetScale: number, viewport: ViewportSize): Point {
  return { x: state.boat.x, y: state.boat.y + Math.sin(state.boat.phase) * boatVisualSize(viewport, targetScale) * 0.035 };
}

function spawnRoute(state: BoatGameState, viewport: ViewportSize, routeIndex: number, fromRight: boolean, targetScale: number): BoatGameState {
  const river = riverGeometry(viewport);
  const segment = boatRouteSegments[routeIndex];
  const riverHeight = river.bottom - river.top;
  const width = viewport.width * segment.width;
  const x = fromRight ? viewport.width + width + viewport.width * 0.12 : viewport.width * 0.78;
  const gapY = river.top + riverHeight * segment.gapY;
  const gapHeight = riverHeight * segment.gapHeight;
  const hazard = { id: `stones-${segment.id}`, x, width, gapY, gapHeight, phase: 0 };
  return {
    ...state,
    routeIndex,
    gate: { id: `gate-${segment.id}`, x, y: gapY, radius: gapHeight / 2, phase: 0 },
    hazards: [hazard],
    invulnerableSeconds: Math.min(state.invulnerableSeconds, 0.25),
    boat: { ...state.boat, glow: 0 }
  };
}

function updateBoatPosition(state: BoatGameState, inputY: number | undefined, delta: number, viewport: ViewportSize, motionSpeed: number, targetScale: number, reduceMotion: boolean): BoatGameState {
  const river = riverGeometry(viewport);
  const size = boatVisualSize(viewport, targetScale);
  const idleWave = reduceMotion ? 0 : Math.sin(state.boat.phase * 0.48) * 18;
  const targetY = inputY ?? river.centerY + idleWave;
  const clampedTarget = clamp(targetY, river.top + size * 0.3, river.bottom - size * 0.3);
  const diff = clampedTarget - state.boat.y;
  const easedStep = diff * Math.min(1, delta * 2.65);
  const maxStep = delta * 340 * motionSpeed;
  return {
    ...state,
    invulnerableSeconds: Math.max(0, state.invulnerableSeconds - delta),
    shakeSeconds: Math.max(0, state.shakeSeconds - delta),
    boat: {
      ...state.boat,
      y: clamp(state.boat.y + clamp(easedStep, -maxStep, maxStep), river.top + size * 0.28, river.bottom - size * 0.28),
      phase: state.boat.phase + (reduceMotion ? 0 : delta * 2.35),
      damageFlash: Math.max(0, state.boat.damageFlash - delta * 1.8)
    }
  };
}

function scrollRoute(state: BoatGameState, delta: number, motionSpeed: number, reduceMotion: boolean): BoatGameState {
  const speed = boatScrollSpeed(motionSpeed);
  return {
    ...state,
    gate: { ...state.gate, x: state.gate.x - speed * delta, phase: state.gate.phase + (reduceMotion ? 0 : delta * 1.7) },
    hazards: state.hazards.map((hazard) => ({ ...hazard, x: hazard.x - speed * delta, phase: hazard.phase + (reduceMotion ? 0 : delta * 1.9) })).filter((hazard) => hazard.x > -hazard.width * 1.4)
  };
}

function detectDamage(state: BoatGameState, viewport: ViewportSize, targetScale: number) {
  const river = riverGeometry(viewport);
  const size = boatVisualSize(viewport, targetScale);
  const point = boatPoint(state, targetScale, viewport);
  if (point.y < river.top + size * 0.36 || point.y > river.bottom - size * 0.36) return { hazardId: "bank", reason: "bank" as const };
  for (const hazard of state.hazards) {
    if (stoneGateHitsBoat(hazard, point, size)) return { hazardId: hazard.id, reason: "stone" as const };
  }
  return undefined;
}

function stoneGateHitsBoat(hazard: BoatHazard, point: Point, boatSize: number) {
  const halfBoatWidth = boatSize * 0.46;
  const halfBoatHeight = boatSize * 0.32;
  const overlapsX = point.x + halfBoatWidth > hazard.x - hazard.width / 2 && point.x - halfBoatWidth < hazard.x + hazard.width / 2;
  if (!overlapsX) return false;
  const gapTop = hazard.gapY - hazard.gapHeight / 2;
  const gapBottom = hazard.gapY + hazard.gapHeight / 2;
  return point.y - halfBoatHeight < gapTop || point.y + halfBoatHeight > gapBottom;
}

function applyDamage(state: BoatGameState, damage: { hazardId: string; reason: BoatDamageReason }, viewport: ViewportSize, targetScale: number): BoatUpdateResult {
  const nextHull = state.hull - 1;
  const river = riverGeometry(viewport);
  const size = boatVisualSize(viewport, targetScale);
  const hazard = state.hazards.find((item) => item.id === damage.hazardId);
  const targetY = hazard ? hazard.gapY : river.centerY;
  const pushedY = clamp(state.boat.y + Math.sign(targetY - state.boat.y || 1) * size * 0.25, river.top + size * 0.32, river.bottom - size * 0.32);
  const next = {
    ...state,
    hull: nextHull,
    invulnerableSeconds: 1,
    shakeSeconds: 0.45,
    boat: { ...state.boat, y: pushedY, damageFlash: 1 }
  };
  if (nextHull <= 0) return { state: { ...next, mode: "crashed" }, event: { type: "crashed", routeIndex: state.routeIndex, hazardId: damage.hazardId, reason: damage.reason } };
  return { state: next, event: { type: "damage", routeIndex: state.routeIndex, hazardId: damage.hazardId, reason: damage.reason, hull: nextHull } };
}

function boatX(viewport: ViewportSize, boatSize: number) {
  return clamp(viewport.width * 0.25, boatSize * 1.35, Math.max(boatSize * 1.5, viewport.width * 0.32));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
