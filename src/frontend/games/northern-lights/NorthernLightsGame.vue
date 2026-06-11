<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeNorthernLightsPiano, setNorthernLightsPianoActive, tickNorthernLightsPiano, warmNorthernLightsPiano } from "./audio";

type GazeGlow = {
  x: number;
  y: number;
  age: number;
  life: number;
  hue: number;
  radius: number;
};

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkle: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("northern-lights", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 85,
  targetScale: 1.6,
  motionSpeed: 0.4,
  distractors: "none",
  hints: "high",
  sound: true
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const glows = reactive<GazeGlow[]>([]);
const stars = reactive<Star[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastGlowAt = 0;
let attentionMs = 0;
let intervalEnteredAt: number | undefined;
let audioTimer = 0;

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
  initStars();
}

function initStars() {
  stars.splice(0);
  const count = Math.min(110, Math.max(46, Math.round(window.innerWidth / 13)));
  for (let index = 0; index < count; index++) {
    stars.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(0, window.innerHeight * 0.62),
      radius: randomRange(0.7, 2.2),
      alpha: randomRange(0.18, 0.62),
      twinkle: randomRange(0, Math.PI * 2)
    });
  }
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
  return session.settings.sessionSeconds * 1000 / session.maxSteps;
}

function addGazeGlow(now: number) {
  if (!pointer.value.valid || now - lastGlowAt < 120) return;
  lastGlowAt = now;
  glows.push({
    x: pointer.value.x,
    y: pointer.value.y,
    age: 0,
    life: randomRange(2.2, 3.4),
    hue: randomRange(156, 206),
    radius: randomRange(92, 156) * session.settings.targetScale
  });
  if (glows.length > 34) glows.shift();
}

function recordAttentionStep(now: number) {
  if (session.step >= session.maxSteps) return;
  const targetId = `aurora-attention-${session.step + 1}`;
  const elapsedMs = intervalEnteredAt === undefined ? stepTargetMs() : now - intervalEnteredAt;
  recordEvent("target-click", {
    targetId,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    elapsedMs,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId, mode: "ambient-attention" });
  intervalEnteredAt = now;
}

function updateAttention(delta: number, now: number) {
  if (session.status !== "running" || !pointer.value.valid) return;

  if (intervalEnteredAt === undefined && session.step < session.maxSteps) {
    intervalEnteredAt = now;
    recordEvent("target-enter", {
      targetId: `aurora-attention-${session.step + 1}`,
      at: Date.now(),
      dwellMs: stepTargetMs(),
      pointer: copyPointer()
    });
  }

  attentionMs += delta * 1000;
  addGazeGlow(now);

  while (session.step < session.maxSteps && attentionMs >= (session.step + 1) * stepTargetMs()) {
    recordAttentionStep(now);
  }
}

function updateGlows(delta: number) {
  for (let index = glows.length - 1; index >= 0; index--) {
    const glow = glows[index];
    glow.age += delta;
    if (glow.age >= glow.life) glows.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#020514");
  sky.addColorStop(0.58, "#08142a");
  sky.addColorStop(1, "#13211e");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  for (const star of stars) {
    const twinkle = 0.72 + Math.sin(now * 0.00045 + star.twinkle) * 0.28;
    context.globalAlpha = star.alpha * twinkle;
    context.fillStyle = "#dceeff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const horizon = context.createRadialGradient(window.innerWidth * 0.5, window.innerHeight * 0.98, 0, window.innerWidth * 0.5, window.innerHeight * 0.98, window.innerWidth * 0.72);
  horizon.addColorStop(0, "rgb(52 93 86 / 24%)");
  horizon.addColorStop(1, "rgb(52 93 86 / 0%)");
  context.fillStyle = horizon;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawGlow(context: CanvasRenderingContext2D, glow: GazeGlow) {
  const progress = Math.min(1, glow.age / glow.life);
  const radius = glow.radius * (1 + progress * 1.45);
  const alpha = (1 - progress) * 0.24;
  const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, radius);
  gradient.addColorStop(0, `hsla(${glow.hue}, 94%, 82%, ${alpha})`);
  gradient.addColorStop(0.45, `hsla(${glow.hue + 24}, 88%, 72%, ${alpha * 0.42})`);
  gradient.addColorStop(1, `hsla(${glow.hue}, 84%, 64%, 0)`);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(glow.x, glow.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const glow of glows) drawGlow(context, glow);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateAttention(delta, now);
    updateGlows(delta);
  }
  setNorthernLightsPianoActive(session.settings.sound, session.status === "running");

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  attentionMs = 0;
  intervalEnteredAt = undefined;
  lastGlowAt = 0;
  glows.splice(0);
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  warmNorthernLightsPiano(session.settings.sound);
  audioTimer = window.setInterval(() => tickNorthernLightsPiano(session.settings.sound), 500);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  window.clearInterval(audioTimer);
  cancelAnimationFrame(frame);
  disposeNorthernLightsPiano();
});
</script>

<template>
  <div class="northern-lights-shell">
    <canvas ref="canvasRef" class="northern-lights-canvas" />

    <GameHud
      title="Северное сияние"
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
      title="Северное сияние"
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
.northern-lights-shell {
  background: #020514;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.northern-lights-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

</style>
