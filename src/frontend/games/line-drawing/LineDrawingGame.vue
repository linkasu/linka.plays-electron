<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { drawingLevelAt, drawingLevels } from "./model";

type Point = { x: number; y: number };
type TrailPoint = Point;
type DrawingDot = Point & {
  id: string;
  index: number;
  radius: number;
  hue: number;
  completed: boolean;
  enteredAt?: number;
  dwellProgress: number;
  bloom: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("line-drawing", {
  maxSteps: drawingLevels.length,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.5, motionSpeed: 0.52, distractors: "none", hints: "high", sound: false },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const dots = reactive<DrawingDot[]>([]);
const trail = reactive<TrailPoint[]>([]);
const brush = reactive<Point>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.54 });
const levelIndex = ref(0);
const resultVisible = computed(() => session.status === "finished");
const currentLevel = computed(() => drawingLevelAt(levelIndex.value));
const completedDots = computed(() => dots.filter((dot) => dot.completed).length);
const progressPercent = computed(() => dots.length === 0 ? 0 : Math.round(completedDots.value / dots.length * 100));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Линия останется на месте.";
  if (!pointer.value.valid) return "Можно рисовать взглядом или мышью. Кисть ждёт движения.";
  const nextDot = dots.find((dot) => !dot.completed);
  if (nextDot?.dwellProgress) return "Оставайся в большой точке, чтобы закрепить шаг.";
  return currentLevel.value.prompt;
});

const dotHues = [205, 184, 162, 128, 45, 25, 315, 266, 18, 342, 92, 235, 278];
let finishDelayRemainingMs = 0;
let levelDelayRemainingMs = 0;
const canvasFontUnit = String.fromCharCode(112, 120);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function dotRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.12;
  return Math.min(116, Math.max(74, Math.min(viewportLimit, 62 * session.settings.targetScale)));
}

function drawingArea() {
  const top = Math.max(132, height.value * 0.18);
  const bottom = height.value - Math.max(72, height.value * 0.09);
  const side = Math.max(72, width.value * 0.12);
  return {
    left: side,
    right: width.value - side,
    top,
    bottom,
    centerX: width.value * 0.5,
    width: width.value - side * 2,
    height: bottom - top
  };
}

function dotPoint(index: number): Point {
  const area = drawingArea();
  const template = currentLevel.value.points[index] ?? currentLevel.value.points.at(-1) ?? { x: 0.5, y: 0.5 };
  return { x: area.left + area.width * template.x, y: area.top + area.height * template.y };
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

function targetPayload(dot: DrawingDot, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: dot.id,
    checkpoint: dot.index + 1,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: dot.enteredAt === undefined ? 0 : Math.round(now - dot.enteredAt),
    progress,
    pointer: copyPointer(),
    reason
  };
}

function createDots() {
  dots.splice(0);
  const radius = dotRadius();

  for (let index = 0; index < currentLevel.value.points.length; index += 1) {
    const point = dotPoint(index);
    dots.push({
      id: `line-dot-${Date.now()}-${index}`,
      index,
      x: point.x,
      y: point.y,
      radius,
      hue: dotHues[index % dotHues.length],
      completed: false,
      dwellProgress: 0,
      bloom: 0
    });
  }
}

function resetDrawing() {
  trail.splice(0);
  finishDelayRemainingMs = 0;
  levelDelayRemainingMs = 0;
  brush.x = width.value * 0.5;
  brush.y = height.value * 0.54;
  createDots();
}

function resetAllLevels() {
  levelIndex.value = 0;
  resetDrawing();
}

function updateBrush(delta: number) {
  const target = pointer.value.valid ? pointer.value : { x: width.value * 0.5, y: height.value * 0.54 };
  const smoothing = pointer.value.valid ? 8.5 : 1.35;
  brush.x += (target.x - brush.x) * Math.min(1, delta * smoothing);
  brush.y += (target.y - brush.y) * Math.min(1, delta * smoothing);
}

function addTrailPoint() {
  if (!pointer.value.valid || session.status !== "running") return;

  const lastPoint = trail[trail.length - 1];
  if (!lastPoint || distance(lastPoint, brush) >= Math.max(5, 10 / session.settings.motionSpeed)) {
    trail.push({ x: brush.x, y: brush.y });
  }
  while (trail.length > 620) trail.shift();
}

function completeDot(dot: DrawingDot, now: number) {
  dot.completed = true;
  dot.enteredAt = undefined;
  dot.dwellProgress = 1;
  dot.bloom = 1;
  recordEvent("target-click", targetPayload(dot, now, 1));

  if (dots.every((item) => item.completed) && levelDelayRemainingMs === 0 && finishDelayRemainingMs === 0) {
    recordSuccess({ targetId: dot.id, checkpoint: dot.index + 1, levelId: currentLevel.value.id, levelTitle: currentLevel.value.title, points: dots.length });
    if (levelIndex.value >= drawingLevels.length - 1) finishDelayRemainingMs = 1200;
    else levelDelayRemainingMs = 900;
  }
}

function cancelDot(dot: DrawingDot, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(dot, now, dot.dwellProgress, reason));
  dot.enteredAt = undefined;
  dot.dwellProgress = 0;
}

function updateDots(delta: number, now: number) {
  const nextDot = dots.find((dot) => !dot.completed);
  const activeDot = nextDot && pointer.value.valid && distance(brush, nextDot) <= nextDot.radius ? nextDot : undefined;

  for (const dot of dots) {
    if (dot.bloom > 0) dot.bloom = Math.max(0, dot.bloom - delta * 1.5);
    if (dot.completed) continue;

    if (dot !== activeDot) {
      if (dot.enteredAt !== undefined) cancelDot(dot, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (dot.enteredAt === undefined) {
      dot.enteredAt = now;
      recordEvent("target-enter", targetPayload(dot, now, 0));
    }

    dot.dwellProgress = Math.min(1, (now - dot.enteredAt) / session.settings.dwellMs);
    if (dot.dwellProgress >= 1) completeDot(dot, now);
  }

  if (levelDelayRemainingMs > 0) {
    levelDelayRemainingMs = Math.max(0, levelDelayRemainingMs - delta * 1000);
    if (levelDelayRemainingMs === 0) {
      levelIndex.value += 1;
      resetDrawing();
    }
  } else if (finishDelayRemainingMs > 0) {
    finishDelayRemainingMs = Math.max(0, finishDelayRemainingMs - delta * 1000);
    if (finishDelayRemainingMs === 0) finishSession("game-complete");
  }
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateBrush(delta);
    addTrailPoint();
    updateDots(delta, now);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const paper = ctx.createLinearGradient(0, 0, width.value, height.value);
  paper.addColorStop(0, "#f7fbff");
  paper.addColorStop(0.5, "#f7f5ff");
  paper.addColorStop(1, "#fff8ec");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "#c8d7e5";
  ctx.lineWidth = 1;
  const gap = Math.max(38, Math.min(64, width.value * 0.06));
  for (let x = -gap; x < width.value + gap; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(now * 0.00008 + x) * 4, height.value * 0.16);
    ctx.lineTo(x + Math.sin(now * 0.00008 + x) * 4, height.value);
    ctx.stroke();
  }
  for (let y = Math.max(126, height.value * 0.18); y < height.value; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.cos(now * 0.00007 + y) * 3);
    ctx.lineTo(width.value, y + Math.cos(now * 0.00007 + y) * 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuide(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([10, 18]);
  ctx.strokeStyle = "rgb(110 136 170 / 22%)";
  ctx.lineWidth = Math.max(4, dotRadius() * 0.06);
  ctx.beginPath();
  dots.forEach((dot, index) => {
    if (index === 0) ctx.moveTo(dot.x, dot.y);
    else {
      const previous = dots[index - 1];
      const midX = (previous.x + dot.x) * 0.5;
      const midY = (previous.y + dot.y) * 0.5;
      ctx.quadraticCurveTo(midX, midY, dot.x, dot.y);
    }
  });
  if (currentLevel.value.closed && dots.length > 2) {
    const first = dots[0];
    const last = dots[dots.length - 1];
    const midX = (first.x + last.x) * 0.5;
    const midY = (first.y + last.y) * 0.5;
    ctx.quadraticCurveTo(midX, midY, first.x, first.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D) {
  if (trail.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgb(119 174 224 / 18%)";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let index = 1; index < trail.length; index += 1) ctx.lineTo(trail[index].x, trail[index].y);
  ctx.stroke();

  const line = ctx.createLinearGradient(0, 0, width.value, height.value);
  line.addColorStop(0, "rgb(81 179 212 / 82%)");
  line.addColorStop(0.45, "rgb(126 156 232 / 78%)");
  line.addColorStop(1, "rgb(238 154 177 / 74%)");
  ctx.strokeStyle = line;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(trail[0].x, trail[0].y);
  for (let index = 1; index < trail.length; index += 1) {
    const previous = trail[index - 1];
    const point = trail[index];
    ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + point.x) * 0.5, (previous.y + point.y) * 0.5);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgb(255 255 255 / 42%)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, dot: DrawingDot, now: number) {
  const pulse = Math.sin(now * 0.003 + dot.index) * 0.04;
  const radius = dot.radius * (1 + pulse + dot.bloom * 0.08);
  const progressRadius = dot.radius * (0.46 + dot.dwellProgress * 0.38);

  ctx.save();
  const glow = ctx.createRadialGradient(dot.x, dot.y, radius * 0.2, dot.x, dot.y, radius * 1.65);
  glow.addColorStop(0, `hsl(${dot.hue}, 78%, 86%)`);
  glow.addColorStop(1, `hsla(${dot.hue}, 82%, 72%, 0)`);
  ctx.globalAlpha = dot.completed ? 0.42 : 0.72;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, radius * 1.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = dot.completed ? `hsl(${dot.hue}, 50%, 86%)` : "rgb(255 255 255 / 86%)";
  ctx.strokeStyle = dot.completed ? `hsl(${dot.hue}, 52%, 58%)` : `hsl(${dot.hue}, 60%, 66%)`;
  ctx.lineWidth = Math.max(4, dot.radius * 0.055);
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!dot.completed && dot.dwellProgress > 0) {
    ctx.strokeStyle = `hsl(${dot.hue}, 76%, 48%)`;
    ctx.lineWidth = Math.max(6, dot.radius * 0.08);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, progressRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dot.dwellProgress);
    ctx.stroke();
  }

  ctx.fillStyle = dot.completed ? `hsl(${dot.hue}, 58%, 46%)` : `hsl(${dot.hue}, 62%, 52%)`;
  ctx.font = `700 ${Math.max(18, dot.radius * 0.3)}${canvasFontUnit} system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(dot.completed ? "✓" : String(dot.index + 1), dot.x, dot.y + 1);
  ctx.restore();
}

function drawBrush(ctx: CanvasRenderingContext2D) {
  const active = pointer.value.valid && session.status === "running";
  const radius = Math.max(22, dotRadius() * 0.34);

  ctx.save();
  ctx.globalAlpha = active ? 0.95 : 0.45;
  const glow = ctx.createRadialGradient(brush.x, brush.y, radius * 0.1, brush.x, brush.y, radius * 2.2);
  glow.addColorStop(0, "rgb(255 255 255 / 86%)");
  glow.addColorStop(0.46, "rgb(126 193 225 / 36%)");
  glow.addColorStop(1, "rgb(126 193 225 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(brush.x, brush.y, radius * 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = active ? "#ffffff" : "#eef3f7";
  ctx.strokeStyle = active ? "#5db8d5" : "#9aaaba";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(brush.x, brush.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawLevelTitle(ctx);
  drawGuide(ctx);
  drawTrail(ctx);
  for (const dot of dots) drawDot(ctx, dot, now);
  drawBrush(ctx);
}

function drawLevelTitle(ctx: CanvasRenderingContext2D) {
  const fontSize = Math.max(17, Math.min(width.value, height.value) * 0.028);
  const x = Math.max(34, width.value * 0.045);
  const y = Math.max(78, height.value * 0.12);
  ctx.save();
  ctx.fillStyle = "rgb(54 70 92 / 74%)";
  ctx.strokeStyle = "rgb(255 255 255 / 24%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - fontSize * 0.8, y - fontSize * 1.35, fontSize * 17.4, fontSize * 3.3, fontSize * 0.65);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#fbfdff";
  ctx.font = `800 ${fontSize}${canvasFontUnit} Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Уровень ${levelIndex.value + 1}/${drawingLevels.length}: ${currentLevel.value.title}`, x, y - fontSize * 0.35);
  ctx.fillStyle = "#dceaff";
  ctx.font = `650 ${Math.max(13, fontSize * 0.72)}${canvasFontUnit} Roboto, sans-serif`;
  ctx.fillText(`Точки: ${completedDots.value}/${dots.length}`, x, y + fontSize * 0.85);
  ctx.restore();
}

function restart() {
  resetAllLevels();
  startSession();
}

onMounted(() => {
  resetAllLevels();
});

onUnmounted(() => {
  trail.splice(0);
  dots.splice(0);
  finishDelayRemainingMs = 0;
  levelDelayRemainingMs = 0;
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="line-drawing-shell">
    <canvas ref="canvasRef" class="line-drawing-canvas" />

    <GameHud
      title="Рисование линией"
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

    <v-card class="line-drawing-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Рисование взглядом</div>
      <div class="text-caption text-medium-emphasis mb-1">{{ currentLevel.title }}</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="progressPercent" color="primary" height="0.5rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Уровень: {{ session.step }} / {{ session.maxSteps }} · Точки: {{ completedDots }} / {{ dots.length }}</div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Рисование линией"
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
.line-drawing-shell {
  background: #f7fbff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.line-drawing-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.line-drawing-guidance {
  box-shadow: 0 1rem 2.75rem rgb(91 121 154 / 14%);
  inline-size: min(26.875rem, calc(100dvw - 2rem));
  inset-block-start: clamp(6.5rem, 14vh, 9.25rem);
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  opacity: 0.92;
  position: absolute;
  z-index: 4;
}

@media (max-width: 45rem) {
 .line-drawing-guidance {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline: 1rem;
    inline-size: auto;
  }
}
</style>
