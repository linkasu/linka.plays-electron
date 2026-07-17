<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeDuckAudio, playDuckMelody, resetDuckAudioSession, warmDuckAudio } from "./audio";
import { drawDuckScene, duckHitRadius, waterTop, type Duck, type Point, type Splash } from "./scene";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("ducks", {
  maxSteps: 999,
  overrides: { preset: "gentle", dwellMs: 850, sessionSeconds: 60, targetScale: 1.35, motionSpeed: 0.6, distractors: "none", hints: "high" },
  finishOnMaxSteps: false
});
useStartPromptAudio({ gameId: "ducks", soundEnabled: toRef(session.settings, "sound") });

const ducks = reactive<Duck[]>([]);
const splashes = reactive<Splash[]>([]);
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

function maxDuckCount() {
  return window.innerWidth < 760 ? 2 : 3;
}

function activeDuckCount() {
  if (session.step >= 2) return maxDuckCount();
  if (session.step >= 1) return Math.min(maxDuckCount(), 2);
  return 1;
}

function progressionSpeed() {
  return 1 + Math.min(0.78, session.step * 0.13);
}

function duckSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.18;
  return Math.min(140, Math.max(74, Math.min(viewportLimit, 78 * session.settings.targetScale)));
}

function laneY(index: number, count: number) {
  const top = waterTop() + window.innerHeight * 0.12;
  const bottom = window.innerHeight * 0.82;
  const spacing = count <= 1 ? 0.5 : index / (count - 1);
  return top + (bottom - top) * spacing + randomRange(-window.innerHeight * 0.012, window.innerHeight * 0.012);
}

function nextSpawnDirection() {
  let direction: -1 | 1 = Math.random() > 0.5 ? 1 : -1;
  if (spawnSequence % 2 === 1 && Math.random() < 0.72) direction = lastSpawnDirection === 1 ? -1 : 1;
  if (direction === lastSpawnDirection && sameSideSpawns >= 1) direction = direction === 1 ? -1 : 1;

  sameSideSpawns = direction === lastSpawnDirection ? sameSideSpawns + 1 : 0;
  lastSpawnDirection = direction;
  spawnSequence += 1;
  return direction;
}

function resetDuck(duck: Duck, index: number, fromEdge = false) {
  const direction = fromEdge ? nextSpawnDirection() : index % 2 === 0 ? 1 : -1;
  const depthScale = 0.58 + index / Math.max(1, maxDuckCount() - 1) * 0.58;
  const size = duckSize() * depthScale * randomRange(0.92, 1.08);
  const edgeDelay = size * (1.4 + index * 2.6 + randomRange(0, 1.8));
  duck.direction = direction;
  duck.size = size;
  duck.laneY = laneY(index, Math.max(1, maxDuckCount()));
  duck.y = duck.laneY;
  duck.x = fromEdge
    ? direction === 1 ? -edgeDelay : window.innerWidth + edgeDelay
    : window.innerWidth * ((index + 1) / (activeDuckCount() + 1));
  duck.speed = randomRange(24, 42) * session.settings.motionSpeed * progressionSpeed() * (0.92 + depthScale * 0.24);
  duck.bob = randomRange(0, Math.PI * 2);
  duck.state = "swimming";
  duck.dwellProgress = 0;
  duck.enteredAt = undefined;
  duck.hitAge = 0;
}

function createDuck(index: number, fromEdge = false): Duck {
  const duck: Duck = {
    id: `duck-${Date.now()}-${index}`,
    x: 0,
    y: 0,
    laneY: 0,
    size: 100,
    direction: 1,
    speed: 26,
    bob: 0,
    state: "swimming",
    dwellProgress: 0,
    hitAge: 0
  };
  resetDuck(duck, index, fromEdge);
  return duck;
}

function initDucks() {
  ducks.splice(0);
  spawnSequence = 0;
  sameSideSpawns = 0;
  for (let index = 0; index < activeDuckCount(); index++) ducks.push(createDuck(index, true));
}

function ensureProgressionDucks() {
  while (ducks.length < activeDuckCount()) ducks.push(createDuck(ducks.length, true));
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

function targetPayload(duck: Duck, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: duck.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: duck.enteredAt === undefined ? 0 : now - duck.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addSplash(duck: Duck) {
  splashes.push({
    x: duck.x,
    y: duck.y + duck.size * 0.22,
    age: 0,
    life: 1.1,
    radius: duck.size * 0.32
  });
  if (splashes.length > 8) splashes.shift();
}

function cancelDuck(duck: Duck, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(duck, now, duck.dwellProgress, reason));
  duck.dwellProgress = 0;
  duck.enteredAt = undefined;
}

function hitDuck(duck: Duck, now: number) {
  recordEvent("target-click", targetPayload(duck, now, 1));
  recordSuccess({ targetId: duck.id });
  void playDuckMelody(session.settings.sound);
  addSplash(duck);
  duck.state = "hit";
  duck.hitAge = 0;
  duck.dwellProgress = 1;
  duck.enteredAt = undefined;
}

function updateDuckGaze(duck: Duck, now: number) {
  if (duck.state !== "swimming" || session.status !== "running") return;
  const inside = pointer.value.valid && distance(duck, pointer.value) <= duckHitRadius(duck);

  if (!inside) {
    if (duck.enteredAt !== undefined) cancelDuck(duck, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (duck.enteredAt === undefined) {
    duck.enteredAt = now;
    recordEvent("target-enter", targetPayload(duck, now, 0));
  }

  duck.dwellProgress = Math.min(1, (now - duck.enteredAt) / session.settings.dwellMs);
  if (duck.dwellProgress >= 1) hitDuck(duck, now);
}

function updateDucks(delta: number, now: number) {
  ensureProgressionDucks();
  for (let index = 0; index < ducks.length; index++) {
    const duck = ducks[index];
    duck.x += duck.direction * duck.speed * delta;
    duck.bob += delta * 1.8;
    duck.y = duck.laneY + Math.sin(duck.bob) * duck.size * 0.035;

    if (duck.state === "hit") {
      duck.hitAge += delta;
      if (duck.hitAge > 0.75 && session.status === "running") resetDuck(duck, index, true);
      continue;
    }

    if (duck.x < -duck.size * 2 || duck.x > window.innerWidth + duck.size * 2) resetDuck(duck, index, true);
    updateDuckGaze(duck, now);
  }
}

function updateSplashes(delta: number) {
  for (let index = splashes.length - 1; index >= 0; index--) {
    const splash = splashes[index];
    splash.age += delta;
    if (splash.age >= splash.life) splashes.splice(index, 1);
  }
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawDuckScene(context, {
    ducks,
    splashes,
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
    updateDucks(delta, now);
    updateSplashes(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  splashes.splice(0);
  resetDuckAudioSession();
  startSession();
  initDucks();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initDucks();
  resetDuckAudioSession();
  warmDuckAudio(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeDuckAudio();
});
</script>

<template>
  <div class="ducks-shell">
    <canvas ref="canvasRef" class="ducks-canvas" />
    <GameHud title="Утки" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <GameResultDialog
      :model-value="resultVisible"
      title="Утки"
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
.ducks-shell {
  background: #92d8f0;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.ducks-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

</style>
