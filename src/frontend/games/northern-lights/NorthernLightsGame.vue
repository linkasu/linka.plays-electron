<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type AuroraBand = {
  id: string;
  hue: number;
  baseY: number;
  amplitude: number;
  thickness: number;
  phase: number;
  speed: number;
  alpha: number;
};

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
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const bands = reactive<AuroraBand[]>([]);
const glows = reactive<GazeGlow[]>([]);
const stars = reactive<Star[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastGlowAt = 0;
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
  initStars();
}

function initBands() {
  bands.splice(0);
  const hues = [152, 174, 196, 276];
  for (let index = 0; index < 6; index++) {
    bands.push({
      id: `aurora-band-${index}`,
      hue: hues[index % hues.length] + randomRange(-8, 8),
      baseY: randomRange(0.22, 0.58),
      amplitude: randomRange(26, 58),
      thickness: randomRange(34, 72),
      phase: randomRange(0, Math.PI * 2),
      speed: randomRange(0.00008, 0.00016),
      alpha: randomRange(0.14, 0.28)
    });
  }
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

function drawAuroraBand(context: CanvasRenderingContext2D, band: AuroraBand, now: number) {
  const gazeInfluence = pointer.value.valid
    ? Math.max(0, 1 - Math.abs(pointer.value.y - window.innerHeight * band.baseY) / (window.innerHeight * 0.42))
    : 0;
  const gazeShift = pointer.value.valid ? (pointer.value.x / window.innerWidth - 0.5) * 34 * gazeInfluence : 0;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let layer = 0; layer < 4; layer++) {
    const layerProgress = layer / 3;
    const alpha = band.alpha * (1.15 - layerProgress * 0.22) + gazeInfluence * 0.06;
    context.strokeStyle = `hsla(${band.hue + layer * 18}, 86%, ${58 + layer * 8}%, ${alpha})`;
    context.lineWidth = band.thickness * (1.4 - layerProgress * 0.26);
    context.shadowBlur = 24 + layer * 10;
    context.shadowColor = `hsla(${band.hue}, 84%, 68%, ${0.18 + gazeInfluence * 0.08})`;
    context.beginPath();

    const points = 56;
    for (let index = 0; index <= points; index++) {
      const x = window.innerWidth * (index / points);
      const wave = Math.sin(index * 0.42 + band.phase + now * band.speed) * band.amplitude;
      const slowWave = Math.sin(index * 0.16 + band.phase * 0.6 + now * band.speed * 0.55) * band.amplitude * 0.42;
      const y = window.innerHeight * band.baseY + wave + slowWave + gazeShift + layer * band.thickness * 0.2;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  context.restore();
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

function drawGazeCurtain(context: CanvasRenderingContext2D) {
  if (!pointer.value.valid || session.status !== "running") return;
  const radius = Math.min(220, Math.max(128, window.innerWidth * 0.11));
  const gradient = context.createLinearGradient(pointer.value.x, pointer.value.y - radius, pointer.value.x, pointer.value.y + radius);
  gradient.addColorStop(0, "rgb(141 244 211 / 0%)");
  gradient.addColorStop(0.38, "rgb(141 244 211 / 18%)");
  gradient.addColorStop(0.62, "rgb(167 205 255 / 14%)");
  gradient.addColorStop(1, "rgb(167 205 255 / 0%)");

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(pointer.value.x, pointer.value.y, radius * 0.8, radius * 1.35, -0.18, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const band of bands) drawAuroraBand(context, band, now);
  for (const glow of glows) drawGlow(context, glow);
  drawGazeCurtain(context);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateAttention(delta, now);
    updateGlows(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  attentionMs = 0;
  intervalEnteredAt = undefined;
  lastGlowAt = 0;
  glows.splice(0);
  initBands();
  startSession();
}

onMounted(async () => {
  await nextTick();
  initBands();
  resizeCanvas();
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
  <div class="northern-lights-shell">
    <canvas ref="canvasRef" class="northern-lights-canvas" />

    <v-card class="northern-lights-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Смотри спокойно: сияние мягко следует за взглядом.</div>
      <div class="text-caption text-medium-emphasis">Нет целей и ошибок, только тихое удержание внимания.</div>
    </v-card>

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

.northern-lights-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 520px;
  opacity: 0.72;
  position: absolute;
  z-index: 3;
}
</style>
