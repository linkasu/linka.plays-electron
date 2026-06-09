<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type GardenLeaf = Point & {
  id: string;
  radius: number;
  hue: number;
  angle: number;
  age: number;
  dwellProgress: number;
  rippleCooldown: number;
  bloomAge: number;
  enteredAt?: number;
};
type Ripple = {
  x: number;
  y: number;
  age: number;
  life: number;
  radius: number;
  hue: number;
  strength: number;
};
type RainDrop = {
  x: number;
  y: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  alpha: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("rain-garden", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 75,
  targetScale: 1.55,
  motionSpeed: 0.42,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const leaves = reactive<GardenLeaf[]>([]);
const ripples = reactive<Ripple[]>([]);
const drops = reactive<RainDrop[]>([]);
const resultVisible = computed(() => session.status === "finished");

const leafHues = [128, 146, 166, 184];
let dropTimer = 0;
let finishAfter = 0;
let previousLeafPoint: Point | undefined;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function leafRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.16;
  return Math.min(138, Math.max(88, Math.min(viewportLimit, 86 * session.settings.targetScale)));
}

function chooseLeafPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 56 };

  return randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(112, height.value * 0.16),
    sidePadding: Math.max(72, width.value * 0.1),
    bottomPadding: Math.max(80, height.value * 0.1),
    previous: previousLeafPoint,
    minDistance: Math.min(300, Math.max(168, radius * 1.55)),
    attempts: 24
  });
}

function copyPointer() {
  return {
    x: pointer.value.x,
    y: pointer.value.y,
    valid: pointer.value.valid,
    source: pointer.value.source,
    timestamp: pointer.value.timestamp
  };
}

function targetPayload(leaf: GardenLeaf, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: leaf.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: leaf.enteredAt === undefined ? 0 : now - leaf.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function createLeaf(first = false): GardenLeaf {
  const radius = leafRadius() * randomRange(0.92, 1.08);
  const point = chooseLeafPoint(radius, first);
  previousLeafPoint = point;

  return {
    id: `rain-leaf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: leafHues[Math.floor(Math.random() * leafHues.length)],
    angle: randomRange(-0.34, 0.34),
    age: randomRange(0, Math.PI * 2),
    dwellProgress: 0,
    rippleCooldown: randomRange(0.1, 0.4),
    bloomAge: 0
  };
}

function resetLeaf(leaf: GardenLeaf) {
  const next = createLeaf(false);
  Object.assign(leaf, next);
}

function initGarden() {
  leaves.splice(0);
  ripples.splice(0);
  drops.splice(0);
  previousLeafPoint = undefined;
  finishAfter = 0;
  dropTimer = 0;

  const count = width.value < 720 ? 3 : 4;
  for (let index = 0; index < count; index += 1) leaves.push(createLeaf(index === 0));
}

function leafPoint(leaf: GardenLeaf) {
  const point = percentToPixels(leaf);
  return {
    x: point.x + Math.sin(leaf.age * 0.32) * leaf.radius * 0.035,
    y: point.y + Math.cos(leaf.age * 0.26) * leaf.radius * 0.025
  };
}

function addRipple(point: Point, radius: number, hue: number, strength = 1) {
  ripples.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: randomRange(1.85, 2.45),
    radius,
    hue,
    strength
  });
  if (ripples.length > 26) ripples.shift();
}

function spawnDrop() {
  drops.push({
    x: randomRange(width.value * 0.04, width.value * 0.96),
    y: randomRange(-40, -8),
    vy: randomRange(42, 82) * session.settings.motionSpeed,
    age: 0,
    life: randomRange(4.5, 7.8),
    radius: randomRange(2.2, 4.6),
    alpha: randomRange(0.16, 0.28)
  });
  if (drops.length > 70) drops.shift();
}

function closestLeaf() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: GardenLeaf | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const leaf of leaves) {
    const point = leafPoint(leaf);
    const nextDistance = distance(point, pointer.value);
    if (nextDistance <= leaf.radius * 1.32 && nextDistance < closestDistance) {
      closest = leaf;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function completeLeaf(leaf: GardenLeaf, now: number) {
  const point = leafPoint(leaf);
  recordEvent("target-click", targetPayload(leaf, now, 1));
  recordSuccess({ targetId: leaf.id, hue: leaf.hue });
  addRipple(point, leaf.radius * 0.58, leaf.hue + 18, 1.45);
  leaf.enteredAt = undefined;
  leaf.dwellProgress = 0;
  leaf.bloomAge = 1.35;

  if (session.step >= session.maxSteps && finishAfter === 0) finishAfter = now + 1900;
}

function cancelLeaf(leaf: GardenLeaf, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(leaf, now, leaf.dwellProgress, reason));
  leaf.enteredAt = undefined;
  leaf.dwellProgress = 0;
}

function updateLeafGaze(leaf: GardenLeaf, delta: number, now: number, gazeLeaf?: GardenLeaf) {
  const point = leafPoint(leaf);
  leaf.rippleCooldown -= delta;

  if (gazeLeaf !== leaf) {
    if (leaf.enteredAt !== undefined) cancelLeaf(leaf, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (leaf.enteredAt === undefined) {
    leaf.enteredAt = now;
    recordEvent("target-enter", targetPayload(leaf, now, 0));
  }

  leaf.dwellProgress = Math.min(1, (now - leaf.enteredAt) / session.settings.dwellMs);
  if (leaf.rippleCooldown <= 0) {
    addRipple(point, leaf.radius * (0.28 + leaf.dwellProgress * 0.34), leaf.hue + 24, 0.58 + leaf.dwellProgress * 0.55);
    leaf.rippleCooldown = Math.max(0.34, 0.78 - leaf.dwellProgress * 0.28);
  }
  if (leaf.dwellProgress >= 1) completeLeaf(leaf, now);
}

function updateLeaves(delta: number, now: number) {
  const gazeLeaf = closestLeaf();

  for (const leaf of leaves) {
    leaf.age += delta;
    if (leaf.bloomAge > 0) {
      leaf.bloomAge = Math.max(0, leaf.bloomAge - delta);
      if (leaf.bloomAge === 0 && session.step < session.maxSteps) resetLeaf(leaf);
      continue;
    }
    updateLeafGaze(leaf, delta, now, gazeLeaf);
  }

  if (finishAfter > 0 && now >= finishAfter) finishSession("max-steps");
}

function updateRain(delta: number) {
  if (!session.settings.reduceMotion) {
    dropTimer += delta;
    const interval = 0.32 / session.settings.motionSpeed;
    while (dropTimer >= interval) {
      spawnDrop();
      dropTimer -= interval;
    }
  }

  for (let index = drops.length - 1; index >= 0; index -= 1) {
    const drop = drops[index];
    drop.age += delta;
    drop.y += drop.vy * delta;
    if (drop.age >= drop.life || drop.y > height.value + 24) {
      if (Math.random() < 0.45) addRipple({ x: drop.x, y: Math.min(height.value * 0.92, drop.y) }, randomRange(8, 18), 194, 0.24);
      drops.splice(index, 1);
    }
  }
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += delta;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#cfe5ef");
  sky.addColorStop(0.42, "#d9edf0");
  sky.addColorStop(1, "#8fb7ad");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const pondTop = height.value * 0.22;
  const pond = ctx.createLinearGradient(0, pondTop, 0, height.value);
  pond.addColorStop(0, "#9fcfc8");
  pond.addColorStop(0.55, "#6ba9a8");
  pond.addColorStop(1, "#477f84");
  ctx.fillStyle = pond;
  ctx.fillRect(0, pondTop, width.value, height.value - pondTop);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#effcff";
  ctx.lineWidth = 2;
  for (let index = 0; index < 9; index += 1) {
    const y = pondTop + height.value * (0.08 + index * 0.08);
    const phase = now * 0.00016 + index * 0.72;
    ctx.beginPath();
    for (let x = -20; x <= width.value + 20; x += 42) {
      const waveY = y + Math.sin(x * 0.012 + phase) * 6;
      if (x === -20) ctx.moveTo(x, waveY);
      else ctx.quadraticCurveTo(x - 21, y - Math.cos(x * 0.01 + phase) * 5, x, waveY);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#557d66";
  for (let index = 0; index < 18; index += 1) {
    const x = (index * 89 + Math.sin(index) * 30) % width.value;
    const y = height.value * (0.78 + (index % 5) * 0.045);
    ctx.beginPath();
    ctx.ellipse(x, y, 62 + index % 3 * 18, 16 + index % 4 * 4, Math.sin(index) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawDrop(ctx: CanvasRenderingContext2D, drop: RainDrop) {
  ctx.save();
  ctx.globalAlpha = drop.alpha;
  ctx.strokeStyle = "#e8fbff";
  ctx.lineWidth = Math.max(1.5, drop.radius * 0.62);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(drop.x, drop.y - drop.radius * 2.4);
  ctx.lineTo(drop.x - drop.radius * 0.28, drop.y + drop.radius * 2.2);
  ctx.stroke();
  ctx.restore();
}

function drawRipple(ctx: CanvasRenderingContext2D, ripple: Ripple) {
  const progress = Math.min(1, ripple.age / ripple.life);
  const radius = ripple.radius * (1 + progress * 2.6);
  const alpha = (1 - progress) * 0.36 * ripple.strength;

  ctx.save();
  ctx.strokeStyle = `hsla(${ripple.hue}, 76%, 86%, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, 3.4 * (1 - progress * 0.45));
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `hsla(${ripple.hue - 18}, 66%, 78%, ${alpha * 0.45})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius * 0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, leaf: GardenLeaf) {
  const point = leafPoint(leaf);
  const bloom = leaf.bloomAge > 0 ? leaf.bloomAge / 1.35 : 0;
  const focus = leaf.dwellProgress;
  const radius = leaf.radius * (1 + focus * 0.04 + bloom * 0.08);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(leaf.angle + Math.sin(leaf.age * 0.34) * 0.025);

  const shadow = ctx.createRadialGradient(0, radius * 0.18, radius * 0.2, 0, radius * 0.18, radius * 1.25);
  shadow.addColorStop(0, "rgb(35 83 73 / 20%)");
  shadow.addColorStop(1, "rgb(35 83 73 / 0%)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.16, radius * 1.08, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  const leafFill = ctx.createRadialGradient(-radius * 0.32, -radius * 0.28, radius * 0.1, 0, 0, radius * 1.08);
  leafFill.addColorStop(0, `hsla(${leaf.hue + 24}, 58%, ${72 + focus * 8}%, 0.94)`);
  leafFill.addColorStop(0.64, `hsla(${leaf.hue}, 48%, ${48 + focus * 8}%, 0.92)`);
  leafFill.addColorStop(1, `hsla(${leaf.hue - 20}, 42%, 34%, 0.9)`);
  ctx.fillStyle = leafFill;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.84, radius * 0.58, -0.08, 0.18, Math.PI * 2.06);
  ctx.lineTo(radius * 0.04, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.28 + focus * 0.24;
  ctx.strokeStyle = `hsl(${leaf.hue + 26}, 66%, 82%)`;
  ctx.lineWidth = Math.max(2, radius * 0.026);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.62, -radius * 0.04);
  ctx.quadraticCurveTo(-radius * 0.12, -radius * 0.1, radius * 0.58, radius * 0.08);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (focus > 0 || bloom > 0) {
    ctx.strokeStyle = `hsla(${leaf.hue + 38}, 84%, 88%, ${0.22 + focus * 0.24 + bloom * 0.18})`;
    ctx.lineWidth = Math.max(2, radius * 0.024);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (0.96 + focus * 0.1 + bloom * 0.18), radius * (0.68 + focus * 0.06 + bloom * 0.12), -0.08, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const ripple of ripples) drawRipple(ctx, ripple);
  for (const leaf of leaves) drawLeaf(ctx, leaf);
  for (const drop of drops) drawDrop(ctx, drop);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateRain(delta);
    updateLeaves(delta, now);
    updateRipples(delta);
  }
}

function restart() {
  startSession();
  initGarden();
}

onMounted(() => {
  initGarden();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="rain-garden-shell">
    <canvas ref="canvasRef" class="rain-garden-canvas" />

    <GameHud
      title="Сад дождя"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Сад дождя"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.rain-garden-shell {
  background: #9fcfc8;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.rain-garden-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
