<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeKitePiano, setKitePianoActive, setKitePianoIntensity, tickKitePiano, warmKitePiano } from "./audio";

type Point = { x: number; y: number };
type Cloud = Point & {
  radius: number;
  speed: number;
  alpha: number;
  phase: number;
};
type WindLine = Point & {
  age: number;
  life: number;
  length: number;
  drift: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("kite", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 1450, sessionSeconds: 85, targetScale: 1.5, motionSpeed: 0.34, distractors: "none", hints: "high", sound: true },
  finishOnMistakes: false
});

const kite = reactive({
  x: 0,
  y: 0,
  power: 0,
  dwellProgress: 0,
  enteredAt: 0,
  glow: 0,
  sway: 0
});
const clouds = reactive<Cloud[]>([]);
const windLines = reactive<WindLine[]>([]);
const resultVisible = computed(() => session.status === "finished");

let windTimer = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function kiteSize() {
  return Math.min(260, Math.max(150, Math.min(width.value, height.value) * 0.24 * session.settings.targetScale));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function resetScene() {
  kite.x = width.value * 0.5;
  kite.y = height.value * 0.58;
  kite.power = 0;
  kite.dwellProgress = 0;
  kite.enteredAt = 0;
  kite.glow = 0;
  kite.sway = randomRange(0, Math.PI * 2);
  windTimer = 0;
  windLines.splice(0);
  clouds.splice(0);

  const cloudCount = width.value < 720 ? 5 : 8;
  for (let index = 0; index < cloudCount; index += 1) {
    clouds.push({
      x: randomRange(-10, 105),
      y: randomRange(height.value * 0.12, height.value * 0.46),
      radius: randomRange(36, 82),
      speed: randomRange(4, 11),
      alpha: randomRange(0.22, 0.46),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function gazeInfluence() {
  if (!pointer.value.valid) return 0;
  const radius = kiteSize() * 0.88;
  return clamp(1 - distance(kite, pointer.value) / radius, 0, 1);
}

function kiteHeightIntensity() {
  if (height.value <= 0) return 0;
  const low = height.value * 0.66;
  const high = height.value * 0.22;
  const normalizedHeight = clamp((low - kite.y) / Math.max(1, low - high), 0, 1);
  return 0.16 + normalizedHeight * 0.84;
}

function updateKiteMusic() {
  const enabled = session.settings.sound;
  const active = session.status === "running";
  setKitePianoActive(enabled, active);
  setKitePianoIntensity(enabled, active ? kiteHeightIntensity() : 0);
  tickKitePiano(enabled);
}

function targetPayload(now: number, progress: number) {
  return {
    targetId: `kite-lift-${session.step + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: kite.enteredAt > 0 ? now - kite.enteredAt : 0,
    progress,
    pointer: copyPointer()
  };
}

function completeLift(now: number) {
  const targetId = `kite-lift-${session.step + 1}`;
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId, label: "kite-lift" });
  kite.dwellProgress = 0;
  kite.enteredAt = 0;
  kite.glow = 1;
}

function updateProgress(delta: number, now: number, influence: number) {
  if (session.status !== "running" || session.step >= session.maxSteps) return;

  const focused = influence > 0.14;
  if (focused && kite.enteredAt === 0) {
    kite.enteredAt = now;
    recordEvent("target-enter", targetPayload(now, kite.dwellProgress));
  }
  if (!focused) kite.enteredAt = 0;

  if (focused) {
    const gain = (delta * 1000 / session.settings.dwellMs) * (0.55 + influence * 0.7);
    kite.dwellProgress = Math.min(1, kite.dwellProgress + gain);
  } else {
    kite.dwellProgress = Math.max(0, kite.dwellProgress - delta * 0.12);
  }

  if (kite.dwellProgress >= 1) completeLift(now);
}

function updateKite(delta: number, now: number) {
  const influence = gazeInfluence();
  kite.power += (influence - kite.power) * Math.min(1, delta * 1.8);
  kite.glow = Math.max(0, kite.glow - delta * 0.55);

  updateProgress(delta, now, influence);

  const stepLift = session.step / Math.max(1, session.maxSteps);
  const lift = stepLift * 0.34 + kite.dwellProgress * 0.09 + kite.power * 0.12;
  const calmX = width.value * (0.5 + Math.sin(now * 0.00016 + kite.sway) * 0.08);
  const gazeX = pointer.value.valid && influence > 0.12 ? pointer.value.x : calmX;
  const targetX = clamp(gazeX, width.value * 0.16, width.value * 0.84);
  const targetY = clamp(height.value * (0.62 - lift) + Math.sin(now * 0.00028 + kite.sway) * 12, height.value * 0.22, height.value * 0.66);

  const follow = session.status === "running" ? 0.92 : 0.36;
  kite.x += (targetX - kite.x) * Math.min(1, delta * follow * session.settings.motionSpeed * 3.2);
  kite.y += (targetY - kite.y) * Math.min(1, delta * follow * session.settings.motionSpeed * 3.4);
}

function updateClouds(delta: number) {
  for (const cloud of clouds) {
    cloud.x += cloud.speed * delta * session.settings.motionSpeed;
    cloud.y += Math.sin(performance.now() * 0.00018 + cloud.phase) * delta * 2.2;
    if (cloud.x * 0.01 * width.value - cloud.radius > width.value + 80) cloud.x = -18;
  }
}

function addWindLine() {
  windLines.push({
    x: kite.x + randomRange(-160, 120),
    y: kite.y + randomRange(-130, 120),
    age: 0,
    life: randomRange(1.5, 2.8),
    length: randomRange(86, 180),
    drift: randomRange(-22, 22)
  });
  if (windLines.length > 24) windLines.shift();
}

function updateWind(delta: number) {
  windTimer += delta;
  const interval = 0.42 / session.settings.motionSpeed;
  while (windTimer >= interval) {
    addWindLine();
    windTimer -= interval;
  }

  for (let index = windLines.length - 1; index >= 0; index -= 1) {
    const line = windLines[index];
    line.age += delta;
    line.x += (26 + line.drift) * delta;
    line.y += Math.sin(line.age * 1.9) * delta * 8;
    if (line.age >= line.life) windLines.splice(index, 1);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#bfe9ff");
  sky.addColorStop(0.62, "#edf8ff");
  sky.addColorStop(1, "#e8f2c8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const sunX = width.value * 0.82 + Math.sin(now * 0.00008) * 18;
  const sunY = height.value * 0.19;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(width.value, height.value) * 0.38);
  glow.addColorStop(0, "rgb(255 242 179 / 34%)");
  glow.addColorStop(1, "rgb(255 242 179 / 0%)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.fillStyle = "rgb(129 177 114 / 34%)";
  ctx.beginPath();
  ctx.ellipse(width.value * 0.23, height.value * 0.96, width.value * 0.36, height.value * 0.16, 0, 0, Math.PI * 2);
  ctx.ellipse(width.value * 0.74, height.value * 0.97, width.value * 0.44, height.value * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud, now: number) {
  const x = cloud.x * 0.01 * width.value;
  const y = cloud.y + Math.sin(now * 0.00018 + cloud.phase) * 5;
  ctx.save();
  ctx.globalAlpha = cloud.alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x - cloud.radius * 0.46, y + cloud.radius * 0.06, cloud.radius * 0.56, cloud.radius * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(x, y - cloud.radius * 0.1, cloud.radius * 0.72, cloud.radius * 0.38, 0, 0, Math.PI * 2);
  ctx.ellipse(x + cloud.radius * 0.52, y + cloud.radius * 0.08, cloud.radius * 0.52, cloud.radius * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWindLine(ctx: CanvasRenderingContext2D, line: WindLine) {
  const progress = line.age / line.life;
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.22;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(line.x - line.length * 0.5, line.y);
  ctx.quadraticCurveTo(line.x, line.y - 16 * Math.sin(progress * Math.PI), line.x + line.length * 0.5, line.y + line.drift * 0.14);
  ctx.stroke();
  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, size: number, now: number) {
  const points: Point[] = [];
  for (let index = 0; index < 8; index += 1) {
    points.push({
      x: Math.sin(now * 0.001 + index * 0.82 + kite.sway) * size * 0.13,
      y: size * 0.42 + index * size * 0.18
    });
  }

  ctx.strokeStyle = "rgb(63 83 115 / 58%)";
  ctx.lineWidth = Math.max(2, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.32);
  for (const point of points) ctx.lineTo(point.x, point.y);
  ctx.stroke();

  for (let index = 1; index < points.length; index += 2) {
    const point = points[index];
    const bow = size * 0.075;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(Math.sin(now * 0.0012 + index) * 0.38);
    ctx.fillStyle = index % 4 === 1 ? "#ffb15c" : "#7bc8ff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-bow, -bow * 0.5);
    ctx.lineTo(-bow * 0.2, bow * 0.55);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bow, -bow * 0.5);
    ctx.lineTo(bow * 0.2, bow * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawKite(ctx: CanvasRenderingContext2D, now: number) {
  const size = kiteSize();
  const angle = Math.sin(now * 0.00055 + kite.sway) * 0.08;
  const light = Math.max(kite.power, kite.dwellProgress, kite.glow);

  ctx.save();
  ctx.translate(kite.x, kite.y);
  drawTail(ctx, size, now);

  ctx.strokeStyle = "rgb(55 72 103 / 34%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.34);
  ctx.quadraticCurveTo(-width.value * 0.1, height.value * 0.76, width.value * 0.48, height.value * 0.95 - kite.y);
  ctx.stroke();

  ctx.rotate(angle);
  const glowRadius = size * (0.82 + light * 0.44);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
  glow.addColorStop(0, `rgb(255 255 230 / ${0.18 + light * 0.22})`);
  glow.addColorStop(1, "rgb(255 255 230 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-size * 0.36, -size * 0.42, size * 0.34, size * 0.4);
  body.addColorStop(0, `hsl(35, 98%, ${72 + light * 8}%)`);
  body.addColorStop(0.52, `hsl(14, 92%, ${62 + light * 8}%)`);
  body.addColorStop(1, `hsl(205, 78%, ${54 + light * 10}%)`);
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgb(109 68 78 / 58%)";
  ctx.lineWidth = Math.max(3, size * 0.024);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.58);
  ctx.lineTo(size * 0.45, 0);
  ctx.lineTo(0, size * 0.48);
  ctx.lineTo(-size * 0.45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgb(255 248 218 / 62%)";
  ctx.lineWidth = Math.max(2, size * 0.018);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(0, size * 0.46);
  ctx.moveTo(-size * 0.43, 0);
  ctx.lineTo(size * 0.43, 0);
  ctx.stroke();

  ctx.strokeStyle = `rgb(255 255 240 / ${0.28 + kite.dwellProgress * 0.32})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 14]);
  ctx.beginPath();
  ctx.arc(0, 0, size * (0.58 + kite.dwellProgress * 0.04), -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * Math.max(0.02, kite.dwellProgress));
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const cloud of clouds) drawCloud(ctx, cloud, now);
  for (const line of windLines) drawWindLine(ctx, line);
  drawKite(ctx, now);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (width.value <= 0 || height.value <= 0) return;
  updateKite(delta, now);
  updateClouds(delta);
  updateWind(delta);
  updateKiteMusic();
}

function restart() {
  startSession();
  resetScene();
}

onMounted(() => {
  resetScene();
  warmKitePiano(session.settings.sound);
});

onUnmounted(() => {
  setKitePianoActive(false, false);
  disposeKitePiano();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="kite-shell">
    <canvas ref="canvasRef" class="kite-canvas" />

    <v-card class="kite-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Смотри на змея: ветер поднимет его выше.</div>
      <div class="text-caption text-medium-emphasis">Если взгляд ушёл, змей просто ждёт и продолжает парить.</div>
    </v-card>

    <GameHud
      title="Воздушный змей"
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
      title="Воздушный змей"
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
.kite-shell {
  background: #bfe9ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.kite-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.kite-hint {
  inset-block-end: max(1.125rem, env(safe-area-inset-bottom));
  inset-inline: 1.125rem;
  margin-inline: auto;
  max-inline-size: 37.5rem;
  opacity: 0.8;
  position: absolute;
  z-index: 3;
}
</style>
