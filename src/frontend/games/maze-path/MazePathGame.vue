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

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("maze-path", {
  maxSteps: 5,
  overrides: { preset: "gentle", dwellMs: 1000, sessionSeconds: 120, targetScale: 1.55, motionSpeed: 0.48, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const progress = ref(0);
const visualProgress = ref(0);
const light = reactive({ pulse: 0, confidence: 0, hint: 0 });
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(progress.value * 100));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Можно спокойно продолжить, когда будет удобно.";
  if (!pointer.value.valid) return "Можно вести свет взглядом или мышью. Дорожка ждёт спокойно.";
  if (light.hint > 0.42) return "Вернись к мягкому свету на дорожке и веди его дальше.";
  return "Веди свет по широкой дорожке к финишу.";
});

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastHintAt = 0;
let finishAfter = 0;
let tracking = false;

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
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx = canvas.getContext("2d") ?? undefined;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function pathWidth() {
  const scale = session.settings.targetScale;
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.16;
  return Math.min(156, Math.max(96, Math.min(viewportLimit, 94 * scale)));
}

function pathPoints(): Point[] {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const left = Math.max(82, width * 0.12);
  const right = width - left;
  const hudTop = Math.max(132, height * 0.17);
  const bottom = height - Math.max(86, height * 0.1);
  const travel = Math.max(300, bottom - hudTop);
  const firstY = hudTop + travel * 0.08;
  const midY = hudTop + travel * 0.46;
  const lastY = hudTop + travel * 0.88;

  if (width < 720) {
    const center = width * 0.5;
    const mobileLeft = Math.max(70, width * 0.2);
    const mobileRight = width - mobileLeft;
    return [
      { x: center, y: firstY },
      { x: mobileRight, y: firstY + travel * 0.16 },
      { x: mobileRight, y: midY },
      { x: mobileLeft, y: midY },
      { x: mobileLeft, y: lastY - travel * 0.16 },
      { x: center, y: lastY }
    ];
  }

  return [
    { x: left, y: firstY },
    { x: right, y: firstY },
    { x: right, y: midY },
    { x: left, y: midY },
    { x: left, y: lastY },
    { x: right, y: lastY }
  ];
}

function pathLength(points: Point[]) {
  let length = 0;
  for (let index = 1; index < points.length; index++) length += distance(points[index - 1], points[index]);
  return Math.max(1, length);
}

function pointAtPathProgress(points: Point[], ratio: number): Point {
  const target = pathLength(points) * clamp(ratio, 0, 1);
  let walked = 0;

  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (walked + segmentLength >= target) {
      const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * local,
        y: start.y + (end.y - start.y) * local
      };
    }
    walked += segmentLength;
  }

  return points[points.length - 1];
}

function projectPointToPath(point: Point, points: Point[]): Projection {
  const totalLength = pathLength(points);
  let walked = 0;
  let best: Projection = { ...points[0], distance: Number.POSITIVE_INFINITY, ratio: 0 };

  for (let index = 1; index < points.length; index++) {
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
      best = {
        ...candidate,
        distance: nextDistance,
        ratio: (walked + segmentLength * t) / totalLength
      };
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
    elapsedMs: 0,
    progress: pathProgress,
    pathProgress,
    pointer: copyPointer(),
    distanceToPath: projection?.distance,
    reason
  };
}

function updateTracking(nearPath: boolean, projection: Projection | undefined) {
  if (nearPath && !tracking) {
    tracking = true;
    recordEvent("target-enter", targetPayload("maze-path", progress.value, projection));
    return;
  }

  if (!nearPath && tracking) {
    tracking = false;
    recordEvent("target-cancel", targetPayload("maze-path", progress.value, projection, pointer.value.valid ? "left" : "invalid-gaze"));
  }
}

function updateCheckpoints(now: number) {
  while (session.step < session.maxSteps && progress.value >= (session.step + 1) / session.maxSteps - 0.003) {
    const checkpoint = session.step + 1;
    const targetId = `maze-path-checkpoint-${checkpoint}`;
    recordEvent("target-click", targetPayload(targetId, progress.value));
    recordSuccess({ targetId, checkpoint, pathProgress: progress.value });
  }

  if (session.step >= session.maxSteps && progress.value >= 0.995 && finishAfter === 0) finishAfter = now + 650;
  if (finishAfter > 0 && now >= finishAfter) finishSession("game-complete");
}

function update(delta: number, now: number) {
  light.pulse += delta;
  visualProgress.value += (progress.value - visualProgress.value) * Math.min(1, delta * 5.5);

  if (session.status !== "running") return;

  const points = pathPoints();
  const projection = pointer.value.valid ? projectPointToPath(pointer.value, points) : undefined;
  const laneWidth = pathWidth();
  const onPath = Boolean(projection && projection.distance <= laneWidth * 0.58);
  const nearPath = Boolean(projection && projection.distance <= laneWidth * 1.05);
  const ahead = Boolean(projection && projection.ratio > progress.value + 0.004);

  updateTracking(nearPath, projection);

  const confidenceTarget = onPath ? 1 : nearPath ? 0.48 : 0;
  const hintTarget = nearPath ? 0 : 1;
  light.confidence += (confidenceTarget - light.confidence) * Math.min(1, delta * 4.2);
  light.hint += (hintTarget - light.hint) * Math.min(1, delta * 2.4);

  if (projection && nearPath && ahead) {
    const speed = (onPath ? 0.34 : 0.11) * session.settings.motionSpeed;
    progress.value = Math.min(projection.ratio, progress.value + speed * delta);
  }

  if (!nearPath && now - lastHintAt > 3000) {
    lastHintAt = now;
    recordHint({ kind: "path-guide", pathProgress: progress.value, pointer: copyPointer(), distanceToPath: projection?.distance });
  }

  updateCheckpoints(now);
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#f1fbff");
  sky.addColorStop(0.55, "#eef6ff");
  sky.addColorStop(1, "#f8f3e8");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.34;
  for (let index = 0; index < 5; index++) {
    const x = window.innerWidth * (0.12 + index * 0.22);
    const y = window.innerHeight * (0.22 + Math.sin(now * 0.00012 + index) * 0.025 + (index % 2) * 0.18);
    const glow = context.createRadialGradient(x, y, 0, x, y, Math.max(window.innerWidth, window.innerHeight) * 0.28);
    glow.addColorStop(0, index % 2 === 0 ? "rgb(255 255 255 / 62%)" : "rgb(207 231 244 / 48%)");
    glow.addColorStop(1, "rgb(255 255 255 / 0%)");
    context.fillStyle = glow;
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }
  context.restore();
}

function strokePath(context: CanvasRenderingContext2D, points: Point[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) context.lineTo(points[index].x, points[index].y);
  context.stroke();
}

function strokePartialPath(context: CanvasRenderingContext2D, points: Point[], ratio: number) {
  const target = pathLength(points) * clamp(ratio, 0, 1);
  let walked = 0;

  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
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

function drawPath(context: CanvasRenderingContext2D, points: Point[]) {
  const laneWidth = pathWidth();
  const pathGradient = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  pathGradient.addColorStop(0, "#dff3ef");
  pathGradient.addColorStop(0.54, "#e7ecff");
  pathGradient.addColorStop(1, "#fff1d5");

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgb(94 128 150 / 16%)";
  context.lineWidth = laneWidth + 28;
  strokePath(context, points);

  context.strokeStyle = pathGradient;
  context.lineWidth = laneWidth;
  strokePath(context, points);

  context.strokeStyle = "rgb(255 255 255 / 74%)";
  context.lineWidth = Math.max(3, laneWidth * 0.055);
  strokePath(context, points);

  context.setLineDash([Math.max(18, laneWidth * 0.18), Math.max(18, laneWidth * 0.24)]);
  context.strokeStyle = "rgb(95 130 170 / 22%)";
  context.lineWidth = Math.max(3, laneWidth * 0.04);
  strokePath(context, points);
  context.setLineDash([]);

  const progressGradient = context.createLinearGradient(0, 0, window.innerWidth, window.innerHeight);
  progressGradient.addColorStop(0, "rgb(123 211 219 / 78%)");
  progressGradient.addColorStop(0.6, "rgb(145 154 232 / 70%)");
  progressGradient.addColorStop(1, "rgb(255 207 128 / 74%)");
  context.strokeStyle = progressGradient;
  context.lineWidth = laneWidth * 0.54;
  strokePartialPath(context, points, visualProgress.value);

  context.restore();
}

function drawCheckpoints(context: CanvasRenderingContext2D, points: Point[]) {
  const laneWidth = pathWidth();
  for (let index = 0; index < session.maxSteps; index++) {
    const ratio = (index + 1) / session.maxSteps;
    const point = pointAtPathProgress(points, ratio);
    const done = session.step > index;
    const radius = laneWidth * (done ? 0.2 : 0.16);

    context.save();
    context.fillStyle = done ? "rgb(255 255 255 / 92%)" : "rgb(255 255 255 / 58%)";
    context.strokeStyle = done ? "rgb(80 184 190 / 86%)" : "rgb(115 142 164 / 34%)";
    context.lineWidth = Math.max(3, laneWidth * 0.035);
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    if (done) {
      context.fillStyle = "rgb(80 184 190 / 86%)";
      context.beginPath();
      context.arc(point.x, point.y, radius * 0.42, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawLight(context: CanvasRenderingContext2D, points: Point[]) {
  const laneWidth = pathWidth();
  const point = pointAtPathProgress(points, visualProgress.value);
  const pulse = Math.sin(light.pulse * 3.2) * 0.08;
  const radius = laneWidth * (0.24 + pulse + light.confidence * 0.05);
  const hintRadius = laneWidth * (0.74 + Math.sin(light.pulse * 2.1) * 0.04);

  context.save();
  if (light.hint > 0.05) {
    context.globalAlpha = light.hint * 0.66;
    context.strokeStyle = "rgb(93 122 171 / 42%)";
    context.lineWidth = Math.max(3, laneWidth * 0.035);
    context.beginPath();
    context.arc(point.x, point.y, hintRadius, 0, Math.PI * 2);
    context.stroke();
  }

  context.globalAlpha = 1;
  const glow = context.createRadialGradient(point.x, point.y, radius * 0.16, point.x, point.y, radius * 2.6);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.9 + light.confidence * 0.1})`);
  glow.addColorStop(0.42, "rgb(184 232 237 / 44%)");
  glow.addColorStop(1, "rgb(184 232 237 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(point.x, point.y, radius * 2.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(255 255 255 / 94%)";
  context.strokeStyle = light.confidence > 0.6 ? "rgb(80 184 190 / 82%)" : "rgb(121 145 179 / 52%)";
  context.lineWidth = Math.max(3, laneWidth * 0.04);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawLabels(context: CanvasRenderingContext2D, points: Point[]) {
  const start = points[0];
  const finish = points[points.length - 1];
  context.save();
  context.font = "700 18px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgb(69 92 112 / 78%)";
  context.fillText("Старт", start.x, start.y - pathWidth() * 0.62);
  context.fillText("Финиш", finish.x, finish.y + pathWidth() * 0.62);
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  const points = pathPoints();
  drawBackground(context, now);
  drawPath(context, points);
  drawCheckpoints(context, points);
  drawLight(context, points);
  drawLabels(context, points);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta, now);
  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function resetPath() {
  progress.value = 0;
  visualProgress.value = 0;
  light.confidence = 0;
  light.hint = 0;
  lastHintAt = 0;
  finishAfter = 0;
  tracking = false;
}

function restart() {
  resetPath();
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetPath();
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
  <div class="maze-path-shell">
    <canvas ref="canvasRef" class="maze-path-canvas" />

    <GameHud title="Лабиринт-дорожка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-card class="maze-path-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Плавное ведение</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="progressPercent" color="primary" height="8" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Прогресс: {{ progressPercent }}%</div>
    </v-card>

    <GameResultDialog :model-value="resultVisible" title="Лабиринт-дорожка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.maze-path-shell {
  background: #f1fbff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.maze-path-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.maze-path-guidance {
  box-shadow: 0 16px 44px rgb(75 117 143 / 14%);
  inline-size: min(420px, calc(100vw - 32px));
  inset-block-start: clamp(104px, 14vh, 148px);
  inset-inline-end: max(16px, env(safe-area-inset-right));
  opacity: 0.9;
  position: absolute;
  z-index: 4;
}

@media (max-width: 720px) {
  .maze-path-guidance {
    inset-block-start: auto;
    inset-block-end: max(16px, env(safe-area-inset-bottom));
    inset-inline: 16px;
    inline-size: auto;
  }
}
</style>
