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

type Boat = Point & {
  holdProgress: number;
  glow: number;
  phase: number;
  wait: number;
  enteredAt: number;
};

type Ripple = Point & {
  age: number;
  life: number;
  radius: number;
  alpha: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("island", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 85,
  targetScale: 1.55,
  motionSpeed: 0.34,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMistakes: false
});

const island = reactive({ x: 0, y: 0, phase: 0 });
const boat = reactive<Boat>({ x: 0, y: 0, holdProgress: 0, glow: 0, phase: 0, wait: 0, enteredAt: 0 });
const ripples = reactive<Ripple[]>([]);
const resultVisible = computed(() => session.status === "finished");
const progressLabel = computed(() => `${Math.min(session.step, session.maxSteps)} из ${session.maxSteps}`);

let wasInSafeRadius = false;
let rippleTimer = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function islandRadius() {
  return Math.min(156, Math.max(92, Math.min(width.value, height.value) * 0.13 * session.settings.targetScale));
}

function safeRadius() {
  return islandRadius() * 1.9;
}

function boatSize() {
  return Math.min(108, Math.max(64, islandRadius() * 0.64));
}

function syncIsland() {
  const radius = islandRadius();
  island.x = width.value * 0.5;
  island.y = clamp(height.value * 0.57, Math.max(150, height.value * 0.25) + radius * 0.35, height.value - radius * 0.82);
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

function gazeInfluence() {
  if (!pointer.value.valid) return 0;
  const gap = distance(pointer.value, island);
  return clamp(1 - gap / safeRadius(), 0, 1);
}

function constrainedSafePoint(point: Point) {
  const radius = islandRadius();
  const minGap = radius * 1.16;
  const maxGap = safeRadius() * 0.82;
  const dx = point.x - island.x;
  const dy = point.y - island.y;
  const gap = Math.max(1, Math.hypot(dx, dy));
  const clampedGap = clamp(gap, minGap, maxGap);
  return {
    x: island.x + dx / gap * clampedGap,
    y: island.y + dy / gap * clampedGap
  };
}

function targetPayload(now: number, progress: number, reason?: "left-safe-radius" | "invalid-gaze") {
  return {
    targetId: `island-safe-${session.step + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: boat.enteredAt > 0 ? now - boat.enteredAt : 0,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addRipple(x: number, y: number, radius: number, alpha = 0.35) {
  ripples.push({ x, y, radius, age: 0, life: 1.9, alpha });
  if (ripples.length > 18) ripples.shift();
}

function completeSafeHold(now: number) {
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: `island-safe-${session.step + 1}`, label: "safe island radius" });
  boat.holdProgress = 0;
  boat.enteredAt = 0;
  boat.glow = 1;
  wasInSafeRadius = false;
  addRipple(island.x, island.y, safeRadius() * 0.5, 0.42);
}

function updateSafeHold(delta: number, now: number, influence: number) {
  if (session.status !== "running" || session.step >= session.maxSteps) return;

  const inSafeRadius = influence > 0;
  if (inSafeRadius && !wasInSafeRadius) {
    boat.enteredAt = now;
    recordEvent("target-enter", targetPayload(now, boat.holdProgress));
  }

  if (!inSafeRadius && wasInSafeRadius) {
    recordEvent("target-cancel", targetPayload(now, boat.holdProgress, pointer.value.valid ? "left-safe-radius" : "invalid-gaze"));
    boat.enteredAt = 0;
  }

  wasInSafeRadius = inSafeRadius;
  if (!inSafeRadius) return;

  const gain = (delta * 1000 / session.settings.dwellMs) * (0.72 + influence * 0.48);
  boat.holdProgress = Math.min(1, boat.holdProgress + gain);
  if (boat.holdProgress >= 1) completeSafeHold(now);
}

function updateBoat(delta: number, now: number, influence: number) {
  const inSafeRadius = influence > 0;
  const radius = islandRadius();
  const idleAngle = -0.2 + Math.sin(now * 0.00022 + boat.phase) * 0.18;
  const idlePoint = {
    x: island.x + Math.cos(idleAngle) * radius * 1.48,
    y: island.y + Math.sin(idleAngle) * radius * 0.52
  };
  const target = inSafeRadius ? constrainedSafePoint(pointer.value) : idlePoint;
  const follow = inSafeRadius ? 2.25 : 0.48;

  boat.x += (target.x - boat.x) * Math.min(1, delta * follow * session.settings.motionSpeed * 3.1);
  boat.y += (target.y - boat.y) * Math.min(1, delta * follow * session.settings.motionSpeed * 3.1);
  boat.glow = Math.max(0, boat.glow - delta * 0.5);
  boat.wait += ((inSafeRadius ? 0 : 1) - boat.wait) * Math.min(1, delta * 1.7);
}

function updateRipples(delta: number) {
  rippleTimer += delta;
  if (rippleTimer >= 0.82) {
    rippleTimer = 0;
    addRipple(island.x, island.y, islandRadius() * (1.15 + boat.holdProgress * 0.3), 0.16 + boat.holdProgress * 0.16);
  }

  for (let index = ripples.length - 1; index >= 0; index -= 1) {
    const ripple = ripples[index];
    ripple.age += delta;
    ripple.radius += delta * 18;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  if (width.value <= 0 || height.value <= 0) return;
  syncIsland();
  const safeDelta = session.status === "paused" ? 0 : delta;
  const influence = session.status === "running" ? gazeInfluence() : 0;

  island.phase += safeDelta * 0.5;
  boat.phase += safeDelta * 0.85;
  updateSafeHold(safeDelta, now, influence);
  updateBoat(safeDelta, now, influence);
  updateRipples(safeDelta);
}

function resetScene() {
  syncIsland();
  boat.x = island.x + islandRadius() * 1.42;
  boat.y = island.y - islandRadius() * 0.18;
  boat.holdProgress = 0;
  boat.glow = 0;
  boat.phase = Math.random() * Math.PI * 2;
  boat.wait = 0;
  boat.enteredAt = 0;
  rippleTimer = 0;
  wasInSafeRadius = false;
  ripples.splice(0);
}

function restart() {
  startSession();
  resetScene();
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#9fd7f0");
  sky.addColorStop(0.5, "#b9efe9");
  sky.addColorStop(1, "#4ca6b9");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const sunX = width.value * 0.78 + Math.sin(now * 0.00008) * 14;
  const sunY = height.value * 0.2;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.min(width.value, height.value) * 0.32);
  sun.addColorStop(0, "rgb(255 244 191 / 38%)");
  sun.addColorStop(1, "rgb(255 244 191 / 0%)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.fillStyle = "rgb(255 255 255 / 16%)";
  for (let index = 0; index < 5; index += 1) {
    const y = height.value * (0.48 + index * 0.085);
    const offset = Math.sin(now * 0.00018 + index) * 24;
    ctx.beginPath();
    ctx.ellipse(width.value * 0.5 + offset, y, width.value * 0.54, 8 + index * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSafeRadius(ctx: CanvasRenderingContext2D, influence: number) {
  const radius = safeRadius();
  const alpha = 0.15 + Math.max(influence, boat.holdProgress) * 0.16;
  const safe = ctx.createRadialGradient(island.x, island.y, islandRadius() * 0.82, island.x, island.y, radius);
  safe.addColorStop(0, `rgb(255 248 194 / ${alpha})`);
  safe.addColorStop(1, "rgb(255 248 194 / 0%)");
  ctx.fillStyle = safe;
  ctx.beginPath();
  ctx.arc(island.x, island.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgb(255 255 225 / ${0.18 + boat.holdProgress * 0.24})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 18]);
  ctx.beginPath();
  ctx.arc(island.x, island.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRipples(ctx: CanvasRenderingContext2D) {
  for (const ripple of ripples) {
    const progress = ripple.age / ripple.life;
    ctx.strokeStyle = `rgb(255 255 235 / ${ripple.alpha * (1 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ripple.x, ripple.y, ripple.radius * 1.3, ripple.radius * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawIsland(ctx: CanvasRenderingContext2D, now: number) {
  const radius = islandRadius();
  const bob = Math.sin(now * 0.0006 + island.phase) * 2;

  ctx.save();
  ctx.translate(island.x, island.y + bob);

  ctx.fillStyle = "rgb(239 206 130 / 92%)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.18, radius * 1.1, radius * 0.5, -0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6fb36a";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.08, -radius * 0.08, radius * 0.82, radius * 0.42, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(60 114 80 / 58%)";
  ctx.lineWidth = Math.max(4, radius * 0.04);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(radius * 0.12, -radius * 0.1);
  ctx.quadraticCurveTo(radius * 0.08, -radius * 0.62, radius * 0.36, -radius * 0.92);
  ctx.stroke();

  ctx.fillStyle = "#4f9f62";
  for (let index = 0; index < 4; index += 1) {
    const angle = -1.05 + index * 0.38;
    ctx.save();
    ctx.translate(radius * 0.36, -radius * 0.92);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(radius * 0.22, 0, radius * 0.28, radius * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let index = 0; index < session.step; index += 1) {
    const angle = -Math.PI * 0.75 + index * (Math.PI * 1.5 / Math.max(1, session.maxSteps - 1));
    const x = Math.cos(angle) * radius * 0.72;
    const y = Math.sin(angle) * radius * 0.28 + radius * 0.15;
    ctx.fillStyle = "rgb(255 247 179 / 86%)";
    ctx.beginPath();
    ctx.arc(x, y, Math.max(5, radius * 0.055), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBoat(ctx: CanvasRenderingContext2D, now: number, influence: number) {
  const size = boatSize();
  const bob = Math.sin(now * 0.0012 + boat.phase) * size * 0.045;
  const light = Math.max(influence, boat.holdProgress, boat.glow * 0.8);

  ctx.save();
  ctx.translate(boat.x, boat.y + bob);
  ctx.rotate(Math.sin(now * 0.0007 + boat.phase) * 0.05);

  const glow = ctx.createRadialGradient(0, -size * 0.28, 0, 0, -size * 0.28, size * (1.1 + light * 0.7));
  glow.addColorStop(0, `rgb(255 248 190 / ${0.2 + light * 0.34})`);
  glow.addColorStop(1, "rgb(255 248 190 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -size * 0.28, size * (1.1 + light * 0.7), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b5a3c";
  ctx.beginPath();
  ctx.moveTo(-size * 0.62, 0);
  ctx.quadraticCurveTo(0, size * 0.46, size * 0.62, 0);
  ctx.quadraticCurveTo(size * 0.34, size * 0.18, -size * 0.34, size * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f7d892";
  ctx.beginPath();
  ctx.roundRect(-size * 0.17, -size * 0.62, size * 0.34, size * 0.36, size * 0.06);
  ctx.fill();
  ctx.strokeStyle = "rgb(108 72 46 / 50%)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = `rgb(255 239 144 / ${0.72 + light * 0.26})`;
  ctx.beginPath();
  ctx.arc(0, -size * 0.43, size * 0.095, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgb(255 255 238 / ${0.34 + boat.holdProgress * 0.38})`;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, -size * 0.23, size * 0.78, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * Math.max(0.02, boat.holdProgress));
  ctx.stroke();

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  const influence = session.status === "running" ? gazeInfluence() : 0;
  drawBackground(ctx, now);
  drawSafeRadius(ctx, influence);
  drawRipples(ctx);
  drawIsland(ctx, now);
  drawBoat(ctx, now, influence);
}

onMounted(resetScene);
useGameLoop({ context, update, draw });
</script>

<template>
  <div class="island-shell">
    <canvas ref="canvasRef" class="island-canvas" aria-label="Игра Островок" />

    <v-card class="island-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Держи взгляд в мягком круге у островка: лодка и огонёк останутся рядом.</div>
      <div class="text-caption text-medium-emphasis">Если взгляд ушёл, лодка спокойно ждёт. Ошибок здесь нет. Огоньков: {{ progressLabel }}</div>
    </v-card>

    <GameHud
      title="Островок"
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
      title="Островок"
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
.island-shell {
  background: #9fd7f0;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.island-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.island-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 640px;
  opacity: 0.86;
  position: absolute;
  z-index: 3;
}
</style>
