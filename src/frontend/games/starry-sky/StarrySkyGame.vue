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
import { percentToPixels } from "../../core/placement";
import { disposeStarrySkyPiano, playStarrySkyCue, setStarrySkyPianoActive, tickStarrySkyPiano, warmStarrySkyPiano } from "./audio";

type Point = { x: number; y: number };
type StarPhase = "waiting" | "gazing" | "lit";
type ConstellationStar = Point & {
  id: string;
  label: string;
  radius: number;
  phase: StarPhase;
  dwellProgress: number;
  enteredAt?: number;
  age: number;
  twinkleSeed: number;
};
type Constellation = {
  id: string;
  name: string;
  hue: number;
  label: Point;
  links: [number, number][];
  stars: ConstellationStar[];
  completedAt?: number;
};
type DustStar = Point & {
  size: number;
  alpha: number;
  twinkleSeed: number;
};

// Line geometry is adapted from d3-celestial constellations.lines.json.
const constellationBlueprints = [
  {
    id: "ursa-major",
    name: "Большая Медведица",
    hue: 46,
    label: { x: 50, y: 30 },
    points: [
      { x: 44.4, y: 43.6 },
      { x: 1.1, y: 23.3 },
      { x: 0, y: 46.4 },
      { x: 31.4, y: 57.9 },
      { x: 67.7, y: 48.2 },
      { x: 85.7, y: 52.6 },
      { x: 100, y: 76.7 }
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5], [5, 6]]
  },
  {
    id: "cassiopeia",
    name: "Кассиопея",
    hue: 292,
    label: { x: 52, y: 28 },
    points: [
      { x: 100, y: 22.8 },
      { x: 72.8, y: 49 },
      { x: 45.2, y: 45.3 },
      { x: 29.8, y: 77.2 },
      { x: 0, y: 57.3 }
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]]
  },
  {
    id: "orion",
    name: "Орион",
    hue: 206,
    label: { x: 50, y: 20 },
    points: [
      { x: 16.7, y: 21.6 },
      { x: 46.5, y: 36.6 },
      { x: 76.2, y: 32.4 },
      { x: 83.3, y: 23.5 },
      { x: 18.2, y: 8.2 },
      { x: 26.3, y: 0.8 },
      { x: 31.3, y: 0 },
      { x: 53.3, y: 62.9 },
      { x: 62, y: 69.4 },
      { x: 36.1, y: 94.2 },
      { x: 45.9, y: 71.2 },
      { x: 68.9, y: 100 }
    ],
    links: [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [1, 7], [7, 8], [8, 2], [9, 10], [10, 7], [8, 11]]
  },
  {
    id: "cygnus",
    name: "Лебедь",
    hue: 226,
    label: { x: 51, y: 28 },
    points: [
      { x: 93.4, y: 91.1 },
      { x: 73.4, y: 76.3 },
      { x: 55.4, y: 51.6 },
      { x: 27.5, y: 32.4 },
      { x: 16, y: 6.4 },
      { x: 6.6, y: 0 },
      { x: 69.8, y: 31.8 },
      { x: 36, y: 72 },
      { x: 16.8, y: 100 }
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 2], [2, 7], [7, 8]]
  }
] as const;

const router = useRouter();
const canvasRef = ref<HTMLCanvasElement>();
const { pointer } = useGazePointer();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("starry-sky", {
  maxSteps: constellationBlueprints.reduce((sum, constellation) => sum + constellation.points.length, 0),
  overrides: { preset: "gentle", targetScale: 1.45, motionSpeed: 0.2, distractors: "none", hints: "high", sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
useStartPromptAudio({ gameId: "starry-sky", soundEnabled: toRef(session.settings, "sound") });

const constellations = reactive<Constellation[]>([]);
const dustStars = reactive<DustStar[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ctx: CanvasRenderingContext2D | undefined;
let frame = 0;
let lastTime = performance.now();
let activeConstellationIndex = 0;
let activeStarIndex = 0;
let nextConstellationAt = 0;
let finishAfter = 0;
const constellationFadeMs = 5200;
const starDwellMultiplier = 0.68;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function constellationFrameScale() {
  const safeHeight = Math.max(420, window.innerHeight - 160);
  return Math.min(window.innerWidth * 0.58, safeHeight * 0.78, 720) / 100;
}

function constellationToPixels(point: Point) {
  const scale = constellationFrameScale();
  return {
    x: window.innerWidth * 0.5 + (point.x - 50) * scale,
    y: window.innerHeight * 0.58 + (point.y - 50) * scale
  };
}

function targetRadius() {
  const viewportLimit = Math.min(window.innerWidth, window.innerHeight) * 0.1;
  return Math.min(88, Math.max(62, Math.min(viewportLimit, 62 * session.settings.targetScale)));
}

function createConstellations() {
  const radius = targetRadius();
  constellations.splice(0);
  for (const blueprint of constellationBlueprints) {
    constellations.push({
      id: blueprint.id,
      name: blueprint.name,
      hue: blueprint.hue,
      label: blueprint.label,
      links: blueprint.links.map(([from, to]) => [from, to]),
      completedAt: undefined,
      stars: blueprint.points.map((point, index) => ({
        id: `${blueprint.id}-${index}`,
        label: String(index + 1),
        x: point.x,
        y: point.y,
        radius,
        phase: "waiting",
        dwellProgress: 0,
        age: randomRange(0, 6),
        twinkleSeed: randomRange(0, Math.PI * 2)
      }))
    });
  }
}

function updateConstellationRadii() {
  const radius = targetRadius();
  for (const constellation of constellations) {
    for (const star of constellation.stars) star.radius = radius;
  }
}

function initDustStars() {
  dustStars.splice(0);
  const count = Math.min(130, Math.max(58, Math.round((window.innerWidth * window.innerHeight) / 9000)));
  for (let index = 0; index < count; index++) {
    dustStars.push({
      x: randomRange(2, 98),
      y: randomRange(13, 95),
      size: randomRange(0.65, 2),
      alpha: randomRange(0.14, 0.48),
      twinkleSeed: randomRange(0, Math.PI * 2)
    });
  }
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
  initDustStars();
  if (constellations.length === 0) createConstellations();
  else updateConstellationRadii();
}

function resetConstellations() {
  activeConstellationIndex = 0;
  activeStarIndex = 0;
  nextConstellationAt = 0;
  finishAfter = 0;
  createConstellations();
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

function targetPayload(star: ConstellationStar, now: number, progress: number, constellation: Constellation, reason?: "left" | "invalid-gaze") {
  return {
    targetId: star.id,
    constellationId: constellation.id,
    constellationName: constellation.name,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: star.enteredAt === undefined ? 0 : now - star.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function cancelStar(star: ConstellationStar, now: number, constellation: Constellation, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(star, now, star.dwellProgress, constellation, reason));
  star.enteredAt = undefined;
  star.dwellProgress = 0;
  if (star.phase === "gazing") star.phase = "waiting";
}

function activeConstellation() {
  return constellations[activeConstellationIndex];
}

function activeStar() {
  return activeConstellation()?.stars[activeStarIndex];
}

function completedConstellation(constellation: Constellation) {
  return constellation.stars.every((star) => star.phase === "lit");
}

function lightStar(star: ConstellationStar, now: number, constellation: Constellation) {
  recordEvent("target-click", targetPayload(star, now, 1, constellation));
  recordSuccess({ targetId: star.id, constellationId: constellation.id, constellationName: constellation.name });
  playStarrySkyCue(session.settings.sound);

  star.phase = "lit";
  star.dwellProgress = 1;
  star.enteredAt = undefined;

  if (activeStarIndex < constellation.stars.length - 1) {
    activeStarIndex += 1;
    return;
  }

  constellation.completedAt = now;
  if (activeConstellationIndex < constellations.length - 1) {
    nextConstellationAt = now + constellationFadeMs;
    return;
  }

  finishAfter = now + constellationFadeMs;
}

function updateActiveStar(now: number) {
  if (session.status !== "running" || finishAfter > 0) return;
  if (nextConstellationAt > 0) {
    if (now < nextConstellationAt) return;
    activeConstellationIndex += 1;
    activeStarIndex = 0;
    nextConstellationAt = 0;
  }

  const constellation = activeConstellation();
  const star = activeStar();
  if (!constellation || !star) return;

  const point = constellationToPixels(star);
  const hitRadius = adaptiveGazeHitRadius(point, star.radius * 1.62, { edgeBoost: 0.2 });
  const inside = pointer.value.valid && distance(point, pointer.value) <= hitRadius;

  if (!inside) {
    if (star.enteredAt !== undefined) cancelStar(star, now, constellation, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (star.enteredAt === undefined) {
    star.enteredAt = now;
    star.phase = "gazing";
    recordEvent("target-enter", targetPayload(star, now, 0, constellation));
  }

  star.dwellProgress = Math.min(1, (now - star.enteredAt) / (session.settings.dwellMs * starDwellMultiplier));
  if (star.dwellProgress >= 1) lightStar(star, now, constellation);
}

function updateStars(delta: number, now: number) {
  for (const constellation of constellations) {
    for (const star of constellation.stars) star.age += delta;
  }
  updateActiveStar(now);
  if (finishAfter > 0 && now >= finishAfter) finishSession("game-complete");
}

function drawBackground(context: CanvasRenderingContext2D, now: number) {
  const sky = context.createLinearGradient(0, 0, 0, window.innerHeight);
  sky.addColorStop(0, "#030513");
  sky.addColorStop(0.46, "#0b1131");
  sky.addColorStop(1, "#171027");
  context.fillStyle = sky;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const moon = context.createRadialGradient(window.innerWidth * 0.77, window.innerHeight * 0.2, 0, window.innerWidth * 0.77, window.innerHeight * 0.2, Math.max(window.innerWidth, window.innerHeight) * 0.35);
  moon.addColorStop(0, "rgb(218 226 255 / 16%)");
  moon.addColorStop(0.36, "rgb(140 154 228 / 7%)");
  moon.addColorStop(1, "rgb(15 16 42 / 0%)");
  context.fillStyle = moon;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (const dust of dustStars) {
    const point = percentToPixels(dust);
    const pulse = 0.72 + Math.sin(now * 0.001 + dust.twinkleSeed) * 0.28;
    context.fillStyle = `rgb(226 232 255 / ${dust.alpha * pulse})`;
    context.beginPath();
    context.arc(point.x, point.y, dust.size * (0.82 + pulse * 0.34), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawConstellationLine(context: CanvasRenderingContext2D, from: ConstellationStar, to: ConstellationStar, hue: number, active: boolean) {
  const start = constellationToPixels(from);
  const end = constellationToPixels(to);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `hsla(${hue}, 94%, 82%, ${active ? 0.58 : 0.36})`;
  context.lineWidth = active ? 5 : 3.5;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.strokeStyle = `hsla(${hue + 26}, 100%, 94%, ${active ? 0.42 : 0.24})`;
  context.lineWidth = 1.4;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

function drawGuideLine(context: CanvasRenderingContext2D, from: ConstellationStar, to: ConstellationStar, hue: number) {
  const start = constellationToPixels(from);
  const end = constellationToPixels(to);
  context.save();
  context.strokeStyle = `hsla(${hue}, 86%, 86%, 0.22)`;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.setLineDash([7, 13]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

function drawStar(context: CanvasRenderingContext2D, star: ConstellationStar, hue: number, isActive: boolean) {
  const point = constellationToPixels(star);
  const pulse = 0.5 + Math.sin(star.age * 1.08 + star.twinkleSeed) * 0.5;
  const lit = star.phase === "lit" ? 1 : 0;
  const gaze = star.dwellProgress;
  const glowRadius = star.radius * (0.64 + pulse * 0.1 + gaze * 0.28 + lit * 0.18);

  context.save();
  context.globalCompositeOperation = "lighter";
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, glowRadius * 2.2);
  halo.addColorStop(0, `hsla(${hue}, 100%, 90%, ${0.12 + gaze * 0.24 + lit * 0.18})`);
  halo.addColorStop(0.46, `hsla(${hue}, 92%, 66%, ${0.08 + gaze * 0.12 + lit * 0.1})`);
  halo.addColorStop(1, `hsla(${hue}, 82%, 52%, 0)`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(point.x, point.y, glowRadius * 2.2, 0, Math.PI * 2);
  context.fill();

  if (isActive && star.phase !== "lit") {
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = `hsla(${hue}, 88%, 88%, ${0.3 + gaze * 0.46})`;
    context.lineWidth = Math.max(2, star.radius * 0.035);
    context.setLineDash([6, 12]);
    context.beginPath();
    context.arc(point.x, point.y, star.radius * (0.72 + gaze * 0.1), 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `hsla(${hue + 18}, 100%, 94%, ${0.54 + gaze * 0.32 + lit * 0.18})`;
  context.lineWidth = Math.max(3, star.radius * (0.045 + gaze * 0.018));
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(point.x - star.radius * (0.15 + lit * 0.08), point.y);
  context.lineTo(point.x + star.radius * (0.15 + lit * 0.08), point.y);
  context.moveTo(point.x, point.y - star.radius * (0.15 + lit * 0.08));
  context.lineTo(point.x, point.y + star.radius * (0.15 + lit * 0.08));
  context.stroke();

  const core = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, Math.max(10, star.radius * 0.18));
  core.addColorStop(0, `hsla(${hue}, 100%, 97%, ${0.86 + lit * 0.1})`);
  core.addColorStop(1, `hsla(${hue}, 96%, 74%, 0)`);
  context.fillStyle = core;
  context.beginPath();
  context.arc(point.x, point.y, Math.max(7, star.radius * (0.11 + gaze * 0.035 + lit * 0.03)), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawLabel(context: CanvasRenderingContext2D, constellation: Constellation) {
  const point = constellationToPixels(constellation.label);
  context.save();
  context.font = `600 ${Math.max(22, Math.min(34, window.innerWidth * 0.032))}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const metrics = context.measureText(constellation.name);
  const width = metrics.width + 36;
  const height = 42;
  const x = Math.min(window.innerWidth - width / 2 - 16, Math.max(width / 2 + 16, point.x));
  const y = Math.min(window.innerHeight - height / 2 - 20, Math.max(118, point.y));

  context.fillStyle = "rgb(7 10 28 / 64%)";
  context.strokeStyle = `hsla(${constellation.hue}, 92%, 82%, 0.34)`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(x - width / 2, y - height / 2, width, height, 20);
  context.fill();
  context.stroke();
  context.fillStyle = "rgb(240 244 255 / 92%)";
  context.fillText(constellation.name, x, y + 1);
  context.restore();
}

function constellationOpacity(constellation: Constellation, now: number) {
  if (constellation.completedAt === undefined) return 1;
  return Math.max(0, 1 - (now - constellation.completedAt) / constellationFadeMs);
}

function drawConstellation(context: CanvasRenderingContext2D, constellation: Constellation, index: number, now: number) {
  context.save();
  context.globalAlpha = constellationOpacity(constellation, now);
  const isActiveConstellation = index === activeConstellationIndex && nextConstellationAt === 0;
  for (const [fromIndex, toIndex] of constellation.links) {
    const from = constellation.stars[fromIndex];
    const to = constellation.stars[toIndex];
    if (from.phase === "lit" && to.phase === "lit") {
      drawConstellationLine(context, from, to, constellation.hue, index === activeConstellationIndex);
    } else if (isActiveConstellation && (fromIndex === activeStarIndex || toIndex === activeStarIndex)) {
      const linkedStar = fromIndex === activeStarIndex ? to : from;
      if (linkedStar.phase === "lit") drawGuideLine(context, linkedStar, fromIndex === activeStarIndex ? from : to, constellation.hue);
    }
  }

  for (let starIndex = 0; starIndex < constellation.stars.length; starIndex++) {
    const star = constellation.stars[starIndex];
    if (index < activeConstellationIndex || starIndex <= activeStarIndex || star.phase === "lit") {
      drawStar(context, star, constellation.hue, isActiveConstellation && starIndex === activeStarIndex);
    }
  }

  if (completedConstellation(constellation)) drawLabel(context, constellation);
  context.restore();
}

function draw(context: CanvasRenderingContext2D, now: number) {
  drawBackground(context, now);
  const constellation = activeConstellation();
  if (constellation) drawConstellation(context, constellation, activeConstellationIndex, now);
}

function tick(now: number) {
  const delta = session.status === "paused" ? 0 : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;

  if (session.status === "running") {
    updateStars(delta, now);
    tickStarrySkyPiano(session.settings.sound);
  }
  setStarrySkyPianoActive(session.settings.sound, session.status === "running");

  if (ctx) draw(ctx, now);
  frame = requestAnimationFrame(tick);
}

function restart() {
  startSession();
  resetConstellations();
}

onMounted(async () => {
  await nextTick();
  resizeCanvas();
  resetConstellations();
  warmStarrySkyPiano(session.settings.sound);
  window.addEventListener("resize", resizeCanvas);
  lastTime = performance.now();
  frame = requestAnimationFrame(tick);
});

onUnmounted(() => {
  window.removeEventListener("resize", resizeCanvas);
  cancelAnimationFrame(frame);
  disposeStarrySkyPiano();
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
  background: #030513;
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
