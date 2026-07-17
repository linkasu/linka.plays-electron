<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { createDwellMachineState } from "../../core/dwellStateMachine";
import type { DwellCancelReason } from "../../core/gaze";
import { resolveMenuRoute } from "../../core/menuMode";
import { advanceMovingTargetDwell } from "../../core/movingTarget";
import { disposeLeavesWindAudio, playLeavesWindFlowCue, warmLeavesWindAudio } from "./audio";
import {
  advanceLeavesWindTarget,
  clampLeavesWindPoint,
  isLeavesWindGazeInput,
  isLeavesWindTargetHit,
  leavesWindMotionPoint,
  leavesWindSceneBounds,
  leavesWindTargetBounds,
  leavesWindTargetPoint,
  leavesWindTargetRadius,
  type LeavesWindPoint
} from "./model";

type Leaf = LeavesWindPoint & {
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
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "leaves-wind", soundEnabled: toRef(session.settings, "sound") });

const leaves = reactive<Leaf[]>([]);
const windLines = reactive<WindLine[]>([]);
const breeze = reactive<LeavesWindPoint>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.54 });
const targetAnchor = reactive<LeavesWindPoint>({ x: breeze.x, y: breeze.y });
const resultVisible = computed(() => session.status === "finished");

let lastBreeze: LeavesWindPoint = { x: breeze.x, y: breeze.y };
let activeLeafIndex = 0;
let targetActivatedAt = 0;
let dwellState = createDwellMachineState();
let dwellProgress = 0;
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

function activeLeaf() {
  return leaves[activeLeafIndex];
}

function flowRadius() {
  return leavesWindTargetRadius(width.value, height.value, session.settings.targetScale);
}

function flowBounds() {
  return leavesWindTargetBounds(width.value, height.value, flowRadius());
}

function leafFocus(leaf: Leaf) {
  if (leaf !== activeLeaf() || !pointer.value.valid) return 0;
  return clamp(1 - Math.hypot(pointer.value.x - leaf.x, pointer.value.y - leaf.y) / flowRadius(), 0, 1);
}

function createLeaf(index: number): Leaf {
  const scene = leavesWindSceneBounds(width.value, height.value);
  const sizeBase = Math.min(62, Math.max(34, Math.min(width.value, height.value) * 0.055)) * session.settings.targetScale;
  return {
    id: `leaf-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    x: randomRange(scene.left, scene.right),
    y: randomRange(scene.top, scene.bottom),
    vx: randomRange(-8, 8),
    vy: randomRange(-5, 5),
    size: sizeBase * randomRange(0.78, 1.1),
    hue: randomRange(36, 78),
    angle: randomRange(0, Math.PI * 2),
    spin: randomRange(-0.24, 0.24),
    age: randomRange(0, Math.PI * 2),
    seed: randomRange(0, Math.PI * 2),
    follow: randomRange(0.52, 0.86)
  };
}

function activateLeaf(sequence: number) {
  const leaf = leaves[Math.abs(sequence) % leaves.length];
  if (!leaf) return;

  activeLeafIndex = Math.abs(sequence) % leaves.length;
  const anchor = leavesWindTargetPoint(flowBounds(), sequence);
  targetAnchor.x = anchor.x;
  targetAnchor.y = anchor.y;
  leaf.x = anchor.x;
  leaf.y = anchor.y;
  leaf.vx = 0;
  leaf.vy = 0;
  breeze.x = anchor.x;
  breeze.y = anchor.y;
  lastBreeze = { ...anchor };
  targetActivatedAt = performance.now();
  dwellState = createDwellMachineState();
  dwellProgress = 0;
}

function resetScene() {
  leaves.splice(0);
  windLines.splice(0);
  windLineTimer = 0;

  const count = width.value < 720 ? 12 : 18;
  for (let index = 0; index < count; index += 1) leaves.push(createLeaf(index));
  activateLeaf(0);
}

function targetPayload(leaf: Leaf, progress: number, reason?: DwellCancelReason, elapsedMs = Math.round(progress * session.settings.dwellMs)) {
  return {
    targetId: leaf.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function completeActiveLeaf(inputMode: "gaze-dwell" | "mouse-click") {
  if (session.status !== "running") return;
  const leaf = activeLeaf();
  if (!leaf) return;

  recordEvent("target-click", {
    ...targetPayload(leaf, 1, undefined, inputMode === "gaze-dwell" ? session.settings.dwellMs : 0),
    inputMode
  });
  recordSuccess({ targetId: leaf.id, mode: inputMode });
  void playLeavesWindFlowCue(session.settings.sound);
  dwellState = createDwellMachineState();
  dwellProgress = 0;
  if (session.status === "running") activateLeaf(session.step);
}

function updateBreeze(delta: number, now: number) {
  const leaf = activeLeaf();
  if (!leaf) return;

  lastBreeze = { x: breeze.x, y: breeze.y };
  const bounds = flowBounds();
  const destination = session.settings.reduceMotion
    ? targetAnchor
    : leavesWindMotionPoint(targetAnchor, bounds, (now - targetActivatedAt) / 1000, session.step);
  const next = advanceLeavesWindTarget({
    current: leaf,
    destination,
    bounds,
    deltaSeconds: delta,
    motionSpeed: session.settings.motionSpeed,
    reduceMotion: session.settings.reduceMotion
  });
  leaf.x = next.x;
  leaf.y = next.y;
  breeze.x = next.x;
  breeze.y = next.y;
}

function updateTargetDwell(now: number) {
  const leaf = activeLeaf();
  if (session.status !== "running" || !leaf) return;

  const previousProgress = dwellProgress;
  const result = advanceMovingTargetDwell(dwellState, {
    now,
    pointer: { ...pointer.value, valid: isLeavesWindGazeInput(pointer.value) },
    targets: [leaf],
    point: (target) => target,
    hitRadius: () => flowRadius(),
    dwellMs: session.settings.dwellMs
  });
  dwellState = result.state;
  dwellProgress = result.progress;

  for (const event of result.events) {
    if (event.type === "enter") recordEvent("target-enter", targetPayload(leaf, 0));
    if (event.type === "cancel") recordEvent("target-cancel", targetPayload(leaf, previousProgress, event.reason));
    if (event.type === "select") {
      completeActiveLeaf("gaze-dwell");
      return;
    }
  }
}

function keepLeafInScene(leaf: Leaf) {
  const scene = leavesWindSceneBounds(width.value, height.value);
  const margin = Math.min(leaf.size * 0.82, (scene.bottom - scene.top) * 0.24);
  const next = clampLeavesWindPoint(leaf, {
    left: scene.left + margin,
    top: scene.top + margin,
    right: scene.right - margin,
    bottom: scene.bottom - margin
  });
  if (next.x !== leaf.x) leaf.vx *= -0.45;
  if (next.y !== leaf.y) leaf.vy *= -0.45;
  leaf.x = next.x;
  leaf.y = next.y;
}

function updateLeaves(delta: number, now: number) {
  const windX = (breeze.x - lastBreeze.x) / Math.max(delta, 0.016);
  const windY = (breeze.y - lastBreeze.y) / Math.max(delta, 0.016);
  const ambientX = Math.sin(now * 0.00018) * 18 + 16;
  const ambientY = Math.cos(now * 0.00014) * 8 - 2;

  for (const leaf of leaves) {
    if (leaf === activeLeaf()) {
      if (!session.settings.reduceMotion) {
        leaf.age += delta;
        leaf.angle += leaf.spin * delta * 3.6 * session.settings.motionSpeed;
      }
      continue;
    }
    if (session.settings.reduceMotion) {
      leaf.vx = 0;
      leaf.vy = 0;
      keepLeafInScene(leaf);
      continue;
    }

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
    keepLeafInScene(leaf);
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
  if (session.settings.reduceMotion) {
    windLines.splice(0);
    windLineTimer = 0;
    return;
  }

  windLineTimer += delta;
  const interval = 0.28 / session.settings.motionSpeed;
  while (windLineTimer >= interval) {
    addWindLine();
    windLineTimer -= interval;
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
  const isActive = leaf === activeLeaf();
  const focus = leafFocus(leaf);
  const scaledSize = leaf.size * (isActive ? 1.08 : 0.9) * (1 + focus * 0.08 + (isActive ? dwellProgress * 0.08 : 0));
  const size = isActive ? Math.max(scaledSize, flowRadius() * 0.34) : scaledSize;
  ctx.save();
  ctx.translate(leaf.x, leaf.y);
  ctx.rotate(leaf.angle);
  if (isActive) {
    ctx.shadowColor = "rgb(255 244 174 / 72%)";
    ctx.shadowBlur = size * 0.52;
  }

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
  if (isActive) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgb(255 251 218 / 92%)";
    ctx.lineWidth = Math.max(3, size * 0.07);
    ctx.stroke();
  }

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
  const leaf = activeLeaf();
  if (!leaf) return;
  const radius = flowRadius();
  const isEngaged = pointer.value.valid && isLeavesWindTargetHit(pointer.value, leaf, radius);
  const gradient = ctx.createRadialGradient(breeze.x, breeze.y, 0, breeze.x, breeze.y, radius);
  gradient.addColorStop(0, isEngaged ? "rgb(255 250 208 / 42%)" : "rgb(255 250 208 / 24%)");
  gradient.addColorStop(1, "rgb(255 250 208 / 0%)");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(breeze.x, breeze.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isEngaged ? "rgb(255 248 205 / 72%)" : "rgb(255 248 205 / 42%)";
  ctx.lineWidth = Math.max(3, radius * 0.025);
  ctx.setLineDash([radius * 0.12, radius * 0.08]);
  ctx.stroke();
  ctx.restore();
}

function drawDwellProgress(ctx: CanvasRenderingContext2D) {
  const leaf = activeLeaf();
  if (!leaf || dwellProgress <= 0) return;
  const radius = flowRadius() * 0.72;
  ctx.save();
  ctx.strokeStyle = "rgb(255 255 235 / 92%)";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(6, radius * 0.075);
  ctx.beginPath();
  ctx.arc(leaf.x, leaf.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dwellProgress);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  const visualNow = session.settings.reduceMotion ? 0 : now;
  drawBackground(ctx, visualNow);
  drawBreeze(ctx);
  for (const line of windLines) drawWindLine(ctx, line);
  const target = activeLeaf();
  for (const leaf of leaves) {
    if (leaf !== target) drawLeaf(ctx, leaf);
  }
  if (target) drawLeaf(ctx, target);
  drawDwellProgress(ctx);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status !== "running") return;
  updateBreeze(delta, now);
  updateTargetDwell(now);
  updateLeaves(delta, now);
  updateWindLines(delta);
}

function onCanvasClick(event: MouseEvent) {
  if (session.status !== "running") return;
  const canvas = canvasRef.value;
  const leaf = activeLeaf();
  if (!canvas || !leaf) return;
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) * width.value / rect.width,
    y: (event.clientY - rect.top) * height.value / rect.height
  };
  if (isLeavesWindTargetHit(point, leaf, flowRadius())) completeActiveLeaf("mouse-click");
}

function pause() {
  const leaf = activeLeaf();
  if (leaf && dwellState.targetId) recordEvent("target-cancel", targetPayload(leaf, dwellProgress, "disabled"));
  dwellState = createDwellMachineState();
  dwellProgress = 0;
  pauseSession();
}

function resume() {
  targetActivatedAt = performance.now();
  resumeSession();
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
    <canvas ref="canvasRef" class="leaves-wind-canvas" aria-label="Следи за светящимся листом в потоке ветра" @click="onCanvasClick" />

    <v-card class="leaves-wind-hint px-4 py-3 text-on-surface" color="surface" rounded="xl" variant="flat">
      <div class="text-body-2 font-weight-medium">Следи за светящимся листом и удерживай взгляд внутри потока.</div>
      <div class="text-caption text-medium-emphasis">Можно также нажать на тот же лист мышью.</div>
    </v-card>

    <GameHud
      title="Подмети двор"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      @pause="pause"
      @resume="resume"
    />

    <GameResultDialog
      :model-value="resultVisible"
      title="Подмети двор"
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
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.leaves-wind-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.leaves-wind-hint {
  inset-block-end: max(1.125rem, env(safe-area-inset-bottom));
  inset-inline: 1.125rem;
  margin-inline: auto;
  max-inline-size: 35rem;
  opacity: 0.92;
  position: absolute;
  z-index: 3;
}
</style>
