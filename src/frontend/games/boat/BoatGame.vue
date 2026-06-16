<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = {
  x: number;
  y: number;
};

type Boat = Point & {
  phase: number;
  glow: number;
};

type Checkpoint = Point & {
  id: string;
  radius: number;
  speed: number;
  phase: number;
  entered: boolean;
  enteredAt?: number;
};

type Decoration = Point & {
  kind: "island" | "buoy" | "reeds";
  size: number;
  speed: number;
  phase: number;
};

type Ripple = Point & {
  age: number;
  life: number;
  radius: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("boat", {
  maxSteps: 7,
  overrides: { preset: "gentle", dwellMs: 500, sessionSeconds: 135, targetScale: 1.35, motionSpeed: 0.62, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const boat = reactive<Boat>({ x: window.innerWidth * 0.26, y: window.innerHeight * 0.56, phase: 0, glow: 0 });
const checkpoint = reactive<Checkpoint>({ id: "checkpoint-0", x: window.innerWidth * 0.78, y: window.innerHeight * 0.5, radius: 120, speed: 48, phase: 0, entered: false });
const decorations = reactive<Decoration[]>([]);
const ripples = reactive<Ripple[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let checkpointSequence = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
  syncGeometry();
}

function riverTop() {
  return Math.max(126, window.innerHeight * 0.19);
}

function riverBottom() {
  return window.innerHeight - Math.max(62, window.innerHeight * 0.09);
}

function riverCenterY() {
  return riverTop() + (riverBottom() - riverTop()) / 2;
}

function boatSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.17;
  return Math.min(132, Math.max(78, Math.min(viewportLimit, 82 * session.settings.targetScale)));
}

function checkpointRadius() {
  return Math.min(148, Math.max(96, 84 * session.settings.targetScale));
}

function boatPoint() {
  return { x: boat.x, y: boat.y + Math.sin(boat.phase) * boatSize() * 0.035 };
}

function safeRiverY(size = boatSize()) {
  return clamp(randomRange(riverTop() + size * 0.68, riverBottom() - size * 0.68), riverTop() + size * 0.52, riverBottom() - size * 0.52);
}

function syncGeometry() {
  boat.x = clamp(window.innerWidth * 0.26, 120, Math.max(140, window.innerWidth * 0.34));
  boat.y = clamp(boat.y, riverTop() + boatSize() * 0.55, riverBottom() - boatSize() * 0.55);
  checkpoint.radius = checkpointRadius();
  checkpoint.y = clamp(checkpoint.y, riverTop() + checkpoint.radius * 0.5, riverBottom() - checkpoint.radius * 0.5);
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

function targetPayload(progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: checkpoint.id,
    at: Date.now(),
    dwellMs: 0,
    elapsedMs: checkpoint.enteredAt === undefined ? 0 : now - checkpoint.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function checkpointSpeed() {
  return randomRange(68, 82) * session.settings.motionSpeed;
}

function resetCheckpoint(fromRight = true) {
  checkpointSequence += 1;
  checkpoint.id = `checkpoint-${Date.now()}-${checkpointSequence}`;
  checkpoint.radius = checkpointRadius();
  checkpoint.x = fromRight ? window.innerWidth + checkpoint.radius + randomRange(80, 190) : window.innerWidth * randomRange(0.64, 0.82);
  checkpoint.y = safeRiverY(checkpoint.radius);
  checkpoint.speed = checkpointSpeed();
  checkpoint.phase = randomRange(0, Math.PI * 2);
  checkpoint.entered = false;
  checkpoint.enteredAt = undefined;
}

function addRipple(x: number, y: number, radius: number) {
  ripples.push({ x, y, radius, age: 0, life: 1.35 });
  if (ripples.length > 10) ripples.shift();
}

function createDecoration(index: number): Decoration {
  const kind = index % 5 === 0 ? "island" : index % 3 === 0 ? "reeds" : "buoy";
  const size = kind === "island" ? randomRange(58, 96) : kind === "reeds" ? randomRange(38, 62) : randomRange(22, 34);
  return {
    kind,
    size,
    x: randomRange(0, window.innerWidth),
    y: safeRiverY(size),
    speed: randomRange(18, 34),
    phase: randomRange(0, Math.PI * 2)
  };
}

function initDecorations() {
  decorations.splice(0);
  const count = window.innerWidth < 760 ? 8 : 12;
  for (let index = 0; index < count; index++) decorations.push(createDecoration(index));
}

function restart() {
  startSession();
  ripples.splice(0);
  checkpointSequence = 0;
  boat.y = riverCenterY();
  resetCheckpoint(false);
  initDecorations();
}

function updateBoat(delta: number) {
  const targetY = pointer.value.valid ? pointer.value.y : riverCenterY() + Math.sin(boat.phase * 0.48) * 18;
  const clampedTarget = clamp(targetY, riverTop() + boatSize() * 0.55, riverBottom() - boatSize() * 0.55);
  const diff = clampedTarget - boat.y;
  const easedStep = diff * Math.min(1, delta * 2.35);
  const maxStep = delta * 260;
  boat.y += clamp(easedStep, -maxStep, maxStep);
  boat.phase += delta * (session.settings.reduceMotion ? 1.1 : 2.2);
}

function updateCheckpoint(delta: number, now: number) {
  checkpoint.x -= checkpoint.speed * delta;
  checkpoint.phase += delta * 1.6;
  checkpoint.y += Math.sin(checkpoint.phase) * delta * 6;
  checkpoint.y = clamp(checkpoint.y, riverTop() + checkpoint.radius * 0.5, riverBottom() - checkpoint.radius * 0.5);

  const boatPosition = boatPoint();
  const gap = distance(boatPosition, checkpoint);
  const enterDistance = checkpoint.radius * 1.34;
  const successDistance = checkpoint.radius * 0.78;
  const progress = Math.max(0, 1 - gap / enterDistance);
  boat.glow += (progress - boat.glow) * Math.min(1, delta * 4.2);

  if (!checkpoint.entered && gap <= enterDistance) {
    checkpoint.entered = true;
    checkpoint.enteredAt = now;
    recordEvent("target-enter", targetPayload(progress, now));
  }

  if (gap <= successDistance) {
    recordEvent("target-click", targetPayload(1, now));
    recordSuccess({ targetId: checkpoint.id, checkpoint: session.step + 1 });
    addRipple(checkpoint.x, checkpoint.y, checkpoint.radius * 0.72);
    if (session.status === "running") resetCheckpoint(true);
    return;
  }

  if (checkpoint.x < boat.x - checkpoint.radius * 1.8) {
    if (checkpoint.entered) recordEvent("target-cancel", targetPayload(progress, now, pointer.value.valid ? "left" : "invalid-gaze"));
    resetCheckpoint(true);
  }
}

function updateDecorations(delta: number) {
  for (const decoration of decorations) {
    decoration.x -= decoration.speed * session.settings.motionSpeed * delta;
    decoration.phase += delta * 1.3;
    if (decoration.x < -decoration.size * 2) {
      decoration.x = window.innerWidth + randomRange(40, 260);
      decoration.y = safeRiverY(decoration.size);
    }
  }
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index--) {
    const ripple = ripples[index];
    ripple.age += delta;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  syncGeometry();
  if (session.status !== "running") return;
  updateBoat(delta);
  updateCheckpoint(delta, now);
  updateDecorations(delta);
  updateRipples(delta);
}

function drawRiver(context: CanvasRenderingContext2D) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const top = riverTop();
  const bottom = riverBottom();
  const riverGradient = context.createLinearGradient(0, top, 0, bottom);
  riverGradient.addColorStop(0, "#a7dff2");
  riverGradient.addColorStop(0.48, "#5ab5d1");
  riverGradient.addColorStop(1, "#2f88b2");

  context.fillStyle = "#e5f3dd";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#d1e9be";
  context.fillRect(0, 0, width, top + 18);
  context.fillStyle = "#c8e1b3";
  context.fillRect(0, bottom - 10, width, height - bottom + 10);

  context.beginPath();
  context.moveTo(0, top + 18);
  context.bezierCurveTo(width * 0.24, top - 14, width * 0.62, top + 28, width, top + 8);
  context.lineTo(width, bottom - 10);
  context.bezierCurveTo(width * 0.7, bottom + 28, width * 0.26, bottom - 34, 0, bottom + 6);
  context.closePath();
  context.fillStyle = riverGradient;
  context.fill();

  context.strokeStyle = "rgb(255 255 255 / 30%)";
  context.lineWidth = 2;
  for (let index = 0; index < 5; index++) {
    const y = top + (bottom - top) * (0.18 + index * 0.16);
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(width * 0.28, y - 12, width * 0.54, y + 14, width, y - 5);
    context.stroke();
  }
}

function drawDecoration(context: CanvasRenderingContext2D, decoration: Decoration) {
  const bobY = decoration.y + Math.sin(decoration.phase) * decoration.size * 0.04;
  if (decoration.kind === "island") {
    context.fillStyle = "rgb(212 183 121 / 72%)";
    context.beginPath();
    context.ellipse(decoration.x, bobY, decoration.size * 0.68, decoration.size * 0.34, -0.08, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgb(87 145 82 / 74%)";
    context.beginPath();
    context.ellipse(decoration.x - decoration.size * 0.12, bobY - decoration.size * 0.12, decoration.size * 0.42, decoration.size * 0.2, 0.12, 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (decoration.kind === "reeds") {
    context.strokeStyle = "rgb(62 121 88 / 72%)";
    context.lineWidth = 4;
    for (let index = -1; index <= 1; index++) {
      context.beginPath();
      context.moveTo(decoration.x + index * decoration.size * 0.16, bobY + decoration.size * 0.28);
      context.quadraticCurveTo(decoration.x + index * decoration.size * 0.08, bobY, decoration.x + index * decoration.size * 0.2, bobY - decoration.size * 0.38);
      context.stroke();
    }
    return;
  }

  context.fillStyle = "rgb(255 245 201 / 88%)";
  context.beginPath();
  context.arc(decoration.x, bobY, decoration.size * 0.46, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgb(218 104 91 / 82%)";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(decoration.x - decoration.size * 0.38, bobY);
  context.lineTo(decoration.x + decoration.size * 0.38, bobY);
  context.stroke();
}

function drawCheckpoint(context: CanvasRenderingContext2D) {
  const pulse = 1 + Math.sin(checkpoint.phase * 2) * 0.035;
  const radius = checkpoint.radius * pulse;
  const gradient = context.createRadialGradient(checkpoint.x, checkpoint.y, radius * 0.18, checkpoint.x, checkpoint.y, radius);
  gradient.addColorStop(0, "rgb(255 255 255 / 42%)");
  gradient.addColorStop(0.62, "rgb(255 244 167 / 20%)");
  gradient.addColorStop(1, "rgb(255 244 167 / 0%)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(checkpoint.x, checkpoint.y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgb(255 250 196 / 92%)";
  context.lineWidth = 7;
  context.setLineDash([14, 12]);
  context.beginPath();
  context.arc(checkpoint.x, checkpoint.y, radius * 0.74, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = "rgb(255 255 255 / 88%)";
  context.beginPath();
  context.arc(checkpoint.x - radius * 0.48, checkpoint.y, 13, 0, Math.PI * 2);
  context.arc(checkpoint.x + radius * 0.48, checkpoint.y, 13, 0, Math.PI * 2);
  context.fill();
}

function drawBoat(context: CanvasRenderingContext2D) {
  const size = boatSize();
  const position = boatPoint();
  const glowRadius = size * (0.86 + boat.glow * 0.42);
  const glow = context.createRadialGradient(position.x, position.y, size * 0.24, position.x, position.y, glowRadius);
  glow.addColorStop(0, `rgb(255 246 182 / ${0.18 + boat.glow * 0.24})`);
  glow.addColorStop(1, "rgb(255 246 182 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(position.x, position.y, glowRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgb(58 101 129 / 26%)";
  context.beginPath();
  context.ellipse(position.x - size * 0.06, position.y + size * 0.36, size * 0.68, size * 0.16, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f4a35f";
  context.beginPath();
  context.moveTo(position.x - size * 0.68, position.y + size * 0.14);
  context.quadraticCurveTo(position.x, position.y + size * 0.52, position.x + size * 0.68, position.y + size * 0.14);
  context.quadraticCurveTo(position.x + size * 0.42, position.y + size * 0.44, position.x - size * 0.42, position.y + size * 0.44);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(126 76 47 / 42%)";
  context.lineWidth = 3;
  context.stroke();

  context.strokeStyle = "#7a5b45";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(position.x - size * 0.04, position.y + size * 0.16);
  context.lineTo(position.x - size * 0.04, position.y - size * 0.58);
  context.stroke();

  context.fillStyle = "#fff7d6";
  context.beginPath();
  context.moveTo(position.x, position.y - size * 0.56);
  context.quadraticCurveTo(position.x + size * 0.54, position.y - size * 0.22, position.x, position.y + size * 0.08);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgb(130 116 82 / 24%)";
  context.lineWidth = 2;
  context.stroke();
}

function drawRipples(context: CanvasRenderingContext2D) {
  for (const ripple of ripples) {
    const progress = ripple.age / ripple.life;
    context.strokeStyle = `rgb(255 255 255 / ${0.42 * (1 - progress)})`;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(ripple.x, ripple.y, ripple.radius * (0.5 + progress), 0, Math.PI * 2);
    context.stroke();
  }
}

function draw(context: CanvasRenderingContext2D) {
  drawRiver(context);
  for (const decoration of decorations) drawDecoration(context, decoration);
  drawCheckpoint(context);
  drawRipples(context);
  drawBoat(context);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta, now);
  if (ctx) draw(ctx);
  frame = requestAnimationFrame(tick);
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initDecorations();
  resetCheckpoint(false);
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
  <div class="boat-shell">
    <canvas ref="canvasRef" class="boat-canvas" />

    <GameHud
      title="Лодочка"
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
      title="Лодочка"
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
.boat-shell {
  background: #e5f3dd;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.boat-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
