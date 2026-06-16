<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { advanceHoldProgress, calculatePulsingTargetRadii, computeTargetAssistState, distanceBetween, targetPathPoint, type Point, type TargetAssistState } from "./model";

type PulsingTarget = Point & {
  id: string;
  phase: number;
  pulse: number;
  hue: number;
  holdProgress: number;
  entered: boolean;
  speedScale: number;
  glow: number;
};

type CompletionRing = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("pulsing-target", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 900, targetScale: 1.58, motionSpeed: 0.48, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const target = reactive<PulsingTarget>({
  id: "pulsing-target-0",
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.56,
  phase: 0,
  pulse: 0,
  hue: 188,
  holdProgress: 0,
  entered: false,
  speedScale: 0.5,
  glow: 0.25
});
const rings = reactive<CompletionRing[]>([]);
const insideTarget = ref(false);
const nearTarget = ref(false);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(target.holdProgress * 100));
const helperText = computed(() => {
  if (session.status === "paused") return "Пауза. Цель спокойно ждёт продолжения.";
  if (!pointer.value.valid) return "Можно удерживать цель взглядом или мышью. Цель замедлится и подождёт.";
  if (insideTarget.value) return "Отлично. Оставайся в мягком круге ещё немного.";
  if (nearTarget.value || target.holdProgress > 0) return "Вернись в светлую зону: прогресс сохраняется и уходит очень медленно.";
  return "Следи за большой пульсирующей целью и удерживай взгляд в мягкой зоне.";
});

const targetHues = [188, 214, 168, 274, 42, 326, 132, 248];
let targetSequence = 0;
let enteredAt = 0;
let lastHintAt = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function stageSize() {
  return { width: width.value, height: height.value };
}

function targetRadii() {
  return calculatePulsingTargetRadii(stageSize(), session.settings.targetScale);
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

function targetPayload(assist: TargetAssistState, now: number, progress = target.holdProgress, reason?: "left" | "invalid-gaze") {
  const elapsedMs = enteredAt === 0 ? Math.round(progress * session.settings.dwellMs) : Math.max(0, Math.round(now - enteredAt));

  return {
    targetId: target.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs,
    progress,
    pointer: copyPointer(),
    target: { x: Math.round(target.x), y: Math.round(target.y) },
    assist,
    reason
  };
}

function resetTarget(nextPhase = target.phase + randomRange(Math.PI * 0.45, Math.PI * 0.9)) {
  targetSequence += 1;
  target.id = `pulsing-target-${Date.now()}-${targetSequence}`;
  target.phase = nextPhase;
  target.pulse = randomRange(0, Math.PI * 2);
  target.hue = targetHues[targetSequence % targetHues.length];
  target.holdProgress = 0;
  target.entered = false;
  target.speedScale = 0.46;
  target.glow = 0.25;
  insideTarget.value = false;
  nearTarget.value = false;
  enteredAt = 0;

  const point = targetPathPoint(target.phase, stageSize());
  target.x = point.x;
  target.y = point.y;
}

function addCompletionRings() {
  const radii = targetRadii();
  for (let index = 0; index < 5; index += 1) {
    rings.push({
      x: target.x,
      y: target.y,
      age: -index * 0.08,
      life: 1.55,
      radius: radii.coreRadius * (0.68 + index * 0.18),
      hue: target.hue + index * 10
    });
  }
  if (rings.length > 26) rings.splice(0, rings.length - 26);
}

function completeTarget(now: number, assist: TargetAssistState) {
  recordEvent("target-click", targetPayload(assist, now, 1));
  recordSuccess({ targetId: target.id, holdMs: session.settings.dwellMs });
  addCompletionRings();

  if (session.status === "running") resetTarget();
}

function updateTargetMotion(delta: number) {
  const speed = (session.settings.reduceMotion ? 0.13 : 0.38) * session.settings.motionSpeed * target.speedScale;
  target.phase += delta * speed;
  target.pulse += delta * (session.settings.reduceMotion ? 1.05 : 2.3);

  const point = targetPathPoint(target.phase, stageSize());
  const easing = session.settings.reduceMotion ? 1.6 : 2.35;
  target.x += (point.x - target.x) * Math.min(1, delta * easing);
  target.y += (point.y - target.y) * Math.min(1, delta * easing);
}

function updateHold(delta: number, now: number) {
  const radii = targetRadii();
  const distance = pointer.value.valid ? distanceBetween(pointer.value, target) : Number.POSITIVE_INFINITY;
  const assist = computeTargetAssistState(distance, radii.holdRadius, pointer.value.valid);
  insideTarget.value = assist.inside;
  nearTarget.value = assist.near;
  target.speedScale = assist.speedScale;
  target.glow += (assist.glow - target.glow) * Math.min(1, delta * 4.6);

  if (assist.inside && !target.entered) {
    target.entered = true;
    enteredAt = now;
    recordEvent("target-enter", targetPayload(assist, now));
  }

  if (!assist.inside && target.entered) {
    recordEvent("target-cancel", targetPayload(assist, now, target.holdProgress, pointer.value.valid ? "left" : "invalid-gaze"));
    target.entered = false;
    enteredAt = 0;
  }

  if (!assist.inside && now - lastHintAt > 4200) {
    lastHintAt = now;
    recordHint({ kind: pointer.value.valid ? "soft-return" : "gaze-wait", targetId: target.id, progress: target.holdProgress });
  }

  target.holdProgress = advanceHoldProgress(target.holdProgress, {
    deltaSeconds: delta,
    dwellMs: session.settings.dwellMs,
    inside: assist.inside,
    releaseDecayPerSecond: pointer.value.valid ? 0.14 : 0.08
  });

  if (target.holdProgress >= 1) completeTarget(now, assist);
}

function updateRings(delta: number) {
  for (let index = rings.length - 1; index >= 0; index -= 1) {
    const ring = rings[index];
    ring.age += delta;
    if (ring.age >= ring.life) rings.splice(index, 1);
  }
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  updateRings(delta);
  if (session.status !== "running") return;

  updateTargetMotion(delta);
  updateHold(delta, now);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#eef8ff");
  sky.addColorStop(0.5, "#f5fbf5");
  sky.addColorStop(1, "#fff4df");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.26;
  for (let index = 0; index < 6; index += 1) {
    const x = width.value * (0.08 + index * 0.19) + Math.sin(now * 0.00012 + index) * 32;
    const y = height.value * (0.18 + (index % 3) * 0.12);
    ctx.fillStyle = index % 2 === 0 ? "#d9f0ff" : "#e1f6e8";
    ctx.beginPath();
    ctx.ellipse(x, y, 112, 38, Math.sin(index) * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPath(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = "#65a9b5";
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 18]);
  ctx.beginPath();
  for (let index = 0; index <= 160; index += 1) {
    const point = targetPathPoint(index / 160 * Math.PI * 2, stageSize());
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCompletionRings(ctx: CanvasRenderingContext2D) {
  for (const ring of rings) {
    if (ring.age < 0) continue;
    const ratio = ring.age / ring.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ratio) * 0.58;
    ctx.strokeStyle = `hsl(${ring.hue} 78% 58%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius * (1 + ratio * 1.55), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPointerAura(ctx: CanvasRenderingContext2D) {
  if (!pointer.value.valid) return;

  ctx.save();
  const radius = 34 + target.glow * 14;
  const aura = ctx.createRadialGradient(pointer.value.x, pointer.value.y, 0, pointer.value.x, pointer.value.y, radius);
  aura.addColorStop(0, "rgb(255 255 255 / 50%)");
  aura.addColorStop(1, "rgb(80 147 166 / 0%)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(pointer.value.x, pointer.value.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTarget(ctx: CanvasRenderingContext2D) {
  const radii = targetRadii();
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(target.pulse) * 0.045;
  const coreRadius = radii.coreRadius * (1 + pulse + target.holdProgress * 0.06);
  const holdRadius = radii.holdRadius * (1 + pulse * 0.45);

  ctx.save();
  ctx.translate(target.x, target.y);

  const glow = ctx.createRadialGradient(0, 0, coreRadius * 0.25, 0, 0, radii.hintRadius * (1 + target.glow * 0.08));
  glow.addColorStop(0, `hsla(${target.hue}, 92%, 80%, ${0.34 + target.glow * 0.18})`);
  glow.addColorStop(0.56, `hsla(${target.hue}, 82%, 76%, ${0.18 + target.glow * 0.12})`);
  glow.addColorStop(1, `hsla(${target.hue}, 82%, 76%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radii.hintRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = insideTarget.value ? 0.34 : 0.5;
  ctx.strokeStyle = `hsl(${target.hue} 62% 48%)`;
  ctx.lineWidth = insideTarget.value ? 5 : 7;
  if (!insideTarget.value) ctx.setLineDash([14, 16]);
  ctx.beginPath();
  ctx.arc(0, 0, holdRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  const body = ctx.createRadialGradient(-coreRadius * 0.3, -coreRadius * 0.34, coreRadius * 0.08, 0, 0, coreRadius);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.38, `hsl(${target.hue} 92% 82%)`);
  body.addColorStop(1, `hsl(${target.hue} 70% 56%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(255 255 255 / 78%)";
  ctx.lineWidth = Math.max(6, coreRadius * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 0.68, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgb(255 255 255 / 88%)";
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(46 86 102 / 62%)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 0, coreRadius * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * target.holdProgress);
  ctx.stroke();

  ctx.fillStyle = "#315466";
  ctx.font = `700 ${Math.max(18, coreRadius * 0.18)}px Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${progressPercent.value}%`, 0, coreRadius * 0.74);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawPath(ctx);
  drawCompletionRings(ctx);
  drawPointerAura(ctx);
  drawTarget(ctx);
}

function restart() {
  rings.splice(0);
  targetSequence = 0;
  startSession();
  resetTarget(0.15);
}

onMounted(() => {
  resetTarget(0.15);
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="pulsing-target-shell">
    <canvas ref="canvasRef" class="pulsing-target-canvas" aria-label="Игра Пульсирующая цель" />

    <GameHud
      title="Пульсирующая цель"
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

    <v-card class="pulsing-target-card pa-4 pa-sm-5" color="surface" elevation="8" rounded="xl">
      <div class="text-overline text-cyan-darken-3">continuous dwell</div>
      <h1 class="text-h4 text-sm-h3 font-weight-bold mb-2">Пульсирующая цель</h1>
      <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-4">{{ helperText }}</p>
      <v-progress-linear :model-value="progressPercent" color="cyan-darken-2" height="10" rounded />
      <div class="d-flex flex-wrap justify-center ga-2 mt-3">
        <v-chip color="cyan-darken-2" prepend-icon="mdi-bullseye" rounded="pill" variant="tonal">
          Большая мягкая зона
        </v-chip>
        <v-chip color="teal" prepend-icon="mdi-timer-sand" rounded="pill" variant="tonal">
          Прогресс не сбрасывается
        </v-chip>
      </div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Пульсирующая цель"
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
.pulsing-target-shell {
  background: #eef8ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.pulsing-target-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.pulsing-target-card {
  inline-size: min(620px, calc(100vw - 32px));
  inset-block-start: max(104px, calc(env(safe-area-inset-top) + 84px));
  inset-inline-start: 50%;
  opacity: 0.93;
  position: absolute;
  text-align: center;
  transform: translateX(-50%);
  z-index: 2;
}

@media (max-width: 720px) {
  .pulsing-target-card {
    inset-block-start: auto;
    inset-block-end: max(16px, env(safe-area-inset-bottom));
  }
}
</style>
