<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeFrogAudio, playFrogMelody, resetFrogAudioSession, warmFrogAudio } from "./audio";
import { bugHitRadius, drawFrogScene, laneBottom, laneTop, type Bug, type CatchBurst, type Point, type Tongue } from "./scene";

type CancelReason = "left" | "invalid-gaze" | "escaped";

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("frog", {
  maxSteps: 10,
  overrides: { preset: "gentle", dwellMs: 850, sessionSeconds: 90, targetScale: 1.35, motionSpeed: 0.62, distractors: "none", hints: "high" },
  finishOnMaxSteps: false
});

const bugs = reactive<Bug[]>([]);
const bursts = reactive<CatchBurst[]>([]);
const tongues = reactive<Tongue[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let spawnTimer = 999;
let lastSpawnKey = "";

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

function attempts() {
  return session.step + session.mistakes;
}

function activeBugLimit() {
  if (window.innerWidth < 860) return 1;
  return attempts() >= 4 ? 2 : 1;
}

function spawnDelaySeconds() {
  return Math.max(1.1, 2 * Math.pow(0.98, attempts()));
}

function progressionSpeed() {
  return 1 + Math.min(0.5, attempts() * 0.055);
}

function bugSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.17;
  return Math.min(132, Math.max(78, Math.min(viewportLimit, 78 * session.settings.targetScale)));
}

function laneY(laneIndex: number) {
  const top = laneTop();
  const bottom = laneBottom();
  const spacing = laneIndex / 2;
  return top + (bottom - top) * spacing + randomRange(-window.innerHeight * 0.018, window.innerHeight * 0.018);
}

function nextSpawnPoint() {
  const points = [
    { laneIndex: 0, direction: 1 as const },
    { laneIndex: 1, direction: 1 as const },
    { laneIndex: 2, direction: 1 as const },
    { laneIndex: 0, direction: -1 as const },
    { laneIndex: 1, direction: -1 as const },
    { laneIndex: 2, direction: -1 as const }
  ];
  const available = points.filter((point) => `${point.direction}:${point.laneIndex}` !== lastSpawnKey);
  const point = available[Math.floor(Math.random() * available.length)] ?? points[0];
  lastSpawnKey = `${point.direction}:${point.laneIndex}`;
  return point;
}

function spawnBug() {
  const spawn = nextSpawnPoint();
  const size = bugSize() * randomRange(0.9, 1.08);
  const edgeDelay = size * randomRange(1.25, 1.8);
  const bug: Bug = {
    id: `bug-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    x: spawn.direction === 1 ? -edgeDelay : window.innerWidth + edgeDelay,
    y: laneY(spawn.laneIndex),
    laneY: 0,
    laneIndex: spawn.laneIndex,
    size,
    direction: spawn.direction,
    speed: randomRange(58, 82) * session.settings.motionSpeed * progressionSpeed(),
    phase: randomRange(0, Math.PI * 2),
    state: "flying",
    dwellProgress: 0,
    caughtAge: 0
  };
  bug.laneY = bug.y;
  bugs.push(bug);
}

function initGameObjects() {
  bugs.splice(0);
  bursts.splice(0);
  tongues.splice(0);
  spawnTimer = 999;
  lastSpawnKey = "";
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

function targetPayload(bug: Bug, now: number, progress: number, reason?: CancelReason) {
  return {
    targetId: bug.id,
    laneIndex: bug.laneIndex,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: bug.enteredAt === undefined ? 0 : now - bug.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addBurst(bug: Bug) {
  bursts.push({
    x: bug.x,
    y: bug.y,
    age: 0,
    life: 1.05,
    radius: bug.size * 0.4
  });
  if (bursts.length > 8) bursts.shift();
}

function addTongue(target: Point) {
  tongues.push({
    x: target.x,
    y: target.y,
    age: 0,
    life: 0.42
  });
  if (tongues.length > 4) tongues.shift();
}

function finishIfAttemptsComplete() {
  if (attempts() >= session.maxSteps) finishSession("max-steps");
}

function cancelBug(bug: Bug, now: number, reason: Exclude<CancelReason, "escaped">) {
  recordEvent("target-cancel", targetPayload(bug, now, bug.dwellProgress, reason));
  bug.dwellProgress = 0;
  bug.enteredAt = undefined;
}

function catchBug(bug: Bug, now: number) {
  recordEvent("target-click", targetPayload(bug, now, 1));
  recordSuccess({ targetId: bug.id, laneIndex: bug.laneIndex });
  void playFrogMelody(session.settings.sound);
  addBurst(bug);
  addTongue(bug);
  bug.state = "caught";
  bug.caughtAge = 0;
  bug.dwellProgress = 1;
  bug.enteredAt = undefined;
  spawnTimer = Math.max(spawnTimer, spawnDelaySeconds() * 0.36);
  finishIfAttemptsComplete();
}

function missBug(bug: Bug, index: number, now: number) {
  recordEvent("target-cancel", targetPayload(bug, now, bug.dwellProgress, "escaped"));
  recordMistake({ targetId: bug.id, laneIndex: bug.laneIndex, reason: "escaped" });
  bugs.splice(index, 1);
  spawnTimer = Math.max(spawnTimer, spawnDelaySeconds() * 0.46);
  finishIfAttemptsComplete();
}

function updateBugGaze(bug: Bug, now: number) {
  if (bug.state !== "flying" || session.status !== "running") return;
  const inside = pointer.value.valid && distance(bug, pointer.value) <= bugHitRadius(bug);

  if (!inside) {
    if (bug.enteredAt !== undefined) cancelBug(bug, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (bug.enteredAt === undefined) {
    bug.enteredAt = now;
    recordEvent("target-enter", targetPayload(bug, now, 0));
  }

  bug.dwellProgress = Math.min(1, (now - bug.enteredAt) / session.settings.dwellMs);
  if (bug.dwellProgress >= 1) catchBug(bug, now);
}

function updateBugs(delta: number, now: number) {
  spawnTimer += delta;
  const limit = activeBugLimit();
  if (bugs.length < limit && spawnTimer >= spawnDelaySeconds()) {
    spawnBug();
    spawnTimer = 0;
  }
  if (!bugs.length && spawnTimer >= 0.35) {
    spawnBug();
    spawnTimer = 0;
  }

  for (let index = bugs.length - 1; index >= 0; index--) {
    if (session.status !== "running") break;
    const bug = bugs[index];
    bug.phase += delta * 2.6;

    if (bug.state === "caught") {
      bug.caughtAge += delta;
      bug.y -= delta * bug.size * 0.22;
      if (bug.caughtAge > 0.78) bugs.splice(index, 1);
      continue;
    }

    bug.x += bug.direction * bug.speed * delta;
    bug.y = bug.laneY + Math.sin(bug.phase) * bug.size * 0.075;

    if (bug.x < -bug.size * 2 || bug.x > window.innerWidth + bug.size * 2) {
      missBug(bug, index, now);
      continue;
    }

    updateBugGaze(bug, now);
  }
}

function updateEffects(delta: number) {
  for (let index = bursts.length - 1; index >= 0; index--) {
    bursts[index].age += delta;
    if (bursts[index].age >= bursts[index].life) bursts.splice(index, 1);
  }
  for (let index = tongues.length - 1; index >= 0; index--) {
    tongues[index].age += delta;
    if (tongues[index].age >= tongues[index].life) tongues.splice(index, 1);
  }
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawFrogScene(context, {
    bugs,
    bursts,
    tongues,
    pointer: pointer.value,
    running: session.status === "running",
    now,
    durationMs: durationMs.value,
    sessionSeconds: session.settings.sessionSeconds,
    attempts: attempts(),
    maxAttempts: session.maxSteps
  });
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateBugs(delta, now);
    updateEffects(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  initGameObjects();
  resetFrogAudioSession();
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initGameObjects();
  resetFrogAudioSession();
  warmFrogAudio(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeFrogAudio();
});
</script>

<template>
  <div class="frog-shell">
    <canvas ref="canvasRef" class="frog-canvas" />
    <GameHud title="Жаба" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <GameResultDialog
      :model-value="resultVisible"
      title="Жаба"
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
.frog-shell {
  background: #17204c;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.frog-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

</style>
