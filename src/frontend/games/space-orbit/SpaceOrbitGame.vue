<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type OrbitStar = {
  id: string;
  angle: number;
  radius: number;
  hue: number;
  pulse: number;
  heldMs: number;
  entered: boolean;
};
type CleanupGlow = Point & {
  angle: number;
  age: number;
  life: number;
  radius: number;
  hue: number;
};
type BackgroundStar = Point & {
  radius: number;
  alpha: number;
  phase: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("space-orbit", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 600,
  sessionSeconds: 150,
  targetScale: 1.4,
  motionSpeed: 0.56,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const orbit = reactive({ craftAngle: -Math.PI * 0.45, targetAngle: -Math.PI * 0.45, pulse: 0 });
const star = reactive<OrbitStar>({ id: "space-star-0", angle: Math.PI * 0.1, radius: 36, hue: 50, pulse: 0, heldMs: 0, entered: false });
const cleanupGlows = reactive<CleanupGlow[]>([]);
const backgroundStars = reactive<BackgroundStar[]>([]);
const resultVisible = computed(() => session.status === "finished");
const holdProgress = computed(() => Math.min(100, Math.round(star.heldMs / session.settings.dwellMs * 100)));
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Орбита спокойно ждёт продолжения.";
  if (!pointer.value.valid) return "Можно вести ракету взглядом или мышью по мягкой орбите.";
  if (star.heldMs > 0) return "Оставайся рядом со звездой ещё чуть-чуть.";
  return "Веди ракету взглядом по орбите и собирай звёзды.";
});

let starSequence = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function wrapAngle(angle: number) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function angleDifference(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function orbitCenter(): Point {
  return { x: width.value * 0.5, y: height.value * 0.55 };
}

function orbitRadiusX() {
  return Math.min(width.value * 0.35, Math.max(132, width.value * 0.28));
}

function orbitRadiusY() {
  return Math.min(height.value * 0.27, Math.max(98, height.value * 0.2));
}

function craftSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.13;
  return Math.min(88, Math.max(54, Math.min(viewportLimit, 48 * session.settings.targetScale)));
}

function starRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.09;
  return Math.min(66, Math.max(40, Math.min(viewportLimit, 34 * session.settings.targetScale)));
}

function pointOnOrbit(angle: number, radiusOffset = 0): Point {
  const center = orbitCenter();
  return {
    x: center.x + Math.cos(angle) * (orbitRadiusX() + radiusOffset),
    y: center.y + Math.sin(angle) * (orbitRadiusY() + radiusOffset * 0.68)
  };
}

function pointerAngle() {
  const center = orbitCenter();
  const normalizedX = (pointer.value.x - center.x) / Math.max(1, orbitRadiusX());
  const normalizedY = (pointer.value.y - center.y) / Math.max(1, orbitRadiusY());
  return Math.atan2(normalizedY, normalizedX);
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

function targetPayload(progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: star.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: Math.round(star.heldMs),
    progress,
    orbitAngle: star.angle,
    craftAngle: orbit.craftAngle,
    pointer: copyPointer(),
    reason
  };
}

function nextStarAngle() {
  const gap = Math.PI * randomRange(0.42, 0.78) * (Math.random() > 0.5 ? 1 : -1);
  return wrapAngle(orbit.craftAngle + gap);
}

function resetStar() {
  starSequence += 1;
  star.id = `space-star-${Date.now()}-${starSequence}`;
  star.angle = nextStarAngle();
  star.radius = starRadius();
  star.hue = [42, 54, 64, 204, 268][starSequence % 5];
  star.pulse = randomRange(0, Math.PI * 2);
  star.heldMs = 0;
  star.entered = false;
}

function createBackgroundStars() {
  backgroundStars.splice(0);
  const count = width.value < 760 ? 42 : 72;
  for (let index = 0; index < count; index += 1) {
    backgroundStars.push({
      x: randomRange(0, width.value),
      y: randomRange(0, height.value),
      radius: randomRange(0.8, 2.3),
      alpha: randomRange(0.18, 0.66),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function restart() {
  cleanupGlows.splice(0);
  orbit.craftAngle = -Math.PI * 0.45;
  orbit.targetAngle = orbit.craftAngle;
  starSequence = 0;
  startSession();
  resetStar();
  createBackgroundStars();
}

function updateCraft(delta: number) {
  if (pointer.value.valid) {
    orbit.targetAngle = pointerAngle();
  } else if (!session.settings.reduceMotion) {
    orbit.targetAngle = wrapAngle(orbit.targetAngle + delta * 0.16 * session.settings.motionSpeed);
  }

  const diff = angleDifference(orbit.craftAngle, orbit.targetAngle);
  const easedStep = diff * Math.min(1, delta * 2.9);
  const maxStep = delta * 1.45 * session.settings.motionSpeed;
  orbit.craftAngle = wrapAngle(orbit.craftAngle + clamp(easedStep, -maxStep, maxStep));
  orbit.pulse += delta * (session.settings.reduceMotion ? 0.65 : 1.8);
}

function completeStar() {
  const position = pointOnOrbit(star.angle);
  cleanupGlows.push({
    x: position.x,
    y: position.y,
    angle: star.angle,
    age: 0,
    life: 1.45,
    radius: star.radius,
    hue: star.hue
  });
  if (cleanupGlows.length > 10) cleanupGlows.shift();

  recordEvent("target-click", targetPayload(1));
  recordSuccess({ targetId: star.id, star: session.step + 1 });
  if (session.status === "running") resetStar();
}

function updateStar(delta: number) {
  star.pulse += delta * (session.settings.reduceMotion ? 0.8 : 2.4);
  const angularGap = Math.abs(angleDifference(orbit.craftAngle, star.angle));
  const collectRadius = 0.25 + (star.radius / Math.max(orbitRadiusX(), orbitRadiusY())) * 0.55;
  const progress = Math.max(0, 1 - angularGap / collectRadius);
  const closeEnough = angularGap <= collectRadius;

  if (closeEnough) {
    star.heldMs = Math.min(session.settings.dwellMs, star.heldMs + delta * 1000);
    if (!star.entered) {
      star.entered = true;
      recordEvent("target-enter", targetPayload(progress));
    }
  } else {
    if (star.entered && star.heldMs > 0) recordEvent("target-cancel", targetPayload(progress, pointer.value.valid ? "left" : "invalid-gaze"));
    star.entered = false;
    star.heldMs = Math.max(0, star.heldMs - delta * 1200);
  }

  if (star.heldMs >= session.settings.dwellMs) completeStar();
}

function updateCleanupGlows(delta: number) {
  for (let index = cleanupGlows.length - 1; index >= 0; index -= 1) {
    const glow = cleanupGlows[index];
    glow.age += delta;
    const drift = session.settings.reduceMotion ? 0 : glow.age * 10;
    const next = pointOnOrbit(glow.angle + glow.age * 0.12, drift);
    glow.x = next.x;
    glow.y = next.y;
    if (glow.age >= glow.life) cleanupGlows.splice(index, 1);
  }
}

function update(rawDelta: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  updateCleanupGlows(delta);
  if (session.status !== "running") return;
  updateCraft(delta);
  updateStar(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#081531");
  sky.addColorStop(0.54, "#15285a");
  sky.addColorStop(1, "#241d4a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  for (const dot of backgroundStars) {
    const shimmer = session.settings.reduceMotion ? 0.72 : 0.72 + Math.sin(now * 0.001 + dot.phase) * 0.28;
    ctx.globalAlpha = dot.alpha * shimmer;
    ctx.fillStyle = "#fff8cc";
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const center = orbitCenter();
  const planetRadius = Math.min(132, Math.max(82, Math.min(width.value, height.value) * 0.16));
  const planet = ctx.createRadialGradient(center.x - planetRadius * 0.32, center.y - planetRadius * 0.35, planetRadius * 0.18, center.x, center.y, planetRadius);
  planet.addColorStop(0, "#bfe7ff");
  planet.addColorStop(0.48, "#638edc");
  planet.addColorStop(1, "#334b9a");
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(center.x, center.y, planetRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#d9f2ff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, orbitRadiusX(), orbitRadiusY(), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 18]);
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, orbitRadiusX(), orbitRadiusY(), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawStarShape(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.closePath();
}

function drawTargetStar(ctx: CanvasRenderingContext2D) {
  const position = pointOnOrbit(star.angle);
  const progress = star.heldMs / session.settings.dwellMs;
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(star.pulse) * 3.2;

  ctx.save();
  ctx.globalAlpha = 0.18 + progress * 0.26;
  ctx.fillStyle = `hsl(${star.hue} 96% 72%)`;
  ctx.beginPath();
  ctx.arc(position.x, position.y, star.radius * (1.34 + progress * 0.26), 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.88;
  ctx.fillStyle = `hsl(${star.hue} 96% 76%)`;
  drawStarShape(ctx, position.x, position.y, star.radius * 0.52 + pulse, star.radius * 0.23 + pulse * 0.25);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(position.x, position.y, star.radius * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.stroke();
  ctx.restore();
}

function drawCleanupGlows(ctx: CanvasRenderingContext2D) {
  for (const glow of cleanupGlows) {
    const ratio = glow.age / glow.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - ratio) * 0.58;
    ctx.strokeStyle = `hsl(${glow.hue} 100% 76%)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, glow.radius * (0.55 + ratio * 1.1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, 1 - ratio) * 0.72;
    ctx.fillStyle = `hsl(${glow.hue} 100% 82%)`;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, glow.radius * (0.22 + ratio * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRocket(ctx: CanvasRenderingContext2D) {
  const position = pointOnOrbit(orbit.craftAngle);
  const tangent = orbit.craftAngle + Math.PI / 2;
  const size = craftSize();
  const glow = 0.7 + Math.sin(orbit.pulse) * 0.08;

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(tangent);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#bdefff";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.18, size * 0.58, size * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f7fbff";
  ctx.strokeStyle = "rgba(34, 61, 124, 0.48)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.72);
  ctx.quadraticCurveTo(size * 0.36, -size * 0.32, size * 0.28, size * 0.28);
  ctx.quadraticCurveTo(0, size * 0.48, -size * 0.28, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.36, -size * 0.32, 0, -size * 0.72);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#82d9ff";
  ctx.beginPath();
  ctx.arc(0, -size * 0.22, size * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7d8ded";
  ctx.beginPath();
  ctx.moveTo(-size * 0.24, size * 0.16);
  ctx.lineTo(-size * 0.48, size * 0.5);
  ctx.lineTo(-size * 0.16, size * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(size * 0.24, size * 0.16);
  ctx.lineTo(size * 0.48, size * 0.5);
  ctx.lineTo(size * 0.16, size * 0.38);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = glow;
  ctx.fillStyle = "#ffe7a8";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.56, size * 0.12, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawCleanupGlows(ctx);
  drawTargetStar(ctx);
  drawRocket(ctx);
}

onMounted(() => {
  resetStar();
  createBackgroundStars();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="space-orbit-shell">
    <canvas ref="canvasRef" class="space-orbit-canvas" />

    <GameHud
      title="Космическая орбита"
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

    <v-card class="space-orbit-guidance pa-4" color="surface" rounded="xl" variant="flat">
      <div class="text-overline text-primary mb-1">Плавное ведение</div>
      <div class="text-body-1 font-weight-medium">{{ guidanceText }}</div>
      <v-progress-linear class="mt-3" :model-value="holdProgress" color="amber" height="8" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Звёзд собрано: {{ session.step }} / {{ session.maxSteps }}</div>
    </v-card>

    <GameResultDialog
      :model-value="resultVisible"
      title="Космическая орбита"
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
.space-orbit-shell {
  background: #081531;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.space-orbit-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.space-orbit-guidance {
  box-shadow: 0 18px 48px rgb(5 12 31 / 28%);
  inline-size: min(430px, calc(100vw - 32px));
  inset-block-start: clamp(104px, 14vh, 148px);
  inset-inline-end: max(16px, env(safe-area-inset-right));
  opacity: 0.92;
  position: absolute;
  z-index: 4;
}

@media (max-width: 720px) {
  .space-orbit-guidance {
    inset-block-start: auto;
    inset-block-end: max(16px, env(safe-area-inset-bottom));
    inset-inline: 16px;
    inline-size: auto;
  }
}
</style>
