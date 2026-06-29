<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = { x: number; y: number };
type Projection = Point & { distance: number; ratio: number };
type SnowSpark = Point & { age: number; life: number; size: number; drift: number };

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("snow-trail", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.45, motionSpeed: 0.48, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const progress = ref(0);
const visualProgress = ref(0);
const snow = reactive({ pulse: 0, confidence: 0, guide: 0, cleanup: 0 });
const sparks = reactive<SnowSpark[]>([]);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(visualProgress.value * 100));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Санки подождут на мягком снегу.";
  if (snow.cleanup > 0) return "Тропа мягко заметает следы. Маршрут завершён.";
  if (!pointer.value.valid) return "Можно вести санки взглядом или мышью по широкой снежной тропе.";
  if (snow.guide > 0.45) return "Вернись к свету на тропе и веди санки дальше.";
  return "Веди мягкий свет санок через снежные отметки.";
});

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let tracking = false;
let lastHintAt = 0;
let cleanupStartedAt = 0;
let cleanupElapsedMs = 0;
let gameTimeMs = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = "100dvw";
  canvas.style.height = "100dvh";
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function trailWidth() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(172, Math.max(150, Math.min(viewportLimit, 104 * session.settings.targetScale)));
}

function trailPoints(): Point[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const top = Math.max(128, height * 0.17);
  const bottom = height - Math.max(78, height * 0.1);
  const left = Math.max(72, width * 0.12);
  const right = width - left;
  const center = width * 0.5;

  if (width < 720) {
    return [
      { x: center, y: bottom },
      { x: width * 0.28, y: bottom - (bottom - top) * 0.16 },
      { x: width * 0.72, y: bottom - (bottom - top) * 0.32 },
      { x: width * 0.32, y: bottom - (bottom - top) * 0.5 },
      { x: width * 0.76, y: bottom - (bottom - top) * 0.68 },
      { x: center, y: top }
    ];
  }

  return [
    { x: left, y: bottom },
    { x: width * 0.32, y: bottom - (bottom - top) * 0.12 },
    { x: right, y: bottom - (bottom - top) * 0.28 },
    { x: width * 0.58, y: bottom - (bottom - top) * 0.48 },
    { x: left + 36, y: bottom - (bottom - top) * 0.62 },
    { x: width * 0.42, y: bottom - (bottom - top) * 0.8 },
    { x: right, y: top }
  ];
}

function pathLength(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  return Math.max(1, length);
}

function pointAtPathProgress(points: Point[], ratio: number): Point {
  const target = pathLength(points) * clamp(ratio, 0, 1);
  let walked = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (walked + segmentLength >= target) {
      const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
      return { x: start.x + (end.x - start.x) * local, y: start.y + (end.y - start.y) * local };
    }
    walked += segmentLength;
  }

  return points[points.length - 1];
}

function projectPointToPath(point: Point, points: Point[]): Projection {
  const totalLength = pathLength(points);
  let walked = 0;
  let best: Projection = { ...points[0], distance: Number.POSITIVE_INFINITY, ratio: 0 };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.hypot(dx, dy);
    const segmentLengthSquared = dx * dx + dy * dy;
    const t = segmentLengthSquared <= 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared, 0, 1);
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const nextDistance = distance(point, candidate);

    if (nextDistance < best.distance) {
      best = { ...candidate, distance: nextDistance, ratio: (walked + segmentLength * t) / totalLength };
    }

    walked += segmentLength;
  }

  return best;
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

function targetPayload(targetId: string, pathProgress: number, projection?: Projection, reason?: "left" | "invalid-gaze") {
  return {
    targetId,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: session.settings.dwellMs,
    progress: pathProgress,
    pathProgress,
    pointer: copyPointer(),
    distanceToPath: projection?.distance,
    reason
  };
}

function updateTracking(nearTrail: boolean, projection: Projection | undefined) {
  if (nearTrail && !tracking) {
    tracking = true;
    recordEvent("target-enter", targetPayload("snow-trail", progress.value, projection));
    return;
  }

  if (!nearTrail && tracking) {
    tracking = false;
    recordEvent("target-cancel", targetPayload("snow-trail", progress.value, projection, pointer.value.valid ? "left" : "invalid-gaze"));
  }
}

function addSnowSpark(point: Point, count = 8) {
  if (session.settings.reduceMotion) return;
  for (let index = 0; index < count; index += 1) {
    sparks.push({
      x: point.x + (Math.random() - 0.5) * trailWidth() * 0.36,
      y: point.y + (Math.random() - 0.5) * trailWidth() * 0.28,
      age: 0,
      life: 0.9 + Math.random() * 0.65,
      size: 3 + Math.random() * 5,
      drift: (Math.random() - 0.5) * 28
    });
  }
  if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
}

function startCleanup(now: number) {
  cleanupStartedAt = now;
  cleanupElapsedMs = 0;
  snow.cleanup = 0.001;
  addSnowSpark(pointAtPathProgress(trailPoints(), 1), 18);
}

function updateCheckpoints(now: number) {
  const points = trailPoints();
  while (session.step < session.maxSteps && progress.value >= (session.step + 1) / session.maxSteps - 0.004) {
    const checkpoint = session.step + 1;
    const targetId = `snow-trail-checkpoint-${checkpoint}`;
    const checkpointPoint = pointAtPathProgress(points, checkpoint / session.maxSteps);
    recordEvent("target-click", targetPayload(targetId, progress.value));
    if (checkpoint === session.maxSteps) startCleanup(now);
    recordSuccess({ targetId, checkpoint, pathProgress: progress.value });
    addSnowSpark(checkpointPoint, checkpoint === session.maxSteps ? 18 : 10);
  }
}

function updateSparks(delta: number) {
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.age += delta;
    spark.x += spark.drift * delta;
    spark.y -= 18 * delta;
    if (spark.age >= spark.life) sparks.splice(index, 1);
  }
}

function updateCleanup(delta: number) {
  if (cleanupStartedAt === 0) return;
  cleanupElapsedMs += delta * 1000;
  snow.cleanup = clamp(cleanupElapsedMs / 1500, 0, 1);
  if (snow.cleanup >= 1) finishSession("max-steps");
}

function update(delta: number, now: number) {
  if (!session.settings.reduceMotion) gameTimeMs += delta * 1000;
  snow.pulse += session.settings.reduceMotion ? 0 : delta;
  visualProgress.value += (progress.value - visualProgress.value) * Math.min(1, delta * 5.2);
  updateSparks(delta);
  updateCleanup(delta);

  if (session.status !== "running") return;

  const points = trailPoints();
  const projection = pointer.value.valid ? projectPointToPath(pointer.value, points) : undefined;
  const width = trailWidth();
  const onTrail = Boolean(projection && projection.distance <= width * 0.5);
  const nearTrail = Boolean(projection && projection.distance <= width * 0.95);
  const ahead = Boolean(projection && projection.ratio > progress.value + 0.003);

  updateTracking(nearTrail, projection);

  const confidenceTarget = onTrail ? 1 : nearTrail ? 0.46 : 0;
  const guideTarget = nearTrail ? 0 : 1;
  snow.confidence += (confidenceTarget - snow.confidence) * Math.min(1, delta * 4.4);
  snow.guide += (guideTarget - snow.guide) * Math.min(1, delta * 2.2);

  if (projection && nearTrail && ahead) {
    const speed = (onTrail ? 0.42 : 0.14) * session.settings.motionSpeed;
    progress.value = Math.min(projection.ratio, progress.value + speed * delta);
  }

  if (!nearTrail && now - lastHintAt > 3400) {
    lastHintAt = now;
    recordHint({ kind: "snow-trail-guide", pathProgress: progress.value, pointer: copyPointer(), distanceToPath: projection?.distance });
  }

  updateCheckpoints(now);
}

function strokePath(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
  context.stroke();
}

function strokePartialPath(context: CanvasRenderingContext2D, points: Point[], ratio: number) {
  const target = pathLength(points) * clamp(ratio, 0, 1);
  let walked = 0;

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (walked + segmentLength <= target) {
      context.lineTo(end.x, end.y);
      walked += segmentLength;
      continue;
    }

    const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
    context.lineTo(start.x + (end.x - start.x) * local, start.y + (end.y - start.y) * local);
    break;
  }
  context.stroke();
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#dff2ff");
  sky.addColorStop(0.58, "#edf8ff");
  sky.addColorStop(1, "#f8fbff");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.fillStyle = "rgb(255 255 255 / 74%)";
  for (let ridge = 0; ridge < 3; ridge += 1) {
    const base = window.innerHeight * (0.66 + ridge * 0.1);
    context.beginPath();
    context.moveTo(0, window.innerHeight);
    context.lineTo(0, base);
    for (let x = 0; x <= window.innerWidth; x += 90) {
      context.quadraticCurveTo(x + 44, base - 38 - ridge * 10, x + 90, base + Math.sin(x * 0.01 + ridge) * 18);
    }
    context.lineTo(window.innerWidth, window.innerHeight);
    context.closePath();
    context.fill();
  }
  context.restore();

  context.save();
  context.fillStyle = "rgb(255 255 255 / 58%)";
  for (let index = 0; index < 44; index += 1) {
    const visualNow = session.settings.reduceMotion ? 0 : now;
    const x = (index * 97 + visualNow * 0.006 * (index % 4 + 1)) % (window.innerWidth + 40) - 20;
    const y = (index * 53 + visualNow * 0.012 * (index % 3 + 1)) % (window.innerHeight + 40) - 20;
    const size = 1.5 + index % 4;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTrail(context: CanvasRenderingContext2D, points: Point[]) {
  const width = trailWidth();
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgb(118 154 181 / 13%)";
  context.lineWidth = width + 36;
  strokePath(context, points);

  context.strokeStyle = "rgb(255 255 255 / 78%)";
  context.lineWidth = width;
  strokePath(context, points);

  context.strokeStyle = "rgb(168 207 229 / 30%)";
  context.lineWidth = Math.max(3, width * 0.05);
  context.setLineDash([Math.max(14, width * 0.14), Math.max(18, width * 0.18)]);
  strokePath(context, points);
  context.setLineDash([]);

  context.strokeStyle = "rgb(126 210 230 / 58%)";
  context.lineWidth = width * 0.42;
  strokePartialPath(context, points, visualProgress.value);

  if (snow.cleanup > 0) {
    context.globalAlpha = 0.78 * snow.cleanup;
    context.strokeStyle = "rgb(255 255 255 / 88%)";
    context.lineWidth = width * (0.48 + snow.cleanup * 0.16);
    strokePartialPath(context, points, snow.cleanup);
  }

  context.restore();
}

function drawCheckpoints(context: CanvasRenderingContext2D, points: Point[]) {
  const width = trailWidth();
  for (let index = 0; index < session.maxSteps; index += 1) {
    const ratio = (index + 1) / session.maxSteps;
    const point = pointAtPathProgress(points, ratio);
    const done = session.step > index;
    const next = session.step === index && session.status === "running";
    const pulse = next && !session.settings.reduceMotion ? 1 + Math.sin(snow.pulse * 4) * 0.07 : 1;
    const radius = width * (done ? 0.18 : 0.15) * pulse;

    context.save();
    context.fillStyle = done ? "rgb(217 247 255 / 92%)" : "rgb(255 255 255 / 70%)";
    context.strokeStyle = done ? "rgb(79 177 201 / 86%)" : next ? "rgb(94 153 203 / 70%)" : "rgb(126 153 178 / 34%)";
    context.lineWidth = Math.max(3, width * 0.035);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = done ? "rgb(61 150 179 / 88%)" : "rgb(89 116 145 / 70%)";
    context.font = `800 ${Math.max(15, width * 0.14)}px system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(done ? "✓" : String(index + 1), point.x, point.y + 1);
    context.restore();
  }
}

function drawSparks(context: CanvasRenderingContext2D) {
  context.save();
  for (const spark of sparks) {
    const alpha = 1 - spark.age / spark.life;
    context.fillStyle = `rgb(255 255 255 / ${0.72 * alpha})`;
    context.beginPath();
    context.arc(spark.x, spark.y, spark.size * (0.8 + alpha * 0.5), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSled(context: CanvasRenderingContext2D, points: Point[]) {
  const point = pointAtPathProgress(points, visualProgress.value);
  const next = pointAtPathProgress(points, clamp(visualProgress.value + 0.012, 0, 1));
  const previous = pointAtPathProgress(points, clamp(visualProgress.value - 0.012, 0, 1));
  const angle = Math.atan2(next.y - previous.y, next.x - previous.x);
  const size = trailWidth() * (0.36 + snow.confidence * 0.04);
  const glowRadius = size * (1.9 + snow.confidence * 0.55);

  context.save();
  const glow = context.createRadialGradient(point.x, point.y, size * 0.2, point.x, point.y, glowRadius);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.88 + snow.confidence * 0.1})`);
  glow.addColorStop(0.45, "rgb(158 223 236 / 46%)");
  glow.addColorStop(1, "rgb(158 223 236 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(point.x, point.y, glowRadius, 0, Math.PI * 2);
  context.fill();

  if (snow.guide > 0.05) {
    context.globalAlpha = snow.guide * 0.62;
    context.strokeStyle = "rgb(94 132 178 / 42%)";
    context.lineWidth = Math.max(3, size * 0.08);
    context.beginPath();
    context.arc(point.x, point.y, trailWidth() * 0.56, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
  }

  context.translate(point.x, point.y);
  context.rotate(angle);
  context.strokeStyle = "rgb(73 112 143 / 64%)";
  context.lineWidth = Math.max(3, size * 0.08);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-size * 0.56, size * 0.28);
  context.quadraticCurveTo(0, size * 0.42, size * 0.62, size * 0.18);
  context.moveTo(-size * 0.56, -size * 0.28);
  context.quadraticCurveTo(0, -size * 0.42, size * 0.62, -size * 0.18);
  context.stroke();

  context.fillStyle = "#de7d62";
  context.strokeStyle = "rgb(126 71 64 / 36%)";
  context.lineWidth = Math.max(2, size * 0.04);
  context.beginPath();
  context.roundRect(-size * 0.44, -size * 0.26, size * 0.72, size * 0.52, size * 0.12);
  context.fill();
  context.stroke();

  context.fillStyle = "rgb(255 255 255 / 92%)";
  context.beginPath();
  context.arc(size * 0.34, 0, size * 0.21, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawLabels(context: CanvasRenderingContext2D, points: Point[]) {
  const start = points[0];
  const finish = points[points.length - 1];
  context.save();
  context.fillStyle = "rgb(70 101 132 / 74%)";
  context.font = "800 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Старт", start.x, start.y + trailWidth() * 0.58);
  context.fillText("Финиш", finish.x, finish.y - trailWidth() * 0.46);
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  const points = trailPoints();
  drawBackground(context, gameTimeMs);
  drawTrail(context, points);
  drawCheckpoints(context, points);
  drawSparks(context);
  drawSled(context, points);
  drawLabels(context, points);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta, now);
  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function resetTrail() {
  progress.value = 0;
  visualProgress.value = 0;
  snow.confidence = 0;
  snow.guide = 0;
  snow.cleanup = 0;
  cleanupElapsedMs = 0;
  gameTimeMs = 0;
  sparks.splice(0);
  cleanupStartedAt = 0;
  lastHintAt = 0;
  tracking = false;
}

function restart() {
  resetTrail();
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetTrail();
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
  <div class="snow-trail-shell">
    <canvas ref="canvasRef" class="snow-trail-canvas" />

    <GameHud
      title="Снежная тропа"
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

    <v-card class="snow-trail-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-info mb-1">Плавное управление</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="progressPercent" color="info" height="0.5rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Отметки: {{ session.step }} / {{ session.maxSteps }}</div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Снежная тропа"
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
.snow-trail-shell {
  background: #edf8ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.snow-trail-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.snow-trail-guidance {
  box-shadow: 0 1.125rem 3rem rgb(74 116 150 / 14%);
  inline-size: min(27.5rem, calc(100dvw - 2rem));
  inset-block-start: clamp(6.5rem, 14vh, 9.25rem);
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  opacity: 0.92;
  position: absolute;
  z-index: 4;
}

@media (max-width: 45rem) {
  .snow-trail-guidance {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline: 1rem;
    inline-size: auto;
  }
}
</style>
