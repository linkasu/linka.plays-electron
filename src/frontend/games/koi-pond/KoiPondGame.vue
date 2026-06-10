<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type KoiFish = Point & {
  id: string;
  size: number;
  hue: number;
  accentHue: number;
  age: number;
  angle: number;
  speed: number;
  dwellProgress: number;
  rippleCooldown: number;
  fedAge: number;
  enteredAt?: number;
  wander: Point;
};
type WaterRipple = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
  strength: number;
};
type FoodSpeck = Point & {
  age: number;
  life: number;
  radius: number;
  drift: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("koi-pond", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 86,
  targetScale: 1.55,
  motionSpeed: 0.42,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const koi = reactive<KoiFish[]>([]);
const ripples = reactive<WaterRipple[]>([]);
const food = reactive<FoodSpeck[]>([]);
const resultVisible = computed(() => session.status === "finished");

const koiHues = [24, 34, 196, 12];
let finishAfter = 0;
let ambientRippleTimer = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pondTop() {
  return Math.max(118, height.value * 0.18);
}

function safePoint(padding = 96): Point {
  return {
    x: randomRange(padding, Math.max(padding + 1, width.value - padding)),
    y: randomRange(pondTop() + padding * 0.45, Math.max(pondTop() + padding, height.value - padding * 0.72))
  };
}

function koiCount() {
  return width.value < 720 ? 3 : 4;
}

function koiSize(index: number) {
  const viewportLimit = Math.min(width.value, height.value) * 0.15;
  const base = Math.min(128, Math.max(78, Math.min(viewportLimit, 82 * session.settings.targetScale)));
  return base * (0.86 + index / Math.max(1, koiCount() - 1) * 0.22);
}

function createKoi(index: number): KoiFish {
  const size = koiSize(index);
  const start = safePoint(size * 0.9);
  const hue = koiHues[index % koiHues.length];
  return {
    id: `koi-${Date.now()}-${index}`,
    x: start.x,
    y: start.y,
    size,
    hue,
    accentHue: index % 2 === 0 ? 8 : 204,
    age: randomRange(0, Math.PI * 2),
    angle: randomRange(-0.4, 0.4),
    speed: randomRange(26, 42) * session.settings.motionSpeed,
    dwellProgress: 0,
    rippleCooldown: randomRange(0.2, 0.7),
    fedAge: 0,
    wander: safePoint(size)
  };
}

function resetKoi(fish: KoiFish, index: number) {
  Object.assign(fish, createKoi(index));
}

function initPond() {
  koi.splice(0);
  ripples.splice(0);
  food.splice(0);
  finishAfter = 0;
  ambientRippleTimer = 0;
  for (let index = 0; index < koiCount(); index += 1) koi.push(createKoi(index));
}

function ensureKoi() {
  while (koi.length < koiCount()) koi.push(createKoi(koi.length));
  while (koi.length > koiCount()) koi.pop();
  koi.forEach((fish, index) => {
    fish.size = koiSize(index);
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

function targetPayload(fish: KoiFish, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: fish.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: fish.enteredAt === undefined ? 0 : now - fish.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addRipple(point: Point, radius: number, hue = 188, strength = 1) {
  ripples.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: randomRange(2.2, 3.2),
    radius,
    hue,
    strength
  });
  if (ripples.length > 36) ripples.shift();
}

function addFood(point: Point) {
  for (let index = 0; index < 7; index += 1) {
    food.push({
      x: point.x + randomRange(-22, 22),
      y: point.y + randomRange(-18, 18),
      age: 0,
      life: randomRange(2.6, 4.2),
      radius: randomRange(2.4, 4.8),
      drift: randomRange(-1, 1)
    });
  }
  if (food.length > 42) food.splice(0, food.length - 42);
}

function closestKoi() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: KoiFish | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const fish of koi) {
    if (fish.fedAge > 0) continue;
    const nextDistance = distance(fish, pointer.value);
    const hitRadius = fish.size * 1.18;
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = fish;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function cancelKoi(fish: KoiFish, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(fish, now, fish.dwellProgress, reason));
  fish.enteredAt = undefined;
  fish.dwellProgress = 0;
}

function feedKoi(fish: KoiFish, now: number) {
  recordEvent("target-click", targetPayload(fish, now, 1));
  recordSuccess({ targetId: fish.id, hue: fish.hue });
  addRipple(fish, fish.size * 0.48, fish.hue + 24, 1.55);
  addFood(fish);
  fish.fedAge = 1.8;
  fish.enteredAt = undefined;
  fish.dwellProgress = 1;
  fish.wander = safePoint(fish.size);
  if (session.step >= session.maxSteps && finishAfter === 0) finishAfter = now + 2200;
}

function updateKoiGaze(fish: KoiFish, delta: number, now: number, gazeKoi?: KoiFish) {
  fish.rippleCooldown -= delta;

  if (fish.fedAge > 0 || session.status !== "running") return;
  if (gazeKoi !== fish) {
    if (fish.enteredAt !== undefined) cancelKoi(fish, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (fish.enteredAt === undefined) {
    fish.enteredAt = now;
    recordEvent("target-enter", targetPayload(fish, now, 0));
  }

  fish.dwellProgress = Math.min(1, (now - fish.enteredAt) / session.settings.dwellMs);
  if (fish.rippleCooldown <= 0) {
    addRipple(fish, fish.size * (0.2 + fish.dwellProgress * 0.34), fish.hue + 30, 0.45 + fish.dwellProgress * 0.75);
    fish.rippleCooldown = Math.max(0.42, 0.95 - fish.dwellProgress * 0.34);
  }
  if (fish.dwellProgress >= 1) feedKoi(fish, now);
}

function updateKoiMovement(fish: KoiFish, delta: number) {
  fish.age += delta;
  if (fish.fedAge > 0) {
    fish.fedAge = Math.max(0, fish.fedAge - delta);
    if (fish.fedAge === 0 && session.step < session.maxSteps) fish.wander = safePoint(fish.size);
  }

  const hasGaze = pointer.value.valid && session.status === "running" && session.step < session.maxSteps;
  const target = hasGaze ? pointer.value : fish.wander;
  const driftDistance = distance(fish, fish.wander);
  if (!hasGaze && driftDistance < fish.size * 0.7) fish.wander = safePoint(fish.size);

  const dx = target.x - fish.x;
  const dy = target.y - fish.y;
  const angle = Math.atan2(dy, dx);
  const approach = Math.min(distance(fish, target), fish.speed * (hasGaze ? 0.34 : 0.22) * delta);
  const sideSway = Math.sin(fish.age * 1.1) * fish.size * 0.012 * delta;
  fish.x += Math.cos(angle) * approach - Math.sin(angle) * sideSway;
  fish.y += Math.sin(angle) * approach + Math.cos(angle) * sideSway;
  fish.angle += (angle - fish.angle) * Math.min(1, delta * 1.8);

  const margin = fish.size * 0.7;
  fish.x = Math.min(width.value - margin, Math.max(margin, fish.x));
  fish.y = Math.min(height.value - margin * 0.7, Math.max(pondTop() + margin * 0.35, fish.y));
}

function updateFood(delta: number) {
  for (let index = food.length - 1; index >= 0; index -= 1) {
    const speck = food[index];
    speck.age += delta;
    speck.y += delta * 5;
    speck.x += Math.sin(speck.age * 1.4 + speck.drift) * delta * 5;
    if (speck.age >= speck.life) food.splice(index, 1);
  }
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += delta;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function updatePond(delta: number, now: number) {
  ensureKoi();
  if (!session.settings.reduceMotion) {
    ambientRippleTimer += delta;
    if (ambientRippleTimer >= 2.8) {
      addRipple(safePoint(42), randomRange(12, 28), 184, 0.24);
      ambientRippleTimer = 0;
    }
  }

  const gazeKoi = closestKoi();
  for (const fish of koi) {
    updateKoiMovement(fish, delta);
    updateKoiGaze(fish, delta, now, gazeKoi);
  }
  updateFood(delta);
  updateRipples(delta);
  if (finishAfter > 0 && now >= finishAfter) finishSession("max-steps");
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#e7efe4");
  sky.addColorStop(0.28, "#d4e7dc");
  sky.addColorStop(1, "#5f9492");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const top = pondTop();
  const water = ctx.createLinearGradient(0, top, 0, height.value);
  water.addColorStop(0, "#8fc8bc");
  water.addColorStop(0.56, "#4f9999");
  water.addColorStop(1, "#266f7a");
  ctx.fillStyle = water;
  ctx.fillRect(0, top, width.value, height.value - top);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e9fff6";
  ctx.lineWidth = 2;
  for (let row = 0; row < 9; row += 1) {
    const y = top + height.value * (0.05 + row * 0.085);
    const phase = now * 0.00014 + row * 0.64;
    ctx.beginPath();
    for (let x = -32; x <= width.value + 32; x += 48) {
      const waveY = y + Math.sin(x * 0.011 + phase) * 5;
      if (x === -32) ctx.moveTo(x, waveY);
      else ctx.quadraticCurveTo(x - 24, y + Math.cos(x * 0.009 + phase) * 4, x, waveY);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#537f62";
  for (let index = 0; index < 10; index += 1) {
    const x = (index * 137 + 42) % Math.max(width.value, 1);
    const y = top + height.value * (0.1 + (index % 5) * 0.14);
    ctx.beginPath();
    ctx.ellipse(x, y, 44 + index % 3 * 12, 15 + index % 2 * 5, Math.sin(index) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRipple(ctx: CanvasRenderingContext2D, ripple: WaterRipple) {
  const progress = Math.min(1, ripple.age / ripple.life);
  const radius = ripple.radius * (1 + progress * 3.4);
  const alpha = (1 - progress) * 0.34 * ripple.strength;
  ctx.save();
  ctx.strokeStyle = `hsla(${ripple.hue}, 76%, 88%, ${alpha})`;
  ctx.lineWidth = Math.max(1.4, 3.2 * (1 - progress * 0.45));
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `hsla(${ripple.hue + 20}, 68%, 92%, ${alpha * 0.52})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(ripple.x, ripple.y, radius * 0.56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFood(ctx: CanvasRenderingContext2D, speck: FoodSpeck) {
  const progress = Math.min(1, speck.age / speck.life);
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.68;
  ctx.fillStyle = "#f2d99d";
  ctx.beginPath();
  ctx.arc(speck.x, speck.y, speck.radius * (1 - progress * 0.24), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawKoi(ctx: CanvasRenderingContext2D, fish: KoiFish) {
  const pulse = Math.sin(fish.age * 2.2) * 0.04;
  const focus = fish.dwellProgress;
  const fed = fish.fedAge > 0 ? fish.fedAge / 1.8 : 0;
  const length = fish.size * (1.22 + pulse * 0.25);
  const body = fish.size * (0.44 + focus * 0.018);

  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.rotate(fish.angle);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#174f5a";
  ctx.beginPath();
  ctx.ellipse(0, body * 0.28, length * 0.55, body * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = `hsla(${fish.accentHue}, 82%, 62%, 0.72)`;
  ctx.beginPath();
  ctx.moveTo(-length * 0.54, 0);
  ctx.quadraticCurveTo(-length * 0.78, -body * 0.72, -length * 0.94, -body * 0.34);
  ctx.quadraticCurveTo(-length * 0.72, 0, -length * 0.94, body * 0.34);
  ctx.quadraticCurveTo(-length * 0.78, body * 0.72, -length * 0.54, 0);
  ctx.fill();

  const bodyFill = ctx.createRadialGradient(-length * 0.16, -body * 0.32, body * 0.18, 0, 0, length * 0.52);
  bodyFill.addColorStop(0, "#fff7e7");
  bodyFill.addColorStop(0.56, `hsl(${fish.hue}, 84%, ${64 + focus * 7}%)`);
  bodyFill.addColorStop(1, `hsl(${fish.hue - 8}, 72%, ${46 + fed * 7}%)`);
  ctx.fillStyle = bodyFill;
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.54, body, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${fish.accentHue}, 92%, 58%, 0.66)`;
  ctx.beginPath();
  ctx.ellipse(-length * 0.12, -body * 0.24, length * 0.16, body * 0.38, -0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(length * 0.18, body * 0.18, length * 0.13, body * 0.3, 0.26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(255 250 235 / 78%)";
  ctx.beginPath();
  ctx.ellipse(length * 0.38, -body * 0.05, length * 0.15, body * 0.34, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#173d48";
  ctx.beginPath();
  ctx.arc(length * 0.38, -body * 0.28, Math.max(2.5, body * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(length * 0.38, body * 0.28, Math.max(2.5, body * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${fish.hue + 22}, 88%, 86%, ${0.28 + focus * 0.34 + fed * 0.2})`;
  ctx.lineWidth = Math.max(2, fish.size * 0.025);
  ctx.beginPath();
  ctx.ellipse(0, 0, length * (0.62 + focus * 0.08 + fed * 0.08), body * (1.15 + focus * 0.1), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const ripple of ripples) drawRipple(ctx, ripple);
  for (const speck of food) drawFood(ctx, speck);
  for (const fish of koi) drawKoi(ctx, fish);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") updatePond(delta, now);
}

function restart() {
  startSession();
  initPond();
}

onMounted(() => {
  initPond();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="koi-pond-shell">
    <canvas ref="canvasRef" class="koi-pond-canvas" />

    <GameHud
      title="Кои-пруд"
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
      title="Кои-пруд"
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
.koi-pond-shell {
  background: #8fc8bc;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.koi-pond-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
