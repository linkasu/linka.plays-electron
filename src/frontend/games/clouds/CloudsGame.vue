<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStartPromptAudio } from "../../composables/useStartPromptAudio";
import { adaptiveGazeHitRadius } from "../../core/gazeTarget";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeCloudsPiano, playCloudsPianoCue, setCloudsPianoActive, setCloudsPianoIntensity, tickCloudsPiano, warmCloudsPiano } from "./audio";
import { cloudRenderGeometry, createCloudLobes, createCloudPlacementLayout, type CloudLobe, type CloudPlacement } from "./model";

type Point = { x: number; y: number };
type CloudPhase = "floating" | "parting" | "clearing" | "hidden";
type Cloud = Point & {
  id: string;
  homeX: number;
  homeY: number;
  baseRx: number;
  baseRy: number;
  age: number;
  drift: number;
  seed: number;
  openness: number;
  dwellProgress: number;
  phaseAge: number;
  phase: CloudPhase;
  enteredAt?: number;
  lobes: CloudLobe[];
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("clouds", {
  maxSteps: 6,
  overrides: { preset: "gentle", targetScale: 1.6, motionSpeed: 0.34, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "clouds", soundEnabled: toRef(session.settings, "sound") });

const clouds = reactive<Cloud[]>([]);
const resultVisible = computed(() => session.status === "finished");

const clearSeconds = 0.9;
const hiddenSeconds = 10;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let cloudIndex = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cloudPoint(cloud: Cloud) {
  return {
    x: window.innerWidth * cloud.x / 100,
    y: window.innerHeight * cloud.y / 100
  };
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
}

function createCloud(placement: CloudPlacement): Cloud {
  const seed = randomRange(0, Math.PI * 2);
  const x = placement.x / window.innerWidth * 100;
  const y = placement.y / window.innerHeight * 100;
  cloudIndex += 1;

  return {
    id: `cloud-${Date.now()}-${cloudIndex}`,
    x,
    y,
    homeX: x,
    homeY: y,
    baseRx: placement.baseRx,
    baseRy: placement.baseRy,
    age: randomRange(0, 12),
    drift: randomRange(-0.18, 0.18),
    seed,
    openness: 0,
    dwellProgress: 0,
    phaseAge: 0,
    phase: "floating",
    lobes: createCloudLobes(seed)
  };
}

function resetCloud(cloud: Cloud) {
  const seed = randomRange(0, Math.PI * 2);
  cloud.id = `cloud-${Date.now()}-${++cloudIndex}`;
  cloud.x = cloud.homeX;
  cloud.y = cloud.homeY;
  cloud.age = randomRange(0, 12);
  cloud.drift = randomRange(-0.18, 0.18);
  cloud.seed = seed;
  cloud.openness = 0;
  cloud.dwellProgress = 0;
  cloud.phaseAge = 0;
  cloud.phase = "floating";
  cloud.enteredAt = undefined;
  cloud.lobes = createCloudLobes(seed);
}

function initClouds() {
  const layout = createCloudPlacementLayout({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    targetScale: session.settings.targetScale,
    random: Math.random
  });
  clouds.splice(0);
  cloudIndex = 0;
  for (const placement of layout.placements) clouds.push(createCloud(placement));
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

function targetPayload(cloud: Cloud, now: number, progress: number) {
  return {
    targetId: cloud.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: cloud.enteredAt === undefined ? 0 : now - cloud.enteredAt,
    progress,
    pointer: copyPointer()
  };
}

function gazeInfluence(cloud: Cloud) {
  if (!pointer.value.valid) return 0;
  const point = cloudPoint(cloud);
  const radius = adaptiveGazeHitRadius(point, Math.max(cloud.baseRx, cloud.baseRy) * 1.05, { edgeBoost: 0.22 });
  return clamp(1 - distance(point, pointer.value) / radius, 0, 1);
}

function clearCloud(cloud: Cloud, now: number) {
  recordEvent("target-click", targetPayload(cloud, now, 1));
  recordSuccess({ targetId: cloud.id, label: "cloud" });
  playCloudsPianoCue(session.settings.sound);
  cloud.phase = "clearing";
  cloud.phaseAge = 0;
  cloud.dwellProgress = 1;
  cloud.enteredAt = undefined;
}

function updateCloud(cloud: Cloud, delta: number, now: number) {
  cloud.age += delta;
  cloud.phaseAge += delta;
  cloud.x += cloud.drift * session.settings.motionSpeed * delta;
  cloud.y += Math.sin(cloud.age * 0.11 + cloud.seed) * session.settings.motionSpeed * delta * 0.05;

  if (cloud.x < -8) cloud.x = 108;
  if (cloud.x > 108) cloud.x = -8;

  if (cloud.phase === "clearing") {
    cloud.openness += (1 - cloud.openness) * Math.min(1, delta * 1.6);
    if (cloud.phaseAge >= clearSeconds) {
      cloud.phase = "hidden";
      cloud.phaseAge = 0;
    }
    return;
  }

  if (cloud.phase === "hidden") return;

  const influence = gazeInfluence(cloud);
  const targetOpen = Math.max(influence, cloud.dwellProgress * 0.85);
  cloud.openness += (targetOpen - cloud.openness) * Math.min(1, delta * 1.8);

  const inside = session.status === "running" && influence > 0.15;
  if (!inside) {
    cloud.enteredAt = undefined;
    cloud.dwellProgress = Math.max(0, cloud.dwellProgress - delta * 0.42);
    if (cloud.dwellProgress === 0) cloud.phase = "floating";
    return;
  }

  if (cloud.enteredAt === undefined) {
    cloud.enteredAt = now;
    cloud.phase = "parting";
    cloud.phaseAge = 0;
    recordEvent("target-enter", targetPayload(cloud, now, 0));
  }

  cloud.dwellProgress = Math.min(1, (now - cloud.enteredAt) / session.settings.dwellMs);
  if (cloud.dwellProgress >= 1) clearCloud(cloud, now);
}

function updateClouds(delta: number, now: number) {
  for (const cloud of clouds) updateCloud(cloud, delta, now);
  if (session.status === "running" && clouds.length > 0 && clouds.every((cloud) => cloud.phase === "hidden")) {
    finishSession("game-complete");
    return;
  }
  for (const cloud of clouds) {
    if (cloud.phase === "hidden" && cloud.phaseAge >= hiddenSeconds && session.status === "running") resetCloud(cloud);
  }
}

function audioIntensity() {
  const cloudActivity = clouds.reduce((activity, cloud) => {
    if (cloud.phase === "hidden") return activity;
    const phaseBoost = cloud.phase === "parting" || cloud.phase === "clearing" ? 0.18 : 0;
    return Math.max(activity, cloud.openness, cloud.dwellProgress + phaseBoost);
  }, 0);
  return Math.min(1, 0.72 + cloudActivity * 0.28);
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#7fb5d5");
  sky.addColorStop(0.54, "#9ac6dc");
  sky.addColorStop(1, "#bfc7b6");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const sunX = window.innerWidth * 0.78 + Math.sin(now * 0.00008) * 18;
  const sunY = window.innerHeight * 0.22;
  const glow = context.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(window.innerWidth, window.innerHeight) * 0.42);
  glow.addColorStop(0, "rgb(255 233 170 / 24%)");
  glow.addColorStop(0.36, "rgb(255 233 170 / 10%)");
  glow.addColorStop(1, "rgb(255 246 205 / 0%)");
  context.fillStyle = glow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawProgress(context: CanvasRenderingContext2D, cloud: Cloud, point: Point) {
  if (cloud.dwellProgress <= 0 || cloud.phase === "clearing") return;
  const radius = cloud.baseRx * (cloudRenderGeometry.progressRadius + cloud.openness * cloudRenderGeometry.progressOpenRadius);
  context.save();
  context.strokeStyle = `rgb(105 160 205 / ${0.22 + cloud.dwellProgress * 0.34})`;
  context.lineCap = "round";
  context.lineWidth = Math.max(4, cloud.baseRx * cloudRenderGeometry.progressLineWidth);
  context.beginPath();
  context.arc(point.x, point.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cloud.dwellProgress);
  context.stroke();
  context.restore();
}

function drawCloud(context: CanvasRenderingContext2D, cloud: Cloud) {
  if (cloud.phase === "hidden") return;
  const point = cloudPoint(cloud);
  const clearing = cloud.phase === "clearing" ? Math.min(1, cloud.phaseAge / clearSeconds) : 0;
  const alpha = 0.9 * (1 - clearing);
  const open = Math.max(cloud.openness, clearing);

  context.save();
  context.globalAlpha = alpha;

  const shadow = context.createRadialGradient(point.x, point.y + cloud.baseRy * 0.36, 0, point.x, point.y + cloud.baseRy * 0.36, cloud.baseRx * 1.28);
  shadow.addColorStop(0, `rgb(128 169 196 / ${0.08 * (1 - open * 0.6)})`);
  shadow.addColorStop(1, "rgb(128 169 196 / 0%)");
  context.fillStyle = shadow;
  context.beginPath();
  context.ellipse(point.x, point.y + cloud.baseRy * cloudRenderGeometry.shadowOffsetY, cloud.baseRx * cloudRenderGeometry.shadowRadiusX, cloud.baseRy * cloudRenderGeometry.shadowRadiusY, 0, 0, Math.PI * 2);
  context.fill();

  for (const lobe of cloud.lobes) {
    const wobbleX = Math.sin(cloud.age * lobe.speed + lobe.seed) * cloud.baseRx * cloudRenderGeometry.lobeWobbleX;
    const wobbleY = Math.cos(cloud.age * lobe.speed * 0.8 + lobe.seed) * cloud.baseRy * cloudRenderGeometry.lobeWobbleY;
    const naturalX = point.x + lobe.offsetX * cloud.baseRx + wobbleX;
    const naturalY = point.y + lobe.offsetY * cloud.baseRy + wobbleY;
    const awayX = pointer.value.valid ? naturalX - pointer.value.x : lobe.offsetX || 0.1;
    const awayY = pointer.value.valid ? naturalY - pointer.value.y : lobe.offsetY || -0.1;
    const awayLength = Math.max(1, Math.hypot(awayX, awayY));
    const localDistance = pointer.value.valid ? Math.min(1, distance({ x: naturalX, y: naturalY }, pointer.value) / (cloud.baseRx * 1.6)) : 1;
    const push = open * (cloudRenderGeometry.pushProximity - localDistance) * cloud.baseRx * (cloudRenderGeometry.pushBase + lobe.radius * cloudRenderGeometry.pushRadius);
    const x = naturalX + awayX / awayLength * push;
    const y = naturalY + awayY / awayLength * push * cloudRenderGeometry.pushY - clearing * cloud.baseRy * cloudRenderGeometry.clearingLift;
    const rx = cloud.baseRx * lobe.radius * (1 + Math.sin(cloud.age * lobe.speed + lobe.seed) * cloudRenderGeometry.lobePulseX + open * cloudRenderGeometry.lobeOpenRadiusX);
    const ry = cloud.baseRy * lobe.radius * (1 + Math.cos(cloud.age * lobe.speed + lobe.seed) * cloudRenderGeometry.lobePulseY - open * cloudRenderGeometry.lobeOpenRadiusY);
    const body = context.createRadialGradient(x - rx * 0.28, y - ry * 0.38, ry * 0.12, x, y, rx);
    body.addColorStop(0, "rgb(255 255 255 / 96%)");
    body.addColorStop(0.64, "rgb(245 251 255 / 86%)");
    body.addColorStop(1, "rgb(213 232 244 / 42%)");
    context.fillStyle = body;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (open > 0.05) {
    const opening = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, cloud.baseRx * 0.8);
    opening.addColorStop(0, `rgb(139 201 241 / ${0.18 * open})`);
    opening.addColorStop(0.6, `rgb(205 238 255 / ${0.12 * open})`);
    opening.addColorStop(1, "rgb(205 238 255 / 0%)");
    context.fillStyle = opening;
    context.beginPath();
    context.ellipse(point.x, point.y, cloud.baseRx * (0.42 + open * 0.22), cloud.baseRy * (0.46 + open * 0.12), 0, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
  drawProgress(context, cloud, point);
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const cloud of clouds) drawCloud(context, cloud);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  setCloudsPianoActive(session.settings.sound, session.status === "running");
  setCloudsPianoIntensity(session.settings.sound, audioIntensity());
  tickCloudsPiano(session.settings.sound);
  if (session.status === "running") updateClouds(delta, now);
  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function resizeGame() {
  resizeCanvas();
  initClouds();
}

function restart() {
  startSession();
  initClouds();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initClouds();
  warmCloudsPiano(session.settings.sound);
  window.addEventListener("resize", resizeGame);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeGame);
  cancelAnimationFrame(frame);
  disposeCloudsPiano();
});
</script>

<template>
  <div class="clouds-shell">
    <canvas ref="canvasRef" class="clouds-canvas" />
    <GameHud title="Облака" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GameResultDialog :model-value="resultVisible" title="Облака" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.clouds-shell {
  background: #7fb5d5;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.clouds-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
