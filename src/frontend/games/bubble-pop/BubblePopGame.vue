<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { disposeBubblePopAudio, playBubblePopMelody, resetBubblePopAudioSession, warmBubblePopAudio } from "./audio";

type Point = { x: number; y: number };
type BubblePhase = "floating" | "gazing" | "popping";
type BubblePop = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: BubblePhase;
  dwellProgress: number;
  enteredAt?: number;
  speed: number;
  wobble: number;
  drift: number;
};
type Ripple = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("bubble-pop", {
  maxSteps: 10,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.42, distractors: "none", hints: "high" },
  finishOnMaxSteps: false
});

const bubbles = reactive<BubblePop[]>([]);
const ripples = reactive<Ripple[]>([]);
const resultVisible = computed(() => session.status === "finished");

const bubbleHues = [188, 204, 222, 258, 288, 324];
const popSeconds = 1.35;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let previousBubblePoint: Point | undefined;

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

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function bubbleRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.19;
  return Math.min(152, Math.max(96, Math.min(viewportLimit, 92 * session.settings.targetScale)));
}

function desiredBubbleCount() {
  if (window.innerWidth < 720) return 3;
  return 4;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function bubblePoint(bubble: BubblePop) {
  const point = percentToPixels(bubble);
  return {
    x: point.x + Math.sin(bubble.age * 0.55 + bubble.wobble) * bubble.radius * 0.12,
    y: point.y + Math.cos(bubble.age * 0.42 + bubble.wobble) * bubble.radius * 0.05
  };
}

function chooseBubblePoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 56 };

  let bestPoint = randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(94, window.innerHeight * 0.14),
    sidePadding: Math.max(68, window.innerWidth * 0.1),
    bottomPadding: Math.max(92, window.innerHeight * 0.14),
    previous: previousBubblePoint,
    minDistance: Math.min(280, Math.max(150, radius * 1.55)),
    attempts: 18
  });
  let bestClearance = bubbleClearance(bestPoint, radius);

  for (let index = 0; index < 28; index++) {
    const point = randomTargetCenterPercent({
      targetWidth: radius * 2,
      targetHeight: radius * 2,
      hudHeight: Math.max(94, window.innerHeight * 0.14),
      sidePadding: Math.max(68, window.innerWidth * 0.1),
      bottomPadding: Math.max(92, window.innerHeight * 0.14),
      previous: previousBubblePoint,
      minDistance: Math.min(280, Math.max(150, radius * 1.55)),
      attempts: 18
    });
    const clearance = bubbleClearance(point, radius);
    if (clearance >= 0) return point;
    if (clearance > bestClearance) {
      bestPoint = point;
      bestClearance = clearance;
    }
  }

  return bestPoint;
}

function bubbleClearance(point: Point, radius: number) {
  if (bubbles.length === 0) return Number.POSITIVE_INFINITY;

  const candidate = percentToPixels(point);
  let clearance = Number.POSITIVE_INFINITY;
  for (const bubble of bubbles) {
    const nextPoint = bubblePoint(bubble);
    const requiredGap = radius + bubble.radius + Math.max(24, Math.min(radius, bubble.radius) * 0.16);
    clearance = Math.min(clearance, distance(candidate, nextPoint) - requiredGap);
  }
  return clearance;
}

function requiredBubbleGap(first: BubblePop, second: BubblePop) {
  return first.radius + second.radius + Math.max(24, Math.min(first.radius, second.radius) * 0.16);
}

function clampBubblePosition(bubble: BubblePop) {
  const xMargin = (bubble.radius / Math.max(1, window.innerWidth)) * 100 + 2;
  const yMargin = (bubble.radius / Math.max(1, window.innerHeight)) * 100 + 4;
  bubble.x = Math.max(xMargin, Math.min(100 - xMargin, bubble.x));
  bubble.y = Math.max(12 + yMargin, Math.min(100 - yMargin, bubble.y));
}

function separateBubbles() {
  const visibleBubbles = bubbles.filter((bubble) => bubble.phase !== "popping");
  for (let pass = 0; pass < 3; pass++) {
    for (let firstIndex = 0; firstIndex < visibleBubbles.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < visibleBubbles.length; secondIndex++) {
        const first = visibleBubbles[firstIndex];
        const second = visibleBubbles[secondIndex];
        const firstPoint = bubblePoint(first);
        const secondPoint = bubblePoint(second);
        const dx = secondPoint.x - firstPoint.x;
        const dy = secondPoint.y - firstPoint.y;
        const currentDistance = Math.max(1, Math.hypot(dx, dy));
        const overlap = requiredBubbleGap(first, second) - currentDistance;
        if (overlap <= 0) continue;

        const shiftX = dx / currentDistance * overlap * 0.5;
        const shiftY = dy / currentDistance * overlap * 0.5;
        first.x -= shiftX / Math.max(1, window.innerWidth) * 100;
        first.y -= shiftY / Math.max(1, window.innerHeight) * 100;
        second.x += shiftX / Math.max(1, window.innerWidth) * 100;
        second.y += shiftY / Math.max(1, window.innerHeight) * 100;
        clampBubblePosition(first);
        clampBubblePosition(second);
      }
    }
  }
}

function randomHue() {
  return bubbleHues[Math.floor(Math.random() * bubbleHues.length)];
}

function createBubble(first = false): BubblePop {
  const radius = bubbleRadius() * randomRange(0.94, 1.08);
  const point = chooseBubblePoint(radius, first);
  previousBubblePoint = point;

  return {
    id: `bubble-pop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    age: randomRange(0, 4),
    phaseAge: 0,
    phase: "floating",
    dwellProgress: 0,
    speed: randomRange(0.48, 0.86),
    wobble: randomRange(0, Math.PI * 2),
    drift: randomRange(-0.12, 0.12)
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

function targetPayload(bubble: BubblePop, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: bubble.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: bubble.enteredAt === undefined ? 0 : now - bubble.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addRipple(bubble: BubblePop) {
  const point = bubblePoint(bubble);
  ripples.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: 2.2,
    radius: bubble.radius * 0.68,
    hue: bubble.hue
  });
  if (ripples.length > 10) ripples.shift();
}

function cancelBubble(bubble: BubblePop, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(bubble, now, bubble.dwellProgress, reason));
  bubble.enteredAt = undefined;
  bubble.dwellProgress = 0;
  if (bubble.phase === "gazing") {
    bubble.phase = "floating";
    bubble.phaseAge = 0;
  }
}

function popBubble(bubble: BubblePop, now: number) {
  recordEvent("target-click", targetPayload(bubble, now, 1));
  recordSuccess({ targetId: bubble.id, hue: bubble.hue });
  void playBubblePopMelody(session.settings.sound);
  addRipple(bubble);
  bubble.phase = "popping";
  bubble.phaseAge = 0;
  bubble.dwellProgress = 1;
  bubble.enteredAt = undefined;
}

function closestGazeBubble() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: BubblePop | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const bubble of bubbles) {
    if (bubble.phase === "popping") continue;
    const point = bubblePoint(bubble);
    const hitRadius = bubble.radius * 1.24;
    const nextDistance = distance(point, pointer.value);
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = bubble;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function updateBubbleGaze(bubble: BubblePop, now: number, gazeBubble?: BubblePop) {
  if (bubble.phase === "popping" || session.status !== "running") return;
  const inside = gazeBubble === bubble;

  if (!inside) {
    if (bubble.enteredAt !== undefined) cancelBubble(bubble, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (bubble.enteredAt === undefined) {
    bubble.enteredAt = now;
    bubble.phase = "gazing";
    bubble.phaseAge = 0;
    recordEvent("target-enter", targetPayload(bubble, now, 0));
  }

  bubble.dwellProgress = Math.min(1, (now - bubble.enteredAt) / session.settings.dwellMs);
  if (bubble.dwellProgress >= 1) popBubble(bubble, now);
}

function ensureBubbles() {
  if (session.status !== "running") return;
  if (session.step >= session.maxSteps) {
    if (!bubbles.some((bubble) => bubble.phase === "popping")) finishSession("max-steps");
    return;
  }

  for (let index = bubbles.length; index < desiredBubbleCount(); index++) {
    bubbles.push(createBubble(bubbles.length === 0 && session.step === 0));
  }
}

function resetFloatingBubble(bubble: BubblePop) {
  const radius = bubbleRadius() * randomRange(0.94, 1.08);
  const point = chooseBubblePoint(radius, false);
  bubble.x = point.x;
  bubble.y = point.y;
  bubble.radius = radius;
  bubble.hue = randomHue();
  bubble.speed = randomRange(0.48, 0.86);
  bubble.wobble = randomRange(0, Math.PI * 2);
  bubble.drift = randomRange(-0.12, 0.12);
  bubble.age = 0;
  bubble.phaseAge = 0;
  bubble.phase = "floating";
  bubble.dwellProgress = 0;
  bubble.enteredAt = undefined;
}

function updateBubbles(delta: number, now: number) {
  ensureBubbles();
  const gazeBubble = closestGazeBubble();

  for (let index = bubbles.length - 1; index >= 0; index--) {
    const bubble = bubbles[index];
    bubble.age += delta;
    bubble.phaseAge += delta;

    if (bubble.phase === "popping") {
      if (bubble.phaseAge >= popSeconds) bubbles.splice(index, 1);
      continue;
    }

    bubble.y -= bubble.speed * session.settings.motionSpeed * delta;
    bubble.x += bubble.drift * session.settings.motionSpeed * delta;
    if (bubble.y < 8 || bubble.x < 6 || bubble.x > 94) resetFloatingBubble(bubble);
    updateBubbleGaze(bubble, now, gazeBubble);
  }
  separateBubbles();
}

function updateRipples(delta: number) {
  for (let index = ripples.length - 1; index >= 0; index--) {
    const ripple = ripples[index];
    ripple.age += delta;
    if (ripple.age >= ripple.life) ripples.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#d7f0ff");
  sky.addColorStop(0.5, "#f0eaff");
  sky.addColorStop(1, "#fff7e8");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.32;
  for (let index = 0; index < 5; index++) {
    const y = window.innerHeight * (0.18 + index * 0.15);
    const wave = Math.sin(now * 0.00012 + index) * window.innerWidth * 0.03;
    const gradient = context.createRadialGradient(window.innerWidth * (0.18 + index * 0.16) + wave, y, 0, window.innerWidth * (0.18 + index * 0.16) + wave, y, window.innerWidth * 0.34);
    gradient.addColorStop(0, index % 2 === 0 ? "rgb(255 255 255 / 54%)" : "rgb(196 228 255 / 42%)");
    gradient.addColorStop(1, "rgb(255 255 255 / 0%)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(window.innerWidth * (0.18 + index * 0.16) + wave, y, window.innerWidth * 0.36, window.innerHeight * 0.12, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawRipple(context: CanvasRenderingContext2D, ripple: Ripple) {
  const progress = Math.min(1, ripple.age / ripple.life);
  const alpha = (1 - progress) * 0.42;
  const radius = ripple.radius * (1 + progress * 2.15);

  context.save();
  context.strokeStyle = `hsla(${ripple.hue}, 78%, 68%, ${alpha})`;
  context.lineWidth = Math.max(2, ripple.radius * 0.035 * (1 - progress * 0.5));
  context.beginPath();
  context.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = `hsla(${ripple.hue + 28}, 92%, 88%, ${alpha * 0.55})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(ripple.x, ripple.y, radius * 0.64, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawBubble(context: CanvasRenderingContext2D, bubble: BubblePop) {
  const point = bubblePoint(bubble);
  const pop = bubble.phase === "popping" ? Math.min(1, bubble.phaseAge / popSeconds) : 0;
  const floatPulse = Math.sin(bubble.age * 0.9 + bubble.wobble) * 0.025;
  const radius = bubble.radius * (1 + floatPulse + bubble.dwellProgress * 0.1 + pop * 0.34);
  const alpha = bubble.phase === "popping" ? Math.max(0, 1 - pop) : 1;

  context.save();
  context.globalAlpha = alpha;

  const glow = context.createRadialGradient(point.x, point.y, radius * 0.08, point.x, point.y, radius * 1.9);
  glow.addColorStop(0, `hsla(${bubble.hue}, 96%, 88%, ${0.24 + bubble.dwellProgress * 0.16})`);
  glow.addColorStop(0.58, `hsla(${bubble.hue}, 80%, 76%, ${0.11 + bubble.dwellProgress * 0.08})`);
  glow.addColorStop(1, `hsla(${bubble.hue}, 80%, 74%, 0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(point.x, point.y, radius * 1.9, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.clip();

  const body = context.createRadialGradient(point.x - radius * 0.28, point.y - radius * 0.34, radius * 0.05, point.x, point.y, radius * 1.1);
  body.addColorStop(0, `hsla(${bubble.hue + 18}, 100%, 96%, 0.76)`);
  body.addColorStop(0.52, `hsla(${bubble.hue}, 82%, 84%, 0.34)`);
  body.addColorStop(1, `hsla(${bubble.hue - 16}, 72%, 70%, 0.18)`);
  context.fillStyle = body;
  context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);

  if (bubble.dwellProgress > 0) {
    const fillRadius = radius * (0.16 + bubble.dwellProgress * 0.84);
    const fill = context.createRadialGradient(point.x, point.y, radius * 0.04, point.x, point.y, fillRadius);
    fill.addColorStop(0, `hsla(${bubble.hue + 24}, 98%, 91%, ${0.48 + bubble.dwellProgress * 0.16})`);
    fill.addColorStop(0.72, `hsla(${bubble.hue}, 88%, 76%, ${0.28 + bubble.dwellProgress * 0.24})`);
    fill.addColorStop(1, `hsla(${bubble.hue - 12}, 76%, 68%, 0)`);
    context.fillStyle = fill;
    context.beginPath();
    context.arc(point.x, point.y, fillRadius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `hsla(${bubble.hue + 30}, 100%, 92%, ${0.22 + bubble.dwellProgress * 0.2})`;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, fillRadius * 0.82, 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();

  context.strokeStyle = `hsla(${bubble.hue}, 78%, 78%, ${0.42 + bubble.dwellProgress * 0.24})`;
  context.lineWidth = Math.max(2, radius * 0.026);
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = `hsla(${bubble.hue + 40}, 100%, 97%, ${0.48 + bubble.dwellProgress * 0.18})`;
  context.lineWidth = Math.max(2, radius * 0.035);
  context.lineCap = "round";
  context.beginPath();
  context.arc(point.x - radius * 0.08, point.y - radius * 0.1, radius * 0.72, Math.PI * 1.08, Math.PI * 1.5);
  context.stroke();

  context.fillStyle = `hsla(${bubble.hue + 44}, 100%, 98%, ${0.56 + bubble.dwellProgress * 0.16})`;
  context.beginPath();
  context.ellipse(point.x - radius * 0.32, point.y - radius * 0.36, radius * 0.14, radius * 0.08, -0.6, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const ripple of ripples) drawRipple(context, ripple);
  for (const bubble of bubbles) drawBubble(context, bubble);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateBubbles(delta, now);
    updateRipples(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function initBubbles() {
  bubbles.splice(0);
  ripples.splice(0);
  previousBubblePoint = undefined;
  resetBubblePopAudioSession();
  for (let index = 0; index < desiredBubbleCount(); index++) bubbles.push(createBubble(index === 0));
  separateBubbles();
}

function restart() {
  startSession();
  initBubbles();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initBubbles();
  window.addEventListener("resize", resizeCanvas);
  warmBubblePopAudio(session.settings.sound);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeBubblePopAudio();
});
</script>

<template>
  <div class="bubble-pop-shell">
    <canvas ref="canvasRef" class="bubble-pop-canvas" />

    <div class="compact-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="primary" density="comfortable" icon="mdi-arrow-left" size="small" variant="flat" @click="router.push(resolveMenuRoute())" />
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="primary"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="flat"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title=" пузыри"
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
.bubble-pop-shell {
  background: #d7f0ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.bubble-pop-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.compact-controls {
  background: rgb(var(--v-theme-surface) / 88%);
  border: 1px solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 18px;
  inset-block-start: max(16px, env(safe-area-inset-top));
  inset-inline-start: max(16px, env(safe-area-inset-left));
  opacity: 0.9;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 2;
}

.compact-controls:focus-within,
.compact-controls:hover {
  opacity: 0.95;
}
</style>
