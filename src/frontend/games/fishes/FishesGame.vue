<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSession } from "../../core/session";
import { disposeFishAudio, playFishMelody, resetFishAudioSession, warmFishAudio } from "./audio";
import { drawFishScene, fishHitRadius, swimBottom, swimTop, type Bubble, type CatchRipple, type Fish, type Point } from "./scene";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("fishes", {
  preset: "gentle",
  maxSteps: 999,
  dwellMs: 850,
  sessionSeconds: 60,
  targetScale: 1.35,
  motionSpeed: 0.62,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false
});

const fishes = reactive<Fish[]>([]);
const bubbles = reactive<Bubble[]>([]);
const ripples = reactive<CatchRipple[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let spawnSequence = 0;
let lastSpawnDirection: -1 | 1 = 1;
let sameSideSpawns = 0;

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

function maxFishCount() {
  return window.innerWidth < 760 ? 2 : 3;
}

function activeFishCount() {
  if (session.step >= 2) return maxFishCount();
  if (session.step >= 1) return Math.min(maxFishCount(), 2);
  return 1;
}

function progressionSpeed() {
  return 1 + Math.min(0.72, session.step * 0.12);
}

function fishSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.17;
  return Math.min(136, Math.max(76, Math.min(viewportLimit, 82 * session.settings.targetScale)));
}

function laneY(index: number, count: number) {
  const top = swimTop();
  const bottom = swimBottom();
  const spacing = count <= 1 ? 0.48 : index / (count - 1);
  return top + (bottom - top) * spacing + randomRange(-window.innerHeight * 0.018, window.innerHeight * 0.018);
}

function nextSpawnDirection() {
  let direction: -1 | 1 = Math.random() > 0.5 ? 1 : -1;
  if (spawnSequence % 2 === 1 && Math.random() < 0.76) direction = lastSpawnDirection === 1 ? -1 : 1;
  if (direction === lastSpawnDirection && sameSideSpawns >= 1) direction = direction === 1 ? -1 : 1;

  sameSideSpawns = direction === lastSpawnDirection ? sameSideSpawns + 1 : 0;
  lastSpawnDirection = direction;
  spawnSequence += 1;
  return direction;
}

function resetFish(fish: Fish, index: number, fromEdge = false) {
  const direction = fromEdge ? nextSpawnDirection() : index % 2 === 0 ? 1 : -1;
  const depthScale = 0.76 + index / Math.max(1, maxFishCount() - 1) * 0.34;
  const size = fishSize() * depthScale * randomRange(0.9, 1.08);
  const edgeDelay = size * (1.4 + index * 2.4 + randomRange(0, 1.6));
  fish.direction = direction;
  fish.size = size;
  fish.laneY = laneY(index, Math.max(1, maxFishCount()));
  fish.y = fish.laneY;
  fish.x = fromEdge
    ? direction === 1 ? -edgeDelay : window.innerWidth + edgeDelay
    : window.innerWidth * ((index + 1) / (activeFishCount() + 1));
  fish.speed = randomRange(22, 38) * session.settings.motionSpeed * progressionSpeed() * (0.92 + depthScale * 0.2);
  fish.phase = randomRange(0, Math.PI * 2);
  fish.hue = [24, 190, 318, 46, 264][index % 5];
  fish.state = "swimming";
  fish.dwellProgress = 0;
  fish.enteredAt = undefined;
  fish.caughtAge = 0;
}

function createFish(index: number, fromEdge = false): Fish {
  const fish: Fish = {
    id: `fish-${Date.now()}-${index}`,
    x: 0,
    y: 0,
    laneY: 0,
    size: 100,
    direction: 1,
    speed: 26,
    phase: 0,
    hue: 24,
    state: "swimming",
    dwellProgress: 0,
    caughtAge: 0
  };
  resetFish(fish, index, fromEdge);
  return fish;
}

function initBubbles() {
  bubbles.splice(0);
  const count = window.innerWidth < 760 ? 10 : 16;
  for (let index = 0; index < count; index++) {
    bubbles.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(window.innerHeight * 0.2, window.innerHeight * 0.86),
      radius: randomRange(3, 9),
      speed: randomRange(10, 22),
      wobble: randomRange(0, Math.PI * 2),
      alpha: randomRange(0.28, 0.58)
    });
  }
}

function initFishes() {
  fishes.splice(0);
  ripples.splice(0);
  spawnSequence = 0;
  sameSideSpawns = 0;
  for (let index = 0; index < activeFishCount(); index++) fishes.push(createFish(index, true));
}

function ensureProgressionFishes() {
  while (fishes.length < activeFishCount()) fishes.push(createFish(fishes.length, true));
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

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function targetPayload(fish: Fish, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: fish.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: fish.enteredAt === undefined ? 0 : now - fish.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addCatchRipple(fish: Fish) {
  ripples.push({
    x: fish.x,
    y: fish.y,
    age: 0,
    life: 1.2,
    radius: fish.size * 0.36,
    hue: fish.hue
  });
  if (ripples.length > 8) ripples.shift();
}

function cancelFish(fish: Fish, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(fish, now, fish.dwellProgress, reason));
  fish.dwellProgress = 0;
  fish.enteredAt = undefined;
}

function catchFish(fish: Fish, now: number) {
  recordEvent("target-click", targetPayload(fish, now, 1));
  recordSuccess({ targetId: fish.id, hue: fish.hue });
  void playFishMelody(session.settings.sound);
  addCatchRipple(fish);
  fish.state = "caught";
  fish.caughtAge = 0;
  fish.dwellProgress = 1;
  fish.enteredAt = undefined;
}

function updateFishGaze(fish: Fish, now: number) {
  if (fish.state !== "swimming" || session.status !== "running") return;
  const inside = pointer.value.valid && distance(fish, pointer.value) <= fishHitRadius(fish);

  if (!inside) {
    if (fish.enteredAt !== undefined) cancelFish(fish, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (fish.enteredAt === undefined) {
    fish.enteredAt = now;
    recordEvent("target-enter", targetPayload(fish, now, 0));
  }

  fish.dwellProgress = Math.min(1, (now - fish.enteredAt) / session.settings.dwellMs);
  if (fish.dwellProgress >= 1) catchFish(fish, now);
}

function updateFishes(delta: number, now: number) {
  ensureProgressionFishes();
  for (let index = 0; index < fishes.length; index++) {
    const fish = fishes[index];
    fish.x += fish.direction * fish.speed * delta;
    fish.phase += delta * 2.1;
    fish.y = fish.laneY + Math.sin(fish.phase) * fish.size * 0.055;

    if (fish.state === "caught") {
      fish.caughtAge += delta;
      fish.y -= delta * fish.size * 0.22;
      if (fish.caughtAge > 0.78 && session.status === "running") resetFish(fish, index, true);
      continue;
    }

    if (fish.x < -fish.size * 2 || fish.x > window.innerWidth + fish.size * 2) resetFish(fish, index, true);
    updateFishGaze(fish, now);
  }
}

function updateBubbles(delta: number) {
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * session.settings.motionSpeed * delta;
    bubble.wobble += delta * 1.8;
    bubble.x += Math.sin(bubble.wobble) * delta * 8;
    if (bubble.y < window.innerHeight * 0.12) {
      bubble.x = randomRange(0, window.innerWidth);
      bubble.y = randomRange(window.innerHeight * 0.72, window.innerHeight * 0.92);
      bubble.radius = randomRange(3, 9);
      bubble.speed = randomRange(10, 22);
      bubble.alpha = randomRange(0.28, 0.58);
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

function draw(context: CanvasRenderingContext2D, now: number) {
  drawFishScene(context, {
    fishes,
    bubbles,
    ripples,
    pointer: pointer.value,
    running: session.status === "running",
    now,
    durationMs: durationMs.value,
    sessionSeconds: session.settings.sessionSeconds
  });
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateFishes(delta, now);
    updateBubbles(delta);
    updateRipples(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  resetFishAudioSession();
  startSession();
  initBubbles();
  initFishes();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initBubbles();
  initFishes();
  resetFishAudioSession();
  warmFishAudio(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeFishAudio();
});
</script>

<template>
  <div class="fishes-shell">
    <canvas ref="canvasRef" class="fishes-canvas" />

    <div class="quiet-controls d-flex align-center ga-2 pa-1">
      <v-btn aria-label="В меню" class="exit-button" color="surface" density="comfortable" prepend-icon="mdi-arrow-left" size="small" variant="tonal" @click="router.push('/')">
        В меню
      </v-btn>
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="surface"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="text"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Рыбки"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push('/')"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.fishes-shell {
  background: #0b3558;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.fishes-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.quiet-controls {
  background: rgb(5 33 56 / 58%);
  border: 1px solid rgb(219 250 255 / 22%);
  border-radius: 20px;
  box-shadow: 0 10px 28px rgb(0 30 54 / 18%);
  inset-block-start: max(16px, env(safe-area-inset-top));
  inset-inline-start: max(16px, env(safe-area-inset-left));
  opacity: 0.82;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 2;
}

.exit-button {
  min-inline-size: 86px;
}

.quiet-controls:focus-within,
.quiet-controls:hover {
  opacity: 0.95;
}
</style>
