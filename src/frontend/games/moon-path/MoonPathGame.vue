<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposeMoonPathPiano, playMoonPathCue, setMoonPathPianoActive, tickMoonPathPiano, warmMoonPathPiano } from "./audio";

type Point = { x: number; y: number };
type Star = Point & {
  radius: number;
  alpha: number;
  twinkle: number;
};
type WaterLine = {
  y: number;
  amplitude: number;
  speed: number;
  phase: number;
  alpha: number;
};
type MoonGlow = Point & {
  age: number;
  life: number;
  radius: number;
  phase: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("moon-path", {
  maxSteps: 8,
  overrides: { preset: "gentle", targetScale: 1.55, motionSpeed: 0.42, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const stars = reactive<Star[]>([]);
const waterLines = reactive<WaterLine[]>([]);
const glows = reactive<MoonGlow[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let illuminatedMs = 0;
let lastGlowAt = 0;
let wasIlluminating = false;
let activeSegmentStartedAt = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function waterTop() {
  return window.innerHeight * 0.46;
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
  initScene();
}

function initScene() {
  stars.splice(0);
  waterLines.splice(0);

  const starCount = Math.min(105, Math.max(42, Math.round(window.innerWidth / 14)));
  for (let index = 0; index < starCount; index += 1) {
    stars.push({
      x: randomRange(0, window.innerWidth),
      y: randomRange(0, window.innerHeight * 0.44),
      radius: randomRange(0.7, 2.1),
      alpha: randomRange(0.16, 0.56),
      twinkle: randomRange(0, Math.PI * 2)
    });
  }

  const lineCount = Math.min(18, Math.max(10, Math.round(window.innerHeight / 54)));
  for (let index = 0; index < lineCount; index += 1) {
    waterLines.push({
      y: waterTop() + index * ((window.innerHeight - waterTop()) / lineCount),
      amplitude: randomRange(5, 18),
      speed: randomRange(0.00018, 0.00038),
      phase: randomRange(0, Math.PI * 2),
      alpha: randomRange(0.05, 0.14)
    });
  }
}

function pathCenterX(y: number, now: number) {
  const depth = Math.max(0, Math.min(1, (y - waterTop()) / Math.max(1, window.innerHeight - waterTop())));
  const drift = Math.sin(depth * Math.PI * 2.15 + now * 0.00032) * window.innerWidth * 0.035;
  const slowDrift = Math.sin(depth * Math.PI * 0.9 + now * 0.00012) * window.innerWidth * 0.045;
  return window.innerWidth * 0.5 + drift + slowDrift;
}

function pathWidth(y: number) {
  const depth = Math.max(0, Math.min(1, (y - waterTop()) / Math.max(1, window.innerHeight - waterTop())));
  const nearHorizon = 46 + window.innerWidth * 0.04;
  const nearViewer = Math.min(420, window.innerWidth * 0.46);
  return nearHorizon + (nearViewer - nearHorizon) * depth;
}

function gazePathPoint(now: number) {
  if (!pointer.value.valid || pointer.value.y < waterTop() - 24) return undefined;
  const y = Math.max(waterTop() + 8, Math.min(window.innerHeight - 18, pointer.value.y));
  const center = pathCenterX(y, now);
  const x = center + (pointer.value.x - center) * 0.34;
  return { x, y };
}

function stepTargetMs() {
  return session.settings.sessionSeconds * 1000 / session.maxSteps;
}

function recordPathStep(now: number) {
  if (session.step >= session.maxSteps) return;
  const targetId = `moon-path-${session.step + 1}`;
  const elapsedMs = activeSegmentStartedAt > 0 ? now - activeSegmentStartedAt : stepTargetMs();

  recordEvent("target-click", {
    targetId,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    elapsedMs,
    progress: 1,
    pointer: copyPointer()
  });
  recordSuccess({ targetId, mode: "ambient-moon-path" });
  playMoonPathCue(session.settings.sound);
  activeSegmentStartedAt = now;
}

function clipToWater(context: CanvasRenderingContext2D) {
  context.beginPath();
  context.rect(0, waterTop() + 1, window.innerWidth, window.innerHeight - waterTop() - 1);
  context.clip();
}

function startIllumination(now: number) {
  wasIlluminating = true;
  activeSegmentStartedAt = now;
  recordEvent("target-enter", {
    targetId: `moon-path-${session.step + 1}`,
    at: Date.now(),
    dwellMs: stepTargetMs(),
    pointer: copyPointer()
  });
}

function pauseIllumination() {
  if (!wasIlluminating) return;
  recordEvent("target-cancel", {
    targetId: `moon-path-${Math.min(session.step + 1, session.maxSteps)}`,
    at: Date.now(),
    progress: Math.min(1, illuminatedMs / Math.max(1, (session.step + 1) * stepTargetMs())),
    pointer: copyPointer(),
    reason: "invalid-gaze"
  });
  wasIlluminating = false;
  activeSegmentStartedAt = 0;
}

function addGlow(now: number, point: Point) {
  if (now - lastGlowAt < 115) return;
  lastGlowAt = now;
  glows.push({
    x: point.x,
    y: point.y,
    age: 0,
    life: randomRange(2.8, 4.2),
    radius: randomRange(96, 154) * session.settings.targetScale,
    phase: randomRange(0, Math.PI * 2)
  });
  if (glows.length > 42) glows.shift();
}

function updateIllumination(delta: number, now: number) {
  const point = gazePathPoint(now);

  if (!point || session.settings.reduceMotion) {
    pauseIllumination();
    return;
  }

  if (!wasIlluminating) startIllumination(now);
  illuminatedMs += delta * 1000;
  addGlow(now, point);

  while (session.step < session.maxSteps && illuminatedMs >= (session.step + 1) * stepTargetMs()) {
    recordPathStep(now);
  }
}

function updateGlows(delta: number) {
  for (let index = glows.length - 1; index >= 0; index -= 1) {
    const glow = glows[index];
    glow.age += delta;
    if (glow.age >= glow.life) glows.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#020513");
  sky.addColorStop(0.48, "#07162c");
  sky.addColorStop(1, "#0a1e31");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  for (const star of stars) {
    const twinkle = 0.76 + Math.sin(now * 0.00042 + star.twinkle) * 0.24;
    context.globalAlpha = star.alpha * twinkle;
    context.fillStyle = "#dfeaff";
    context.beginPath();
    context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  drawMoon(context);

  const water = context.createLinearGradient(0, waterTop(), 0, window.innerHeight);
  water.addColorStop(0, "#0b2138");
  water.addColorStop(0.46, "#08253c");
  water.addColorStop(1, "#041827");
  context.fillStyle = water;
  context.fillRect(0, waterTop(), window.innerWidth, window.innerHeight - waterTop());

  const horizon = context.createLinearGradient(0, waterTop() - 36, 0, waterTop() + 34);
  horizon.addColorStop(0, "rgb(155 180 214 / 0%)");
  horizon.addColorStop(0.52, "rgb(155 180 214 / 18%)");
  horizon.addColorStop(1, "rgb(155 180 214 / 0%)");
  context.fillStyle = horizon;
  context.fillRect(0, waterTop() - 36, window.innerWidth, 70);
}

function drawMoon(context: CanvasRenderingContext2D) {
  const moonX = window.innerWidth * 0.5;
  const moonY = window.innerHeight * 0.18;
  const radius = Math.min(62, Math.max(34, window.innerWidth * 0.05));
  const glow = context.createRadialGradient(moonX, moonY, 0, moonX, moonY, radius * 4.2);
  glow.addColorStop(0, "rgb(223 231 255 / 22%)");
  glow.addColorStop(1, "rgb(223 231 255 / 0%)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(moonX, moonY, radius * 4.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#edf4ff";
  context.beginPath();
  context.arc(moonX, moonY, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#07162c";
  context.beginPath();
  context.arc(moonX + radius * 0.34, moonY - radius * 0.08, radius * 0.94, 0, Math.PI * 2);
  context.fill();
}

function drawWaterLines(context: CanvasRenderingContext2D, now: number) {
  context.save();
  clipToWater(context);
  context.lineCap = "round";
  for (const line of waterLines) {
    context.globalAlpha = line.alpha;
    context.strokeStyle = "#a8c8df";
    context.lineWidth = 1.4;
    context.beginPath();
    const points = 34;
    for (let index = 0; index <= points; index += 1) {
      const x = (window.innerWidth * index) / points;
      const y = line.y + Math.sin(index * 0.74 + line.phase + now * line.speed) * line.amplitude;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();
}

function drawMoonPath(context: CanvasRenderingContext2D, now: number) {
  context.save();
  clipToWater(context);
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  const segments = 42;
  for (let layer = 0; layer < 5; layer += 1) {
    context.beginPath();
    for (let index = 0; index <= segments; index += 1) {
      const depth = index / segments;
      const y = waterTop() + depth * (window.innerHeight - waterTop());
      const x = pathCenterX(y, now) + Math.sin(depth * 15 + now * 0.00045 + layer) * pathWidth(y) * 0.03;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.strokeStyle = `rgba(198, 220, 255, ${0.15 - layer * 0.018})`;
    context.lineWidth = Math.max(18, window.innerWidth * 0.028) + layer * Math.max(18, window.innerWidth * 0.028);
    context.stroke();
  }

  for (let index = 0; index < 76; index += 1) {
    const depth = index / 75;
    const y = waterTop() + depth * (window.innerHeight - waterTop());
    const width = pathWidth(y) * (0.18 + depth * 0.12);
    const shimmer = Math.sin(now * 0.0012 + index * 1.87) * 0.5 + 0.5;
    const x = pathCenterX(y, now) + Math.sin(index * 2.1 + now * 0.0008) * width;
    context.globalAlpha = (0.08 + shimmer * 0.22) * (1 - depth * 0.12);
    context.fillStyle = "#eef5ff";
    context.beginPath();
    context.ellipse(x, y, 8 + depth * 18, 1.2 + depth * 2.8, Math.sin(index) * 0.18, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawGlow(context: CanvasRenderingContext2D, glow: MoonGlow) {
  const progress = Math.min(1, glow.age / glow.life);
  const ripple = Math.sin(glow.phase + glow.age * 1.8) * 0.08;
  const radius = glow.radius * (0.64 + progress * 1.3 + ripple);
  const alpha = (1 - progress) * 0.28;
  const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, radius);
  gradient.addColorStop(0, `rgba(246, 250, 255, ${alpha})`);
  gradient.addColorStop(0.42, `rgba(176, 207, 255, ${alpha * 0.48})`);
  gradient.addColorStop(1, "rgba(176, 207, 255, 0)");

  context.save();
  clipToWater(context);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(glow.x, glow.y, radius * 0.86, radius * 0.36, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = alpha * 0.9;
  context.strokeStyle = "#eff6ff";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(glow.x, glow.y, radius * 0.5, radius * 0.14, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawGazeHighlight(context: CanvasRenderingContext2D, now: number) {
  const point = gazePathPoint(now);
  if (!point || session.status !== "running") return;

  const radius = Math.min(260, Math.max(138, window.innerWidth * 0.16));
  const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
  gradient.addColorStop(0, "rgb(250 253 255 / 36%)");
  gradient.addColorStop(0.38, "rgb(194 218 255 / 18%)");
  gradient.addColorStop(1, "rgb(194 218 255 / 0%)");

  context.save();
  clipToWater(context);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 0.72, radius * 0.32, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGuideSpark(context: CanvasRenderingContext2D, now: number) {
  const period = 18500 / session.settings.motionSpeed;
  const depth = ((now % period) / period) * 0.88 + 0.08;
  const y = waterTop() + depth * (window.innerHeight - waterTop());
  const x = pathCenterX(y, now);
  const radius = Math.min(78, Math.max(44, pathWidth(y) * 0.24));
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, "rgb(241 248 255 / 22%)");
  gradient.addColorStop(1, "rgb(241 248 255 / 0%)");

  context.save();
  clipToWater(context);
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, radius, radius * 0.28, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  drawWaterLines(context, now);
  drawMoonPath(context, now);
  for (const glow of glows) drawGlow(context, glow);
  drawGazeHighlight(context, now);
  drawGuideSpark(context, now);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateIllumination(delta, now);
    updateGlows(delta);
    tickMoonPathPiano(session.settings.sound);
  }
  setMoonPathPianoActive(session.settings.sound, session.status === "running");

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  illuminatedMs = 0;
  lastGlowAt = 0;
  wasIlluminating = false;
  activeSegmentStartedAt = 0;
  glows.splice(0);
  initScene();
  startSession();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  warmMoonPathPiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeMoonPathPiano();
});
</script>

<template>
  <div class="moon-path-shell">
    <canvas ref="canvasRef" class="moon-path-canvas" />

    <GameHud
      title="Лунная дорожка"
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
      title="Лунная дорожка"
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
.moon-path-shell {
  background: #020513;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.moon-path-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

</style>
