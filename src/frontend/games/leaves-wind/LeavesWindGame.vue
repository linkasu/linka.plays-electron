<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeLeavesWindAudio, playLeavesWindFlowCue, warmLeavesWindAudio } from "./audio";

type Point = { x: number; y: number };
type Leaf = Point & {
  id: string;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  angle: number;
  spin: number;
  age: number;
  seed: number;
  follow: number;
};
type WindLine = {
  x: number;
  y: number;
  age: number;
  life: number;
  length: number;
  alpha: number;
  drift: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("leaves-wind", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 1500, sessionSeconds: 80, targetScale: 1.5, motionSpeed: 0.42, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const leaves = reactive<Leaf[]>([]);
const windLines = reactive<WindLine[]>([]);
const breeze = reactive<Point>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.54 });
const resultVisible = computed(() => session.status === "finished");

let lastBreeze: Point = { x: breeze.x, y: breeze.y };
let calmFlowSeconds = 0;
let intervalStartedAt = 0;
let windLineTimer = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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

function leafFocus(leaf: Point) {
  return pointer.value.valid ? clamp(1 - Math.hypot(pointer.value.x - leaf.x, pointer.value.y - leaf.y) / 360, 0, 1) : 0;
}

function stepTargetSeconds() {
  return session.settings.sessionSeconds / session.maxSteps;
}

function createLeaf(index: number): Leaf {
  const sizeBase = Math.min(62, Math.max(34, Math.min(width.value, height.value) * 0.055)) * session.settings.targetScale;
  return {
    id: `leaf-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    x: randomRange(width.value * 0.08, width.value * 0.92),
    y: randomRange(height.value * 0.2, height.value * 0.9),
    vx: randomRange(-8, 8),
    vy: randomRange(-5, 5),
    size: sizeBase * randomRange(0.62, 1.1),
    hue: randomRange(36, 78),
    angle: randomRange(0, Math.PI * 2),
    spin: randomRange(-0.24, 0.24),
    age: randomRange(0, Math.PI * 2),
    seed: randomRange(0, Math.PI * 2),
    follow: randomRange(0.52, 0.86)
  };
}

function resetScene() {
  leaves.splice(0);
  windLines.splice(0);
  calmFlowSeconds = 0;
  intervalStartedAt = 0;
  windLineTimer = 0;
  breeze.x = width.value * 0.5;
  breeze.y = height.value * 0.54;
  lastBreeze = { x: breeze.x, y: breeze.y };

  const count = width.value < 720 ? 12 : 18;
  for (let index = 0; index < count; index += 1) leaves.push(createLeaf(index));
}

function recordFlowStart(now: number) {
  intervalStartedAt = now;
  recordEvent("target-enter", {
    targetId: `wind-flow-${session.step + 1}`,
    at: Date.now(),
    dwellMs: stepTargetSeconds() * 1000,
    pointer: copyPointer()
  });
}

function completeFlowStep(now: number) {
  const targetId = `wind-flow-${session.step + 1}`;
  const elapsedMs = intervalStartedAt > 0 ? now - intervalStartedAt : stepTargetSeconds() * 1000;
  recordEvent("target-click", {
    targetId,
    at: Date.now(),
    dwellMs: stepTargetSeconds() * 1000,
    elapsedMs,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId, mode: "ambient-flow" });
  void playLeavesWindFlowCue(session.settings.sound);
  intervalStartedAt = now;
}

function updateBreeze(delta: number) {
  lastBreeze = { x: breeze.x, y: breeze.y };
  const target = pointer.value.valid ? pointer.value : {
    x: width.value * (0.5 + Math.sin(performance.now() * 0.00008) * 0.18),
    y: height.value * (0.56 + Math.cos(performance.now() * 0.00007) * 0.12)
  };
  const smoothing = pointer.value.valid ? 2.2 : 0.36;
  breeze.x += (target.x - breeze.x) * Math.min(1, delta * smoothing);
  breeze.y += (target.y - breeze.y) * Math.min(1, delta * smoothing);
}

function updateProgress(delta: number, now: number) {
  if (session.status !== "running" || !pointer.value.valid || session.step >= session.maxSteps) return;
  if (intervalStartedAt === 0) recordFlowStart(now);

  calmFlowSeconds += delta;
  while (session.step < session.maxSteps && calmFlowSeconds >= (session.step + 1) * stepTargetSeconds()) {
    completeFlowStep(now);
  }
}

function wrapLeaf(leaf: Leaf) {
  const margin = leaf.size * 1.6;
  if (leaf.x < -margin) leaf.x = width.value + margin;
  if (leaf.x > width.value + margin) leaf.x = -margin;
  if (leaf.y < -margin) leaf.y = height.value + margin;
  if (leaf.y > height.value + margin) leaf.y = -margin;
}

function updateLeaves(delta: number, now: number) {
  const windX = (breeze.x - lastBreeze.x) / Math.max(delta, 0.016);
  const windY = (breeze.y - lastBreeze.y) / Math.max(delta, 0.016);
  const ambientX = Math.sin(now * 0.00018) * 18 + 16;
  const ambientY = Math.cos(now * 0.00014) * 8 - 2;

  for (const leaf of leaves) {
    leaf.age += delta;
    const dx = breeze.x - leaf.x;
    const dy = breeze.y - leaf.y;
    const distance = Math.hypot(dx, dy) || 1;
    const pull = clamp(1 - distance / Math.max(width.value, height.value), 0.12, 0.72) * leaf.follow;
    const flutterX = Math.sin(leaf.age * 1.8 + leaf.seed) * 14;
    const flutterY = Math.cos(leaf.age * 1.45 + leaf.seed) * 10;

    leaf.vx += ((dx / distance) * 34 * pull + windX * 0.12 + ambientX + flutterX - leaf.vx) * Math.min(1, delta * 0.78 * session.settings.motionSpeed);
    leaf.vy += ((dy / distance) * 24 * pull + windY * 0.1 + ambientY + flutterY - leaf.vy) * Math.min(1, delta * 0.72 * session.settings.motionSpeed);
    leaf.x += leaf.vx * delta;
    leaf.y += leaf.vy * delta;
    const spinBoost = 1 + leafFocus(leaf) * 1.35;
    leaf.angle += (leaf.spin + leaf.vx * 0.0025 + Math.sin(leaf.age * 1.2 + leaf.seed) * 0.012) * delta * 18 * spinBoost;
    wrapLeaf(leaf);
  }
}

function addWindLine() {
  windLines.push({
    x: breeze.x + randomRange(-110, 110),
    y: breeze.y + randomRange(-84, 84),
    age: 0,
    life: randomRange(1.6, 2.6),
    length: randomRange(72, 150),
    alpha: randomRange(0.12, 0.28),
    drift: randomRange(-18, 18)
  });
  if (windLines.length > 32) windLines.shift();
}

function updateWindLines(delta: number) {
  if (!session.settings.reduceMotion) {
    windLineTimer += delta;
    const interval = 0.28 / session.settings.motionSpeed;
    while (windLineTimer >= interval) {
      addWindLine();
      windLineTimer -= interval;
    }
  }

  for (let index = windLines.length - 1; index >= 0; index -= 1) {
    const line = windLines[index];
    line.age += delta;
    line.x += (28 + line.drift) * delta;
    line.y += Math.sin(line.age * 2.1) * delta * 8;
    if (line.age >= line.life) windLines.splice(index, 1);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#d7eef0");
  sky.addColorStop(0.58, "#edf2cf");
  sky.addColorStop(1, "#d7c88a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const sunX = width.value * 0.82 + Math.sin(now * 0.00008) * 18;
  const sunY = height.value * 0.24;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(width.value, height.value) * 0.44);
  glow.addColorStop(0, "rgb(255 238 172 / 36%)");
  glow.addColorStop(1, "rgb(255 238 172 / 0%)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#81995c";
  for (let index = 0; index < 8; index += 1) {
    const x = width.value * (index / 7);
    const y = height.value * (0.88 + Math.sin(now * 0.0001 + index) * 0.015);
    ctx.beginPath();
    ctx.ellipse(x, y, width.value * 0.18, height.value * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawWindLine(ctx: CanvasRenderingContext2D, line: WindLine) {
  const progress = line.age / line.life;
  const alpha = Math.max(0, 1 - progress) * line.alpha;
  ctx.save();
  ctx.strokeStyle = `rgb(255 255 229 / ${alpha})`;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(line.x - line.length * 0.5, line.y);
  ctx.quadraticCurveTo(line.x, line.y - 18 * Math.sin(progress * Math.PI), line.x + line.length * 0.5, line.y + line.drift * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, leaf: Leaf) {
  const focus = leafFocus(leaf);
  const size = leaf.size * (1 + focus * 0.08);
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.angle);

  const fill = ctx.createLinearGradient(-size * 0.68, -size * 0.34, size * 0.72, size * 0.38);
  fill.addColorStop(0, `hsl(${leaf.hue + 18}, 72%, ${68 + focus * 10}%)`);
  fill.addColorStop(0.58, `hsl(${leaf.hue}, 62%, ${48 + focus * 8}%)`);
  fill.addColorStop(1, `hsl(${leaf.hue - 18}, 58%, 36%)`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-size * 0.72, 0);
  ctx.bezierCurveTo(-size * 0.26, -size * 0.52, size * 0.5, -size * 0.38, size * 0.78, 0);
  ctx.bezierCurveTo(size * 0.35, size * 0.48, -size * 0.36, size * 0.46, -size * 0.72, 0);
  ctx.fill();

  ctx.globalAlpha = 0.3 + focus * 0.25;
  ctx.strokeStyle = `hsl(${leaf.hue + 28}, 72%, 82%)`;
  ctx.lineWidth = Math.max(1.6, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(-size * 0.58, 0);
  ctx.quadraticCurveTo(-size * 0.1, -size * 0.05, size * 0.58, 0.02 * size);
  ctx.stroke();
  ctx.restore();
}

function drawBreeze(ctx: CanvasRenderingContext2D) {
  const radius = Math.min(210, Math.max(118, Math.min(width.value, height.value) * 0.18)) * session.settings.targetScale;
  const gradient = ctx.createRadialGradient(breeze.x, breeze.y, 0, breeze.x, breeze.y, radius);
  gradient.addColorStop(0, pointer.value.valid ? "rgb(255 250 208 / 28%)" : "rgb(255 250 208 / 14%)");
  gradient.addColorStop(1, "rgb(255 250 208 / 0%)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(breeze.x, breeze.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawBreeze(ctx);
  for (const line of windLines) drawWindLine(ctx, line);
  for (const leaf of leaves) drawLeaf(ctx, leaf);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status !== "running") return;
  updateBreeze(delta);
  updateProgress(delta, now);
  updateLeaves(delta, now);
  updateWindLines(delta);
}

function restart() {
  startSession();
  resetScene();
}

onMounted(() => {
  resetScene();
  warmLeavesWindAudio(session.settings.sound);
});

onUnmounted(() => {
  disposeLeavesWindAudio();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="leaves-wind-shell">
    <canvas ref="canvasRef" class="leaves-wind-canvas" />

    <v-card class="leaves-wind-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Веди взгляд по ветру: листья подхватят движение.</div>
      <div class="text-caption text-medium-emphasis">Здесь нет проигрыша, только слежение взглядом и отдых.</div>
    </v-card>

    <GameHud
      title="Листья на ветру"
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
      title="Листья на ветру"
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
.leaves-wind-shell {
  background: #d7eef0;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.leaves-wind-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.leaves-wind-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 560px;
  opacity: 0.78;
  position: absolute;
  z-index: 3;
}
</style>
