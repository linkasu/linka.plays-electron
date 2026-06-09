<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type JellyfishPhase = "drifting" | "glowing" | "resting";
type Jellyfish = Point & {
  id: string;
  size: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: JellyfishPhase;
  dwellProgress: number;
  enteredAt?: number;
  laneY: number;
  speed: number;
  direction: -1 | 1;
  wave: number;
};
type Bubble = Point & {
  radius: number;
  speed: number;
  wobble: number;
  alpha: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("jellyfish", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1450,
  sessionSeconds: 85,
  targetScale: 1.55,
  motionSpeed: 0.36,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const jellyfish = reactive<Jellyfish[]>([]);
const bubbles = reactive<Bubble[]>([]);
const resultVisible = computed(() => session.status === "finished");

const hues = [184, 198, 214, 272, 304];
const restSeconds = 1.8;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let spawnIndex = 0;
let finishAfter = 0;

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
  initBubbles();
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function jellyfishSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(136, Math.max(82, Math.min(viewportLimit, 88 * session.settings.targetScale)));
}

function desiredJellyfishCount() {
  return window.innerWidth < 720 ? 2 : 3;
}

function swimTop() {
  return Math.max(128, window.innerHeight * 0.22);
}

function swimBottom() {
  return window.innerHeight * 0.82;
}

function jellyfishPoint(jelly: Jellyfish) {
  return {
    x: jelly.x + Math.sin(jelly.age * 0.42 + jelly.wave) * jelly.size * 0.09,
    y: jelly.y + Math.cos(jelly.age * 0.34 + jelly.wave) * jelly.size * 0.08
  };
}

function randomHue(index: number) {
  return hues[index % hues.length];
}

function resetJellyfish(jelly: Jellyfish, index: number, fromEdge = true) {
  const direction: -1 | 1 = index % 2 === 0 ? 1 : -1;
  const size = jellyfishSize() * randomRange(0.9, 1.08);
  const laneCount = Math.max(1, desiredJellyfishCount());
  const laneProgress = laneCount === 1 ? 0.48 : index / (laneCount - 1);
  const laneY = swimTop() + (swimBottom() - swimTop()) * laneProgress + randomRange(-window.innerHeight * 0.035, window.innerHeight * 0.035);

  jelly.size = size;
  jelly.direction = direction;
  jelly.x = fromEdge ? direction === 1 ? -size * randomRange(1.2, 2.3) : window.innerWidth + size * randomRange(1.2, 2.3) : window.innerWidth * ((index + 1) / (desiredJellyfishCount() + 1));
  jelly.y = laneY;
  jelly.laneY = laneY;
  jelly.speed = randomRange(12, 22) * session.settings.motionSpeed;
  jelly.hue = randomHue(index + spawnIndex);
  jelly.phase = "drifting";
  jelly.phaseAge = 0;
  jelly.dwellProgress = 0;
  jelly.enteredAt = undefined;
  jelly.wave = randomRange(0, Math.PI * 2);
  spawnIndex += 1;
}

function createJellyfish(index: number, fromEdge = false): Jellyfish {
  const jelly: Jellyfish = {
    id: `jellyfish-${Date.now()}-${index}`,
    x: 0,
    y: 0,
    size: 100,
    hue: randomHue(index),
    age: randomRange(0, 4),
    phaseAge: 0,
    phase: "drifting",
    dwellProgress: 0,
    laneY: 0,
    speed: 12,
    direction: 1,
    wave: randomRange(0, Math.PI * 2)
  };
  resetJellyfish(jelly, index, fromEdge);
  return jelly;
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

function targetPayload(jelly: Jellyfish, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: jelly.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: jelly.enteredAt === undefined ? 0 : now - jelly.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function cancelJellyfish(jelly: Jellyfish, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(jelly, now, jelly.dwellProgress, reason));
  jelly.enteredAt = undefined;
  jelly.dwellProgress = 0;
  if (jelly.phase === "glowing") {
    jelly.phase = "drifting";
    jelly.phaseAge = 0;
  }
}

function rewardJellyfish(jelly: Jellyfish, now: number) {
  recordEvent("target-click", targetPayload(jelly, now, 1));
  recordSuccess({ targetId: jelly.id, hue: jelly.hue });
  jelly.phase = "resting";
  jelly.phaseAge = 0;
  jelly.dwellProgress = 1;
  jelly.enteredAt = undefined;

  if (session.step >= session.maxSteps) finishAfter = now + 1500;
}

function closestJellyfish() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: Jellyfish | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const jelly of jellyfish) {
    if (jelly.phase === "resting") continue;
    const point = jellyfishPoint(jelly);
    const nextDistance = distance(point, pointer.value);
    const hitRadius = jelly.size * 1.24;
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = jelly;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function updateJellyfishGaze(jelly: Jellyfish, now: number, gazeJelly?: Jellyfish) {
  if (jelly.phase === "resting" || session.status !== "running") return;
  const inside = gazeJelly === jelly;

  if (!inside) {
    if (jelly.enteredAt !== undefined) cancelJellyfish(jelly, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (jelly.enteredAt === undefined) {
    jelly.enteredAt = now;
    jelly.phase = "glowing";
    jelly.phaseAge = 0;
    recordEvent("target-enter", targetPayload(jelly, now, 0));
  }

  jelly.dwellProgress = Math.min(1, (now - jelly.enteredAt) / session.settings.dwellMs);
  if (jelly.dwellProgress >= 1) rewardJellyfish(jelly, now);
}

function ensureJellyfish() {
  while (jellyfish.length < desiredJellyfishCount()) jellyfish.push(createJellyfish(jellyfish.length, true));
  while (jellyfish.length > desiredJellyfishCount()) jellyfish.pop();
}

function updateJellyfish(delta: number, now: number) {
  ensureJellyfish();

  if (finishAfter > 0 && now >= finishAfter) {
    finishSession("max-steps");
    return;
  }

  const gazeJelly = closestJellyfish();
  for (let index = 0; index < jellyfish.length; index++) {
    const jelly = jellyfish[index];
    jelly.age += delta;
    jelly.phaseAge += delta;
    jelly.x += jelly.direction * jelly.speed * delta;
    jelly.y = jelly.laneY + Math.sin(jelly.age * 0.28 + jelly.wave) * jelly.size * 0.12;

    if (jelly.phase === "resting") {
      if (jelly.phaseAge >= restSeconds && session.status === "running" && session.step < session.maxSteps) resetJellyfish(jelly, index, true);
      continue;
    }

    if (jelly.x < -jelly.size * 2.4 || jelly.x > window.innerWidth + jelly.size * 2.4) resetJellyfish(jelly, index, true);
    updateJellyfishGaze(jelly, now, gazeJelly);
  }
}

function initBubbles() {
  bubbles.splice(0);
  const count = window.innerWidth < 720 ? 14 : 22;
  for (let index = 0; index < count; index++) {
    bubbles.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(window.innerHeight * 0.18, window.innerHeight * 0.94),
      radius: randomRange(2.5, 8),
      speed: randomRange(5, 13),
      wobble: randomRange(0, Math.PI * 2),
      alpha: randomRange(0.16, 0.42)
    });
  }
}

function initJellyfish() {
  jellyfish.splice(0);
  spawnIndex = 0;
  finishAfter = 0;
  for (let index = 0; index < desiredJellyfishCount(); index++) jellyfish.push(createJellyfish(index, false));
}

function updateBubbles(delta: number) {
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * session.settings.motionSpeed * delta;
    bubble.wobble += delta * 0.8;
    bubble.x += Math.sin(bubble.wobble) * delta * 5;
    if (bubble.y < window.innerHeight * 0.12) {
      bubble.x = randomRange(0, window.innerWidth);
      bubble.y = randomRange(window.innerHeight * 0.76, window.innerHeight * 0.96);
      bubble.radius = randomRange(2.5, 8);
    }
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const water = context.createLinearGradient(0, 0, 0, window.innerHeight);
  water.addColorStop(0, "#09284f");
  water.addColorStop(0.5, "#103966");
  water.addColorStop(1, "#071a35");
  context.fillStyle = water;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.24;
  for (let index = 0; index < 5; index++) {
    const y = window.innerHeight * (0.16 + index * 0.15);
    const drift = Math.sin(now * 0.00016 + index * 1.8) * window.innerWidth * 0.06;
    const light = context.createRadialGradient(window.innerWidth * (0.18 + index * 0.18) + drift, y, 0, window.innerWidth * (0.18 + index * 0.18) + drift, y, window.innerWidth * 0.32);
    light.addColorStop(0, "rgb(162 231 255 / 48%)");
    light.addColorStop(1, "rgb(162 231 255 / 0%)");
    context.fillStyle = light;
    context.beginPath();
    context.ellipse(window.innerWidth * (0.18 + index * 0.18) + drift, y, window.innerWidth * 0.34, window.innerHeight * 0.12, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBubble(context: CanvasRenderingContext2D, bubble: Bubble) {
  context.save();
  context.globalAlpha = bubble.alpha;
  context.strokeStyle = "rgb(202 246 255 / 62%)";
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawJellyfish(context: CanvasRenderingContext2D, jelly: Jellyfish) {
  const point = jellyfishPoint(jelly);
  const gaze = jelly.phase === "glowing" ? Math.max(0.28, jelly.dwellProgress) : jelly.dwellProgress * Math.max(0, 1 - jelly.phaseAge / restSeconds);
  const rest = jelly.phase === "resting" ? Math.min(1, jelly.phaseAge / restSeconds) : 0;
  const pulse = 0.5 + Math.sin(jelly.age * 1.35 + jelly.wave) * 0.5;
  const size = jelly.size * (1 + pulse * 0.035 + gaze * 0.08);
  const capY = point.y - size * 0.08;

  context.save();
  context.globalCompositeOperation = "lighter";
  const halo = context.createRadialGradient(point.x, point.y, size * 0.08, point.x, point.y, size * (1.7 + gaze * 0.52));
  halo.addColorStop(0, `hsla(${jelly.hue + 18}, 100%, 88%, ${0.18 + gaze * 0.24})`);
  halo.addColorStop(0.48, `hsla(${jelly.hue}, 88%, 70%, ${0.08 + gaze * 0.18})`);
  halo.addColorStop(1, `hsla(${jelly.hue}, 82%, 54%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, size * (1.7 + gaze * 0.52), 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = 1 - rest * 0.18;
  const body = context.createRadialGradient(point.x - size * 0.22, capY - size * 0.24, size * 0.04, point.x, capY, size * 0.94);
  body.addColorStop(0, `hsla(${jelly.hue + 32}, 100%, 96%, ${0.76 + gaze * 0.14})`);
  body.addColorStop(0.52, `hsla(${jelly.hue}, 86%, 80%, ${0.44 + gaze * 0.22})`);
  body.addColorStop(1, `hsla(${jelly.hue - 24}, 72%, 58%, ${0.22 + gaze * 0.18})`);
  context.fillStyle = body;
  context.beginPath();
  context.moveTo(point.x - size * 0.62, capY + size * 0.05);
  context.bezierCurveTo(point.x - size * 0.56, capY - size * 0.56, point.x + size * 0.56, capY - size * 0.56, point.x + size * 0.62, capY + size * 0.05);
  context.quadraticCurveTo(point.x + size * 0.46, capY + size * 0.48, point.x, capY + size * 0.48);
  context.quadraticCurveTo(point.x - size * 0.46, capY + size * 0.48, point.x - size * 0.62, capY + size * 0.05);
  context.fill();

  context.strokeStyle = `hsla(${jelly.hue + 36}, 100%, 94%, ${0.44 + gaze * 0.28})`;
  context.lineWidth = Math.max(2, size * 0.028);
  context.lineCap = "round";
  context.beginPath();
  context.arc(point.x - size * 0.12, capY - size * 0.04, size * 0.44, Math.PI * 1.12, Math.PI * 1.58);
  context.stroke();

  for (let index = -3; index <= 3; index++) {
    const spread = index / 3;
    const startX = point.x + spread * size * 0.42;
    const startY = capY + size * 0.36;
    const length = size * (0.66 + (3 - Math.abs(index)) * 0.08);
    const sway = Math.sin(jelly.age * 0.72 + jelly.wave + index) * size * 0.12;
    context.strokeStyle = `hsla(${jelly.hue + 18}, 92%, 88%, ${0.28 + gaze * 0.24})`;
    context.lineWidth = Math.max(1.4, size * (0.014 + gaze * 0.004));
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(startX + sway * 0.4, startY + length * 0.34, startX - sway * 0.2, startY + length * 0.68, startX + sway, startY + length);
    context.stroke();
  }

  if (gaze > 0) {
    context.strokeStyle = `hsla(${jelly.hue + 54}, 100%, 94%, ${0.3 + gaze * 0.34})`;
    context.lineWidth = Math.max(2, size * 0.024);
    context.setLineDash([Math.max(8, size * 0.08), Math.max(10, size * 0.1)]);
    context.beginPath();
    context.arc(point.x, point.y, size * (0.86 + gaze * 0.14), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.12, jelly.dwellProgress));
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const bubble of bubbles) drawBubble(context, bubble);
  for (const jelly of jellyfish) drawJellyfish(context, jelly);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateJellyfish(delta, now);
    updateBubbles(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  initJellyfish();
  initBubbles();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initJellyfish();
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
  <div class="jellyfish-shell">
    <canvas ref="canvasRef" class="jellyfish-canvas" />

    <GameHud title="Медузы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <GameResultDialog
      :model-value="resultVisible"
      title="Медузы"
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
.jellyfish-shell {
  background: #09284f;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.jellyfish-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
