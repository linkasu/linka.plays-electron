<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type SnowflakePhase = "falling" | "melting" | "melted";
type Snowflake = Point & {
  id: string;
  size: number;
  speed: number;
  drift: number;
  wobble: number;
  age: number;
  phaseAge: number;
  phase: SnowflakePhase;
  dwellProgress: number;
  glow: number;
  enteredAt?: number;
  arms: number;
  hue: number;
};
type GazeGlow = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("snowflakes", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1400,
  sessionSeconds: 85,
  targetScale: 1.55,
  motionSpeed: 0.32,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const snowflakes = reactive<Snowflake[]>([]);
const glows = reactive<GazeGlow[]>([]);
const resultVisible = computed(() => session.status === "finished");

const meltSeconds = 1.45;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let lastGlowAt = 0;
let finishAfter = 0;
let spawnIndex = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  initSnowflakes();
}

function desiredSnowflakeCount() {
  return window.innerWidth < 720 ? 24 : 38;
}

function snowflakeSize() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.075;
  return Math.min(54, Math.max(28, Math.min(viewportLimit, 34 * session.settings.targetScale)));
}

function gazeRadius(flake: Snowflake) {
  return Math.max(112, flake.size * 3.15) * session.settings.targetScale;
}

function resetSnowflake(flake: Snowflake, index: number, fromTop = true) {
  const size = snowflakeSize() * randomRange(0.78, 1.16);
  flake.id = `snowflake-${Date.now()}-${spawnIndex}-${index}`;
  flake.x = randomRange(size, Math.max(size, window.innerWidth - size));
  flake.y = fromTop ? randomRange(-window.innerHeight * 0.22, -size * 2) : randomRange(window.innerHeight * 0.1, window.innerHeight * 0.92);
  flake.size = size;
  flake.speed = randomRange(20, 38) * session.settings.motionSpeed;
  flake.drift = randomRange(-12, 12) * session.settings.motionSpeed;
  flake.wobble = randomRange(0, Math.PI * 2);
  flake.age = randomRange(0, 8);
  flake.phaseAge = 0;
  flake.phase = "falling";
  flake.dwellProgress = 0;
  flake.glow = 0;
  flake.enteredAt = undefined;
  flake.arms = Math.random() > 0.38 ? 6 : 8;
  flake.hue = randomRange(194, 218);
  spawnIndex += 1;
}

function createSnowflake(index: number, fromTop = false): Snowflake {
  const flake: Snowflake = {
    id: `snowflake-${Date.now()}-${index}`,
    x: 0,
    y: 0,
    size: 36,
    speed: 10,
    drift: 0,
    wobble: 0,
    age: 0,
    phaseAge: 0,
    phase: "falling",
    dwellProgress: 0,
    glow: 0,
    arms: 6,
    hue: 204
  };
  resetSnowflake(flake, index, fromTop);
  return flake;
}

function initSnowflakes() {
  snowflakes.splice(0);
  spawnIndex = 0;
  finishAfter = 0;
  const count = desiredSnowflakeCount();
  for (let index = 0; index < count; index++) snowflakes.push(createSnowflake(index, false));
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

function targetPayload(flake: Snowflake, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: flake.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: flake.enteredAt === undefined ? 0 : now - flake.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addGazeGlow(x: number, y: number, radius: number, hue: number) {
  glows.push({
    x,
    y,
    age: 0,
    life: randomRange(1.9, 3.1),
    radius,
    hue
  });
  if (glows.length > 30) glows.shift();
}

function addPointerGlow(now: number) {
  if (!pointer.value.valid || now - lastGlowAt < 150) return;
  lastGlowAt = now;
  addGazeGlow(pointer.value.x, pointer.value.y, randomRange(76, 124) * session.settings.targetScale, randomRange(190, 215));
}

function closestSnowflake() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: Snowflake | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const flake of snowflakes) {
    if (flake.phase === "melted") continue;
    const nextDistance = distance(flake, pointer.value);
    if (nextDistance <= gazeRadius(flake) && nextDistance < closestDistance) {
      closest = flake;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function cancelSnowflake(flake: Snowflake, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(flake, now, flake.dwellProgress, reason));
  flake.enteredAt = undefined;
  flake.dwellProgress = 0;
  if (flake.phase === "melting") {
    flake.phase = "falling";
    flake.phaseAge = 0;
  }
}

function meltSnowflake(flake: Snowflake, now: number) {
  recordEvent("target-click", targetPayload(flake, now, 1));
  recordSuccess({ targetId: flake.id, mode: "snowflake-melt" });
  addGazeGlow(flake.x, flake.y, gazeRadius(flake) * 0.72, flake.hue);
  flake.phase = "melted";
  flake.phaseAge = 0;
  flake.dwellProgress = 1;
  flake.glow = 1;
  flake.enteredAt = undefined;

  if (session.step >= session.maxSteps) finishAfter = now + 1800;
}

function updateSnowflakeGaze(flake: Snowflake, now: number, gazeFlake?: Snowflake) {
  if (flake.phase === "melted" || session.status !== "running") return;
  const inside = gazeFlake === flake;

  if (!inside) {
    if (flake.enteredAt !== undefined) cancelSnowflake(flake, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (flake.enteredAt === undefined) {
    flake.enteredAt = now;
    flake.phase = "melting";
    flake.phaseAge = 0;
    recordEvent("target-enter", targetPayload(flake, now, 0));
  }

  flake.dwellProgress = Math.min(1, (now - flake.enteredAt) / session.settings.dwellMs);
  if (flake.dwellProgress >= 1) meltSnowflake(flake, now);
}

function updateGlows(delta: number) {
  for (let index = glows.length - 1; index >= 0; index--) {
    const glow = glows[index];
    glow.age += delta;
    if (glow.age >= glow.life) glows.splice(index, 1);
  }
}

function updateSnowflakes(delta: number, now: number) {
  if (finishAfter > 0 && now >= finishAfter) {
    finishSession("max-steps");
    return;
  }

  const gazeFlake = closestSnowflake();
  for (let index = 0; index < snowflakes.length; index++) {
    const flake = snowflakes[index];
    flake.age += delta;
    flake.phaseAge += delta;

    const nearGaze = pointer.value.valid ? Math.max(0, 1 - distance(flake, pointer.value) / gazeRadius(flake)) : 0;
    flake.glow += (Math.max(nearGaze, flake.dwellProgress) - flake.glow) * Math.min(1, delta * 4.2);

    if (flake.phase === "melted") {
      if (flake.phaseAge >= meltSeconds && session.step < session.maxSteps) resetSnowflake(flake, index, true);
      continue;
    }

    const sway = Math.sin(flake.age * 0.7 + flake.wobble) * 8 * session.settings.motionSpeed;
    flake.x += (flake.drift + sway) * delta;
    flake.y += flake.speed * delta;

    if (flake.x < -flake.size * 2) flake.x = window.innerWidth + flake.size;
    if (flake.x > window.innerWidth + flake.size * 2) flake.x = -flake.size;
    if (flake.y > window.innerHeight + flake.size * 2) resetSnowflake(flake, index, true);

    updateSnowflakeGaze(flake, now, gazeFlake);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#dff4ff");
  sky.addColorStop(0.56, "#f3fbff");
  sky.addColorStop(1, "#d8ecf6");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalAlpha = 0.42;
  for (let index = 0; index < 5; index++) {
    const x = window.innerWidth * (0.12 + index * 0.2) + Math.sin(now * 0.00012 + index) * window.innerWidth * 0.035;
    const y = window.innerHeight * (0.12 + index * 0.075);
    const cloud = context.createRadialGradient(x, y, 0, x, y, window.innerWidth * 0.24);
    cloud.addColorStop(0, "rgb(255 255 255 / 74%)");
    cloud.addColorStop(1, "rgb(255 255 255 / 0%)");
    context.fillStyle = cloud;
    context.beginPath();
    context.ellipse(x, y, window.innerWidth * 0.22, window.innerHeight * 0.08, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawGlow(context: CanvasRenderingContext2D, glow: GazeGlow) {
  const progress = Math.min(1, glow.age / glow.life);
  const radius = glow.radius * (1 + progress * 0.85);
  const alpha = (1 - progress) * 0.22;
  const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, radius);
  gradient.addColorStop(0, `hsla(${glow.hue}, 100%, 96%, ${alpha})`);
  gradient.addColorStop(0.48, `hsla(${glow.hue + 14}, 88%, 82%, ${alpha * 0.36})`);
  gradient.addColorStop(1, `hsla(${glow.hue}, 80%, 72%, 0)`);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(glow.x, glow.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSnowflake(context: CanvasRenderingContext2D, flake: Snowflake) {
  const melt = flake.phase === "melted" ? Math.min(1, flake.phaseAge / meltSeconds) : 0;
  const gaze = Math.max(flake.glow, flake.dwellProgress * 0.75);
  const pulse = 0.5 + Math.sin(flake.age * 1.8 + flake.wobble) * 0.5;
  const radius = flake.size * (1 + gaze * 0.18 - melt * 0.34 + pulse * 0.02);
  const alpha = Math.max(0, 0.78 + gaze * 0.22 - melt);

  context.save();
  context.translate(flake.x, flake.y);
  context.rotate(Math.sin(flake.age * 0.24 + flake.wobble) * 0.18);

  if (gaze > 0.02) {
    context.globalCompositeOperation = "lighter";
    const halo = context.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius * (2.4 + gaze));
    halo.addColorStop(0, `hsla(${flake.hue}, 100%, 96%, ${0.16 + gaze * 0.22})`);
    halo.addColorStop(1, `hsla(${flake.hue}, 86%, 78%, 0)`);
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, radius * (2.4 + gaze), 0, Math.PI * 2);
    context.fill();
  }

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = `hsla(${flake.hue}, 72%, ${78 + gaze * 14}%, ${0.7 + gaze * 0.2})`;
  context.lineWidth = Math.max(1.6, radius * (0.05 + gaze * 0.014));

  for (let arm = 0; arm < flake.arms; arm++) {
    const angle = Math.PI * 2 * arm / flake.arms;
    const endX = Math.cos(angle) * radius;
    const endY = Math.sin(angle) * radius;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(endX, endY);
    context.stroke();

    const branchAt = radius * 0.58;
    const branchX = Math.cos(angle) * branchAt;
    const branchY = Math.sin(angle) * branchAt;
    const branchLength = radius * 0.24;
    for (const turn of [-0.72, 0.72]) {
      context.beginPath();
      context.moveTo(branchX, branchY);
      context.lineTo(branchX + Math.cos(angle + turn) * branchLength, branchY + Math.sin(angle + turn) * branchLength);
      context.stroke();
    }
  }

  context.fillStyle = `hsla(${flake.hue + 10}, 100%, 96%, ${0.84 + gaze * 0.12})`;
  context.beginPath();
  context.arc(0, 0, Math.max(2.5, radius * (0.09 + gaze * 0.02)), 0, Math.PI * 2);
  context.fill();

  if (flake.phase === "melting") {
    context.strokeStyle = `hsla(${flake.hue + 18}, 100%, 92%, ${0.32 + gaze * 0.42})`;
    context.lineWidth = Math.max(2, radius * 0.05);
    context.setLineDash([Math.max(8, radius * 0.17), Math.max(10, radius * 0.2)]);
    context.beginPath();
    context.arc(0, 0, radius * 1.32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.1, flake.dwellProgress));
    context.stroke();
  }

  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const glow of glows) drawGlow(context, glow);
  for (const flake of snowflakes) drawSnowflake(context, flake);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    addPointerGlow(now);
    updateSnowflakes(delta, now);
    updateGlows(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  glows.splice(0);
  lastGlowAt = 0;
  finishAfter = 0;
  startSession();
  initSnowflakes();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
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
  <div class="snowflakes-shell">
    <canvas ref="canvasRef" class="snowflakes-canvas" />

    <v-card class="snowflakes-hint px-4 py-3" color="surface" rounded="xl" variant="tonal">
      <div class="text-body-2 font-weight-medium">Смотри спокойно: снежинки светятся и тают рядом со взглядом.</div>
      <div class="text-caption text-medium-emphasis">Здесь нет ошибок и спешки, только мягкое следование.</div>
    </v-card>

    <GameHud
      title="Снежинки"
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
      title="Снежинки"
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
.snowflakes-shell {
  background: #dff4ff;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.snowflakes-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.snowflakes-hint {
  inset-block-end: max(18px, env(safe-area-inset-bottom));
  inset-inline: 18px;
  margin-inline: auto;
  max-inline-size: 560px;
  opacity: 0.76;
  position: absolute;
  z-index: 3;
}
</style>
