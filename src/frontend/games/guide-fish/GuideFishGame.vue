<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = { x: number; y: number };
type GuideTargetKind = "pearl" | "reef";
type GuideTarget = {
  id: string;
  kind: GuideTargetKind;
  x: number;
  y: number;
  radius: number;
  phase: number;
  dwellSeconds: number;
  entered: boolean;
  enteredAt?: number;
};
type CleanupBubble = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSessionFor("guide-fish", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.45, motionSpeed: 0.58, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const targetPlan = [
  { kind: "pearl", x: 74, y: 42 },
  { kind: "reef", x: 56, y: 68 },
  { kind: "pearl", x: 28, y: 50 },
  { kind: "reef", x: 46, y: 30 },
  { kind: "pearl", x: 82, y: 62 },
  { kind: "reef", x: 34, y: 74 },
  { kind: "pearl", x: 64, y: 38 },
  { kind: "reef", x: 22, y: 58 }
] satisfies Array<{ kind: GuideTargetKind; x: number; y: number }>;

const fish = reactive({ x: window.innerWidth * 0.34, y: window.innerHeight * 0.54, phase: 0, angle: 0, glow: 0 });
const target = ref<GuideTarget>();
const cleanupBubbles = reactive<CleanupBubble[]>([]);
const resultVisible = computed(() => session.status === "finished");
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Рыбка спокойно ждёт продолжения.";
  if (!pointer.value.valid) return "Можно вести рыбку взглядом или мышью к мягкой цели.";
  return target.value?.kind === "reef" ? "Проведи рыбку к светлому рифу." : "Проведи рыбку к жемчужине.";
});

let lastHintAt = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playArea() {
  const top = Math.max(126, height.value * 0.18);
  const bottom = height.value - Math.max(60, height.value * 0.08);
  const side = Math.max(42, width.value * 0.055);
  return { left: side, right: width.value - side, top, bottom };
}

function fishSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.15;
  return Math.min(128, Math.max(76, Math.min(viewportLimit, 76 * session.settings.targetScale)));
}

function targetRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.105;
  return Math.min(112, Math.max(76, Math.min(viewportLimit, 64 * session.settings.targetScale)));
}

function planPoint(index: number) {
  const area = playArea();
  const plan = targetPlan[index % targetPlan.length];
  return {
    kind: plan.kind,
    x: area.left + (area.right - area.left) * plan.x / 100,
    y: area.top + (area.bottom - area.top) * plan.y / 100
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

function targetPayload(nextTarget: GuideTarget, progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: nextTarget.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: Math.round(nextTarget.dwellSeconds * 1000),
    progress,
    pointer: copyPointer(),
    fish: { x: Math.round(fish.x), y: Math.round(fish.y) },
    kind: nextTarget.kind,
    now,
    reason
  };
}

function createTarget(index: number): GuideTarget {
  const point = planPoint(index);
  return {
    id: `guide-fish-${point.kind}-${Date.now()}-${index}`,
    kind: point.kind,
    x: point.x,
    y: point.y,
    radius: targetRadius(),
    phase: randomRange(0, Math.PI * 2),
    dwellSeconds: 0,
    entered: false
  };
}

function placeNextTarget() {
  target.value = createTarget(session.step);
}

function addCleanupAnimation(point: Point, kind: GuideTargetKind) {
  const count = kind === "reef" ? 18 : 14;
  const hue = kind === "reef" ? 176 : 44;
  for (let index = 0; index < count; index += 1) {
    const angle = index / count * Math.PI * 2 + randomRange(-0.18, 0.18);
    const speed = randomRange(32, 86);
    cleanupBubbles.push({
      x: point.x + Math.cos(angle) * randomRange(4, 18),
      y: point.y + Math.sin(angle) * randomRange(4, 18),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomRange(18, 48),
      age: 0,
      life: randomRange(0.85, 1.35),
      radius: randomRange(4, 10),
      hue
    });
  }
  if (cleanupBubbles.length > 70) cleanupBubbles.splice(0, cleanupBubbles.length - 70);
}

function resetGame() {
  cleanupBubbles.splice(0);
  const area = playArea();
  fish.x = area.left + (area.right - area.left) * 0.28;
  fish.y = area.top + (area.bottom - area.top) * 0.5;
  fish.phase = 0;
  fish.angle = 0;
  fish.glow = 0;
  lastHintAt = 0;
  placeNextTarget();
}

function restart() {
  startSession();
  resetGame();
}

function updateFish(delta: number) {
  const area = playArea();
  const size = fishSize();
  const fallback = target.value ?? { x: area.left + (area.right - area.left) * 0.5, y: area.top + (area.bottom - area.top) * 0.5 };
  const targetPoint = pointer.value.valid ? pointer.value : fallback;
  const nextX = clamp(targetPoint.x, area.left + size * 0.42, area.right - size * 0.42);
  const nextY = clamp(targetPoint.y, area.top + size * 0.42, area.bottom - size * 0.42);
  const dx = nextX - fish.x;
  const dy = nextY - fish.y;
  const smoothing = pointer.value.valid ? 3.9 : 1.25;
  const maxStep = delta * 260 * session.settings.motionSpeed;
  fish.x += clamp(dx * Math.min(1, delta * smoothing), -maxStep, maxStep);
  fish.y += clamp(dy * Math.min(1, delta * smoothing), -maxStep, maxStep);
  if (Math.hypot(dx, dy) > 2) fish.angle += (Math.atan2(dy, dx) - fish.angle) * Math.min(1, delta * 5.2);
  fish.phase += delta * (session.settings.reduceMotion ? 1.1 : 2.4);
}

function updateTarget(delta: number, now: number) {
  const current = target.value;
  if (!current) return;

  current.radius = targetRadius();
  current.phase += delta * 1.6;
  const gap = distance(fish, current);
  const activeRadius = current.radius * 0.9;
  const nearRadius = current.radius * 1.52;
  const near = gap <= nearRadius;
  const active = pointer.value.valid && gap <= activeRadius;
  const progress = clamp(1 - gap / nearRadius, 0, 1);
  fish.glow += (progress - fish.glow) * Math.min(1, delta * 4.8);

  if (near && !current.entered) {
    current.entered = true;
    current.enteredAt = now;
    recordEvent("target-enter", targetPayload(current, progress, now));
  }

  if (!near && current.entered) {
    recordEvent("target-cancel", targetPayload(current, progress, now, pointer.value.valid ? "left" : "invalid-gaze"));
    current.entered = false;
    current.enteredAt = undefined;
  }

  current.dwellSeconds = active ? current.dwellSeconds + delta : Math.max(0, current.dwellSeconds - delta * 0.55);
  if (!pointer.value.valid && now - lastHintAt > 4200) {
    lastHintAt = now;
    recordHint({ kind: "guide-fish-follow", targetId: current.id, step: session.step + 1 });
  }

  if (current.dwellSeconds * 1000 < session.settings.dwellMs) return;

  recordEvent("target-click", targetPayload(current, 1, now));
  recordSuccess({ targetId: current.id, kind: current.kind, dwellMs: Math.round(current.dwellSeconds * 1000) });
  addCleanupAnimation(current, current.kind);
  target.value = undefined;
  if (session.status === "running") placeNextTarget();
}

function updateCleanupBubbles(delta: number) {
  for (let index = cleanupBubbles.length - 1; index >= 0; index -= 1) {
    const bubble = cleanupBubbles[index];
    bubble.age += delta;
    bubble.x += bubble.vx * delta;
    bubble.y += bubble.vy * delta;
    bubble.vx *= 1 - Math.min(0.35, delta * 0.42);
    bubble.vy -= 8 * delta;
    if (bubble.age >= bubble.life) cleanupBubbles.splice(index, 1);
  }
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateFish(delta);
    updateTarget(delta, now);
  }
  updateCleanupBubbles(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sea = ctx.createLinearGradient(0, 0, 0, height.value);
  sea.addColorStop(0, "#bceeff");
  sea.addColorStop(0.52, "#75c9e1");
  sea.addColorStop(1, "#2f8caf");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const y = height.value * (0.2 + index * 0.1);
    const phase = now * 0.00016 + index;
    ctx.beginPath();
    ctx.moveTo(-40, y);
    for (let x = -40; x <= width.value + 40; x += 90) {
      ctx.quadraticCurveTo(x + 46, y + Math.sin(phase + x * 0.01) * 15, x + 90, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  const sandTop = height.value * 0.82;
  const sand = ctx.createLinearGradient(0, sandTop, 0, height.value);
  sand.addColorStop(0, "#e8d79e");
  sand.addColorStop(1, "#cfb66e");
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, sandTop + 18);
  ctx.bezierCurveTo(width.value * 0.24, sandTop - 10, width.value * 0.68, sandTop + 34, width.value, sandTop + 4);
  ctx.lineTo(width.value, height.value);
  ctx.lineTo(0, height.value);
  ctx.closePath();
  ctx.fill();
}

function drawSeaPlants(ctx: CanvasRenderingContext2D, now: number) {
  ctx.save();
  ctx.lineCap = "round";
  for (let index = 0; index < 13; index += 1) {
    const x = width.value * (0.06 + index * 0.078);
    const baseY = height.value * (0.88 + (index % 3) * 0.025);
    const length = 42 + index % 4 * 14;
    const sway = Math.sin(now * 0.001 + index) * 12;
    ctx.strokeStyle = index % 2 === 0 ? "rgb(53 137 110 / 58%)" : "rgb(89 157 117 / 50%)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + sway * 0.35, baseY - length * 0.55, x + sway, baseY - length);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPearl(ctx: CanvasRenderingContext2D, current: GuideTarget) {
  const pulse = current.dwellSeconds * 1000 / session.settings.dwellMs;
  const bob = Math.sin(current.phase) * current.radius * 0.05;
  const glow = ctx.createRadialGradient(current.x, current.y + bob, current.radius * 0.18, current.x, current.y + bob, current.radius * 1.25);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.36 + pulse * 0.22})`);
  glow.addColorStop(1, "rgb(255 255 255 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(current.x, current.y + bob, current.radius * 1.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(111 84 68 / 38%)";
  ctx.beginPath();
  ctx.ellipse(current.x, current.y + current.radius * 0.44 + bob, current.radius * 0.74, current.radius * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  const pearl = ctx.createRadialGradient(current.x - current.radius * 0.16, current.y - current.radius * 0.14 + bob, 2, current.x, current.y + bob, current.radius * 0.46);
  pearl.addColorStop(0, "#ffffff");
  pearl.addColorStop(0.62, "#f7ecff");
  pearl.addColorStop(1, "#c8d6f0");
  ctx.fillStyle = pearl;
  ctx.beginPath();
  ctx.arc(current.x, current.y + bob, current.radius * 0.43, 0, Math.PI * 2);
  ctx.fill();
}

function drawReef(ctx: CanvasRenderingContext2D, current: GuideTarget) {
  const pulse = current.dwellSeconds * 1000 / session.settings.dwellMs;
  const bob = Math.sin(current.phase) * current.radius * 0.04;
  ctx.save();
  ctx.translate(current.x, current.y + bob);

  const glow = ctx.createRadialGradient(0, 0, current.radius * 0.18, 0, 0, current.radius * 1.35);
  glow.addColorStop(0, `rgb(162 245 226 / ${0.22 + pulse * 0.22})`);
  glow.addColorStop(1, "rgb(162 245 226 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, current.radius * 1.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#77d2c9";
  ctx.lineWidth = Math.max(11, current.radius * 0.16);
  ctx.lineCap = "round";
  for (const branch of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(branch * current.radius * 0.52, current.radius * 0.52);
    ctx.quadraticCurveTo(branch * current.radius * 0.34, -current.radius * 0.04, branch * current.radius * 0.86, -current.radius * 0.48);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgb(255 255 255 / 82%)";
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, current.radius * (0.72 + pulse * 0.08), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawTarget(ctx: CanvasRenderingContext2D) {
  const current = target.value;
  if (!current) return;
  if (current.kind === "reef") drawReef(ctx, current);
  else drawPearl(ctx, current);
}

function drawFish(ctx: CanvasRenderingContext2D) {
  const size = fishSize();
  const wave = Math.sin(fish.phase) * size * 0.045;
  const glowRadius = size * (0.75 + fish.glow * 0.36);
  const glow = ctx.createRadialGradient(fish.x, fish.y, size * 0.2, fish.x, fish.y, glowRadius);
  glow.addColorStop(0, `rgb(255 244 185 / ${0.16 + fish.glow * 0.24})`);
  glow.addColorStop(1, "rgb(255 244 185 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(fish.x, fish.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(fish.x, fish.y + wave);
  ctx.rotate(fish.angle * 0.18);

  ctx.fillStyle = "rgb(28 92 112 / 22%)";
  ctx.beginPath();
  ctx.ellipse(-size * 0.04, size * 0.34, size * 0.62, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-size * 0.58, -size * 0.2, size * 0.52, size * 0.28);
  body.addColorStop(0, "#ffc56f");
  body.addColorStop(1, "#ff8c6e");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.48, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f27d6f";
  ctx.beginPath();
  ctx.moveTo(-size * 0.44, 0);
  ctx.quadraticCurveTo(-size * 0.82, -size * 0.32 + Math.sin(fish.phase * 1.7) * size * 0.05, -size * 0.76, 0);
  ctx.quadraticCurveTo(-size * 0.82, size * 0.32 - Math.sin(fish.phase * 1.7) * size * 0.05, -size * 0.44, 0);
  ctx.fill();

  ctx.fillStyle = "rgb(255 255 255 / 72%)";
  ctx.beginPath();
  ctx.ellipse(size * 0.1, -size * 0.18, size * 0.22, size * 0.08, -0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#25465d";
  ctx.beginPath();
  ctx.arc(size * 0.28, -size * 0.08, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCleanupBubbles(ctx: CanvasRenderingContext2D) {
  for (const bubble of cleanupBubbles) {
    const progress = bubble.age / bubble.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.78 * (1 - progress));
    ctx.fillStyle = `hsl(${bubble.hue}, 74%, 78%)`;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius * (1 + progress * 0.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(255 255 255 / 68%)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgb(9 63 89 / 46%)";
  ctx.beginPath();
  const x = Math.max(18, width.value * 0.03);
  const y = height.value - Math.max(78, height.value * 0.105);
  const boxWidth = Math.min(520, width.value - x * 2);
  const boxHeight = 52;
  ctx.roundRect(x, y, boxWidth, boxHeight, 24);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.max(17, Math.min(22, width.value * 0.022))}px Roboto, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(guidanceText.value, x + 24, y + boxHeight / 2, boxWidth - 48);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawSeaPlants(ctx, now);
  drawTarget(ctx);
  drawCleanupBubbles(ctx);
  drawFish(ctx);
  drawOverlay(ctx);
}

onMounted(() => {
  resetGame();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="guide-fish-shell">
    <canvas ref="canvasRef" class="guide-fish-canvas" />

    <GameHud
      title="Рыбка-поводырь"
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
      title="Рыбка-поводырь"
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
.guide-fish-shell {
  background: #75c9e1;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.guide-fish-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
