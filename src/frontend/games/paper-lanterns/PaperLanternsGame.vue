<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { disposePaperLanternsPiano, playPaperLanternsCue, setPaperLanternsPianoActive, tickPaperLanternsPiano, warmPaperLanternsPiano } from "./audio";

type Point = { x: number; y: number };
type LanternPhase = "appearing" | "waiting" | "gazing" | "rising";
type Lantern = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: LanternPhase;
  dwellProgress: number;
  enteredAt?: number;
  sway: number;
  lift: number;
};
type Star = Point & {
  radius: number;
  alpha: number;
  phase: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("paper-lanterns", {
  maxSteps: 9,
  overrides: { preset: "gentle", targetScale: 1.6, motionSpeed: 0.42, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "paper-lanterns", soundEnabled: toRef(session.settings, "sound") });

const activeLantern = ref<Lantern>();
const releasedLanterns = reactive<Lantern[]>([]);
const stars = reactive<Star[]>([]);
const resultVisible = computed(() => session.status === "finished");

const lanternHues = [28, 38, 48, 356, 318];
const appearingSeconds = 1.6;
const risingSeconds = 4.4;
const restSeconds = 0.8;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let nextLanternAt = 0;
let previousLanternPoint: Point | undefined;

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

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHue() {
  return lanternHues[Math.floor(Math.random() * lanternHues.length)];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lanternRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.2;
  return Math.min(158, Math.max(96, Math.min(viewportLimit, 96 * session.settings.targetScale)));
}

function chooseLanternPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 58 };

  const point = randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(118, window.innerHeight * 0.18),
    sidePadding: Math.max(74, window.innerWidth * 0.11),
    bottomPadding: Math.max(96, window.innerHeight * 0.14),
    previous: previousLanternPoint,
    minDistance: Math.min(300, Math.max(170, radius * 1.5)),
    attempts: 22
  });

  return point;
}

function createLantern(first = false): Lantern {
  const radius = lanternRadius();
  const point = chooseLanternPoint(radius, first);
  previousLanternPoint = point;

  return {
    id: `paper-lantern-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    age: randomRange(0, 3),
    phaseAge: 0,
    phase: "appearing",
    dwellProgress: 0,
    sway: randomRange(0, Math.PI * 2),
    lift: randomRange(0.74, 1.08)
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

function targetPayload(lantern: Lantern, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: lantern.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: lantern.enteredAt === undefined ? 0 : now - lantern.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function lanternPoint(lantern: Lantern) {
  const point = percentToPixels(lantern);
  const rise = lantern.phase === "rising" ? Math.min(1, lantern.phaseAge / risingSeconds) : 0;
  return {
    x: point.x + Math.sin(lantern.age * 0.62 + lantern.sway) * lantern.radius * (0.06 + rise * 0.18),
    y: point.y - rise * window.innerHeight * 0.5 * lantern.lift + Math.cos(lantern.age * 0.46 + lantern.sway) * lantern.radius * 0.04
  };
}

function lightLantern(lantern: Lantern, now: number) {
  recordEvent("target-click", targetPayload(lantern, now, 1));
  recordSuccess({ targetId: lantern.id, hue: lantern.hue });
  playPaperLanternsCue(session.settings.sound);
  lantern.phase = "rising";
  lantern.phaseAge = 0;
  lantern.dwellProgress = 1;
  lantern.enteredAt = undefined;
}

function cancelLantern(lantern: Lantern, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(lantern, now, lantern.dwellProgress, reason));
  lantern.enteredAt = undefined;
  lantern.dwellProgress = 0;
  if (lantern.phase === "gazing") {
    lantern.phase = "waiting";
    lantern.phaseAge = 0;
  }
}

function ensureLantern(now: number) {
  if (session.status !== "running" || activeLantern.value || now < nextLanternAt) return;
  if (session.step >= session.maxSteps) {
    if (releasedLanterns.length === 0) finishSession("max-steps");
    return;
  }
  activeLantern.value = createLantern(session.step === 0 && previousLanternPoint === undefined);
}

function updateActiveLantern(delta: number, now: number) {
  ensureLantern(now);
  const lantern = activeLantern.value;
  if (!lantern || session.status !== "running") return;

  lantern.age += delta;
  lantern.phaseAge += delta;

  if (lantern.phase === "appearing" && lantern.phaseAge >= appearingSeconds) {
    lantern.phase = "waiting";
    lantern.phaseAge = 0;
  }

  if (lantern.phase === "rising") {
    if (lantern.phaseAge >= risingSeconds) {
      releasedLanterns.push({ ...lantern, phaseAge: risingSeconds, phase: "rising" });
      if (releasedLanterns.length > 7) releasedLanterns.shift();
      activeLantern.value = undefined;
      nextLanternAt = now + restSeconds * 1000;
      if (session.step >= session.maxSteps) finishSession("max-steps");
    }
    return;
  }

  const point = lanternPoint(lantern);
  const hitRadius = lantern.radius * 1.35;
  const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

  if (!inside) {
    if (lantern.enteredAt !== undefined) cancelLantern(lantern, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (lantern.enteredAt === undefined) {
    lantern.enteredAt = now;
    lantern.phase = "gazing";
    lantern.phaseAge = 0;
    recordEvent("target-enter", targetPayload(lantern, now, 0));
  }

  lantern.dwellProgress = Math.min(1, (now - lantern.enteredAt) / session.settings.dwellMs);
  if (lantern.dwellProgress >= 1) lightLantern(lantern, now);
}

function updateReleasedLanterns(delta: number) {
  for (let index = releasedLanterns.length - 1; index >= 0; index--) {
    const lantern = releasedLanterns[index];
    lantern.age += delta;
    lantern.phaseAge += delta * 0.26;
    if (lantern.phaseAge > risingSeconds * 1.7) releasedLanterns.splice(index, 1);
  }
}

function initStars() {
  stars.splice(0);
  const count = Math.min(90, Math.max(38, Math.round(window.innerWidth / 17)));
  for (let index = 0; index < count; index++) {
    stars.push({
      x: randomRange(3, 97),
      y: randomRange(7, 58),
      radius: randomRange(0.8, 2.2),
      alpha: randomRange(0.18, 0.56),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#101233");
  sky.addColorStop(0.58, "#1c2447");
  sky.addColorStop(1, "#2f3149");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  for (const star of stars) {
    const point = percentToPixels(star);
    context.globalAlpha = star.alpha * (0.72 + Math.sin(now * 0.00045 + star.phase) * 0.18);
    context.fillStyle = "#fff7dc";
    context.beginPath();
    context.arc(point.x, point.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const moonX = window.innerWidth * 0.78;
  const moonY = window.innerHeight * 0.2;
  const moonGlow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, Math.max(window.innerWidth, window.innerHeight) * 0.32);
  moonGlow.addColorStop(0, "rgb(255 222 171 / 18%)");
  moonGlow.addColorStop(1, "rgb(255 222 171 / 0%)");
  context.fillStyle = moonGlow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.fillStyle = "rgb(13 24 42 / 42%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.28, window.innerHeight * 0.88, window.innerWidth * 0.38, window.innerHeight * 0.18, 0, 0, Math.PI * 2);
  context.ellipse(window.innerWidth * 0.72, window.innerHeight * 0.9, window.innerWidth * 0.44, window.innerHeight * 0.2, 0, 0, Math.PI * 2);
  context.fill();
}

function drawLantern(context: CanvasRenderingContext2D, lantern: Lantern, decorative = false) {
  const point = lanternPoint(lantern);
  const appear = lantern.phase === "appearing" ? Math.min(1, lantern.phaseAge / appearingSeconds) : 1;
  const rise = lantern.phase === "rising" ? Math.min(1, lantern.phaseAge / risingSeconds) : 0;
  const light = Math.max(lantern.dwellProgress, rise);
  const bodyWidth = lantern.radius * (0.94 + Math.sin(lantern.age * 0.85 + lantern.sway) * 0.025);
  const bodyHeight = lantern.radius * 1.18;
  const alpha = appear * (decorative ? 0.46 : 1) * (1 - Math.max(0, rise - 0.76) * 1.8);

  context.save();
  context.globalAlpha = Math.max(0, alpha);

  const glowRadius = lantern.radius * (1.35 + light * 1.35);
  const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius);
  glow.addColorStop(0, `hsla(${lantern.hue}, 100%, 82%, ${0.2 + light * 0.26})`);
  glow.addColorStop(0.48, `hsla(${lantern.hue + 10}, 94%, 62%, ${0.09 + light * 0.16})`);
  glow.addColorStop(1, `hsla(${lantern.hue}, 88%, 54%, 0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `hsla(${lantern.hue + 14}, 88%, 82%, ${0.22 + light * 0.28})`;
  context.lineWidth = Math.max(2, lantern.radius * 0.018);
  context.beginPath();
  context.moveTo(point.x, point.y - bodyHeight * 0.64);
  context.quadraticCurveTo(point.x + Math.sin(lantern.age * 0.7 + lantern.sway) * lantern.radius * 0.18, point.y - bodyHeight * 1.1, point.x + bodyWidth * 0.24, point.y - bodyHeight * 1.34);
  context.stroke();

  const body = context.createRadialGradient(point.x - bodyWidth * 0.2, point.y - bodyHeight * 0.18, bodyWidth * 0.08, point.x, point.y, bodyWidth * 0.92);
  body.addColorStop(0, `hsla(${lantern.hue + 18}, 100%, ${90 - light * 4}%, 0.96)`);
  body.addColorStop(0.6, `hsla(${lantern.hue}, 88%, ${68 + light * 8}%, 0.86)`);
  body.addColorStop(1, `hsla(${lantern.hue - 10}, 72%, ${46 + light * 10}%, 0.84)`);
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(point.x, point.y, bodyWidth * 0.52, bodyHeight * 0.52, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `hsla(${lantern.hue - 12}, 58%, 40%, 0.34)`;
  context.lineWidth = Math.max(2, lantern.radius * 0.016);
  for (const offset of [-0.32, 0, 0.32]) {
    context.beginPath();
    context.ellipse(point.x + bodyWidth * offset, point.y, bodyWidth * (0.24 - Math.abs(offset) * 0.18), bodyHeight * 0.5, 0, -Math.PI * 0.5, Math.PI * 0.5);
    context.stroke();
  }

  context.fillStyle = `hsla(${lantern.hue - 8}, 64%, 35%, 0.72)`;
  context.beginPath();
  context.roundRect(point.x - bodyWidth * 0.28, point.y - bodyHeight * 0.58, bodyWidth * 0.56, bodyHeight * 0.12, lantern.radius * 0.045);
  context.roundRect(point.x - bodyWidth * 0.26, point.y + bodyHeight * 0.46, bodyWidth * 0.52, bodyHeight * 0.12, lantern.radius * 0.045);
  context.fill();

  if (!decorative && lantern.phase !== "rising") {
    context.strokeStyle = `hsla(${lantern.hue + 22}, 96%, 88%, ${0.18 + lantern.dwellProgress * 0.28})`;
    context.lineWidth = 3;
    context.setLineDash([10, 14]);
    context.beginPath();
    context.arc(point.x, point.y, lantern.radius * (0.82 + lantern.dwellProgress * 0.08), 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const lantern of releasedLanterns) drawLantern(context, lantern, true);
  if (activeLantern.value) drawLantern(context, activeLantern.value);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateActiveLantern(delta, now);
    updateReleasedLanterns(delta);
    tickPaperLanternsPiano(session.settings.sound);
  }
  setPaperLanternsPianoActive(session.settings.sound, session.status === "running");

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  activeLantern.value = undefined;
  releasedLanterns.splice(0);
  previousLanternPoint = undefined;
  nextLanternAt = 0;
  startSession();
  activeLantern.value = createLantern(true);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  warmPaperLanternsPiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  activeLantern.value = createLantern(true);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposePaperLanternsPiano();
});
</script>

<template>
  <div class="paper-lanterns-shell">
    <canvas ref="canvasRef" class="paper-lanterns-canvas" />

    <GameHud
      title="Бумажные фонарики"
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
      title="Бумажные фонарики"
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
.paper-lanterns-shell {
  background: #101233;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.paper-lanterns-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
