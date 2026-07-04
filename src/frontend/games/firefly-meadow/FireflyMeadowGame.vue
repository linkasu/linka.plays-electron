<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { disposeFireflyMeadowPiano, playFireflyIgniteCue, setFireflyMeadowPianoActive, tickFireflyMeadowPiano, warmFireflyMeadowPiano } from "./audio";

type Point = { x: number; y: number };
type FireflyPhase = "arriving" | "waiting" | "gazing" | "lit";
type Firefly = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: FireflyPhase;
  dwellProgress: number;
  enteredAt?: number;
  drift: number;
  twinkleSeed: number;
};
type GrassBlade = {
  x: number;
  y: number;
  height: number;
  lean: number;
  alpha: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("firefly-meadow", {
  maxSteps: 9,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.45, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false
});

const fireflies = reactive<Firefly[]>([]);
const grass = reactive<GrassBlade[]>([]);
const resultVisible = computed(() => session.status === "finished");

const fireflyHues = [48, 58, 96, 172];
const arrivingSeconds = 2.4;
const litSeconds = 3.2;
const maxUnlitFireflies = 3;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let previousFireflyPoint: Point | undefined;
let finishAfter = 0;

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
  initGrass();
}

function targetRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(142, Math.max(96, Math.min(viewportLimit, 90 * session.settings.targetScale)));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHue() {
  return fireflyHues[Math.floor(Math.random() * fireflyHues.length)];
}

function chooseFireflyPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 56 };

  const point = randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(88, window.innerHeight * 0.18),
    sidePadding: Math.max(72, window.innerWidth * 0.12),
    bottomPadding: Math.max(96, window.innerHeight * 0.14),
    previous: previousFireflyPoint,
    minDistance: Math.min(280, Math.max(160, radius * 1.45)),
    attempts: 20
  });

  return point;
}

function createFirefly(first = false): Firefly {
  const radius = targetRadius();
  const point = chooseFireflyPoint(radius, first);
  previousFireflyPoint = point;

  return {
    id: `firefly-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    age: 0,
    phaseAge: 0,
    phase: "arriving",
    dwellProgress: 0,
    drift: randomRange(-1, 1),
    twinkleSeed: randomRange(0, Math.PI * 2)
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

function targetPayload(firefly: Firefly, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: firefly.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: firefly.enteredAt === undefined ? 0 : now - firefly.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function unlitFireflies() {
  return fireflies.filter((firefly) => firefly.phase !== "lit").length;
}

function ensureFireflies() {
  if (session.status !== "running" || session.step >= session.maxSteps) return;
  const desired = Math.min(maxUnlitFireflies, session.maxSteps - session.step);
  while (unlitFireflies() < desired) fireflies.push(createFirefly(session.step === 0 && fireflies.length === 0));
}

function igniteFirefly(firefly: Firefly, now: number) {
  recordEvent("target-click", targetPayload(firefly, now, 1));
  recordSuccess({ targetId: firefly.id, hue: firefly.hue });
  playFireflyIgniteCue(session.settings.sound);
  firefly.phase = "lit";
  firefly.phaseAge = 0;
  firefly.dwellProgress = 1;
  firefly.enteredAt = undefined;

  if (session.step >= session.maxSteps) finishAfter = now + litSeconds * 650;
}

function cancelFirefly(firefly: Firefly, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(firefly, now, firefly.dwellProgress, reason));
  firefly.enteredAt = undefined;
  firefly.dwellProgress = 0;
  if (firefly.phase === "gazing") {
    firefly.phase = "waiting";
    firefly.phaseAge = 0;
  }
}

function updateFireflies(delta: number, now: number) {
  ensureFireflies();

  if (finishAfter > 0 && now >= finishAfter) {
    finishSession("max-steps");
    return;
  }

  for (let index = fireflies.length - 1; index >= 0; index--) {
    const firefly = fireflies[index];
    firefly.age += delta;
    firefly.phaseAge += delta;
    firefly.x += Math.sin(firefly.age * 0.34 + firefly.twinkleSeed) * firefly.drift * delta * 0.18;
    firefly.y += Math.cos(firefly.age * 0.28 + firefly.twinkleSeed) * delta * 0.12;

    if (firefly.phase === "arriving" && firefly.phaseAge >= arrivingSeconds) {
      firefly.phase = "waiting";
      firefly.phaseAge = 0;
    }

    if (firefly.phase === "lit") {
      if (firefly.phaseAge >= litSeconds && fireflies.length > 5) fireflies.splice(index, 1);
      continue;
    }

    const point = percentToPixels(firefly);
    const hitRadius = firefly.radius * 1.55;
    const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

    if (!inside) {
      if (firefly.enteredAt !== undefined) cancelFirefly(firefly, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (firefly.enteredAt === undefined) {
      firefly.enteredAt = now;
      firefly.phase = "gazing";
      firefly.phaseAge = 0;
      recordEvent("target-enter", targetPayload(firefly, now, 0));
    }

    firefly.dwellProgress = Math.min(1, (now - firefly.enteredAt) / session.settings.dwellMs);
    if (firefly.dwellProgress >= 1) igniteFirefly(firefly, now);
  }
}

function initGrass() {
  grass.splice(0);
  const count = Math.min(72, Math.max(34, Math.round(window.innerWidth / 24)));
  for (let index = 0; index < count; index++) {
    grass.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(window.innerHeight * 0.68, window.innerHeight * 0.98),
      height: randomRange(28, 82),
      lean: randomRange(-18, 18),
      alpha: randomRange(0.14, 0.34)
    });
  }
}

function drawBackground(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#030512");
  sky.addColorStop(0.55, "#071021");
  sky.addColorStop(1, "#08170f");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const moonGlow = context.createRadialGradient(window.innerWidth * 0.72, window.innerHeight * 0.2, 0, window.innerWidth * 0.72, window.innerHeight * 0.2, Math.max(window.innerWidth, window.innerHeight) * 0.42);
  moonGlow.addColorStop(0, "rgb(132 174 189 / 14%)");
  moonGlow.addColorStop(1, "rgb(132 174 189 / 0%)");
  context.fillStyle = moonGlow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const meadowTop = window.innerHeight * 0.6;
  const meadow = context.createLinearGradient(0, meadowTop, 0, window.innerHeight);
  meadow.addColorStop(0, "#0a241a");
  meadow.addColorStop(0.62, "#071a12");
  meadow.addColorStop(1, "#031008");
  context.fillStyle = meadow;
  context.fillRect(0, meadowTop, window.innerWidth, window.innerHeight - meadowTop);

  context.fillStyle = "rgb(158 219 158 / 7%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.5, meadowTop + 10, window.innerWidth * 0.58, 26, 0, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.strokeStyle = "#8fbf87";
  context.lineCap = "round";
  for (const blade of grass) {
    context.globalAlpha = blade.alpha;
    context.lineWidth = Math.max(1, blade.height * 0.035);
    context.beginPath();
    context.moveTo(blade.x, blade.y);
    context.quadraticCurveTo(blade.x + blade.lean * 0.35, blade.y - blade.height * 0.46, blade.x + blade.lean, blade.y - blade.height);
    context.stroke();
  }
  context.restore();
}

function drawFirefly(context: CanvasRenderingContext2D, firefly: Firefly) {
  const point = percentToPixels(firefly);
  const appear = firefly.phase === "arriving" ? Math.min(1, firefly.phaseAge / arrivingSeconds) : 1;
  const lit = firefly.phase === "lit" ? Math.min(1, firefly.phaseAge / litSeconds) : 0;
  const breathe = 0.5 + Math.sin(firefly.age * 1.05 + firefly.twinkleSeed) * 0.5;
  const gaze = firefly.dwellProgress;
  const glowRadius = firefly.radius * (0.78 + breathe * 0.16 + gaze * 0.36 + lit * 0.92);
  const glowAlpha = appear * (0.18 + breathe * 0.08 + gaze * 0.34 + lit * 0.34);

  context.save();
  context.globalCompositeOperation = "lighter";

  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius * 2.35);
  halo.addColorStop(0, `hsla(${firefly.hue}, 96%, 82%, ${glowAlpha})`);
  halo.addColorStop(0.38, `hsla(${firefly.hue}, 88%, 58%, ${glowAlpha * 0.34})`);
  halo.addColorStop(1, `hsla(${firefly.hue}, 82%, 44%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, glowRadius * 2.35, 0, Math.PI * 2);
  context.fill();

  const core = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, Math.max(8, firefly.radius * 0.16));
  core.addColorStop(0, `hsla(${firefly.hue}, 100%, 92%, ${appear * (0.78 + gaze * 0.2)})`);
  core.addColorStop(1, `hsla(${firefly.hue}, 92%, 62%, 0)`);
  context.fillStyle = core;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(10, firefly.radius * (0.13 + gaze * 0.04)), 0, Math.PI * 2);
  context.fill();

  if (firefly.phase !== "lit") {
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = appear * (0.18 + gaze * 0.26);
    context.strokeStyle = `hsl(${firefly.hue}, 84%, 76%)`;
    context.lineWidth = 3;
    context.setLineDash([8, 14]);
    context.beginPath();
    context.arc(point.x, point.y, firefly.radius * (0.72 + gaze * 0.08), 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D) {
  drawBackground(context);
  for (const firefly of fireflies) drawFirefly(context, firefly);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  setFireflyMeadowPianoActive(session.settings.sound, session.status === "running");
  tickFireflyMeadowPiano(session.settings.sound);
  if (session.status === "running") updateFireflies(delta, now);

  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

function restart() {
  fireflies.splice(0);
  previousFireflyPoint = undefined;
  finishAfter = 0;
  startSession();
  fireflies.push(createFirefly(true));
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  warmFireflyMeadowPiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  fireflies.push(createFirefly(true));
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeFireflyMeadowPiano();
});
</script>

<template>
  <div class="firefly-meadow-shell">
    <canvas ref="canvasRef" class="firefly-meadow-canvas" />

    <div class="compact-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="surface" density="comfortable" icon="mdi-arrow-left" size="small" variant="text" @click="router.push(resolveMenuRoute())" />
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
      title="Светлячковая поляна"
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
.firefly-meadow-shell {
  background: #030512;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.firefly-meadow-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.compact-controls {
  background: rgb(4 8 18 / 24%);
  border-radius: 18px;
  inset-block-start: 16px;
  inset-inline-start: 16px;
  opacity: 0.42;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 2;
}

.compact-controls:focus-within,
.compact-controls:hover {
  opacity: 0.92;
}
</style>
