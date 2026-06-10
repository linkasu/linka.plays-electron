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
type Car = Point & {
  angle: number;
  dwellProgress: number;
  enteredAt: number;
  glow: number;
  wheelPhase: number;
};
type Checkpoint = Point & {
  id: string;
  radius: number;
  phase: number;
  entered: boolean;
};
type RoadMark = {
  x: number;
  offset: number;
  length: number;
  alpha: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("smooth-car", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 600,
  sessionSeconds: 150,
  targetScale: 1.45,
  motionSpeed: 0.58,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMistakes: false
});

const car = reactive<Car>({ x: 0, y: 0, angle: 0, dwellProgress: 0, enteredAt: 0, glow: 0, wheelPhase: 0 });
const checkpoint = reactive<Checkpoint>({ id: "smooth-car-checkpoint-0", x: 0, y: 0, radius: 120, phase: 0, entered: false });
const roadMarks = reactive<RoadMark[]>([]);
const resultVisible = computed(() => session.status === "finished");
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Машинка спокойно ждёт на широкой дороге.";
  if (!pointer.value.valid) return "Можно вести машинку взглядом или мышью. Дорога широкая, ошибок нет.";
  if (car.dwellProgress > 0) return "Удерживай машинку в светлом круге, checkpoint почти пройден.";
  return "Веди машинку взглядом к следующему светлому checkpoint.";
});

let checkpointSequence = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roadCenterY(x: number) {
  const safeTop = Math.max(150, height.value * 0.2);
  const safeBottom = height.value - Math.max(72, height.value * 0.1);
  const middle = safeTop + (safeBottom - safeTop) * 0.52;
  return middle + Math.sin((x / Math.max(1, width.value)) * Math.PI * 2.1 - 0.55) * Math.min(56, height.value * 0.075);
}

function roadHalfWidth() {
  return Math.min(230, Math.max(145, Math.min(width.value, height.value) * 0.2 * session.settings.targetScale));
}

function carSize() {
  return Math.min(118, Math.max(72, Math.min(width.value, height.value) * 0.12 * session.settings.targetScale));
}

function checkpointRadius() {
  return Math.min(154, Math.max(104, 82 * session.settings.targetScale));
}

function clampToRoad(point: Point) {
  const margin = carSize() * 0.72;
  const x = clamp(point.x, margin, Math.max(margin, width.value - margin));
  const center = roadCenterY(x);
  const halfWidth = roadHalfWidth() - carSize() * 0.34;
  return {
    x,
    y: clamp(point.y, center - halfWidth, center + halfWidth)
  };
}

function checkpointPosition(index: number) {
  const xs = [0.76, 0.42, 0.84, 0.24, 0.64, 0.34, 0.72, 0.5];
  const offsets = [-0.28, 0.2, 0.02, -0.18, 0.3, -0.32, 0.16, -0.04];
  const x = width.value * xs[index % xs.length];
  const radius = checkpointRadius();
  return clampToRoad({ x, y: roadCenterY(x) + roadHalfWidth() * offsets[index % offsets.length] + Math.sin(index * 1.7) * 10 + radius * 0.02 });
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

function targetPayload(now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: checkpoint.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: car.enteredAt > 0 ? now - car.enteredAt : 0,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function resetCheckpoint() {
  const position = checkpointPosition(checkpointSequence);
  checkpointSequence += 1;
  checkpoint.id = `smooth-car-checkpoint-${Date.now()}-${checkpointSequence}`;
  checkpoint.x = position.x;
  checkpoint.y = position.y;
  checkpoint.radius = checkpointRadius();
  checkpoint.phase = Math.random() * Math.PI * 2;
  checkpoint.entered = false;
  car.dwellProgress = 0;
  car.enteredAt = 0;
}

function initRoadMarks() {
  roadMarks.splice(0);
  const count = width.value < 720 ? 7 : 11;
  for (let index = 0; index < count; index += 1) {
    roadMarks.push({
      x: (index / Math.max(1, count - 1)) * width.value,
      offset: index % 2 === 0 ? -0.38 : 0.38,
      length: 44 + (index % 3) * 16,
      alpha: 0.16 + (index % 4) * 0.035
    });
  }
}

function resetScene() {
  checkpointSequence = 0;
  initRoadMarks();
  const startX = width.value * 0.18;
  const start = clampToRoad({ x: startX, y: roadCenterY(startX) });
  car.x = start.x;
  car.y = start.y;
  car.angle = 0;
  car.dwellProgress = 0;
  car.enteredAt = 0;
  car.glow = 0;
  car.wheelPhase = 0;
  resetCheckpoint();
}

function updateCar(delta: number) {
  const fallback = { x: checkpoint.x, y: checkpoint.y };
  const target = clampToRoad(pointer.value.valid ? pointer.value : fallback);
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const ease = Math.min(1, delta * (1.6 + session.settings.motionSpeed * 2.6));
  const maxStep = delta * (240 + session.settings.motionSpeed * 210);
  const moveX = clamp(dx * ease, -maxStep, maxStep);
  const moveY = clamp(dy * ease, -maxStep, maxStep);

  car.x += moveX;
  car.y += moveY;
  car.y = clampToRoad(car).y;
  if (Math.abs(moveX) + Math.abs(moveY) > 0.02) car.angle += (Math.atan2(moveY, Math.max(12, moveX)) - car.angle) * Math.min(1, delta * 5.5);
  car.wheelPhase += distance({ x: 0, y: 0 }, { x: moveX, y: moveY }) * 0.1;
  car.glow = Math.max(0, car.glow - delta * 1.4);
}

function completeCheckpoint(now: number) {
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: checkpoint.id, checkpoint: session.step + 1, label: "smooth-car-checkpoint" });
  car.glow = 1;
  if (session.status === "running") resetCheckpoint();
}

function updateCheckpoint(delta: number, now: number) {
  checkpoint.radius = checkpointRadius();
  checkpoint.phase += delta * 1.9;

  const gap = distance(car, checkpoint);
  const enterDistance = checkpoint.radius * 1.08;
  const holdDistance = checkpoint.radius * 0.66;
  const progress = clamp(1 - gap / enterDistance, 0, 1);
  const closeEnough = gap <= enterDistance;
  const holding = gap <= holdDistance;

  if (closeEnough && !checkpoint.entered) {
    checkpoint.entered = true;
    car.enteredAt = now;
    recordEvent("target-enter", targetPayload(now, progress));
  }

  if (!closeEnough && checkpoint.entered) {
    checkpoint.entered = false;
    recordEvent("target-cancel", targetPayload(now, progress, pointer.value.valid ? "left" : "invalid-gaze"));
    car.enteredAt = 0;
  }

  const dwellGain = (delta * 1000 / session.settings.dwellMs) * (holding ? 1.05 : closeEnough ? 0.45 : -0.75);
  car.dwellProgress = clamp(car.dwellProgress + dwellGain, 0, 1);
  if (car.dwellProgress >= 1) completeCheckpoint(now);
}

function syncGeometry() {
  if (width.value <= 0 || height.value <= 0) return;
  car.x = clamp(car.x || width.value * 0.18, carSize() * 0.72, width.value - carSize() * 0.72);
  car.y = clampToRoad(car).y;
  if (checkpoint.x <= 0 || checkpoint.y <= 0) resetCheckpoint();
  checkpoint.radius = checkpointRadius();
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  syncGeometry();
  if (session.status !== "running") return;
  updateCar(delta);
  updateCheckpoint(delta, now);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#dff7ff");
  sky.addColorStop(0.52, "#f5fbeb");
  sky.addColorStop(1, "#d9efc8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.fillStyle = "rgb(129 189 113 / 30%)";
  for (let index = 0; index < 7; index += 1) {
    const x = width.value * ((index * 0.19 + 0.08) % 1);
    const y = height.value * (0.2 + (index % 4) * 0.18);
    ctx.beginPath();
    ctx.ellipse(x, y + Math.sin(now * 0.0002 + index) * 5, 86 + index * 8, 22 + index * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D) {
  const samples: Point[] = [];
  for (let x = -100; x <= width.value + 100; x += Math.max(28, width.value / 26)) samples.push({ x, y: roadCenterY(x) });

  ctx.save();
  ctx.fillStyle = "#9fb0b4";
  ctx.beginPath();
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index];
    const y = point.y - roadHalfWidth();
    if (index === 0) ctx.moveTo(point.x, y);
    else ctx.lineTo(point.x, y);
  }
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const point = samples[index];
    ctx.lineTo(point.x, point.y + roadHalfWidth());
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgb(255 255 255 / 55%)";
  ctx.lineWidth = 5;
  ctx.setLineDash([24, 22]);
  ctx.beginPath();
  for (let index = 0; index < samples.length; index += 1) {
    const point = samples[index];
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  for (const mark of roadMarks) {
    const center = roadCenterY(mark.x);
    ctx.globalAlpha = mark.alpha;
    ctx.fillStyle = mark.offset < 0 ? "#e6f6ff" : "#fff6cf";
    ctx.beginPath();
    ctx.ellipse(mark.x, center + roadHalfWidth() * mark.offset, mark.length, 7, Math.sin(mark.x * 0.01) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCheckpoint(ctx: CanvasRenderingContext2D) {
  const pulse = 1 + Math.sin(checkpoint.phase) * 0.04;
  const radius = checkpoint.radius * pulse;
  const glow = ctx.createRadialGradient(checkpoint.x, checkpoint.y, radius * 0.12, checkpoint.x, checkpoint.y, radius * 1.12);
  glow.addColorStop(0, "rgb(255 255 255 / 48%)");
  glow.addColorStop(0.62, "rgb(255 229 134 / 24%)");
  glow.addColorStop(1, "rgb(255 229 134 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(checkpoint.x, checkpoint.y, radius * 1.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(255 247 184 / 92%)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(checkpoint.x, checkpoint.y, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgb(88 151 255 / ${0.32 + car.dwellProgress * 0.52})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(checkpoint.x, checkpoint.y, radius * 0.78, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * Math.max(0.02, car.dwellProgress));
  ctx.stroke();
}

function drawCar(ctx: CanvasRenderingContext2D) {
  const size = carSize();
  const light = Math.max(car.glow, car.dwellProgress);
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle * 0.42);

  const glow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * (0.9 + light * 0.42));
  glow.addColorStop(0, `rgb(255 241 164 / ${0.14 + light * 0.28})`);
  glow.addColorStop(1, "rgb(255 241 164 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * (0.9 + light * 0.42), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(50 63 74 / 20%)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.34, size * 0.72, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f9b45d";
  ctx.strokeStyle = "rgb(133 79 54 / 46%)";
  ctx.lineWidth = Math.max(3, size * 0.04);
  ctx.beginPath();
  ctx.roundRect(-size * 0.62, -size * 0.25, size * 1.24, size * 0.55, size * 0.18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffcf7c";
  ctx.beginPath();
  ctx.roundRect(-size * 0.28, -size * 0.5, size * 0.62, size * 0.38, size * 0.16);
  ctx.fill();
  ctx.strokeStyle = "rgb(133 79 54 / 32%)";
  ctx.stroke();

  ctx.fillStyle = "rgb(210 240 255 / 86%)";
  ctx.beginPath();
  ctx.roundRect(-size * 0.2, -size * 0.43, size * 0.23, size * 0.22, size * 0.06);
  ctx.roundRect(size * 0.08, -size * 0.43, size * 0.2, size * 0.22, size * 0.06);
  ctx.fill();

  for (const wheelX of [-size * 0.38, size * 0.42]) {
    ctx.fillStyle = "#384047";
    ctx.beginPath();
    ctx.arc(wheelX, size * 0.3, size * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(255 255 255 / 45%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wheelX, size * 0.3);
    ctx.lineTo(wheelX + Math.cos(car.wheelPhase) * size * 0.11, size * 0.3 + Math.sin(car.wheelPhase) * size * 0.11);
    ctx.stroke();
  }

  ctx.fillStyle = "rgb(255 250 196 / 86%)";
  ctx.beginPath();
  ctx.arc(size * 0.64, -size * 0.06, size * 0.055, 0, Math.PI * 2);
  ctx.arc(size * 0.64, size * 0.16, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawRoad(ctx);
  drawCheckpoint(ctx);
  drawCar(ctx);
}

function restart() {
  startSession();
  resetScene();
}

onMounted(() => {
  resetScene();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="smooth-car-shell">
    <canvas ref="canvasRef" class="smooth-car-canvas" />

    <v-card class="smooth-car-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">{{ guidanceText }}</div>
      <div class="text-caption text-medium-emphasis">Без столкновений и проигрыша: если взгляд ушёл, машинка просто едет мягче.</div>
    </v-card>

    <GameHud
      title="Плавная машинка"
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
      title="Плавная машинка"
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
.smooth-car-shell {
  background: #dff7ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.smooth-car-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.smooth-car-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 660px;
  opacity: 0.88;
  position: absolute;
  z-index: 3;
}
</style>
