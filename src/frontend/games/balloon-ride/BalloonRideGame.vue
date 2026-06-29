<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = { x: number; y: number };
type Balloon = Point & {
  phase: number;
  glow: number;
  lift: number;
};
type CloudRing = Point & {
  id: string;
  radius: number;
  speed: number;
  phase: number;
  entered: boolean;
  dwellMs: number;
};
type Cloud = Point & {
  size: number;
  speed: number;
  alpha: number;
  phase: number;
};
type Sparkle = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("balloon-ride", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.45, motionSpeed: 0.52, distractors: "none", hints: "high", sound: false },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const balloon = reactive<Balloon>({ x: window.innerWidth * 0.32, y: window.innerHeight * 0.55, phase: 0, glow: 0, lift: 0 });
const ring = reactive<CloudRing>({ id: "cloud-ring-0", x: window.innerWidth * 0.72, y: window.innerHeight * 0.46, radius: 124, speed: 46, phase: 0, entered: false, dwellMs: 0 });
const clouds = reactive<Cloud[]>([]);
const sparkles = reactive<Sparkle[]>([]);
const resultVisible = computed(() => session.status === "finished");

let ringSequence = 0;
let finishAfter = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playTop() {
  return Math.max(132, height.value * 0.18);
}

function playBottom() {
  return height.value - Math.max(72, height.value * 0.1);
}

function balloonSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.16;
  return Math.min(142, Math.max(86, Math.min(viewportLimit, 84 * session.settings.targetScale)));
}

function ringRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.17;
  return Math.min(160, Math.max(104, Math.min(viewportLimit, 92 * session.settings.targetScale)));
}

function safeY(radius = ringRadius()) {
  return clamp(randomRange(playTop() + radius * 0.18, playBottom() - radius * 0.18), playTop() + radius * 0.08, playBottom() - radius * 0.08);
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

function targetPayload(progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: ring.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: Math.round(ring.dwellMs),
    progress,
    pointer: copyPointer(),
    reason,
    now
  };
}

function resetRing(fromRight = true) {
  ringSequence += 1;
  ring.id = `cloud-ring-${Date.now()}-${ringSequence}`;
  ring.radius = ringRadius();
  ring.x = fromRight ? width.value + ring.radius + randomRange(72, 220) : width.value * randomRange(0.58, 0.76);
  ring.y = safeY(ring.radius);
  ring.speed = randomRange(34, 52) * session.settings.motionSpeed;
  ring.phase = randomRange(0, Math.PI * 2);
  ring.entered = false;
  ring.dwellMs = 0;
}

function initClouds() {
  clouds.splice(0);
  const count = width.value < 760 ? 7 : 11;
  for (let index = 0; index < count; index += 1) {
    clouds.push({
      x: randomRange(-120, width.value + 160),
      y: randomRange(height.value * 0.12, height.value * 0.58),
      size: randomRange(46, 116),
      speed: randomRange(4, 13),
      alpha: randomRange(0.18, 0.42),
      phase: randomRange(0, Math.PI * 2)
    });
  }
}

function addSparkle(x: number, y: number, radius: number) {
  for (let index = 0; index < 10; index += 1) {
    const angle = randomRange(0, Math.PI * 2);
    const spread = randomRange(radius * 0.14, radius * 0.54);
    sparkles.push({
      x: x + Math.cos(angle) * spread,
      y: y + Math.sin(angle) * spread,
      age: 0,
      life: randomRange(0.9, 1.5),
      radius: randomRange(4, 9),
      hue: randomRange(188, 220)
    });
  }
  if (sparkles.length > 80) sparkles.splice(0, sparkles.length - 80);
}

function restart() {
  startSession();
  finishAfter = 0;
  sparkles.splice(0);
  balloon.x = width.value * 0.32;
  balloon.y = (playTop() + playBottom()) / 2;
  balloon.lift = 0;
  balloon.glow = 0;
  resetRing(false);
  initClouds();
}

function updateBalloon(delta: number) {
  const size = balloonSize();
  const fallback = { x: balloon.x, y: balloon.y };
  const target = pointer.value.valid ? pointer.value : fallback;
  const targetX = finishAfter > 0 ? width.value * 0.52 : target.x;
  const targetY = finishAfter > 0 ? Math.max(playTop() * 0.55, balloon.y - height.value * 0.2) : target.y;
  const clampedX = clamp(targetX, size * 0.72, width.value - size * 0.72);
  const clampedY = clamp(targetY, playTop() + size * 0.45, playBottom() - size * 0.38);
  const smoothing = finishAfter > 0 ? 0.9 : pointer.value.valid ? 2.6 : 0.72;
  const maxStep = delta * (finishAfter > 0 ? 140 : 230);
  const stepX = (clampedX - balloon.x) * Math.min(1, delta * smoothing);
  const stepY = (clampedY - balloon.y) * Math.min(1, delta * smoothing);

  balloon.x += clamp(stepX, -maxStep, maxStep);
  balloon.y += clamp(stepY, -maxStep, maxStep);
  balloon.phase += session.settings.reduceMotion ? 0 : delta * 1.8;
  balloon.lift += ((finishAfter > 0 ? 1 : 0) - balloon.lift) * Math.min(1, delta * 1.4);
}

function updateRing(delta: number, now: number) {
  if (finishAfter > 0) return;

  ring.x -= ring.speed * delta;
  ring.phase += session.settings.reduceMotion ? 0 : delta * 1.4;
  ring.y = clamp(ring.y + (session.settings.reduceMotion ? 0 : Math.sin(ring.phase) * delta * 7), playTop() + ring.radius * 0.08, playBottom() - ring.radius * 0.08);

  const gap = distance(balloon, ring);
  const outerRadius = ring.radius * 0.88;
  const passRadius = Math.max(75, ring.radius * 0.44);
  const inside = pointer.value.valid && gap <= passRadius;
  const near = pointer.value.valid && gap <= outerRadius;
  const progress = clamp(ring.dwellMs / session.settings.dwellMs, 0, 1);

  balloon.glow += ((near ? 1 - gap / outerRadius : 0) - balloon.glow) * Math.min(1, delta * 4);

  if (near && !ring.entered) {
    ring.entered = true;
    recordEvent("target-enter", targetPayload(progress, now));
  }

  if (inside) {
    ring.dwellMs = Math.min(session.settings.dwellMs, ring.dwellMs + delta * 1000);
  } else if (ring.dwellMs > 0) {
    ring.dwellMs = Math.max(0, ring.dwellMs - delta * 520);
  }

  if (ring.dwellMs >= session.settings.dwellMs) {
    recordEvent("target-click", targetPayload(1, now));
    recordSuccess({ targetId: ring.id, ring: session.step + 1 });
    addSparkle(ring.x, ring.y, ring.radius);
    if (session.step >= session.maxSteps && finishAfter === 0) {
      finishAfter = now + 2200;
      ring.x = -ring.radius * 2;
      ring.entered = false;
      return;
    }
    resetRing(true);
    return;
  }

  if (!near && ring.entered) {
    ring.entered = false;
    recordEvent("target-cancel", targetPayload(progress, now, pointer.value.valid ? "left" : "invalid-gaze"));
  }

  if (ring.x < -ring.radius * 1.7) {
    if (ring.entered) recordEvent("target-cancel", targetPayload(progress, now, pointer.value.valid ? "left" : "invalid-gaze"));
    resetRing(true);
  }
}

function updateClouds(delta: number) {
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * session.settings.motionSpeed * delta;
    cloud.phase += session.settings.reduceMotion ? 0 : delta * 0.52;
    if (cloud.x < -cloud.size * 2) {
      cloud.x = width.value + cloud.size * 2 + randomRange(0, 120);
      cloud.y = randomRange(height.value * 0.12, height.value * 0.58);
    }
  }
}

function updateSparkles(delta: number) {
  for (let index = sparkles.length - 1; index >= 0; index -= 1) {
    const sparkle = sparkles[index];
    sparkle.age += delta;
    sparkle.y -= session.settings.reduceMotion ? 0 : delta * 18;
    if (sparkle.age >= sparkle.life) sparkles.splice(index, 1);
  }
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  updateClouds(delta);
  updateSparkles(delta);

  if (session.status !== "running") return;
  updateBalloon(delta);
  updateRing(delta, now);
  if (finishAfter > 0 && now >= finishAfter) finishSession("max-steps");
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#d6f2ff");
  sky.addColorStop(0.54, "#eef9ff");
  sky.addColorStop(1, "#fff4dc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const horizon = height.value * 0.74;
  const meadow = ctx.createLinearGradient(0, horizon, 0, height.value);
  meadow.addColorStop(0, "rgb(207 232 188 / 42%)");
  meadow.addColorStop(1, "rgb(173 214 152 / 68%)");
  ctx.fillStyle = meadow;
  ctx.fillRect(0, horizon, width.value, height.value - horizon);
}

function drawSoftCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  const bob = session.settings.reduceMotion ? 0 : Math.sin(cloud.phase) * cloud.size * 0.05;
  ctx.save();
  ctx.globalAlpha = cloud.alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cloud.x - cloud.size * 0.42, cloud.y + bob + cloud.size * 0.08, cloud.size * 0.48, cloud.size * 0.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cloud.x, cloud.y + bob, cloud.size * 0.58, cloud.size * 0.27, 0, 0, Math.PI * 2);
  ctx.ellipse(cloud.x + cloud.size * 0.46, cloud.y + bob + cloud.size * 0.08, cloud.size * 0.42, cloud.size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRing(ctx: CanvasRenderingContext2D) {
  if (finishAfter > 0) return;

  const progress = clamp(ring.dwellMs / session.settings.dwellMs, 0, 1);
  ctx.save();
  ctx.translate(ring.x, ring.y);
  ctx.rotate(session.settings.reduceMotion ? 0 : Math.sin(ring.phase * 0.32) * 0.04);

  const glow = ctx.createRadialGradient(0, 0, ring.radius * 0.22, 0, 0, ring.radius * 1.18);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.08 + progress * 0.18})`);
  glow.addColorStop(0.72, "rgb(180 226 242 / 12%)");
  glow.addColorStop(1, "rgb(180 226 242 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius * 1.18, 0, Math.PI * 2);
  ctx.fill();

  for (let index = 0; index < 13; index += 1) {
    const angle = index / 13 * Math.PI * 2 + (session.settings.reduceMotion ? 0 : ring.phase * 0.08);
    const puffRadius = ring.radius * (0.18 + (index % 3) * 0.018);
    const centerRadius = ring.radius * 0.72;
    ctx.fillStyle = index % 2 === 0 ? "rgb(255 255 255 / 82%)" : "rgb(226 244 250 / 76%)";
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * centerRadius, Math.sin(angle) * centerRadius, puffRadius * 1.12, puffRadius * 0.78, angle * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgb(111 171 198 / 34%)";
  ctx.lineWidth = Math.max(3, ring.radius * 0.035);
  ctx.setLineDash([12, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, ring.radius * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (progress > 0) {
    ctx.strokeStyle = "rgb(86 183 206 / 82%)";
    ctx.lineWidth = Math.max(6, ring.radius * 0.055);
    ctx.beginPath();
    ctx.arc(0, 0, ring.radius * 0.45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBalloon(ctx: CanvasRenderingContext2D) {
  const size = balloonSize();
  const bob = (session.settings.reduceMotion ? 0 : Math.sin(balloon.phase * 1.3) * size * 0.035) - balloon.lift * size * 0.18;
  const x = balloon.x;
  const y = balloon.y + bob;

  ctx.save();
  const glowRadius = size * (0.82 + balloon.glow * 0.26);
  const glow = ctx.createRadialGradient(x, y, size * 0.15, x, y, glowRadius * 1.9);
  glow.addColorStop(0, `rgb(255 246 198 / ${0.12 + balloon.glow * 0.18})`);
  glow.addColorStop(1, "rgb(255 246 198 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius * 1.9, 0, Math.PI * 2);
  ctx.fill();

  const envelope = ctx.createLinearGradient(x - size * 0.58, y - size * 0.72, x + size * 0.56, y + size * 0.52);
  envelope.addColorStop(0, "#ffcf91");
  envelope.addColorStop(0.48, "#f28e9e");
  envelope.addColorStop(1, "#8fc7df");
  ctx.fillStyle = envelope;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.72);
  ctx.bezierCurveTo(x + size * 0.72, y - size * 0.58, x + size * 0.62, y + size * 0.2, x + size * 0.18, y + size * 0.5);
  ctx.quadraticCurveTo(x, y + size * 0.62, x - size * 0.18, y + size * 0.5);
  ctx.bezierCurveTo(x - size * 0.62, y + size * 0.2, x - size * 0.72, y - size * 0.58, x, y - size * 0.72);
  ctx.fill();
  ctx.strokeStyle = "rgb(117 93 118 / 26%)";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.strokeStyle = "rgb(255 255 255 / 38%)";
  ctx.lineWidth = Math.max(2, size * 0.035);
  for (const offset of [-0.32, 0, 0.32]) {
    ctx.beginPath();
    ctx.moveTo(x + size * offset, y - size * 0.6);
    ctx.quadraticCurveTo(x + size * offset * 0.46, y - size * 0.04, x + size * offset * 0.18, y + size * 0.48);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgb(108 87 83 / 58%)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.17, y + size * 0.48);
  ctx.lineTo(x - size * 0.28, y + size * 0.72);
  ctx.moveTo(x + size * 0.17, y + size * 0.48);
  ctx.lineTo(x + size * 0.28, y + size * 0.72);
  ctx.stroke();

  ctx.fillStyle = "#b78355";
  ctx.beginPath();
  ctx.roundRect(x - size * 0.31, y + size * 0.68, size * 0.62, size * 0.22, size * 0.055);
  ctx.fill();
  ctx.strokeStyle = "rgb(100 72 45 / 28%)";
  ctx.stroke();
  ctx.restore();
}

function drawSparkles(ctx: CanvasRenderingContext2D) {
  for (const sparkle of sparkles) {
    const progress = sparkle.age / sparkle.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.72 * (1 - progress));
    ctx.fillStyle = `hsl(${sparkle.hue}, 74%, 78%)`;
    ctx.beginPath();
    ctx.arc(sparkle.x, sparkle.y, sparkle.radius * (1 - progress * 0.42), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  drawBackground(ctx);
  for (const cloud of clouds) drawSoftCloud(ctx, cloud);
  drawRing(ctx);
  drawSparkles(ctx);
  drawBalloon(ctx);
}

onMounted(() => {
  initClouds();
  resetRing(false);
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="balloon-ride-shell">
    <canvas ref="canvasRef" class="balloon-ride-canvas" />

    <GameHud
      title="Воздушный шар"
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
      title="Воздушный шар"
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
.balloon-ride-shell {
  background: #d6f2ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.balloon-ride-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
