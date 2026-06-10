<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type Spark = Point & {
  age: number;
  life: number;
  radius: number;
  driftX: number;
  driftY: number;
  hue: number;
  twinkle: number;
};
type Ember = Point & {
  phase: number;
  radius: number;
  warmth: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("warm-fire", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1450,
  sessionSeconds: 88,
  targetScale: 1.65,
  motionSpeed: 0.34,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const sparks = reactive<Spark[]>([]);
const embers = reactive<Ember[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastSparkAt = 0;
let gazeWarmth = 0;
let attentionMs = 0;
let intervalEnteredAt: number | undefined;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

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
  initEmbers();
}

function fireCenter() {
  return {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * (window.innerHeight < 720 ? 0.63 : 0.67)
  };
}

function fireRadius() {
  return Math.min(340, Math.max(210, Math.min(window.innerWidth, window.innerHeight) * 0.36 * session.settings.targetScale));
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

function stepTargetMs() {
  return (session.settings.sessionSeconds * 1000 / session.maxSteps) * 0.97;
}

function initEmbers() {
  embers.splice(0);
  const center = fireCenter();
  const count = Math.min(44, Math.max(24, Math.round(window.innerWidth / 32)));
  for (let index = 0; index < count; index += 1) {
    embers.push({
      x: center.x + randomRange(-150, 150),
      y: center.y + randomRange(78, 134),
      phase: randomRange(0, Math.PI * 2),
      radius: randomRange(1.8, 5.4),
      warmth: randomRange(0.35, 1)
    });
  }
}

function resetFire() {
  sparks.splice(0);
  attentionMs = 0;
  intervalEnteredAt = undefined;
  lastSparkAt = 0;
  gazeWarmth = 0;
  initEmbers();
}

function currentGazeInfluence() {
  if (!pointer.value.valid || session.status !== "running") return 0;
  const center = fireCenter();
  const progress = Math.max(0, 1 - distance(pointer.value, center) / fireRadius());
  return Math.min(1, progress * 1.22);
}

function addSpark(now: number) {
  const center = fireCenter();
  const angle = randomRange(-Math.PI * 0.9, -Math.PI * 0.1);
  const warmthBoost = 0.55 + gazeWarmth * 0.45;
  sparks.push({
    x: center.x + randomRange(-58, 58),
    y: center.y + randomRange(-18, 42),
    age: 0,
    life: randomRange(2.4, 4.2),
    radius: randomRange(2.2, 5.8) * (0.9 + gazeWarmth * 0.35),
    driftX: Math.cos(angle) * randomRange(8, 22) * session.settings.motionSpeed,
    driftY: Math.sin(angle) * randomRange(36, 72) * session.settings.motionSpeed,
    hue: randomRange(34, 52),
    twinkle: now * 0.001 + randomRange(0, Math.PI * 2) * warmthBoost
  });

  if (sparks.length > 96) sparks.splice(0, sparks.length - 96);
}

function addSoftSparks(now: number) {
  const interval = 280 - gazeWarmth * 110;
  if (now - lastSparkAt < interval) return;
  lastSparkAt = now;
  addSpark(now);
  if (gazeWarmth > 0.62 && window.innerWidth >= 720) addSpark(now + 1);
}

function recordAttentionEnter(now: number) {
  if (intervalEnteredAt !== undefined || session.step >= session.maxSteps) return;
  intervalEnteredAt = now;
  recordEvent("target-enter", {
    targetId: `warm-fire-glow-${session.step + 1}`,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    pointer: copyPointer()
  });
}

function recordAttentionStep(now: number) {
  if (session.step >= session.maxSteps) return;
  const targetId = `warm-fire-glow-${session.step + 1}`;
  recordEvent("target-click", {
    targetId,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    elapsedMs: intervalEnteredAt === undefined ? stepTargetMs() : now - intervalEnteredAt,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId, mode: "ambient-warm-fire" });
  intervalEnteredAt = now;
}

function updateAttention(delta: number, now: number) {
  const targetWarmth = currentGazeInfluence();
  const smoothing = targetWarmth > gazeWarmth ? 1.35 : 0.82;
  gazeWarmth += (targetWarmth - gazeWarmth) * Math.min(1, delta * smoothing);

  if (session.status !== "running") return;
  addSoftSparks(now);

  if (gazeWarmth < 0.08) {
    intervalEnteredAt = undefined;
    return;
  }

  recordAttentionEnter(now);
  attentionMs += delta * 1000 * Math.min(1, 0.62 + gazeWarmth * 0.48);
  while (session.step < session.maxSteps && attentionMs >= (session.step + 1) * stepTargetMs()) {
    recordAttentionStep(now);
  }
}

function updateSparks(delta: number) {
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.age += delta;
    spark.x += spark.driftX * delta;
    spark.y += spark.driftY * delta;
    spark.driftY -= 3.4 * delta;
    spark.driftX += Math.sin(spark.age * 1.8 + spark.twinkle) * delta * 2.2;
    if (spark.age >= spark.life) sparks.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#120b12");
  sky.addColorStop(0.48, "#21131a");
  sky.addColorStop(1, "#2d1b13");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const center = fireCenter();
  const roomGlow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(window.innerWidth, window.innerHeight) * 0.76);
  roomGlow.addColorStop(0, `rgb(255 151 76 / ${0.18 + gazeWarmth * 0.11})`);
  roomGlow.addColorStop(0.44, "rgb(137 65 38 / 12%)");
  roomGlow.addColorStop(1, "rgb(55 26 18 / 0%)");
  context.fillStyle = roomGlow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const floorTop = window.innerHeight * 0.76;
  const floor = context.createLinearGradient(0, floorTop, 0, window.innerHeight);
  floor.addColorStop(0, "#26160f");
  floor.addColorStop(1, "#170d0a");
  context.fillStyle = floor;
  context.fillRect(0, floorTop, window.innerWidth, window.innerHeight - floorTop);
}

function drawHearth(context: CanvasRenderingContext2D) {
  const center = fireCenter();
  context.save();
  context.fillStyle = "rgb(88 55 41 / 78%)";
  context.beginPath();
  context.ellipse(center.x, center.y + 118, 214, 44, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(42 25 19 / 88%)";
  context.lineWidth = 22;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(center.x - 114, center.y + 92);
  context.lineTo(center.x + 104, center.y + 122);
  context.moveTo(center.x - 90, center.y + 128);
  context.lineTo(center.x + 118, center.y + 88);
  context.stroke();

  context.strokeStyle = "rgb(107 58 32 / 78%)";
  context.lineWidth = 10;
  context.beginPath();
  context.moveTo(center.x - 104, center.y + 88);
  context.lineTo(center.x + 92, center.y + 116);
  context.moveTo(center.x - 82, center.y + 124);
  context.lineTo(center.x + 108, center.y + 88);
  context.stroke();
  context.restore();
}

function drawFlameLayer(context: CanvasRenderingContext2D, now: number, scale: number, hue: number, alpha: number, offset: number) {
  const center = fireCenter();
  const pulse = Math.sin(now * 0.0012 + offset) * 0.035 + Math.sin(now * 0.00064 + offset * 0.7) * 0.025;
  const height = (178 + gazeWarmth * 58) * scale * (1 + pulse);
  const width = (82 + gazeWarmth * 30) * scale;

  context.save();
  context.globalCompositeOperation = "lighter";
  const gradient = context.createRadialGradient(center.x, center.y + 56, 0, center.x, center.y - height * 0.24, height * 0.96);
  gradient.addColorStop(0, `hsla(${hue + 8}, 100%, 82%, ${alpha})`);
  gradient.addColorStop(0.42, `hsla(${hue}, 96%, 64%, ${alpha * 0.58})`);
  gradient.addColorStop(1, `hsla(${hue - 12}, 88%, 42%, 0)`);
  context.fillStyle = gradient;
  context.beginPath();
  context.moveTo(center.x, center.y - height);
  context.bezierCurveTo(center.x - width * 1.08, center.y - height * 0.36, center.x - width * 1.28, center.y + 68, center.x, center.y + 98);
  context.bezierCurveTo(center.x + width * 1.25, center.y + 62, center.x + width * 1.02, center.y - height * 0.35, center.x, center.y - height);
  context.fill();
  context.restore();
}

function drawFireGlow(context: CanvasRenderingContext2D) {
  const center = fireCenter();
  const radius = 210 + gazeWarmth * 120;
  const glow = context.createRadialGradient(center.x, center.y + 12, 0, center.x, center.y + 12, radius);
  glow.addColorStop(0, `rgb(255 207 125 / ${0.26 + gazeWarmth * 0.18})`);
  glow.addColorStop(0.48, `rgb(252 126 57 / ${0.14 + gazeWarmth * 0.1})`);
  glow.addColorStop(1, "rgb(252 126 57 / 0%)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = glow;
  context.beginPath();
  context.arc(center.x, center.y + 8, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEmbers(context: CanvasRenderingContext2D, now: number) {
  context.save();
  context.globalCompositeOperation = "lighter";
  for (const ember of embers) {
    const pulse = 0.62 + Math.sin(now * 0.001 + ember.phase) * 0.24 + gazeWarmth * 0.18;
    context.fillStyle = `rgb(255 151 70 / ${Math.min(0.66, pulse * ember.warmth)})`;
    context.beginPath();
    context.arc(ember.x, ember.y, ember.radius * (0.86 + gazeWarmth * 0.28), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSpark(context: CanvasRenderingContext2D, spark: Spark, now: number) {
  const progress = Math.min(1, spark.age / spark.life);
  const fade = 1 - progress;
  const twinkle = 0.72 + Math.sin(now * 0.002 + spark.twinkle) * 0.18;
  const radius = spark.radius * (1 + progress * 0.9);

  context.save();
  context.globalCompositeOperation = "lighter";
  const halo = context.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, radius * 5.2);
  halo.addColorStop(0, `hsla(${spark.hue}, 100%, 86%, ${0.28 * fade * twinkle})`);
  halo.addColorStop(1, `hsla(${spark.hue}, 92%, 54%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(spark.x, spark.y, radius * 5.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = `hsla(${spark.hue + 8}, 100%, 88%, ${0.68 * fade * twinkle})`;
  context.beginPath();
  context.arc(spark.x, spark.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGazeHalo(context: CanvasRenderingContext2D) {
  if (!pointer.value.valid || session.status !== "running") return;
  const radius = Math.min(150, Math.max(84, 86 * session.settings.targetScale));
  const halo = context.createRadialGradient(pointer.value.x, pointer.value.y, 0, pointer.value.x, pointer.value.y, radius);
  halo.addColorStop(0, "rgb(255 229 176 / 14%)");
  halo.addColorStop(0.5, "rgb(255 162 86 / 7%)");
  halo.addColorStop(1, "rgb(255 162 86 / 0%)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = halo;
  context.beginPath();
  context.arc(pointer.value.x, pointer.value.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context);
  drawFireGlow(context);
  drawHearth(context);
  drawFlameLayer(context, now, 1.22, 30, 0.28 + gazeWarmth * 0.09, 0.2);
  drawFlameLayer(context, now, 0.86, 42, 0.38 + gazeWarmth * 0.1, 1.4);
  drawFlameLayer(context, now, 0.52, 54, 0.42 + gazeWarmth * 0.1, 2.6);
  drawEmbers(context, now);
  for (const spark of sparks) drawSpark(context, spark, now);
  drawGazeHalo(context);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  updateAttention(delta, now);
  updateSparks(delta);

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  resetFire();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetFire();
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="warm-fire-shell">
    <canvas ref="canvasRef" class="warm-fire-canvas" aria-hidden="true" />

    <GameHud
      title="Тёплый костёр"
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

    <v-container class="warm-fire-copy d-flex align-start justify-center" fluid>
      <v-card class="warm-fire-card px-4 py-3 px-sm-6 py-sm-4" color="rgba(45, 25, 18, 0.58)" rounded="xl" elevation="0">
        <div class="text-overline text-amber-lighten-3">мягкая фиксация и слежение</div>
        <h1 class="text-h5 text-sm-h4 font-weight-bold mb-1">Согрей костёр взглядом</h1>
        <p class="text-body-2 text-sm-body-1 text-amber-lighten-5 mb-0">Смотри рядом с огнём: свечение и искры плавно усилятся. Ошибок нет.</p>
      </v-card>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Тёплый костёр"
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
.warm-fire-shell {
  background: #120b12;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.warm-fire-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.warm-fire-copy {
  inset: 0;
  padding-block-start: 112px;
  pointer-events: none;
  position: absolute;
}

.warm-fire-card {
  backdrop-filter: blur(12px);
  border: 1px solid rgb(255 201 134 / 18%);
  color: #fff4df;
  inline-size: min(620px, calc(100vw - 32px));
  text-align: center;
  text-shadow: 0 2px 18px rgb(40 15 6 / 52%);
}

@media (max-height: 680px) {
  .warm-fire-copy {
    padding-block-start: 92px;
  }
}
</style>
