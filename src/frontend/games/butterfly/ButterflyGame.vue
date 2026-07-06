<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { randomTargetCenterPercent, percentToPixels } from "../../core/placement";
import { disposeButterflyAudio, playButterflyMelody, resetButterflyAudioSession, warmButterflyAudio } from "./audio";

type Point = { x: number; y: number };
type TargetPhase = "appearing" | "waiting" | "gazing" | "blooming";
type GlowTarget = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: TargetPhase;
  dwellProgress: number;
  enteredAt?: number;
};
type RewardButterfly = Point & {
  age: number;
  life: number;
  size: number;
  hue: number;
  driftX: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("butterfly", {
  maxSteps: 5,
  overrides: { preset: "gentle", dwellMs: 900, sessionSeconds: 60, targetScale: 1.45, motionSpeed: 0.55, distractors: "none", hints: "high" },
  finishOnMaxSteps: false
});

const target = ref<GlowTarget>();
const rewardButterflies = reactive<RewardButterfly[]>([]);
const resultVisible = computed(() => session.status === "finished");

const targetHues = [48, 135, 186, 285, 325];
const appearanceSeconds = 2.6;
const bloomSeconds = 2.1;
const restSeconds = 1.3;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let restUntil = 0;
let previousTargetPoint: Point | undefined;

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

function targetRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.2;
  return Math.min(150, Math.max(90, Math.min(viewportLimit, 92 * session.settings.targetScale)));
}

function targetPixels(nextTarget: GlowTarget) {
  return percentToPixels(nextTarget);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createTarget(first = false): GlowTarget {
  const radius = targetRadius();
  const point = first
    ? { x: 50, y: 54 }
    : randomTargetCenterPercent({
      targetWidth: radius * 2,
      targetHeight: radius * 2,
      hudHeight: Math.max(96, window.innerHeight * 0.16),
      sidePadding: Math.max(80, window.innerWidth * 0.16),
      bottomPadding: Math.max(72, window.innerHeight * 0.12),
      previous: previousTargetPoint,
      minDistance: Math.min(260, Math.max(150, radius * 1.4)),
      attempts: 16
    });

  previousTargetPoint = point;
  return {
    id: `glow-${Date.now()}`,
    x: point.x,
    y: point.y,
    radius,
    hue: targetHues[Math.floor(Math.random() * targetHues.length)],
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

function targetPayload(nextTarget: GlowTarget, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: nextTarget.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: nextTarget.enteredAt === undefined ? 0 : now - nextTarget.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function spawnRewardButterfly(nextTarget: GlowTarget) {
  const point = targetPixels(nextTarget);
  rewardButterflies.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: 5.8,
    size: nextTarget.radius * 0.42,
    hue: nextTarget.hue,
    driftX: (Math.random() - 0.5) * 16
  });
  if (rewardButterflies.length > 8) rewardButterflies.shift();
}

function awakenTarget(nextTarget: GlowTarget, now: number) {
  recordEvent("target-click", targetPayload(nextTarget, now, 1));
  recordSuccess({ targetId: nextTarget.id, hue: nextTarget.hue });
  void playButterflyMelody(session.settings.sound);
  spawnRewardButterfly(nextTarget);
  nextTarget.phase = "blooming";
  nextTarget.phaseAge = 0;
  nextTarget.dwellProgress = 1;
  nextTarget.enteredAt = undefined;
}

function cancelTarget(nextTarget: GlowTarget, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(nextTarget, now, nextTarget.dwellProgress, reason));
  nextTarget.enteredAt = undefined;
  nextTarget.dwellProgress = 0;
  if (nextTarget.phase === "gazing") {
    nextTarget.phase = "waiting";
    nextTarget.phaseAge = 0;
  }
}

function ensureTarget(now: number) {
  if (session.status !== "running" || target.value || rewardButterflies.length > 0 || now < restUntil) return;
  if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    return;
  }
  target.value = createTarget(session.step === 0 && previousTargetPoint === undefined);
}

function updateTarget(delta: number, now: number) {
  ensureTarget(now);
  const activeTarget = target.value;
  if (!activeTarget || session.status !== "running") return;

  activeTarget.age += delta;
  activeTarget.phaseAge += delta;

  if (activeTarget.phase === "appearing" && activeTarget.phaseAge >= appearanceSeconds) {
    activeTarget.phase = "waiting";
    activeTarget.phaseAge = 0;
  }

  if (activeTarget.phase === "blooming") {
    if (activeTarget.phaseAge >= bloomSeconds) {
      target.value = undefined;
      restUntil = now + restSeconds * 1000;
    }
    return;
  }

  const point = targetPixels(activeTarget);
  const hitRadius = activeTarget.radius * 1.4;
  const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

  if (!inside) {
    if (activeTarget.enteredAt !== undefined) cancelTarget(activeTarget, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (activeTarget.enteredAt === undefined) {
    activeTarget.enteredAt = now;
    activeTarget.phase = "gazing";
    activeTarget.phaseAge = 0;
    recordEvent("target-enter", targetPayload(activeTarget, now, 0));
  }

  activeTarget.dwellProgress = Math.min(1, (now - activeTarget.enteredAt) / session.settings.dwellMs);
  if (activeTarget.dwellProgress >= 1) awakenTarget(activeTarget, now);
}

function updateButterflies(delta: number) {
  for (let index = rewardButterflies.length - 1; index >= 0; index--) {
    const butterfly = rewardButterflies[index];
    butterfly.age += delta;
    butterfly.y -= delta * 14 * session.settings.motionSpeed;
    butterfly.x += butterfly.driftX * delta;
    if (butterfly.age >= butterfly.life) rewardButterflies.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createRadialGradient(window.innerWidth * 0.5, window.innerHeight * 0.58, 0, window.innerWidth * 0.5, window.innerHeight * 0.58, Math.max(window.innerWidth, window.innerHeight) * 0.8);
  gradient.addColorStop(0, "#080818");
  gradient.addColorStop(0.58, "#03040d");
  gradient.addColorStop(1, "#000004");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawGlowTarget(context: CanvasRenderingContext2D, nextTarget: GlowTarget) {
  const point = targetPixels(nextTarget);
  const appear = nextTarget.phase === "appearing" ? Math.min(1, nextTarget.phaseAge / appearanceSeconds) : 1;
  const bloom = nextTarget.phase === "blooming" ? Math.min(1, nextTarget.phaseAge / bloomSeconds) : 0;
  const pulse = 0.5 + Math.sin(nextTarget.age * 1.35) * 0.5;
  const gazeBoost = nextTarget.dwellProgress * 0.32;
  const bloomFade = nextTarget.phase === "blooming" ? 1 - bloom : 1;
  const radius = nextTarget.radius * (1 + pulse * 0.08 + nextTarget.dwellProgress * 0.16 + bloom * 1.2);
  const alpha = appear * bloomFade * (0.36 + pulse * 0.12 + gazeBoost);

  context.save();
  context.globalCompositeOperation = "lighter";

  const outer = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.25);
  outer.addColorStop(0, `hsla(${nextTarget.hue}, 96%, 78%, ${alpha})`);
  outer.addColorStop(0.34, `hsla(${nextTarget.hue}, 90%, 62%, ${alpha * 0.42})`);
  outer.addColorStop(1, `hsla(${nextTarget.hue}, 90%, 46%, 0)`);
  context.fillStyle = outer;
  context.beginPath();
  context.arc(point.x, point.y, radius * 2.25, 0, Math.PI * 2);
  context.fill();

  const core = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 0.85);
  core.addColorStop(0, `hsla(${nextTarget.hue}, 100%, 88%, ${alpha * 0.9})`);
  core.addColorStop(1, `hsla(${nextTarget.hue}, 88%, 66%, 0)`);
  context.fillStyle = core;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.85, 0, Math.PI * 2);
  context.fill();

  context.globalCompositeOperation = "source-over";
  context.fillStyle = `hsla(${nextTarget.hue}, 96%, 86%, ${appear * bloomFade * 0.68})`;
  context.beginPath();
  context.arc(point.x, point.y, radius * 0.22, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `hsla(${nextTarget.hue}, 92%, 84%, ${appear * bloomFade * 0.86})`;
  context.lineWidth = Math.max(4, radius * 0.045);
  context.beginPath();
  context.arc(point.x, point.y, radius * (0.58 + nextTarget.dwellProgress * 0.1), 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawButterfly(context: CanvasRenderingContext2D, butterfly: RewardButterfly) {
  const alpha = Math.max(0, 1 - butterfly.age / butterfly.life);
  const flap = Math.sin(butterfly.age * 3.4) * 0.14;

  context.save();
  context.translate(butterfly.x, butterfly.y);
  context.globalAlpha = alpha;
  context.globalCompositeOperation = "lighter";

  const gradient = context.createRadialGradient(0, 0, 2, 0, 0, butterfly.size * 1.7);
  gradient.addColorStop(0, `hsl(${butterfly.hue}, 100%, 88%)`);
  gradient.addColorStop(1, `hsl(${butterfly.hue + 24}, 86%, 54%)`);
  context.fillStyle = gradient;

  for (const side of [-1, 1]) {
    context.save();
    context.scale(side, 1);
    context.rotate(flap * side);
    context.beginPath();
    context.ellipse(8, -6, butterfly.size * 0.72, butterfly.size * 0.44, -0.6, 0, Math.PI * 2);
    context.ellipse(7, 9, butterfly.size * 0.54, butterfly.size * 0.34, 0.58, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.fillStyle = `hsla(${butterfly.hue}, 80%, 86%, ${alpha * 0.9})`;
  context.beginPath();
  context.roundRect(-2, -13, 4, 26, 4);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D) {
  drawBackground(context);
  if (target.value) drawGlowTarget(context, target.value);
  for (const butterfly of rewardButterflies) drawButterfly(context, butterfly);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateTarget(delta, now);
    updateButterflies(delta);
  }

  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

function restart() {
  target.value = undefined;
  rewardButterflies.splice(0);
  previousTargetPoint = undefined;
  restUntil = 0;
  resetButterflyAudioSession();
  startSession();
  target.value = createTarget(true);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  target.value = createTarget(true);
  resetButterflyAudioSession();
  warmButterflyAudio(session.settings.sound);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeButterflyAudio();
});
</script>

<template>
  <div class="butterfly-shell">
    <canvas ref="canvasRef" class="butterfly-canvas" />
    <GameHud title="Бабочки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <GameResultDialog
      :model-value="resultVisible"
      title="Бабочки"
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
.butterfly-shell {
  background: #000004;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.butterfly-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

</style>
