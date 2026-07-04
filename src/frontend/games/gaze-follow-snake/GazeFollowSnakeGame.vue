<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeGazeFollowSnakeAudio, playGazeFollowSnakeLeafCue, setGazeFollowSnakeMusicActive, tickGazeFollowSnakeMusic, warmGazeFollowSnakeAudio } from "./audio";

type Point = { x: number; y: number };

type Segment = Point & {
  radius: number;
};

type Leaf = Point & {
  id: string;
  radius: number;
  angle: number;
  hue: number;
  pulse: number;
  enteredAt: number;
  progress: number;
};

type MeadowLeaf = Point & {
  radius: number;
  angle: number;
  hue: number;
  phase: number;
  sway: number;
};

type Sparkle = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("gaze-follow-snake", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.45, motionSpeed: 0.52, distractors: "none", hints: "high" },
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");

const segments = reactive<Segment[]>([]);
const meadowLeaves = reactive<MeadowLeaf[]>([]);
const sparkles = reactive<Sparkle[]>([]);
const leaf = reactive<Leaf>({ id: "leaf-0", x: 0, y: 0, radius: 80, angle: 0, hue: 96, pulse: 0, enteredAt: 0, progress: 0 });
const resultVisible = computed(() => session.status === "finished");
const leafProgress = computed(() => Math.round(leaf.progress * 100));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Змейка подождёт.";
  if (!pointer.value.valid) return "Можно вести змейку взглядом или указателем к большому листу.";
  if (leaf.progress > 0.08) return "Хорошо. Подержи змейку у листа ещё немного.";
  return "Веди змейку к подсвеченному листу.";
});

let leafSequence = 0;
let idlePhase = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function snakeRadius() {
  return Math.min(34, Math.max(22, Math.min(width.value, height.value) * 0.038));
}

function targetRadius() {
  return Math.min(112, Math.max(76, Math.min(width.value, height.value) * 0.095 * session.settings.targetScale));
}

function playArea() {
  const margin = targetRadius() * 0.88;
  return {
    left: margin,
    right: width.value - margin,
    top: Math.max(126, height.value * 0.16),
    bottom: height.value - Math.max(70, height.value * 0.1)
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

function targetPayload(now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: leaf.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: leaf.enteredAt > 0 ? now - leaf.enteredAt : 0,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function createLeafPosition() {
  const area = playArea();
  const head = segments[0] ?? { x: width.value * 0.5, y: height.value * 0.58 };
  let candidate = { x: randomRange(area.left, area.right), y: randomRange(area.top, area.bottom) };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const next = { x: randomRange(area.left, area.right), y: randomRange(area.top, area.bottom) };
    if (distance(next, head) > Math.min(width.value, height.value) * 0.28) {
      candidate = next;
      break;
    }
    candidate = next;
  }

  return candidate;
}

function placeTargetLeaf() {
  const next = createLeafPosition();
  leafSequence += 1;
  leaf.id = `snake-leaf-${leafSequence}`;
  leaf.x = next.x;
  leaf.y = next.y;
  leaf.radius = targetRadius();
  leaf.angle = randomRange(-0.6, 0.6);
  leaf.hue = randomRange(80, 128);
  leaf.pulse = randomRange(0, Math.PI * 2);
  leaf.enteredAt = 0;
  leaf.progress = 0;
}

function createMeadowLeaf(): MeadowLeaf {
  return {
    x: randomRange(0, width.value),
    y: randomRange(Math.max(112, height.value * 0.14), height.value),
    radius: randomRange(18, 42),
    angle: randomRange(-1.2, 1.2),
    hue: randomRange(62, 132),
    phase: randomRange(0, Math.PI * 2),
    sway: randomRange(0.2, 0.9)
  };
}

function resetScene() {
  const startX = width.value * 0.5;
  const startY = height.value * 0.58;
  const radius = snakeRadius();
  segments.splice(0);
  for (let index = 0; index < 10; index += 1) {
    segments.push({ x: startX - index * radius * 1.05, y: startY, radius: radius * (1 - index * 0.035) });
  }

  meadowLeaves.splice(0);
  const leafCount = width.value < 720 ? 12 : 20;
  for (let index = 0; index < leafCount; index += 1) meadowLeaves.push(createMeadowLeaf());

  sparkles.splice(0);
  leafSequence = 0;
  idlePhase = 0;
  placeTargetLeaf();
}

function addSparkles(x: number, y: number) {
  if (session.settings.reduceMotion) return;
  for (let index = 0; index < 9; index += 1) {
    sparkles.push({
      x: x + randomRange(-leaf.radius * 0.4, leaf.radius * 0.4),
      y: y + randomRange(-leaf.radius * 0.35, leaf.radius * 0.35),
      age: 0,
      life: randomRange(0.8, 1.35),
      radius: randomRange(4, 10),
      hue: leaf.hue + randomRange(-16, 18)
    });
  }
  if (sparkles.length > 36) sparkles.splice(0, sparkles.length - 36);
}

function completeLeaf(now: number) {
  recordEvent("target-click", targetPayload(now, 1));
  recordSuccess({ targetId: leaf.id, label: "leaf", mode: "smooth-follow" });
  addSparkles(leaf.x, leaf.y);
  playGazeFollowSnakeLeafCue(soundEnabled.value);
  if (session.status === "running") placeTargetLeaf();
}

function updateSnake(delta: number, now: number) {
  if (segments.length === 0) return;
  idlePhase += session.settings.reduceMotion ? 0 : delta;
  const head = segments[0];
  const area = playArea();
  const fallback = {
    x: width.value * (0.5 + (session.settings.reduceMotion ? 0 : Math.sin(now * 0.00012 + idlePhase * 0.1) * 0.18)),
    y: height.value * (0.56 + (session.settings.reduceMotion ? 0 : Math.cos(now * 0.0001) * 0.12))
  };
  const target = pointer.value.valid ? pointer.value : fallback;
  const desired = {
    x: clamp(target.x, area.left * 0.42, width.value - area.left * 0.42),
    y: clamp(target.y, area.top * 0.75, area.bottom + targetRadius() * 0.3)
  };
  const follow = pointer.value.valid ? 2.85 : 0.42;
  const maxStep = (pointer.value.valid ? 360 : 90) * session.settings.motionSpeed * delta;
  const dx = desired.x - head.x;
  const dy = desired.y - head.y;
  const gap = Math.hypot(dx, dy) || 1;
  const eased = Math.min(maxStep, gap * Math.min(1, delta * follow));
  head.x += (dx / gap) * eased;
  head.y += (dy / gap) * eased;

  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1];
    const segment = segments[index];
    const spacing = snakeRadius() * 0.92;
    const sx = previous.x - segment.x;
    const sy = previous.y - segment.y;
    const segmentGap = Math.hypot(sx, sy) || 1;
    const targetDistance = spacing + (session.settings.reduceMotion ? 0 : Math.sin(now * 0.003 + index * 0.8) * snakeRadius() * 0.05);
    const pull = (segmentGap - targetDistance) * Math.min(1, delta * 7.5);
    segment.x += (sx / segmentGap) * pull;
    segment.y += (sy / segmentGap) * pull;
  }
}

function updateLeafProgress(delta: number, now: number) {
  if (session.status !== "running" || session.step >= session.maxSteps || segments.length === 0) return;

  const head = segments[0];
  const focusDistance = leaf.radius * 0.92;
  const nearDistance = leaf.radius * 1.34;
  const gap = distance(head, leaf);
  const focused = pointer.value.valid && gap <= focusDistance;
  const near = pointer.value.valid && gap <= nearDistance;

  if (near && leaf.enteredAt === 0) {
    leaf.enteredAt = now;
    recordEvent("target-enter", targetPayload(now, leaf.progress));
  }

  if (!near && leaf.enteredAt > 0) {
    recordEvent("target-cancel", targetPayload(now, leaf.progress, pointer.value.valid ? "left" : "invalid-gaze"));
    leaf.enteredAt = 0;
  }

  if (near) {
    const distanceGain = clamp(1 - gap / nearDistance, 0.28, 1);
    const contactBoost = focused ? 1.35 : 0.7;
    leaf.progress = Math.min(1, leaf.progress + (delta * 1000 / session.settings.dwellMs) * distanceGain * contactBoost);
  } else {
    leaf.progress = Math.max(0, leaf.progress - delta * 0.42);
  }

  if (leaf.progress >= 1) completeLeaf(now);
}

function updateMeadow(delta: number) {
  if (session.settings.reduceMotion) return;
  for (const item of meadowLeaves) {
    item.phase += delta * item.sway;
    item.angle += Math.sin(item.phase) * delta * 0.035;
  }
}

function updateSparkles(delta: number) {
  for (let index = sparkles.length - 1; index >= 0; index -= 1) {
    const sparkle = sparkles[index];
    sparkle.age += delta;
    sparkle.y -= delta * 16;
    if (sparkle.age >= sparkle.life) sparkles.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  tickGazeFollowSnakeMusic(soundEnabled.value);
  if (session.status === "paused") return;
  leaf.pulse += session.settings.reduceMotion ? 0 : delta * 2.2;
  updateMeadow(delta);
  updateSparkles(delta);
  updateSnake(delta, now);
  updateLeafProgress(delta, now);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#eff8e8");
  sky.addColorStop(0.58, "#dcefc4");
  sky.addColorStop(1, "#c6dfa2");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.44;
  for (let index = 0; index < 4; index += 1) {
    const visualNow = session.settings.reduceMotion ? 0 : now;
    const x = width.value * (0.14 + index * 0.26) + Math.sin(visualNow * 0.00008 + index) * 22;
    const y = height.value * (0.22 + (index % 2) * 0.28);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(width.value, height.value) * 0.28);
    glow.addColorStop(0, index % 2 === 0 ? "rgb(255 251 216 / 62%)" : "rgb(221 247 209 / 56%)");
    glow.addColorStop(1, "rgb(255 255 255 / 0%)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width.value, height.value);
  }
  ctx.restore();
}

function drawLeafShape(ctx: CanvasRenderingContext2D, item: Point & { radius: number; angle: number; hue: number }, alpha = 1) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.globalAlpha = alpha;
  const gradient = ctx.createLinearGradient(-item.radius, -item.radius * 0.45, item.radius, item.radius * 0.45);
  gradient.addColorStop(0, `hsl(${item.hue} 48% 52%)`);
  gradient.addColorStop(1, `hsl(${item.hue + 28} 58% 68%)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-item.radius * 0.86, 0);
  ctx.bezierCurveTo(-item.radius * 0.42, -item.radius * 0.78, item.radius * 0.46, -item.radius * 0.62, item.radius * 0.92, 0);
  ctx.bezierCurveTo(item.radius * 0.42, item.radius * 0.68, -item.radius * 0.44, item.radius * 0.74, -item.radius * 0.86, 0);
  ctx.fill();
  ctx.strokeStyle = "rgb(255 255 255 / 42%)";
  ctx.lineWidth = Math.max(2, item.radius * 0.035);
  ctx.beginPath();
  ctx.moveTo(-item.radius * 0.7, 0);
  ctx.quadraticCurveTo(0, -item.radius * 0.08, item.radius * 0.72, 0);
  ctx.stroke();
  ctx.restore();
}

function drawTargetLeaf(ctx: CanvasRenderingContext2D) {
  const pulse = session.settings.reduceMotion ? 1 : 1 + Math.sin(leaf.pulse) * 0.035;
  const glowRadius = leaf.radius * (1.42 + leaf.progress * 0.36);
  const glow = ctx.createRadialGradient(leaf.x, leaf.y, leaf.radius * 0.12, leaf.x, leaf.y, glowRadius);
  glow.addColorStop(0, `rgb(255 255 218 / ${0.24 + leaf.progress * 0.16})`);
  glow.addColorStop(0.58, "rgb(178 226 115 / 22%)");
  glow.addColorStop(1, "rgb(178 226 115 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(leaf.x, leaf.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  drawLeafShape(ctx, { ...leaf, radius: leaf.radius * pulse }, 0.96);

  ctx.save();
  ctx.strokeStyle = "rgb(255 255 255 / 76%)";
  ctx.lineWidth = Math.max(5, leaf.radius * 0.065);
  ctx.beginPath();
  ctx.arc(leaf.x, leaf.y, leaf.radius * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * leaf.progress);
  ctx.stroke();
  ctx.restore();
}

function drawSnake(ctx: CanvasRenderingContext2D) {
  if (segments.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    const alpha = 0.72 + (1 - index / segments.length) * 0.24;
    const hue = 142 - index * 2;
    ctx.fillStyle = `hsl(${hue} 52% ${42 + index * 1.5}% / ${alpha})`;
    ctx.strokeStyle = "rgb(255 255 255 / 38%)";
    ctx.lineWidth = Math.max(2, segment.radius * 0.12);
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, segment.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const head = segments[0];
  const next = segments[1] ?? { x: head.x - 1, y: head.y };
  const angle = Math.atan2(head.y - next.y, head.x - next.x);
  const eyeOffset = head.radius * 0.42;
  const eyeForward = head.radius * 0.32;
  ctx.fillStyle = "rgb(255 255 255 / 92%)";
  for (const side of [-1, 1]) {
    const x = head.x + Math.cos(angle) * eyeForward + Math.cos(angle + Math.PI / 2) * eyeOffset * side;
    const y = head.y + Math.sin(angle) * eyeForward + Math.sin(angle + Math.PI / 2) * eyeOffset * side;
    ctx.beginPath();
    ctx.arc(x, y, head.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D) {
  for (const sparkle of sparkles) {
    const progress = sparkle.age / sparkle.life;
    ctx.fillStyle = `hsl(${sparkle.hue} 72% 72% / ${1 - progress})`;
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.radius * (1 - progress * 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const item of meadowLeaves) drawLeafShape(ctx, { ...item, y: item.y + (session.settings.reduceMotion ? 0 : Math.sin(item.phase) * 5) }, 0.18);
  drawTargetLeaf(ctx);
  drawSparkles(ctx);
  drawSnake(ctx);
}

function restart() {
  resetScene();
  startSession();
  setGazeFollowSnakeMusicActive(soundEnabled.value, true);
}

watch(() => [session.status, soundEnabled.value] as const, ([status, enabled]) => {
  setGazeFollowSnakeMusicActive(enabled, status === "running");
}, { immediate: true });

onMounted(() => {
  resetScene();
  warmGazeFollowSnakeAudio(soundEnabled.value);
  setGazeFollowSnakeMusicActive(soundEnabled.value, session.status === "running");
});

onUnmounted(() => {
  disposeGazeFollowSnakeAudio();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="gaze-follow-snake-shell">
    <canvas ref="canvasRef" class="gaze-follow-snake-canvas" />

    <GameHud
      title="Змейка за взглядом"
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

    <v-card class="gaze-follow-snake-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Непрерывное ведение</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="leafProgress" color="success" height="0.5rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Лист: {{ leafProgress }}%</div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Змейка за взглядом"
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
.gaze-follow-snake-shell {
  background: #dcefc4;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.gaze-follow-snake-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.gaze-follow-snake-guidance {
  box-shadow: 0 1rem 2.75rem rgb(79 122 70 / 14%);
  inline-size: min(26.25rem, calc(100dvw - 2rem));
  inset-block-start: clamp(6.5rem, 14vh, 9.25rem);
  inset-inline-end: max(1rem, env(safe-area-inset-right));
  opacity: 0.92;
  position: absolute;
  z-index: 4;
}

@media (max-width: 45rem) {
 .gaze-follow-snake-guidance {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
    inset-inline: 1rem;
    inline-size: auto;
  }
}
</style>
