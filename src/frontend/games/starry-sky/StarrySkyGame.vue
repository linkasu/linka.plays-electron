<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels, randomTargetCenterPercent } from "../../core/placement";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };
type StarPhase = "waiting" | "gazing" | "lit";
type SkyStar = Point & {
  id: string;
  radius: number;
  hue: number;
  age: number;
  phaseAge: number;
  phase: StarPhase;
  dwellProgress: number;
  enteredAt?: number;
  twinkleSeed: number;
};
type DustStar = Point & {
  size: number;
  alpha: number;
  twinkleSeed: number;
};
type LightLine = {
  from: Point;
  to: Point;
  age: number;
  hue: number;
};

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSession("starry-sky", {
  preset: "gentle",
  maxSteps: 9,
  dwellMs: 1200,
  sessionSeconds: 80,
  targetScale: 1.55,
  motionSpeed: 0.35,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const stars = reactive<SkyStar[]>([]);
const dustStars = reactive<DustStar[]>([]);
const lines = reactive<LightLine[]>([]);
const resultVisible = computed(() => session.status === "finished");

const starHues = [42, 52, 202, 226, 266, 292];
const lineLifeSeconds = 5.6;
let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let previousStarPoint: Point | undefined;
let lastLitPoint: Point | undefined;
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
  initDustStars();
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function targetRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.17;
  return Math.min(136, Math.max(88, Math.min(viewportLimit, 86 * session.settings.targetScale)));
}

function starPixels(star: SkyStar) {
  const point = percentToPixels(star);
  return {
    x: point.x + Math.sin(star.age * 0.24 + star.twinkleSeed) * star.radius * 0.035,
    y: point.y + Math.cos(star.age * 0.2 + star.twinkleSeed) * star.radius * 0.025
  };
}

function chooseStarPoint(radius: number, first: boolean) {
  if (first) return { x: 50, y: 55 };

  return randomTargetCenterPercent({
    targetWidth: radius * 2,
    targetHeight: radius * 2,
    hudHeight: Math.max(120, window.innerHeight * 0.18),
    sidePadding: Math.max(72, window.innerWidth * 0.1),
    bottomPadding: Math.max(82, window.innerHeight * 0.1),
    previous: previousStarPoint,
    minDistance: Math.min(300, Math.max(158, radius * 1.58)),
    attempts: 22
  });
}

function randomHue() {
  return starHues[Math.floor(Math.random() * starHues.length)];
}

function createStar(first = false): SkyStar {
  const radius = targetRadius() * randomRange(0.94, 1.06);
  const point = chooseStarPoint(radius, first);
  previousStarPoint = point;

  return {
    id: `starry-sky-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    x: point.x,
    y: point.y,
    radius,
    hue: randomHue(),
    age: randomRange(0, 6),
    phaseAge: 0,
    phase: "waiting",
    dwellProgress: 0,
    twinkleSeed: randomRange(0, Math.PI * 2)
  };
}

function initDustStars() {
  dustStars.splice(0);
  const count = Math.min(120, Math.max(52, Math.round((window.innerWidth * window.innerHeight) / 9500)));
  for (let index = 0; index < count; index++) {
    dustStars.push({
      x: randomRange(2, 98),
      y: randomRange(11, 94),
      size: randomRange(0.7, 2.1),
      alpha: randomRange(0.14, 0.5),
      twinkleSeed: randomRange(0, Math.PI * 2)
    });
  }
}

function initStars() {
  stars.splice(0);
  lines.splice(0);
  previousStarPoint = undefined;
  lastLitPoint = undefined;
  finishAfter = 0;
  for (let index = 0; index < 4; index++) stars.push(createStar(index === 0));
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

function targetPayload(star: SkyStar, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: star.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: star.enteredAt === undefined ? 0 : now - star.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function cancelStar(star: SkyStar, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(star, now, star.dwellProgress, reason));
  star.enteredAt = undefined;
  star.dwellProgress = 0;
  if (star.phase === "gazing") {
    star.phase = "waiting";
    star.phaseAge = 0;
  }
}

function lightStar(star: SkyStar, now: number) {
  const point = starPixels(star);
  recordEvent("target-click", targetPayload(star, now, 1));
  recordSuccess({ targetId: star.id, hue: star.hue });

  if (lastLitPoint) {
    lines.push({ from: lastLitPoint, to: point, age: 0, hue: star.hue });
    if (lines.length > 9) lines.shift();
  }
  lastLitPoint = point;

  star.phase = "lit";
  star.phaseAge = 0;
  star.dwellProgress = 1;
  star.enteredAt = undefined;

  if (session.step >= session.maxSteps) finishAfter = now + 2200;
}

function closestGazeStar() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: SkyStar | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const star of stars) {
    if (star.phase === "lit") continue;
    const nextDistance = distance(starPixels(star), pointer.value);
    const hitRadius = star.radius * 1.34;
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = star;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function ensureStars() {
  if (session.status !== "running" || session.step >= session.maxSteps) return;
  const waitingCount = stars.filter((star) => star.phase !== "lit").length;
  const desiredCount = Math.min(window.innerWidth < 720 ? 3 : 4, session.maxSteps - session.step);
  for (let index = waitingCount; index < desiredCount; index++) {
    stars.push(createStar(stars.length === 0 && session.step === 0));
  }
}

function updateStars(delta: number, now: number) {
  ensureStars();
  if (finishAfter > 0 && now >= finishAfter) {
    finishSession("max-steps");
    return;
  }

  const gazeStar = closestGazeStar();
  for (let index = stars.length - 1; index >= 0; index--) {
    const star = stars[index];
    star.age += delta;
    star.phaseAge += delta;

    if (star.phase === "lit") {
      if (star.phaseAge >= 7.5 && stars.length > 5) stars.splice(index, 1);
      continue;
    }

    if (gazeStar !== star) {
      if (star.enteredAt !== undefined) cancelStar(star, now, pointer.value.valid ? "left" : "invalid-gaze");
      continue;
    }

    if (star.enteredAt === undefined) {
      star.enteredAt = now;
      star.phase = "gazing";
      star.phaseAge = 0;
      recordEvent("target-enter", targetPayload(star, now, 0));
    }

    star.dwellProgress = Math.min(1, (now - star.enteredAt) / session.settings.dwellMs);
    if (star.dwellProgress >= 1) lightStar(star, now);
  }
}

function updateLines(delta: number) {
  for (let index = lines.length - 1; index >= 0; index--) {
    lines[index].age += delta;
    if (lines[index].age >= lineLifeSeconds) lines.splice(index, 1);
  }
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#050716");
  sky.addColorStop(0.48, "#11133a");
  sky.addColorStop(1, "#171027");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const glow = context.createRadialGradient(window.innerWidth * 0.5, window.innerHeight * 0.62, 0, window.innerWidth * 0.5, window.innerHeight * 0.62, Math.max(window.innerWidth, window.innerHeight) * 0.72);
  glow.addColorStop(0, "rgb(96 112 214 / 18%)");
  glow.addColorStop(0.54, "rgb(95 69 173 / 8%)");
  glow.addColorStop(1, "rgb(15 16 42 / 0%)");
  context.fillStyle = glow;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (const dust of dustStars) {
    const point = percentToPixels(dust);
    const pulse = 0.7 + Math.sin(now * 0.0011 + dust.twinkleSeed) * 0.3;
    context.fillStyle = `rgb(226 232 255 / ${dust.alpha * pulse})`;
    context.beginPath();
    context.arc(point.x, point.y, dust.size * (0.8 + pulse * 0.35), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawLine(context: CanvasRenderingContext2D, line: LightLine) {
  const progress = Math.min(1, line.age / lineLifeSeconds);
  const alpha = (1 - progress) * 0.5;
  const shimmer = Math.sin(line.age * 2.4) * 0.5 + 0.5;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `hsla(${line.hue}, 92%, 82%, ${alpha})`;
  context.lineWidth = 5 + shimmer * 1.5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(line.from.x, line.from.y);
  context.lineTo(line.to.x, line.to.y);
  context.stroke();

  context.strokeStyle = `hsla(${line.hue + 30}, 100%, 94%, ${alpha * 0.72})`;
  context.lineWidth = 1.8;
  context.beginPath();
  context.moveTo(line.from.x, line.from.y);
  context.lineTo(line.to.x, line.to.y);
  context.stroke();
  context.restore();
}

function drawStar(context: CanvasRenderingContext2D, star: SkyStar) {
  const point = starPixels(star);
  const pulse = 0.5 + Math.sin(star.age * 1.15 + star.twinkleSeed) * 0.5;
  const lit = star.phase === "lit" ? Math.min(1, star.phaseAge / 1.2) : 0;
  const gaze = star.dwellProgress;
  const glowRadius = star.radius * (0.82 + pulse * 0.16 + gaze * 0.34 + lit * 0.56);

  context.save();
  context.globalCompositeOperation = "lighter";

  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius * 2.2);
  halo.addColorStop(0, `hsla(${star.hue}, 100%, 88%, ${0.18 + gaze * 0.22 + lit * 0.2})`);
  halo.addColorStop(0.42, `hsla(${star.hue}, 92%, 64%, ${0.1 + gaze * 0.12 + lit * 0.16})`);
  halo.addColorStop(1, `hsla(${star.hue}, 82%, 50%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, glowRadius * 2.2, 0, Math.PI * 2);
  context.fill();

  if (star.phase !== "lit") {
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = `hsla(${star.hue}, 90%, 86%, ${0.22 + gaze * 0.38})`;
    context.lineWidth = Math.max(2, star.radius * 0.028);
    context.setLineDash([6, 12]);
    context.beginPath();
    context.arc(point.x, point.y, star.radius * (0.78 + gaze * 0.08), 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `hsla(${star.hue + 18}, 100%, 93%, ${0.6 + gaze * 0.28 + lit * 0.12})`;
  context.lineWidth = Math.max(3, star.radius * (0.055 + gaze * 0.02));
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(point.x - star.radius * (0.18 + lit * 0.12), point.y);
  context.lineTo(point.x + star.radius * (0.18 + lit * 0.12), point.y);
  context.moveTo(point.x, point.y - star.radius * (0.18 + lit * 0.12));
  context.lineTo(point.x, point.y + star.radius * (0.18 + lit * 0.12));
  context.stroke();

  const core = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, Math.max(10, star.radius * 0.2));
  core.addColorStop(0, `hsla(${star.hue}, 100%, 97%, ${0.9 + lit * 0.08})`);
  core.addColorStop(1, `hsla(${star.hue}, 96%, 74%, 0)`);
  context.fillStyle = core;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(8, star.radius * (0.13 + gaze * 0.035 + lit * 0.04)), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  for (const line of lines) drawLine(context, line);
  for (const star of stars) drawStar(context, star);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateStars(delta, now);
    updateLines(delta);
  }

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  initStars();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  initStars();
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
  <div class="starry-sky-shell">
    <canvas ref="canvasRef" class="starry-sky-canvas" />

    <GameHud
      title="Звёздное небо"
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
      title="Звёздное небо"
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
.starry-sky-shell {
  background: #050716;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.starry-sky-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
