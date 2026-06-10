<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Point = { x: number; y: number };

type Surfer = Point & {
  phase: number;
  lean: number;
  glow: number;
};

type WaveMarker = Point & {
  id: string;
  radius: number;
  phase: number;
  enteredAt?: number;
  dwellSeconds: number;
  collected: boolean;
};

type FoamTrail = Point & {
  age: number;
  life: number;
  radius: number;
};

type CleanupRing = Point & {
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  finishSession,
  recordEvent,
  recordSuccess,
  startSession
} = useGameSession("catch-wave", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 600,
  sessionSeconds: 150,
  targetScale: 1.55,
  motionSpeed: 0.58,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const surfer = reactive<Surfer>({ x: window.innerWidth * 0.32, y: window.innerHeight * 0.55, phase: 0, lean: 0, glow: 0 });
const marker = reactive<WaveMarker>({ id: "wave-marker-0", x: window.innerWidth * 0.72, y: window.innerHeight * 0.5, radius: 118, phase: 0, dwellSeconds: 0, collected: false });
const trails = reactive<FoamTrail[]>([]);
const cleanupRings = reactive<CleanupRing[]>([]);
const resultVisible = computed(() => session.status === "finished");

let markerSequence = 0;
let trailTimer = 0;
let nextMarkerAt = 0;
let cleanupUntil = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playArea() {
  const top = Math.max(128, height.value * 0.2);
  const bottom = height.value - Math.max(70, height.value * 0.1);
  return {
    left: Math.max(72, width.value * 0.08),
    right: width.value - Math.max(72, width.value * 0.08),
    top,
    bottom,
    centerY: top + (bottom - top) / 2
  };
}

function markerRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.14;
  return Math.min(142, Math.max(92, Math.min(viewportLimit, 76 * session.settings.targetScale)));
}

function surferSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.16;
  return Math.min(128, Math.max(84, Math.min(viewportLimit, 72 * session.settings.targetScale)));
}

function waveY(x: number, now: number) {
  const area = playArea();
  const amplitude = Math.min(64, Math.max(28, height.value * 0.065));
  const slow = Math.sin(x * 0.006 + now * 0.00045) * amplitude;
  const broad = Math.sin(x * 0.0028 - now * 0.00018) * amplitude * 0.42;
  return clamp(area.centerY + slow + broad, area.top + marker.radius * 0.35, area.bottom - marker.radius * 0.35);
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

function targetPayload(progress: number, now: number, reason?: "left" | "invalid-gaze" | "drifted") {
  return {
    targetId: marker.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: marker.enteredAt === undefined ? 0 : now - marker.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function resetMarker(now: number, fromRight = true) {
  const area = playArea();
  markerSequence += 1;
  marker.id = `wave-marker-${Date.now()}-${markerSequence}`;
  marker.radius = markerRadius();
  marker.x = fromRight ? area.right + marker.radius + randomRange(30, 150) : randomRange(width.value * 0.54, area.right - marker.radius * 0.4);
  marker.y = waveY(marker.x, now);
  marker.phase = randomRange(0, Math.PI * 2);
  marker.enteredAt = undefined;
  marker.dwellSeconds = 0;
  marker.collected = false;
}

function syncGeometry(now: number) {
  const area = playArea();
  surfer.x = clamp(surfer.x, area.left, area.right);
  surfer.y = clamp(surfer.y, area.top + surferSize() * 0.38, area.bottom - surferSize() * 0.38);
  marker.radius = markerRadius();
  if (!marker.collected) marker.y = waveY(marker.x, now);
}

function addTrail() {
  trails.push({
    x: surfer.x - surferSize() * 0.42,
    y: surfer.y + surferSize() * 0.22,
    radius: randomRange(10, 24),
    age: 0,
    life: randomRange(0.95, 1.45)
  });
  if (trails.length > 42) trails.shift();
}

function addCleanupRing(x: number, y: number, radius: number) {
  cleanupRings.push({ x, y, radius, age: 0, life: randomRange(1.45, 2.15), hue: randomRange(178, 212) });
  if (cleanupRings.length > 18) cleanupRings.shift();
}

function updateSurfer(delta: number) {
  const area = playArea();
  const size = surferSize();
  const fallback = { x: width.value * 0.34, y: waveY(width.value * 0.34, performance.now()) };
  const target = pointer.value.valid ? pointer.value : fallback;
  const clampedX = clamp(target.x, area.left + size * 0.16, area.right - size * 0.16);
  const clampedY = clamp(target.y, area.top + size * 0.42, area.bottom - size * 0.42);
  const previousY = surfer.y;
  const smoothing = pointer.value.valid ? 3.4 : 1.15;

  surfer.x += (clampedX - surfer.x) * Math.min(1, delta * smoothing);
  surfer.y += (clampedY - surfer.y) * Math.min(1, delta * smoothing);
  surfer.lean += (clamp((surfer.y - previousY) * 0.035, -0.35, 0.35) - surfer.lean) * Math.min(1, delta * 5.2);
  surfer.phase += delta * (session.settings.reduceMotion ? 0.9 : 1.8);

  trailTimer += delta;
  const trailInterval = session.settings.reduceMotion ? 0.26 : 0.11 / session.settings.motionSpeed;
  while (trailTimer >= trailInterval) {
    addTrail();
    trailTimer -= trailInterval;
  }
}

function completeMarker(now: number) {
  recordEvent("target-click", targetPayload(1, now));
  recordSuccess({ targetId: marker.id, marker: session.step + 1 });
  addCleanupRing(marker.x, marker.y, marker.radius * 0.84);
  marker.collected = true;
  marker.enteredAt = undefined;
  marker.dwellSeconds = 0;

  if (session.step >= session.maxSteps) {
    cleanupUntil = now + 2200;
    nextMarkerAt = 0;
    for (let index = 0; index < 6; index += 1) {
      addCleanupRing(surfer.x + randomRange(-150, 170), surfer.y + randomRange(-90, 90), randomRange(58, 116));
    }
  } else {
    nextMarkerAt = now + 560;
  }
}

function cancelMarker(now: number, progress: number, reason: "left" | "invalid-gaze" | "drifted") {
  if (marker.enteredAt !== undefined) recordEvent("target-cancel", targetPayload(progress, now, reason));
  marker.enteredAt = undefined;
  marker.dwellSeconds = 0;
}

function updateMarker(delta: number, now: number) {
  if (marker.collected) {
    if (nextMarkerAt > 0 && now >= nextMarkerAt) {
      nextMarkerAt = 0;
      resetMarker(now, true);
    }
    return;
  }

  const speed = Math.max(32, 58 * session.settings.motionSpeed);
  marker.phase += delta * 1.4;
  marker.x -= speed * delta;
  marker.y = waveY(marker.x, now) + Math.sin(marker.phase) * 4;

  const gap = distance(surfer, marker);
  const enterDistance = marker.radius * 1.24;
  const progress = Math.max(0, 1 - gap / enterDistance);
  surfer.glow += (progress - surfer.glow) * Math.min(1, delta * 4.8);

  if (gap <= enterDistance) {
    if (marker.enteredAt === undefined) {
      marker.enteredAt = now;
      recordEvent("target-enter", targetPayload(progress, now));
    }
    marker.dwellSeconds += delta;
    if (marker.dwellSeconds * 1000 >= session.settings.dwellMs) completeMarker(now);
    return;
  }

  if (marker.enteredAt !== undefined) cancelMarker(now, progress, pointer.value.valid ? "left" : "invalid-gaze");

  if (marker.x < playArea().left - marker.radius * 1.8) {
    cancelMarker(now, progress, "drifted");
    resetMarker(now, true);
  }
}

function updateTrails(delta: number) {
  for (let index = trails.length - 1; index >= 0; index -= 1) {
    const trail = trails[index];
    trail.age += delta;
    trail.x -= delta * 16;
    if (trail.age >= trail.life) trails.splice(index, 1);
  }
}

function updateCleanup(delta: number, now: number) {
  for (let index = cleanupRings.length - 1; index >= 0; index -= 1) {
    const ring = cleanupRings[index];
    ring.age += delta;
    if (ring.age >= ring.life) cleanupRings.splice(index, 1);
  }

  if (cleanupUntil > 0 && now >= cleanupUntil) {
    cleanupUntil = 0;
    finishSession("max-steps");
  }
}

function update(delta: number, now: number) {
  syncGeometry(now);
  if (session.status === "paused") return;
  updateCleanup(delta, now);
  if (session.status !== "running") return;
  updateSurfer(delta);
  if (session.step < session.maxSteps) updateMarker(delta, now);
  updateTrails(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value * 0.64);
  sky.addColorStop(0, "#c9f1ff");
  sky.addColorStop(0.56, "#e8fbff");
  sky.addColorStop(1, "#fff3d9");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#ffffff";
  for (let index = 0; index < 4; index += 1) {
    const cloudX = (width.value * (0.18 + index * 0.24) + Math.sin(now * 0.00008 + index) * 36) % (width.value + 180);
    const cloudY = height.value * (0.11 + index % 2 * 0.08);
    ctx.beginPath();
    ctx.ellipse(cloudX - 42, cloudY + 8, 54, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 10, cloudY, 70, 28, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 64, cloudY + 10, 48, 19, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const waterTop = Math.max(122, height.value * 0.24);
  const water = ctx.createLinearGradient(0, waterTop, 0, height.value);
  water.addColorStop(0, "#8ddcf0");
  water.addColorStop(0.52, "#40aeca");
  water.addColorStop(1, "#18799e");
  ctx.fillStyle = water;
  ctx.fillRect(0, waterTop, width.value, height.value - waterTop);
}

function drawWaveLines(ctx: CanvasRenderingContext2D, now: number) {
  ctx.save();
  ctx.lineCap = "round";
  for (let layer = 0; layer < 5; layer += 1) {
    ctx.strokeStyle = `rgb(255 255 255 / ${0.2 - layer * 0.022})`;
    ctx.lineWidth = 5 - layer * 0.45;
    ctx.beginPath();
    for (let point = 0; point <= 64; point += 1) {
      const x = point / 64 * width.value;
      const y = waveY(x, now + layer * 520) + layer * 38;
      if (point === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: FoamTrail) {
  const progress = trail.age / trail.life;
  ctx.strokeStyle = `rgb(255 255 255 / ${0.42 * (1 - progress)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(trail.x, trail.y, trail.radius * (0.8 + progress * 1.4), 0, Math.PI * 2);
  ctx.stroke();
}

function drawMarker(ctx: CanvasRenderingContext2D) {
  if (marker.collected || session.step >= session.maxSteps) return;
  const dwellProgress = Math.min(1, marker.dwellSeconds * 1000 / session.settings.dwellMs);
  const pulse = 1 + Math.sin(marker.phase * 2) * 0.035;
  const radius = marker.radius * pulse;

  const glow = ctx.createRadialGradient(marker.x, marker.y, radius * 0.2, marker.x, marker.y, radius * 1.12);
  glow.addColorStop(0, `rgb(255 255 255 / ${0.42 + dwellProgress * 0.18})`);
  glow.addColorStop(0.54, "rgb(255 245 184 / 26%)");
  glow.addColorStop(1, "rgb(255 245 184 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, radius * 1.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgb(255 255 255 / 88%)";
  ctx.lineWidth = 7;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, radius * 0.72, -Math.PI / 2, Math.PI * 1.5);
  ctx.stroke();
  ctx.setLineDash([]);

  if (dwellProgress > 0) {
    ctx.strokeStyle = "#fff2a6";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, radius * 0.82, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dwellProgress);
    ctx.stroke();
  }
}

function drawSurfer(ctx: CanvasRenderingContext2D) {
  const size = surferSize();
  const bobY = surfer.y + Math.sin(surfer.phase) * size * 0.035;
  const boardAngle = surfer.lean + Math.sin(surfer.phase * 0.7) * 0.025;
  const glowRadius = size * (0.96 + surfer.glow * 0.34);
  const glow = ctx.createRadialGradient(surfer.x, bobY, size * 0.18, surfer.x, bobY, glowRadius);
  glow.addColorStop(0, `rgb(255 245 176 / ${0.16 + surfer.glow * 0.26})`);
  glow.addColorStop(1, "rgb(255 245 176 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(surfer.x, bobY, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(surfer.x, bobY);
  ctx.rotate(boardAngle);
  ctx.fillStyle = "rgb(36 95 123 / 24%)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.48, size * 0.78, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff1bd";
  ctx.strokeStyle = "rgb(77 118 143 / 30%)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.24, size * 0.7, size * 0.18, -0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#5ec7d4";
  ctx.beginPath();
  ctx.arc(0, -size * 0.26, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#486f9b";
  ctx.beginPath();
  ctx.roundRect(-size * 0.18, -size * 0.1, size * 0.36, size * 0.42, size * 0.12);
  ctx.fill();
  ctx.strokeStyle = "#31506f";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-size * 0.12, size * 0.16);
  ctx.lineTo(-size * 0.36, size * 0.36);
  ctx.moveTo(size * 0.12, size * 0.16);
  ctx.lineTo(size * 0.36, size * 0.36);
  ctx.stroke();
  ctx.restore();
}

function drawCleanupRing(ctx: CanvasRenderingContext2D, ring: CleanupRing) {
  const progress = ring.age / ring.life;
  ctx.strokeStyle = `hsla(${ring.hue}, 84%, 86%, ${0.52 * (1 - progress)})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.radius * (0.45 + progress * 1.45), 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawWaveLines(ctx, now);
  for (const trail of trails) drawTrail(ctx, trail);
  drawMarker(ctx);
  for (const ring of cleanupRings) drawCleanupRing(ctx, ring);
  drawSurfer(ctx);
}

function restart() {
  startSession();
  trails.splice(0);
  cleanupRings.splice(0);
  nextMarkerAt = 0;
  cleanupUntil = 0;
  surfer.x = width.value * 0.32;
  surfer.y = playArea().centerY;
  surfer.glow = 0;
  resetMarker(performance.now(), false);
}

onMounted(() => {
  resetMarker(performance.now(), false);
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="catch-wave-shell">
    <canvas ref="canvasRef" class="catch-wave-canvas" />

    <GameHud
      title="Поймай волну"
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
      title="Поймай волну"
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
.catch-wave-shell {
  background: #8ddcf0;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.catch-wave-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
