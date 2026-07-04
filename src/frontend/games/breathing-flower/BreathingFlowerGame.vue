<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeBreathingFlowerPiano, setBreathingFlowerPianoActive, tickBreathingFlowerPiano, warmBreathingFlowerPiano } from "./audio";

type Point = { x: number; y: number };
type BreathPhase = "opening" | "closing";

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("breathing-flower", {
  maxSteps: 7,
  overrides: { preset: "gentle", targetScale: 1.7, motionSpeed: 0.42, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const flower = reactive({
  phase: "opening" as BreathPhase,
  openness: 0.34,
  dwellProgress: 0,
  enteredAt: undefined as number | undefined,
  age: 0,
  glow: 0
});

const resultVisible = computed(() => session.status === "finished");
const phaseLabel = computed(() => flower.phase === "opening" ? " вдох" : " выдох");
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Цветок ждёт продолжения.";
  if (!pointer.value.valid) return "Смотри в центр цветка или веди туда указатель.";
  return flower.phase === "opening" ? "Удерживай взгляд в центре, лепестки раскрываются." : "Удерживай взгляд в центре, лепестки закрываются.";
});

let finishAfter = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function flowerCenter(): Point {
  return {
    x: width.value * 0.5,
    y: height.value < 720 ? height.value * 0.58 : height.value * 0.56
  };
}

function flowerRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.28;
  return Math.min(250, Math.max(150, Math.min(viewportLimit, 138 * session.settings.targetScale)));
}

function hitRadius() {
  return flowerRadius() * 0.72;
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

function targetPayload(now: number, progress: number) {
  return {
    targetId: `breathing-flower-${session.step + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: flower.enteredAt === undefined ? 0 : now - flower.enteredAt,
    progress,
    breathPhase: flower.phase,
    pointer: copyPointer()
  };
}

function completeBreath(now: number) {
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: `breathing-flower-${session.step + 1}`, breathPhase: flower.phase });

  flower.phase = flower.phase === "opening" ? "closing" : "opening";
  flower.enteredAt = undefined;
  flower.dwellProgress = 0;
  flower.glow = 1;

  if (session.step >= session.maxSteps && finishAfter === 0) finishAfter = now + 1800;
}

function updateBreath(delta: number, now: number) {
  flower.age += delta;
  flower.glow = Math.max(0, flower.glow - delta * 0.48);

  const center = flowerCenter();
  const inside = pointer.value.valid && distance(pointer.value, center) <= hitRadius();
  setBreathingFlowerPianoActive(session.settings.sound, inside && session.status === "running");

  if (inside) {
    if (flower.enteredAt === undefined) {
      flower.enteredAt = now;
      recordEvent("target-enter", targetPayload(now, 0));
    }

    flower.dwellProgress = Math.min(1, (now - flower.enteredAt) / session.settings.dwellMs);
    if (flower.dwellProgress >= 1) completeBreath(now);
  } else {
    flower.enteredAt = undefined;
    flower.dwellProgress = Math.max(0, flower.dwellProgress - delta * 0.55);
  }

  const phaseStart = flower.phase === "opening" ? 0.34 : 0.92;
  const phaseEnd = flower.phase === "opening" ? 0.98 : 0.32;
  const targetOpenness = phaseStart + (phaseEnd - phaseStart) * flower.dwellProgress;
  const idleBreath = session.settings.reduceMotion ? 0 : Math.sin(flower.age * 0.9) * 0.018;
  flower.openness += (clamp(targetOpenness + idleBreath, 0.28, 1) - flower.openness) * Math.min(1, delta * 4.2);
}

function update(delta: number, now: number) {
  if (session.status === "running") updateBreath(delta, now);
  else setBreathingFlowerPianoActive(session.settings.sound, false);
  tickBreathingFlowerPiano(session.settings.sound);
  if (finishAfter > 0 && now >= finishAfter) finishSession("game-complete");
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#e9f5ef");
  sky.addColorStop(0.52, "#f7efe8");
  sky.addColorStop(1, "#e6efd9");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const center = flowerCenter();
  const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(width.value, height.value) * 0.62);
  glow.addColorStop(0, "rgb(255 230 238 / 48%)");
  glow.addColorStop(0.55, "rgb(216 232 216 / 28%)");
  glow.addColorStop(1, "rgb(216 232 216 / 0%)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width.value, height.value);

  if (session.settings.reduceMotion) return;
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let index = 0; index < 5; index += 1) {
    const x = width.value * (0.12 + index * 0.23) + Math.sin(now * 0.00012 + index) * 24;
    const y = height.value * (0.18 + index % 2 * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, 82, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 52, y + 8, 56, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 48, y + 10, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawProgressRing(ctx: CanvasRenderingContext2D, center: Point, radius: number) {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = "#8aa886";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(center.x, center.y, hitRadius(), 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = flower.phase === "opening" ? "#d890a5" : "#83a98f";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(center.x, center.y, hitRadius(), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * flower.dwellProgress);
  ctx.stroke();

  ctx.globalAlpha = 0.12 + flower.glow * 0.18;
  ctx.fillStyle = "#fff8f4";
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * (0.9 + flower.glow * 0.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, side: -1 | 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  ctx.rotate(-0.34);
  ctx.fillStyle = "rgb(116 163 114 / 72%)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(radius * 0.42, -radius * 0.22, radius * 0.92, -radius * 0.04);
  ctx.quadraticCurveTo(radius * 0.42, radius * 0.26, 0, 0);
  ctx.fill();
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, center: Point, radius: number) {
  const openness = flower.openness;
  const petalCount = 10;
  const stemBottom = Math.min(height.value + 24, center.y + radius * 1.95);

  ctx.save();
  ctx.strokeStyle = "rgb(91 137 89 / 70%)";
  ctx.lineWidth = Math.max(10, radius * 0.07);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(center.x, stemBottom);
  ctx.quadraticCurveTo(center.x - radius * 0.08, center.y + radius * 0.94, center.x, center.y + radius * 0.24);
  ctx.stroke();
  drawLeaf(ctx, center.x - radius * 0.02, center.y + radius * 0.98, radius, -1);
  drawLeaf(ctx, center.x + radius * 0.02, center.y + radius * 1.22, radius * 0.86, 1);
  ctx.restore();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(Math.sin(flower.age * 0.22) * 0.018);
  for (let index = 0; index < petalCount; index += 1) {
    const angle = index / petalCount * Math.PI * 2;
    const layerShift = index % 2 === 0 ? 0 : Math.PI / petalCount;
    const petalDistance = radius * (0.12 + openness * 0.34);
    const petalLength = radius * (0.58 + openness * 0.28);
    const petalWidth = radius * (0.22 + openness * 0.08);

    ctx.save();
    ctx.rotate(angle + layerShift);
    const gradient = ctx.createRadialGradient(0, -petalDistance, radius * 0.08, 0, -petalDistance - petalLength * 0.18, petalLength);
    gradient.addColorStop(0, "#ffe4ed");
    gradient.addColorStop(0.58, index % 2 === 0 ? "#dca7c4" : "#c9b7df");
    gradient.addColorStop(1, index % 2 === 0 ? "#bf8bac" : "#a997c6");
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.82 + openness * 0.16;
    ctx.beginPath();
    ctx.ellipse(0, -petalDistance, petalWidth, petalLength, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const core = ctx.createRadialGradient(0, 0, 2, 0, 0, radius * 0.24);
  core.addColorStop(0, "#fff9bd");
  core.addColorStop(0.74, "#e7bd64");
  core.addColorStop(1, "#c99351");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (0.17 + openness * 0.05), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(111 80 54 / 20%)";
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius * 0.12, Math.sin(angle) * radius * 0.12, radius * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  const center = flowerCenter();
  const radius = flowerRadius();
  drawBackground(ctx, now);
  drawProgressRing(ctx, center, radius);
  drawFlower(ctx, center, radius);
}

function restart() {
  finishAfter = 0;
  flower.phase = "opening";
  flower.openness = 0.34;
  flower.dwellProgress = 0;
  flower.enteredAt = undefined;
  flower.glow = 0;
  startSession();
}

onMounted(() => {
  warmBreathingFlowerPiano(session.settings.sound);
});

onUnmounted(() => {
  disposeBreathingFlowerPiano();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="breathing-flower-shell">
    <canvas ref="canvasRef" class="breathing-flower-canvas" />

    <GameHud
      title="Дышащий цветок"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <v-card class="breathing-flower-guide pa-4 text-center" color="surface" rounded="xl" variant="tonal">
      <div class="text-subtitle-1 font-weight-bold">{{ phaseLabel }}</div>
      <div class="text-body-2 text-medium-emphasis">{{ guidanceText }}</div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Дышащий цветок"
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
.breathing-flower-shell {
  background: #e9f5ef;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.breathing-flower-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.breathing-flower-guide {
  bottom: 28px;
  left: 50%;
  max-inline-size: min(520px, calc(100vw - 32px));
  position: fixed;
  transform: translateX(-50%);
  z-index: 8;
}
</style>
