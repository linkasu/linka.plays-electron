<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = { x: number; y: number };
type Projection = Point & { distance: number; ratio: number };
type GateState = {
  dwell: number;
  entered: boolean;
  pulse: number;
};
type Sparkle = Point & {
  age: number;
  life: number;
  radius: number;
  drift: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("gates-path", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.5, motionSpeed: 0.52, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const progress = ref(0);
const visualProgress = ref(0);
const light = reactive({ phase: 0, confidence: 0, correction: 0, finish: 0 });
const gates = reactive<GateState[]>([]);
const sparkles = reactive<Sparkle[]>([]);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(Math.min(1, progress.value) * 100));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Можно продолжить без спешки.";
  if (!pointer.value.valid) return "Можно вести свет взглядом или мышью. Ворота ждут спокойно.";
  if (session.step >= session.maxSteps) return "Все ворота пройдены. Свет мягко собирает дорожку.";
  if (light.correction > 0.42) return "Мягко верни свет к дорожке и широким воротам.";
  return "Веди свет по дорожке через широкие ворота.";
});

let finishAfter = 0;
let lastHintAt = 0;
let trackingGate = -1;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pathWidth() {
  const viewportLimit = Math.min(width.value, height.value) * 0.15;
  return Math.min(150, Math.max(96, Math.min(viewportLimit, 88 * session.settings.targetScale)));
}

function gateHalfWidth() {
  return pathWidth() * 0.82;
}

function playArea() {
  const top = Math.max(132, height.value * 0.18);
  const bottom = height.value - Math.max(84, height.value * 0.1);
  const left = Math.max(70, width.value * 0.11);
  const right = width.value - left;
  return { top, bottom, left, right, centerY: top + (bottom - top) / 2 };
}

function pathPoints(): Point[] {
  const area = playArea();
  const points: Point[] = [];
  const count = 80;
  const amplitude = width.value < 720 ? Math.min(92, width.value * 0.2) : Math.min(142, width.value * 0.16);
  const waves = width.value < 720 ? 1.55 : 1.85;

  for (let index = 0; index <= count; index += 1) {
    const ratio = index / count;
    const y = area.top + (area.bottom - area.top) * ratio;
    const x = width.value < 720
      ? width.value * 0.5 + Math.sin(ratio * Math.PI * waves - 0.45) * amplitude
      : area.left + (area.right - area.left) * ratio + Math.sin(ratio * Math.PI * waves) * amplitude * 0.74;
    points.push({ x: clamp(x, area.left, area.right), y });
  }

  return points;
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

function tangentAtPathProgress(points: Point[], ratio: number) {
  const before = pointAtPathProgress(points, Math.max(0, ratio - 0.012));
  const after = pointAtPathProgress(points, Math.min(1, ratio + 0.012));
  const length = Math.max(1, distance(before, after));
  return { x: (after.x - before.x) / length, y: (after.y - before.y) / length };
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
    const squared = dx * dx + dy * dy;
    const t = squared <= 0 ? 0 : clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / squared, 0, 1);
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const gap = distance(point, candidate);

    if (gap < best.distance) {
      best = { ...candidate, distance: gap, ratio: (walked + segmentLength * t) / totalLength };
    }

    walked += segmentLength;
  }

  return best;
}

function gateRatio(index: number) {
  return (index + 1) / (session.maxSteps + 1);
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

function targetPayload(index: number, now: number, projection?: Projection, reason?: "left" | "invalid-gaze") {
  const gate = gates[index];
  return {
    targetId: `gates-path-gate-${index + 1}`,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: Math.round((gate?.dwell ?? 0) * 1000),
    progress: gate ? clamp(gate.dwell * 1000 / session.settings.dwellMs, 0, 1) : 0,
    pathProgress: progress.value,
    pointer: copyPointer(),
    distanceToPath: projection?.distance,
    now,
    reason
  };
}

function createSparkles(point: Point, count: number) {
  if (session.settings.reduceMotion) return;
  for (let index = 0; index < count; index += 1) {
    sparkles.push({
      x: point.x + randomRange(-pathWidth() * 0.24, pathWidth() * 0.24),
      y: point.y + randomRange(-pathWidth() * 0.24, pathWidth() * 0.24),
      age: 0,
      life: randomRange(0.9, 1.55),
      radius: randomRange(4, 10),
      drift: randomRange(-18, 18)
    });
  }
  if (sparkles.length > 80) sparkles.splice(0, sparkles.length - 80);
}

function resetGates() {
  gates.splice(0);
  for (let index = 0; index < session.maxSteps; index += 1) gates.push({ dwell: 0, entered: false, pulse: 0 });
}

function updateProgress(delta: number, projection: Projection | undefined, nextGateIndex: number) {
  const laneWidth = pathWidth();
  const nearPath = Boolean(projection && projection.distance <= laneWidth * 1.22);
  const onPath = Boolean(projection && projection.distance <= laneWidth * 0.62);
  const nextGateLimit = nextGateIndex < session.maxSteps ? gateRatio(nextGateIndex) + 0.018 : 1;

  light.confidence += ((onPath ? 1 : nearPath ? 0.48 : 0) - light.confidence) * Math.min(1, delta * 4.4);
  light.correction += ((nearPath ? 0 : 1) - light.correction) * Math.min(1, delta * 2.6);

  if (projection && nearPath) {
    const ahead = Math.min(projection.ratio, nextGateLimit);
    if (ahead > progress.value + 0.002) {
      const speed = (onPath ? 0.24 : 0.075) * session.settings.motionSpeed;
      progress.value = Math.min(ahead, progress.value + speed * delta);
    }
  }
}

function updateGate(delta: number, now: number, projection: Projection | undefined, nextGateIndex: number) {
  if (nextGateIndex >= session.maxSteps) return;
  const gate = gates[nextGateIndex];
  const ratio = gateRatio(nextGateIndex);
  const ratioWindow = Math.max(0.018, 0.028 / session.settings.motionSpeed);
  const nearGate = Boolean(
    projection
    && Math.abs(projection.ratio - ratio) <= ratioWindow
    && projection.distance <= gateHalfWidth()
    && progress.value >= ratio - ratioWindow * 1.8
  );

  if (nearGate && !gate.entered) {
    gate.entered = true;
    trackingGate = nextGateIndex;
    recordEvent("target-enter", targetPayload(nextGateIndex, now, projection));
  }

  if (nearGate) {
    gate.dwell += delta;
    gate.pulse = Math.min(1, gate.pulse + delta * 3.2);
  } else {
    if (gate.entered && trackingGate === nextGateIndex) {
      recordEvent("target-cancel", targetPayload(nextGateIndex, now, projection, pointer.value.valid ? "left" : "invalid-gaze"));
      trackingGate = -1;
    }
    gate.entered = false;
    gate.dwell = Math.max(0, gate.dwell - delta * 0.28);
    gate.pulse = Math.max(0, gate.pulse - delta * 1.8);
  }

  if (gate.dwell * 1000 >= session.settings.dwellMs) {
    const points = pathPoints();
    recordEvent("target-click", targetPayload(nextGateIndex, now, projection));
    recordSuccess({ targetId: `gates-path-gate-${nextGateIndex + 1}`, gate: nextGateIndex + 1 });
    createSparkles(pointAtPathProgress(points, ratio), 12);
    progress.value = Math.max(progress.value, ratio + 0.012);
    trackingGate = -1;
  }
}

function updateSparkles(delta: number) {
  for (let index = sparkles.length - 1; index >= 0; index -= 1) {
    const sparkle = sparkles[index];
    sparkle.age += delta;
    sparkle.y -= delta * (18 + sparkle.radius * 2.2);
    sparkle.x += sparkle.drift * delta;
    if (sparkle.age >= sparkle.life) sparkles.splice(index, 1);
  }
}

function updateFinish(delta: number, now: number) {
  if (session.step < session.maxSteps) return;
  progress.value = Math.min(1, progress.value + delta * 0.18);
  light.finish = Math.min(1, light.finish + delta * 0.65);

  if (finishAfter === 0) {
    finishAfter = now + 1850;
    createSparkles(pointAtPathProgress(pathPoints(), 1), 22);
  }
  if (now >= finishAfter) finishSession("game-complete");
}

function update(delta: number, now: number) {
  light.phase += session.settings.reduceMotion ? 0 : delta * 2.6;
  visualProgress.value += (progress.value - visualProgress.value) * Math.min(1, delta * 5.2);
  if (!session.settings.reduceMotion) updateSparkles(delta);

  if (session.status !== "running") return;

  const points = pathPoints();
  const projection = pointer.value.valid ? projectPointToPath(pointer.value, points) : undefined;
  const nextGateIndex = session.step;

  updateProgress(delta, projection, nextGateIndex);
  updateGate(delta, now, projection, nextGateIndex);
  updateFinish(delta, now);

  const nearPath = Boolean(projection && projection.distance <= pathWidth() * 1.22);
  if (pointer.value.valid && !nearPath && now - lastHintAt > 3400) {
    lastHintAt = now;
    recordHint({ kind: "soft-gate-correction", pathProgress: progress.value, pointer: copyPointer(), distanceToPath: projection?.distance });
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#eef8ff");
  sky.addColorStop(0.56, "#f4fbf5");
  sky.addColorStop(1, "#fff4df");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.26;
  for (let index = 0; index < 6; index += 1) {
    const visualNow = session.settings.reduceMotion ? 0 : now;
    const x = width.value * (0.08 + index * 0.18) + Math.sin(visualNow * 0.00013 + index) * 30;
    const y = height.value * (0.2 + index % 3 * 0.17);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width.value, height.value) * 0.24);
    glow.addColorStop(0, index % 2 === 0 ? "rgb(255 255 255 / 72%)" : "rgb(201 235 231 / 54%)");
    glow.addColorStop(1, "rgb(255 255 255 / 0%)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width.value, height.value);
  }
  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.stroke();
}

function strokePartialPath(ctx: CanvasRenderingContext2D, points: Point[], ratio: number) {
  const target = pathLength(points) * clamp(ratio, 0, 1);
  let walked = 0;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (walked + segmentLength <= target) {
      ctx.lineTo(end.x, end.y);
      walked += segmentLength;
      continue;
    }
    const local = segmentLength <= 0 ? 0 : (target - walked) / segmentLength;
    ctx.lineTo(start.x + (end.x - start.x) * local, start.y + (end.y - start.y) * local);
    break;
  }

  ctx.stroke();
}

function drawPath(ctx: CanvasRenderingContext2D, points: Point[]) {
  const laneWidth = pathWidth();
  const pathGradient = ctx.createLinearGradient(0, 0, width.value, height.value);
  pathGradient.addColorStop(0, "#d9f1ef");
  pathGradient.addColorStop(0.55, "#e9eeff");
  pathGradient.addColorStop(1, "#ffeac4");

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgb(83 120 150 / 14%)";
  ctx.lineWidth = laneWidth + 30;
  strokePath(ctx, points);
  ctx.strokeStyle = pathGradient;
  ctx.lineWidth = laneWidth;
  strokePath(ctx, points);
  ctx.strokeStyle = "rgb(255 255 255 / 74%)";
  ctx.lineWidth = Math.max(4, laneWidth * 0.06);
  strokePath(ctx, points);
  ctx.strokeStyle = "rgb(95 184 191 / 72%)";
  ctx.lineWidth = laneWidth * (0.32 + light.finish * 0.18);
  strokePartialPath(ctx, points, visualProgress.value);
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D, points: Point[], index: number) {
  const ratio = gateRatio(index);
  const point = pointAtPathProgress(points, ratio);
  const tangent = tangentAtPathProgress(points, ratio);
  const normal = { x: -tangent.y, y: tangent.x };
  const done = session.step > index;
  const active = session.step === index;
  const gate = gates[index];
  const half = gateHalfWidth() * (1 + (gate?.pulse ?? 0) * 0.05);
  const postRadius = Math.max(12, pathWidth() * 0.1);
  const left = { x: point.x + normal.x * half, y: point.y + normal.y * half };
  const right = { x: point.x - normal.x * half, y: point.y - normal.y * half };

  ctx.save();
  ctx.lineCap = "round";
  ctx.globalAlpha = done ? 0.86 : active ? 0.82 : 0.42;
  ctx.strokeStyle = done ? "rgb(77 176 183 / 90%)" : active ? "rgb(126 156 213 / 72%)" : "rgb(113 132 157 / 42%)";
  ctx.lineWidth = Math.max(5, pathWidth() * 0.055);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();

  ctx.fillStyle = done ? "rgb(255 255 255 / 95%)" : "rgb(255 255 255 / 76%)";
  for (const post of [left, right]) {
    ctx.beginPath();
    ctx.arc(post.x, post.y, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  if (active && gate) {
    const dwellProgress = clamp(gate.dwell * 1000 / session.settings.dwellMs, 0, 1);
    ctx.globalAlpha = 0.76;
    ctx.strokeStyle = "rgb(74 170 177 / 90%)";
    ctx.lineWidth = Math.max(4, pathWidth() * 0.045);
    ctx.beginPath();
    ctx.arc(point.x, point.y, pathWidth() * 0.34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dwellProgress);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLight(ctx: CanvasRenderingContext2D, points: Point[]) {
  const point = pointAtPathProgress(points, visualProgress.value);
  const laneWidth = pathWidth();
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(light.phase * 3) * 0.06;
  const radius = laneWidth * (0.22 + pulse + light.confidence * 0.04 + light.finish * 0.08);

  ctx.save();
  if (light.correction > 0.05 && session.step < session.maxSteps) {
    ctx.globalAlpha = light.correction * 0.62;
    ctx.strokeStyle = "rgb(105 126 174 / 38%)";
    ctx.lineWidth = Math.max(3, laneWidth * 0.035);
    ctx.beginPath();
    ctx.arc(point.x, point.y, laneWidth * 0.72, 0, Math.PI * 2);
    ctx.stroke();
  }

  const glow = ctx.createRadialGradient(point.x, point.y, radius * 0.15, point.x, point.y, radius * 2.9);
  glow.addColorStop(0, "rgb(255 255 255 / 94%)");
  glow.addColorStop(0.42, "rgb(146 220 218 / 46%)");
  glow.addColorStop(1, "rgb(146 220 218 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius * 2.9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(255 255 255 / 96%)";
  ctx.strokeStyle = light.confidence > 0.58 ? "rgb(76 176 184 / 88%)" : "rgb(121 145 179 / 56%)";
  ctx.lineWidth = Math.max(3, laneWidth * 0.04);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const sparkle of sparkles) {
    const alpha = Math.max(0, 1 - sparkle.age / sparkle.life);
    ctx.globalAlpha = alpha * 0.76;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.radius * (0.45 + alpha * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D, points: Point[]) {
  const start = points[0];
  const finish = points[points.length - 1];
  ctx.save();
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgb(70 93 116 / 76%)";
  ctx.fillText("Старт", start.x, start.y - pathWidth() * 0.56);
  ctx.fillText("Финиш", finish.x, finish.y + pathWidth() * 0.56);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D) {
  const points = pathPoints();
  drawBackground(ctx, performance.now());
  drawPath(ctx, points);
  for (let index = 0; index < session.maxSteps; index += 1) drawGate(ctx, points, index);
  drawLight(ctx, points);
  drawSparkles(ctx);
  drawLabels(ctx, points);
}

function resetPath() {
  progress.value = 0;
  visualProgress.value = 0;
  light.confidence = 0;
  light.correction = 0;
  light.finish = 0;
  sparkles.splice(0);
  finishAfter = 0;
  lastHintAt = 0;
  trackingGate = -1;
  resetGates();
}

function restart() {
  resetPath();
  startSession();
}

resetGates();

useGameLoop({
  context,
  update,
  draw: (ctx) => draw(ctx),
  active: computed(() => session.status !== "paused")
});
</script>

<template>
  <div class="gates-path-shell">
    <canvas ref="canvasRef" class="gates-path-canvas" />

    <GameHud title="Дорожка с воротами" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-card class="gates-path-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Непрерывное управление</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="progressPercent" color="primary" height="0.5rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Ворота: {{ session.step }} / {{ session.maxSteps }}</div>
    </v-card>

    <GameResultDialog :model-value="resultVisible" title="Дорожка с воротами" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.gates-path-shell {
  background: #eef8ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.gates-path-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.gates-path-guidance {
  box-shadow: 0 1rem 2.75rem rgb(75 117 143 / 14%);
  inline-size: min(26.875rem, calc(100dvw - 2rem));
  inset-block-start: clamp(6.5rem, 14vh, 9.25rem);
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  opacity: 0.92;
  position: absolute;
  z-index: 4;
}

@media (max-width: 45rem) {
  .gates-path-guidance {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline: 1rem;
    inline-size: auto;
  }
}
</style>
