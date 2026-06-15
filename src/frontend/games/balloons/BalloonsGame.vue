<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";

type Point = { x: number; y: number };
type BalloonPhase = "appearing" | "waiting" | "gazing" | "flying";
type Balloon = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: BalloonPhase;
  dwellProgress: number;
  enteredAt?: number;
  sway: number;
  lift: number;
};
type Cloud = Point & {
  rx: number;
  ry: number;
  alpha: number;
  speed: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("balloons", {
  maxSteps: 9,
  overrides: { preset: "gentle", targetScale: 1.6, motionSpeed: 0.38, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const activeBalloon = ref<Balloon>();
const clouds = reactive<Cloud[]>([]);
const resultVisible = computed(() => session.status === "finished");

const balloonHues = [4, 28, 48, 190, 214, 278, 326];
const appearingSeconds = 0.9;
const flyingSeconds = 2.8;
const restSeconds = 0.45;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let nextBalloonAt = 0;
let previousBalloonPoint: Point | undefined;

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
  initClouds();
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomHue() {
  return balloonHues[Math.floor(Math.random() * balloonHues.length)];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function balloonRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(150, Math.max(94, Math.min(viewportLimit, 92 * session.settings.targetScale)));
}

function chooseBalloonPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 56 };

  return randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2.15,
    hudHeight: Math.max(118, window.innerHeight * 0.18),
    sidePadding: Math.max(70, window.innerWidth * 0.1),
    bottomPadding: Math.max(96, window.innerHeight * 0.16),
    previous: previousBalloonPoint,
    minDistance: Math.min(300, Math.max(172, radius * 1.55)),
    attempts: 24
  });
}

function createBalloon(first = false): Balloon {
  const radius = balloonRadius();
  const point = chooseBalloonPoint(radius, first);
  previousBalloonPoint = point;

  return {
    id: `balloon-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    age: randomRange(0, Math.PI * 2),
    phaseAge: 0,
    phase: "appearing",
    dwellProgress: 0,
    sway: randomRange(0, Math.PI * 2),
    lift: randomRange(0.86, 1.12)
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

function targetPayload(balloon: Balloon, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: balloon.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: balloon.enteredAt === undefined ? 0 : now - balloon.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function balloonPoint(balloon: Balloon) {
  const point = percentToPixels(balloon);
  const flying = balloon.phase === "flying" ? Math.min(1, balloon.phaseAge / flyingSeconds) : 0;
  return {
    x: point.x + Math.sin(balloon.age * 0.7 + balloon.sway) * balloon.radius * (0.05 + flying * 0.16),
    y: point.y - flying * window.innerHeight * 0.56 * balloon.lift + Math.cos(balloon.age * 0.5 + balloon.sway) * balloon.radius * 0.035
  };
}

function releaseBalloon(balloon: Balloon, now: number) {
  recordEvent("target-click", targetPayload(balloon, now, 1));
  recordSuccess({ targetId: balloon.id, hue: balloon.hue });
  balloon.phase = "flying";
  balloon.phaseAge = 0;
  balloon.dwellProgress = 1;
  balloon.enteredAt = undefined;
}

function resetBalloonProgress(balloon: Balloon, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(balloon, now, balloon.dwellProgress, reason));
  balloon.enteredAt = undefined;
  balloon.dwellProgress = 0;
  if (balloon.phase === "gazing") {
    balloon.phase = "waiting";
    balloon.phaseAge = 0;
  }
}

function ensureBalloon(now: number) {
  if (session.status !== "running" || activeBalloon.value || now < nextBalloonAt) return;
  if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    return;
  }
  activeBalloon.value = createBalloon(session.step === 0 && previousBalloonPoint === undefined);
}

function updateBalloon(delta: number, now: number) {
  ensureBalloon(now);
  const balloon = activeBalloon.value;
  if (!balloon || session.status !== "running") return;

  balloon.age += delta;
  balloon.phaseAge += delta;

  if (balloon.phase === "appearing" && balloon.phaseAge >= appearingSeconds) {
    balloon.phase = "waiting";
    balloon.phaseAge = 0;
  }

  if (balloon.phase === "flying") {
    if (balloon.phaseAge >= flyingSeconds) {
      activeBalloon.value = undefined;
      nextBalloonAt = now + restSeconds * 1000;
      if (session.step >= session.maxSteps) finishSession("max-steps");
    }
    return;
  }

  const point = balloonPoint(balloon);
  const hitRadius = balloon.radius * 1.18;
  const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

  if (!inside) {
    if (balloon.enteredAt !== undefined) resetBalloonProgress(balloon, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (balloon.enteredAt === undefined) {
    balloon.enteredAt = now;
    balloon.phase = "gazing";
    balloon.phaseAge = 0;
    recordEvent("target-enter", targetPayload(balloon, now, 0));
  }

  balloon.dwellProgress = Math.min(1, (now - balloon.enteredAt) / session.settings.dwellMs);
  if (balloon.dwellProgress >= 1) releaseBalloon(balloon, now);
}

function initClouds() {
  clouds.splice(0);
  const count = window.innerWidth < 720 ? 4 : 7;
  for (let index = 0; index < count; index++) {
    clouds.push({
      x: randomRange(-8, 108),
      y: randomRange(16, 56),
      rx: randomRange(60, 150),
      ry: randomRange(18, 42),
      alpha: randomRange(0.22, 0.42),
      speed: randomRange(1.8, 5.2)
    });
  }
}

function updateClouds(delta: number) {
  for (const cloud of clouds) {
    cloud.x += cloud.speed * session.settings.motionSpeed * delta;
    if (cloud.x > 116) cloud.x = -16;
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#7fb6d4");
  sky.addColorStop(0.58, "#9fc9dc");
  sky.addColorStop(1, "#7fae91");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const sunX = window.innerWidth * 0.78 + Math.sin(now * 0.00008) * 18;
  const sunY = window.innerHeight * 0.2;
  const glow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(window.innerWidth, window.innerHeight) * 0.36);
  glow.addColorStop(0, "rgb(255 226 144 / 28%)");
  glow.addColorStop(1, "rgb(255 235 168 / 0%)");
  context.fillStyle = glow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  for (const cloud of clouds) {
    const x = window.innerWidth * cloud.x / 100;
    const y = window.innerHeight * cloud.y / 100;
    context.globalAlpha = cloud.alpha;
    context.fillStyle = "#eaf6fb";
    context.beginPath();
    context.ellipse(x, y, cloud.rx, cloud.ry, 0, 0, Math.PI * 2);
    context.ellipse(x - cloud.rx * 0.45, y + cloud.ry * 0.08, cloud.rx * 0.46, cloud.ry * 0.72, 0, 0, Math.PI * 2);
    context.ellipse(x + cloud.rx * 0.42, y - cloud.ry * 0.06, cloud.rx * 0.5, cloud.ry * 0.78, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.fillStyle = "rgb(62 126 78 / 34%)";
  context.beginPath();
  context.ellipse(window.innerWidth * 0.18, window.innerHeight * 0.94, window.innerWidth * 0.32, window.innerHeight * 0.13, 0, 0, Math.PI * 2);
  context.ellipse(window.innerWidth * 0.74, window.innerHeight * 0.95, window.innerWidth * 0.42, window.innerHeight * 0.15, 0, 0, Math.PI * 2);
  context.fill();
}

function drawBalloon(context: CanvasRenderingContext2D, balloon: Balloon) {
  const point = balloonPoint(balloon);
  const appear = balloon.phase === "appearing" ? Math.min(1, balloon.phaseAge / appearingSeconds) : 1;
  const flying = balloon.phase === "flying" ? Math.min(1, balloon.phaseAge / flyingSeconds) : 0;
  const gaze = balloon.dwellProgress;
  const squash = Math.sin(balloon.age * 1.2 + balloon.sway) * 0.018;
  const radiusX = balloon.radius * (0.86 + squash + flying * 0.04);
  const radiusY = balloon.radius * (1.04 - squash * 0.7 + flying * 0.02);
  const alpha = appear * (1 - Math.max(0, flying - 0.78) * 2.3);

  context.save();
  context.globalAlpha = Math.max(0, alpha);

  const shadow = context.createRadialGradient(point.x, point.y + radiusY * 1.25, 0, point.x, point.y + radiusY * 1.25, balloon.radius * 1.35);
  shadow.addColorStop(0, `rgb(76 109 126 / ${0.08 * (1 - flying)})`);
  shadow.addColorStop(1, "rgb(76 109 126 / 0%)");
  context.fillStyle = shadow;
  context.beginPath();
  context.ellipse(point.x, point.y + radiusY * 1.2, radiusX * 0.72, radiusY * 0.22, 0, 0, Math.PI * 2);
  context.fill();

  if (gaze > 0 || balloon.phase === "flying") {
    const haloRadius = balloon.radius * (1.38 + gaze * 0.68 + flying * 0.44);
    const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, haloRadius);
    halo.addColorStop(0, `hsla(${balloon.hue}, 100%, 82%, ${0.16 + gaze * 0.2 + flying * 0.16})`);
    halo.addColorStop(1, `hsla(${balloon.hue}, 78%, 64%, 0)`);
    context.fillStyle = halo;
    context.beginPath();
    context.arc(point.x, point.y, haloRadius, 0, Math.PI * 2);
    context.fill();
  }

  const body = context.createRadialGradient(point.x - radiusX * 0.32, point.y - radiusY * 0.38, radiusX * 0.1, point.x, point.y, radiusX * 1.04);
  body.addColorStop(0, `hsla(${balloon.hue + 12}, 100%, ${88 + gaze * 4}%, 0.98)`);
  body.addColorStop(0.5, `hsla(${balloon.hue}, 88%, ${66 + gaze * 8}%, 0.94)`);
  body.addColorStop(1, `hsla(${balloon.hue - 10}, 70%, ${45 + gaze * 7}%, 0.92)`);
  context.fillStyle = body;
  context.beginPath();
  context.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `hsla(${balloon.hue - 8}, 64%, 34%, 0.18)`;
  context.lineWidth = Math.max(2, balloon.radius * 0.02);
  context.beginPath();
  context.ellipse(point.x, point.y, radiusX * 0.58, radiusY * 0.98, 0, -Math.PI * 0.5, Math.PI * 0.5);
  context.stroke();

  const knotY = point.y + radiusY * 0.94;
  context.fillStyle = `hsla(${balloon.hue - 12}, 68%, 38%, 0.92)`;
  context.beginPath();
  context.moveTo(point.x - balloon.radius * 0.14, knotY);
  context.lineTo(point.x + balloon.radius * 0.14, knotY);
  context.lineTo(point.x + balloon.radius * 0.06, knotY + balloon.radius * 0.2);
  context.lineTo(point.x - balloon.radius * 0.06, knotY + balloon.radius * 0.2);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgb(92 117 128 / 42%)";
  context.lineWidth = Math.max(1.5, balloon.radius * 0.012);
  context.beginPath();
  context.moveTo(point.x, knotY + balloon.radius * 0.18);
  context.bezierCurveTo(
    point.x + Math.sin(balloon.age * 0.8 + balloon.sway) * balloon.radius * 0.2,
    knotY + balloon.radius * 0.58,
    point.x - Math.sin(balloon.age * 0.7 + balloon.sway) * balloon.radius * 0.18,
    knotY + balloon.radius * 0.9,
    point.x,
    knotY + balloon.radius * 1.22
  );
  context.stroke();

  if (balloon.phase !== "flying") {
    context.strokeStyle = `hsla(${balloon.hue + 22}, 94%, 88%, ${0.22 + gaze * 0.42})`;
    context.lineWidth = Math.max(4, balloon.radius * 0.035);
    context.lineCap = "round";
    context.beginPath();
    context.arc(point.x, point.y, balloon.radius * 1.16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.06, gaze));
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  if (activeBalloon.value) drawBalloon(context, activeBalloon.value);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateBalloon(delta, now);
    updateClouds(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  activeBalloon.value = undefined;
  previousBalloonPoint = undefined;
  nextBalloonAt = 0;
  startSession();
  activeBalloon.value = createBalloon(true);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  activeBalloon.value = createBalloon(true);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
});
</script>

<template>
  <div class="balloons-shell">
    <canvas ref="canvasRef" class="balloons-canvas" />

    <v-card class="balloons-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Смотри на шарик спокойно, и он мягко улетит вверх.</div>
      <div class="text-caption text-medium-emphasis">Если взгляд ушёл, ничего страшного: круг начнётся заново.</div>
    </v-card>

    <GameHud
      title="Шарики"
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
      title="Шарики"
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
.balloons-shell {
  background: #7fb6d4;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.balloons-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.balloons-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 560px;
  opacity: 0.78;
  position: absolute;
  z-index: 3;
}
</style>
