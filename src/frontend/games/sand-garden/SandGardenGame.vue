<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type SandTrail = Point & {
  id: string;
  previousX: number;
  previousY: number;
  age: number;
  life: number;
  width: number;
  wobble: number;
  hue: number;
};
type SandPebble = Point & {
  radius: number;
  alpha: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("sand-garden", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 84,
  targetScale: 1.45,
  motionSpeed: 0.5,
  distractors: "none",
  hints: "high",
  sound: false
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const trails = reactive<SandTrail[]>([]);
const pebbles = reactive<SandPebble[]>([]);
const rake = reactive<Point>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.55 });
const resultVisible = computed(() => session.status === "finished");

let trailTimer = 0;
let calmTraceSeconds = 0;
let lastTrailPoint: Point | undefined;
let activeTraceStartedAt = 0;
let finishAfter = 0;
let wasTracing = false;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
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

function resetGarden() {
  trails.splice(0);
  pebbles.splice(0);
  trailTimer = 0;
  calmTraceSeconds = 0;
  lastTrailPoint = undefined;
  activeTraceStartedAt = 0;
  finishAfter = 0;
  wasTracing = false;
  rake.x = width.value * 0.5;
  rake.y = height.value * 0.55;

  const count = Math.min(92, Math.max(38, Math.round(width.value / 18)));
  for (let index = 0; index < count; index += 1) {
    pebbles.push({
      x: randomRange(16, Math.max(17, width.value - 16)),
      y: randomRange(112, Math.max(113, height.value - 18)),
      radius: randomRange(1.2, 3.8),
      alpha: randomRange(0.08, 0.22)
    });
  }
}

function startTrace(now: number) {
  activeTraceStartedAt = now;
  recordEvent("target-enter", {
    targetId: `sand-trace-${session.step + 1}`,
    at: Date.now(),
    pointer: copyPointer()
  });
}

function completeCalmStep(now: number) {
  const elapsedMs = activeTraceStartedAt > 0 ? now - activeTraceStartedAt : session.settings.dwellMs;
  recordEvent("target-click", {
    targetId: `sand-trace-${session.step + 1}`,
    at: Date.now(),
    elapsedMs,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId: `sand-trace-${session.step + 1}`, traceSeconds: Number(calmTraceSeconds.toFixed(1)) });
  calmTraceSeconds = 0;
  activeTraceStartedAt = now;

  if (session.step >= session.maxSteps && finishAfter === 0) finishAfter = now + 1800;
}

function addTrail(now: number) {
  const point = { x: rake.x, y: rake.y };
  const previous = lastTrailPoint ?? point;
  lastTrailPoint = point;

  trails.push({
    id: `sand-trail-${now}-${trails.length}`,
    x: point.x,
    y: point.y,
    previousX: previous.x,
    previousY: previous.y,
    age: 0,
    life: randomRange(9.5, 13.5),
    width: randomRange(22, 34) * session.settings.targetScale,
    wobble: randomRange(-1, 1),
    hue: randomRange(34, 42)
  });

  if (trails.length > 230) trails.splice(0, trails.length - 230);
}

function updateRake(delta: number) {
  const target = pointer.value.valid ? pointer.value : { x: width.value * 0.5, y: height.value * 0.58 };
  const smoothing = pointer.value.valid ? 4.8 : 0.85;
  rake.x += (target.x - rake.x) * Math.min(1, delta * smoothing);
  rake.y += (target.y - rake.y) * Math.min(1, delta * smoothing);
}

function updateTrails(delta: number, now: number) {
  for (let index = trails.length - 1; index >= 0; index -= 1) {
    const trail = trails[index];
    trail.age += delta;
    if (trail.age >= trail.life) trails.splice(index, 1);
  }

  if (!pointer.value.valid || session.settings.reduceMotion) {
    if (wasTracing) {
      recordEvent("target-cancel", {
        targetId: `sand-trace-${session.step + 1}`,
        at: Date.now(),
        progress: Math.min(1, calmTraceSeconds / calmStepSeconds()),
        pointer: copyPointer(),
        reason: pointer.value.valid ? "disabled" : "invalid-gaze"
      });
    }
    wasTracing = false;
    lastTrailPoint = undefined;
    trailTimer = 0;
    return;
  }

  if (!wasTracing) startTrace(now);
  wasTracing = true;
  trailTimer += delta;
  calmTraceSeconds += delta;

  const interval = 0.08 / session.settings.motionSpeed;
  while (trailTimer >= interval) {
    if (!lastTrailPoint || distance(lastTrailPoint, rake) >= 4) addTrail(now);
    trailTimer -= interval;
  }

  if (calmTraceSeconds >= calmStepSeconds() && session.step < session.maxSteps) completeCalmStep(now);
  if (finishAfter > 0 && now >= finishAfter) finishSession("max-steps");
}

function calmStepSeconds() {
  return 9.5;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height.value);
  gradient.addColorStop(0, "#f2d7a6");
  gradient.addColorStop(0.45, "#e9c487");
  gradient.addColorStop(1, "#dcb06e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#fff1cf";
  ctx.lineWidth = 1.5;
  for (let index = 0; index < 11; index += 1) {
    const y = height.value * (0.16 + index * 0.075);
    ctx.beginPath();
    ctx.moveTo(-40, y);
    ctx.bezierCurveTo(width.value * 0.22, y - 24, width.value * 0.48, y + 26, width.value + 40, y - 6);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (const pebble of pebbles) {
    ctx.globalAlpha = pebble.alpha;
    ctx.fillStyle = "#8f6740";
    ctx.beginPath();
    ctx.ellipse(pebble.x, pebble.y, pebble.radius * 1.4, pebble.radius, 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: SandTrail) {
  const progress = trail.age / trail.life;
  const alpha = Math.max(0, 1 - progress) * 0.38;
  const lift = Math.sin(progress * Math.PI) * 3;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `hsla(${trail.hue}, 54%, 42%, ${alpha})`;
  ctx.lineWidth = trail.width;
  ctx.beginPath();
  ctx.moveTo(trail.previousX, trail.previousY);
  ctx.quadraticCurveTo(
    (trail.previousX + trail.x) * 0.5 + trail.wobble * 12,
    (trail.previousY + trail.y) * 0.5 - lift,
    trail.x,
    trail.y
  );
  ctx.stroke();

  ctx.strokeStyle = `hsla(${trail.hue + 12}, 72%, 76%, ${alpha * 0.65})`;
  ctx.lineWidth = Math.max(5, trail.width * 0.24);
  ctx.stroke();
  ctx.restore();
}

function drawRake(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = pointer.value.valid ? 0.76 : 0.34;

  const halo = ctx.createRadialGradient(rake.x, rake.y, 0, rake.x, rake.y, 86 * session.settings.targetScale);
  halo.addColorStop(0, "rgb(255 244 210 / 30%)");
  halo.addColorStop(1, "rgb(255 244 210 / 0%)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(rake.x, rake.y, 86 * session.settings.targetScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8d6844";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rake.x - 46, rake.y - 54);
  ctx.lineTo(rake.x - 8, rake.y - 14);
  ctx.stroke();

  ctx.strokeStyle = "#6f5238";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(rake.x - 18, rake.y - 8);
  ctx.lineTo(rake.x + 44, rake.y + 10);
  ctx.stroke();

  ctx.lineWidth = 3;
  for (let index = 0; index < 5; index += 1) {
    const offset = (index - 2) * 13;
    ctx.beginPath();
    ctx.moveTo(rake.x + offset, rake.y + 3);
    ctx.lineTo(rake.x + offset - 6, rake.y + 24);
    ctx.stroke();
  }

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D) {
  drawBackground(ctx);
  for (const trail of trails) drawTrail(ctx, trail);
  drawRake(ctx);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateRake(delta);
    updateTrails(delta, now);
  }
}

function restart() {
  startSession();
  resetGarden();
}

onMounted(() => {
  resetGarden();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="sand-garden-shell">
    <canvas ref="canvasRef" class="sand-garden-canvas" />

    <GameHud
      title="Песочный сад"
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
      title="Песочный сад"
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
.sand-garden-shell {
  background: #e9c487;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.sand-garden-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
