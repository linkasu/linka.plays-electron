<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";
import { disposeFlowerAudio, playFlowerMelody, resetFlowerAudioSession, warmFlowerAudio } from "./audio";

type Point = { x: number; y: number };
type BudPhase = "appearing" | "waiting" | "gazing" | "blooming";
type ActiveBud = Point & {
  id: string;
  radius: number;
  hue: number;
  petals: number;
  age: number;
  phaseAge: number;
  phase: BudPhase;
  dwellProgress: number;
  enteredAt?: number;
};
type GrownFlower = Point & {
  id: string;
  radius: number;
  hue: number;
  petals: number;
  age: number;
  settled: boolean;
};
type Cloud = Point & {
  id: string;
  size: number;
  alpha: number;
  speed: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("flowers", {
  preset: "gentle",
  maxSteps: 5,
  dwellMs: 1100,
  sessionSeconds: 75,
  targetScale: 1.45,
  motionSpeed: 0.55,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false
});

const activeBud = ref<ActiveBud>();
const grownFlowers = reactive<GrownFlower[]>([]);
const clouds = reactive<Cloud[]>([]);
const resultVisible = computed(() => session.status === "finished");

const flowerHues = [324, 286, 46, 18, 204];
const appearanceSeconds = 1.9;
const bloomSeconds = 2.2;
const restSeconds = 1.1;
const oldFlowerBloomSeconds = 1.8;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let restUntil = 0;
let previousBudPoint: Point | undefined;

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function budRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(132, Math.max(84, Math.min(viewportLimit, 86 * session.settings.targetScale)));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHue() {
  return flowerHues[Math.floor(Math.random() * flowerHues.length)];
}

function randomPetals() {
  return 6 + Math.floor(Math.random() * 3) * 2;
}

function randomMeadowPoint(radius: number) {
  return randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(84, window.innerHeight * 0.5),
    sidePadding: Math.max(80, window.innerWidth * 0.12),
    bottomPadding: Math.max(72, window.innerHeight * 0.1),
    previous: previousBudPoint,
    minDistance: Math.min(260, Math.max(150, radius * 1.45)),
    attempts: 18
  });
}

function flowerClearance(point: Point, radius: number) {
  if (grownFlowers.length === 0) return Number.POSITIVE_INFINITY;

  const candidate = percentToPixels(point);
  let clearance = Number.POSITIVE_INFINITY;
  for (const flower of grownFlowers) {
    const flowerPoint = percentToPixels(flower);
    const requiredGap = Math.max(116, Math.max(radius, flower.radius) * 1.22);
    clearance = Math.min(clearance, distance(candidate, flowerPoint) - requiredGap);
  }
  return clearance;
}

function chooseBudPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 70 };

  let bestPoint = randomMeadowPoint(radius);
  let bestClearance = flowerClearance(bestPoint, radius);
  if (bestClearance >= 0) return bestPoint;

  for (let index = 0; index < 32; index++) {
    const point = randomMeadowPoint(radius);
    const clearance = flowerClearance(point, radius);
    if (clearance >= 0) return point;
    if (clearance > bestClearance) {
      bestPoint = point;
      bestClearance = clearance;
    }
  }

  return bestPoint;
}

function createBud(first = false): ActiveBud {
  const radius = budRadius();
  const point = chooseBudPoint(radius, first);

  previousBudPoint = point;
  return {
    id: `bud-${Date.now()}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    petals: randomPetals(),
    age: 0,
    phaseAge: 0,
    phase: "appearing",
    dwellProgress: 0
  };
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

function targetPayload(bud: ActiveBud, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: bud.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: bud.enteredAt === undefined ? 0 : now - bud.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function growBud(bud: ActiveBud, now: number) {
  recordEvent("target-click", targetPayload(bud, now, 1));
  recordSuccess({ targetId: bud.id, hue: bud.hue });
  void playFlowerMelody(session.settings.sound);
  bud.phase = "blooming";
  bud.phaseAge = 0;
  bud.dwellProgress = 1;
  bud.enteredAt = undefined;
}

function settleBud(bud: ActiveBud) {
  grownFlowers.push({
    id: `flower-${Date.now()}`,
    x: bud.x,
    y: bud.y,
    radius: bud.radius,
    hue: bud.hue,
    petals: bud.petals,
    age: oldFlowerBloomSeconds,
    settled: true
  });
}

function cancelBud(bud: ActiveBud, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(bud, now, bud.dwellProgress, reason));
  bud.enteredAt = undefined;
  bud.dwellProgress = 0;
  if (bud.phase === "gazing") {
    bud.phase = "waiting";
    bud.phaseAge = 0;
  }
}

function ensureBud(now: number) {
  if (session.status !== "running" || activeBud.value || now < restUntil) return;
  if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    return;
  }
  activeBud.value = createBud(session.step === 0 && previousBudPoint === undefined);
}

function updateBud(delta: number, now: number) {
  ensureBud(now);
  const bud = activeBud.value;
  if (!bud || session.status !== "running") return;

  bud.age += delta;
  bud.phaseAge += delta;

  if (bud.phase === "appearing" && bud.phaseAge >= appearanceSeconds) {
    bud.phase = "waiting";
    bud.phaseAge = 0;
  }

  if (bud.phase === "blooming") {
    if (bud.phaseAge >= bloomSeconds) {
      settleBud(bud);
      activeBud.value = undefined;
      restUntil = now + restSeconds * 1000;
    }
    return;
  }

  const point = percentToPixels(bud);
  const hitRadius = bud.radius * 1.28;
  const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

  if (!inside) {
    if (bud.enteredAt !== undefined) cancelBud(bud, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (bud.enteredAt === undefined) {
    bud.enteredAt = now;
    bud.phase = "gazing";
    bud.phaseAge = 0;
    recordEvent("target-enter", targetPayload(bud, now, 0));
  }

  bud.dwellProgress = Math.min(1, (now - bud.enteredAt) / session.settings.dwellMs);
  if (bud.dwellProgress >= 1) growBud(bud, now);
}

function updateFlowers(delta: number) {
  for (const flower of grownFlowers) flower.age += delta;
}

function randomizeCloud(cloud: Cloud, x: number) {
  cloud.x = x;
  cloud.y = randomRange(window.innerHeight * 0.1, window.innerHeight * 0.3);
  cloud.size = randomRange(Math.max(72, window.innerWidth * 0.06), Math.max(118, window.innerWidth * 0.12));
  cloud.alpha = randomRange(0.48, 0.82);
  cloud.speed = randomRange(4, 10) * session.settings.motionSpeed;
}

function initClouds() {
  const count = window.innerWidth < 760 ? 3 : 5;
  clouds.splice(0);
  for (let index = 0; index < count; index++) {
    const cloud = { id: `cloud-${index}`, x: 0, y: 0, size: 100, alpha: 0.65, speed: 6 };
    randomizeCloud(cloud, randomRange(-window.innerWidth * 0.12, window.innerWidth * 1.08));
    clouds.push(cloud);
  }
}

function updateClouds(delta: number) {
  if (clouds.length === 0) initClouds();
  for (const cloud of clouds) {
    cloud.x += cloud.speed * delta;
    if (cloud.x - cloud.size > window.innerWidth) randomizeCloud(cloud, -cloud.size * 1.4);
  }
}

function drawCloud(context: CanvasRenderingContext2D, cloud: Cloud) {
  context.save();
  context.globalAlpha = cloud.alpha;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.ellipse(cloud.x - cloud.size * 0.38, cloud.y + cloud.size * 0.08, cloud.size * 0.42, cloud.size * 0.2, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x - cloud.size * 0.08, cloud.y - cloud.size * 0.02, cloud.size * 0.46, cloud.size * 0.26, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x + cloud.size * 0.28, cloud.y + cloud.size * 0.06, cloud.size * 0.4, cloud.size * 0.22, 0, 0, Math.PI * 2);
  context.ellipse(cloud.x + cloud.size * 0.02, cloud.y + cloud.size * 0.14, cloud.size * 0.62, cloud.size * 0.18, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight * 0.72);
  sky.addColorStop(0, "#8fd0ff");
  sky.addColorStop(0.62, "#c9ecff");
  sky.addColorStop(1, "#eef9ff");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  for (const cloud of clouds) drawCloud(context, cloud);

  const meadowTop = window.innerHeight * 0.58;
  const meadow = context.createLinearGradient(0, meadowTop, 0, window.innerHeight);
  meadow.addColorStop(0, "#d8efbd");
  meadow.addColorStop(0.52, "#bfe39b");
  meadow.addColorStop(1, "#9ccd75");
  context.fillStyle = meadow;
  context.fillRect(0, meadowTop, window.innerWidth, window.innerHeight - meadowTop);

  context.fillStyle = "rgb(255 255 255 / 18%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.5, meadowTop + 12, window.innerWidth * 0.56, 22, 0, 0, Math.PI * 2);
  context.fill();
}

function drawStem(context: CanvasRenderingContext2D, point: Point, radius: number, alpha: number, growth = 1) {
  const stemTop = point.y + radius * 0.34;
  const stemBottom = point.y + radius * 1.18;
  const visibleBottom = stemTop + (stemBottom - stemTop) * growth;

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "#7ca86e";
  context.lineWidth = Math.max(3, radius * 0.045);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(point.x, stemTop);
  context.quadraticCurveTo(point.x - radius * 0.035, stemTop + (visibleBottom - stemTop) * 0.52, point.x, visibleBottom);
  context.stroke();

  context.restore();
}

function drawFlowerShape(context: CanvasRenderingContext2D, point: Point, options: { radius: number; hue: number; petals: number; bloom: number; alpha: number; active: boolean }) {
  const petalRadius = options.radius * (0.26 + options.bloom * 0.24);
  const petalDistance = options.radius * (0.08 + options.bloom * 0.34);

  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = options.alpha;

  for (let index = 0; index < options.petals; index++) {
    const angle = index / options.petals * Math.PI * 2;
    context.save();
    context.rotate(angle);
    const gradient = context.createRadialGradient(0, -petalDistance, 1, 0, -petalDistance, petalRadius * 1.5);
    gradient.addColorStop(0, `hsl(${options.hue}, 92%, ${options.active ? 86 : 78}%)`);
    gradient.addColorStop(1, `hsl(${options.hue + 12}, 64%, ${options.active ? 64 : 70}%)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(0, -petalDistance, petalRadius * 0.72, petalRadius * 1.08, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const core = context.createRadialGradient(0, 0, 1, 0, 0, options.radius * 0.22);
  core.addColorStop(0, "#fff6b7");
  core.addColorStop(1, "#e6bc63");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, options.radius * (0.12 + options.bloom * 0.12), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSprout(context: CanvasRenderingContext2D, bud: ActiveBud, point: Point, appear: number) {
  const sproutHeight = bud.radius * (0.18 + bud.dwellProgress * 0.16);
  const leafLength = bud.radius * (0.12 + bud.dwellProgress * 0.04);
  const leafWidth = bud.radius * (0.045 + bud.dwellProgress * 0.015);
  const sway = Math.sin(bud.age * 1.3) * 0.04;

  context.save();
  context.translate(point.x, point.y);
  context.globalAlpha = appear;

  context.strokeStyle = "#4f9960";
  context.lineWidth = Math.max(3, bud.radius * 0.035);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(0, sproutHeight * 0.36);
  context.quadraticCurveTo(-bud.radius * 0.025, 0, bud.radius * 0.02, -sproutHeight);
  context.stroke();

  context.fillStyle = "#5ca768";
  for (const side of [-1, 1]) {
    context.save();
    context.translate(side * bud.radius * 0.04, -sproutHeight * 0.38);
    context.scale(side, 1);
    context.rotate(-0.46 + sway);
    context.beginPath();
    context.moveTo(0, 0);
    context.quadraticCurveTo(leafLength * 0.48, -leafWidth, leafLength, 0);
    context.quadraticCurveTo(leafLength * 0.48, leafWidth, 0, 0);
    context.fill();
    context.restore();
  }

  context.fillStyle = "#4f9960";
  context.beginPath();
  context.arc(0, sproutHeight * 0.4, bud.radius * 0.055, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGrownFlower(context: CanvasRenderingContext2D, flower: GrownFlower) {
  const point = percentToPixels(flower);
  const bloom = flower.settled ? 1 : Math.min(1, flower.age / oldFlowerBloomSeconds);
  const alpha = 0.68;
  const radius = flower.radius * 0.58;
  drawStem(context, point, radius, alpha, 1);
  drawFlowerShape(context, point, { radius, hue: flower.hue, petals: flower.petals, bloom, alpha, active: false });
}

function drawBud(context: CanvasRenderingContext2D, bud: ActiveBud) {
  const point = percentToPixels(bud);
  const appear = bud.phase === "appearing" ? Math.min(1, bud.phaseAge / appearanceSeconds) : 1;
  const bloom = bud.phase === "blooming" ? Math.min(1, bud.phaseAge / bloomSeconds) : 0;
  const targetAlpha = appear * (0.26 + bud.dwellProgress * 0.28);

  context.save();
  context.globalAlpha = targetAlpha;
  context.strokeStyle = "#4f8f84";
  context.lineWidth = 3;
  context.setLineDash([10, 12]);
  context.beginPath();
  context.arc(point.x, point.y, bud.radius * 0.9, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  if (bud.phase === "blooming") {
    const growth = Math.min(1, 0.28 + bloom * 0.72);
    drawStem(context, point, bud.radius * 0.72, appear * 0.92, growth);
    drawFlowerShape(context, point, { radius: bud.radius * (0.58 + bloom * 0.2), hue: bud.hue, petals: bud.petals, bloom, alpha: appear * 0.92, active: true });
    return;
  }

  drawStem(context, point, bud.radius * 0.62, appear * 0.84, 0.28 + appear * 0.22 + bud.dwellProgress * 0.36);
  drawSprout(context, bud, point, appear);
}

function draw(context: CanvasRenderingContext2D) {
  drawBackground(context);
  for (const flower of grownFlowers) drawGrownFlower(context, flower);
  if (activeBud.value) drawBud(context, activeBud.value);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateBud(delta, now);
    updateFlowers(delta);
    updateClouds(delta);
  }

  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

function restart() {
  activeBud.value = undefined;
  grownFlowers.splice(0);
  previousBudPoint = undefined;
  restUntil = 0;
  resetFlowerAudioSession();
  startSession();
  initClouds();
  activeBud.value = createBud(true);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initClouds();
  window.addEventListener("resize", resizeCanvas);
  activeBud.value = createBud(true);
  resetFlowerAudioSession();
  warmFlowerAudio(session.settings.sound);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeFlowerAudio();
});
</script>

<template>
  <div class="flowers-shell">
    <canvas ref="canvasRef" class="flowers-canvas" />

    <div class="quiet-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="surface" density="comfortable" icon="mdi-arrow-left" size="small" variant="text" @click="router.push('/')" />
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="surface"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="text"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Цветы"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push('/')"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.flowers-shell {
  background: #8fd0ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.flowers-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.quiet-controls {
  background: rgb(255 250 241 / 34%);
  border-radius: 18px;
  inset-block-start: 16px;
  inset-inline-start: 16px;
  opacity: 0.46;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 2;
}

.quiet-controls:focus-within,
.quiet-controls:hover {
  opacity: 0.95;
}
</style>
