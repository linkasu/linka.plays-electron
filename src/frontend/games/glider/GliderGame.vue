<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { applyGliderDamage, classifyGatePass, gliderDifficulty } from "./model";

type Point = { x: number; y: number };

type Glider = Point & {
  vx: number;
  vy: number;
  tilt: number;
  phase: number;
  glow: number;
};

type Gate = Point & {
  id: string;
  gap: number;
  width: number;
  speed: number;
  phase: number;
  entered: boolean;
  enteredAt: number;
  passed: boolean;
};

type Cloud = Point & {
  size: number;
  speed: number;
  alpha: number;
  phase: number;
};

type Trail = Point & {
  age: number;
  life: number;
  radius: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, recordMistake, startSession } = useGameSessionFor("glider", {
  maxSteps: 8,
  overrides: { preset: "standard", dwellMs: 600, targetScale: 1.2, motionSpeed: 0.9, distractors: "low", hints: "medium" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const glider = reactive<Glider>({ x: window.innerWidth * 0.26, y: window.innerHeight * 0.52, vx: 0, vy: 0, tilt: 0, phase: 0, glow: 0 });
const gate = reactive<Gate>({ id: "gate-0", x: window.innerWidth * 0.82, y: window.innerHeight * 0.5, gap: 260, width: 92, speed: 86, phase: 0, entered: false, enteredAt: 0, passed: false });
const clouds = reactive<Cloud[]>([]);
const trails = reactive<Trail[]>([]);
const cleanupProgress = ref(0);
const hull = ref(3);
const maxHull = 3;
const damageFlash = ref(0);
const resultVisible = computed(() => session.status === "finished");
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Планер ждёт продолжения.";
  if (cleanupProgress.value > 0) return "Маршрут завершён: планер уходит в чистое небо.";
  if (hull.value <= 1) return "Остался один шанс. Держи планер точно в просвете.";
  if (!pointer.value.valid) return "Можно вести планер взглядом или мышью. Без управления планер держит курс хуже.";
  return "Веди планер точно через воздушные ворота: промах повреждает крыло.";
});

let gateSequence = 0;
let trailTimer = 0;
let cleanupStartedAt = 0;
let cleanupElapsedMs = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function playTop() {
  return Math.max(124, height.value * 0.16);
}

function playBottom() {
  return height.value - Math.max(58, height.value * 0.08);
}

function gliderSize() {
  const viewportLimit = Math.min(width.value, height.value) * 0.13;
  return Math.min(108, Math.max(66, Math.min(viewportLimit, 70 * session.settings.targetScale)));
}

function gateGap() {
  const safeHeight = playBottom() - playTop();
  const difficulty = gliderDifficulty(session.step, session.maxSteps);
  return Math.min(safeHeight * 0.56, Math.max(138, 178 * session.settings.targetScale * difficulty.gapScale));
}

function gateSpeed() {
  const difficulty = gliderDifficulty(session.step, session.maxSteps);
  return randomRange(168, 204) * session.settings.motionSpeed * difficulty.speedScale;
}

function safeGateY(gap = gateGap()) {
  return clamp(randomRange(playTop() + gap * 0.45, playBottom() - gap * 0.45), playTop() + gap * 0.42, playBottom() - gap * 0.42);
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

function targetPayload(progress: number, now: number, reason?: "left" | "cleanup") {
  return {
    targetId: gate.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: gate.enteredAt > 0 ? now - gate.enteredAt : 0,
    progress,
    gateCenter: { x: gate.x, y: gate.y },
    gateGap: gate.gap,
    glider: { x: glider.x, y: glider.y },
    pointer: copyPointer(),
    reason
  };
}

function resetGate(fromRight = true) {
  gateSequence += 1;
  gate.id = `glider-gate-${Date.now()}-${gateSequence}`;
  gate.gap = gateGap();
  gate.width = Math.min(120, Math.max(86, 62 * session.settings.targetScale));
  gate.x = fromRight ? width.value + gate.width + randomRange(160, 260) : width.value * 0.78;
  gate.y = safeGateY(gate.gap);
  gate.speed = gateSpeed();
  gate.phase = randomRange(0, Math.PI * 2);
  gate.entered = false;
  gate.enteredAt = 0;
  gate.passed = false;
}

function createCloud(index: number): Cloud {
  return {
    x: randomRange(-width.value * 0.1, width.value * 1.05),
    y: randomRange(playTop() * 0.3, playBottom() * 0.78),
    size: randomRange(62, 138) * (width.value < 720 ? 0.76 : 1),
    speed: randomRange(8, 22),
    alpha: randomRange(0.18, 0.42),
    phase: index + randomRange(0, Math.PI * 2)
  };
}

function resetScene() {
  cleanupStartedAt = 0;
  cleanupElapsedMs = 0;
  cleanupProgress.value = 0;
  hull.value = maxHull;
  damageFlash.value = 0;
  trailTimer = 0;
  gateSequence = 0;
  trails.splice(0);
  clouds.splice(0);
  glider.x = width.value * 0.26;
  glider.y = (playTop() + playBottom()) * 0.5;
  glider.vx = 0;
  glider.vy = 0;
  glider.tilt = 0;
  glider.glow = 0;
  resetGate(false);

  const cloudCount = width.value < 720 ? 7 : 11;
  for (let index = 0; index < cloudCount; index += 1) clouds.push(createCloud(index));
}

function startCleanup(now: number) {
  if (cleanupStartedAt > 0) return;
  cleanupStartedAt = now;
  cleanupElapsedMs = 0;
  cleanupProgress.value = 0.001;
  recordEvent("target-cancel", targetPayload(1, now, "cleanup"));
}

function completeGate(now: number) {
  gate.passed = true;
  recordEvent("target-click", targetPayload(1, now));
  recordSuccess({ targetId: gate.id, gate: session.step + 1, mode: "smooth-glide" });
  glider.glow = 1;

  if (session.step >= session.maxSteps) {
    startCleanup(now);
    return;
  }

  resetGate(true);
}

function damageGlider(now: number, reason: "miss") {
  const nextHull = applyGliderDamage(hull.value);
  hull.value = nextHull;
  damageFlash.value = 1;
  glider.glow = 0.7;
  recordMistake({ targetId: gate.id, reason, hull: nextHull, gate: session.step + 1, glider: { x: glider.x, y: glider.y }, gateCenter: { x: gate.x, y: gate.y } });
  recordEvent("target-cancel", targetPayload(0, now, "left"));
  if (nextHull <= 0) {
    finishSession("game-lost");
    return;
  }
  resetGate(true);
}

function updateGlider(delta: number, now: number) {
  glider.phase += delta * (session.settings.reduceMotion ? 1.1 : 2.4);
  const size = gliderSize();
  const fallback = {
    x: width.value * (0.28 + Math.sin(now * 0.00018) * 0.05),
    y: (playTop() + playBottom()) * 0.5 + Math.sin(now * 0.00024) * height.value * 0.08
  };
  const target = pointer.value.valid ? pointer.value : fallback;
  const targetX = clamp(target.x, width.value * 0.12, width.value * 0.62);
  const targetY = clamp(target.y, playTop() + size * 0.45, playBottom() - size * 0.45);
  const previousX = glider.x;
  const previousY = glider.y;
  const easing = Math.min(1, delta * 1.8 * session.settings.motionSpeed + delta * 0.48);
  const maxStep = delta * 360;

  glider.x += clamp((targetX - glider.x) * easing, -maxStep, maxStep);
  glider.y += clamp((targetY - glider.y) * easing, -maxStep, maxStep);
  glider.vx = (glider.x - previousX) / Math.max(delta, 0.016);
  glider.vy = (glider.y - previousY) / Math.max(delta, 0.016);
  glider.tilt += (clamp(glider.vy / 420, -0.42, 0.42) - glider.tilt) * Math.min(1, delta * 4.8);
  glider.glow += (0 - glider.glow) * Math.min(1, delta * 1.6);
  damageFlash.value = Math.max(0, damageFlash.value - delta * 1.7);
}

function updateGate(delta: number, now: number) {
  gate.x -= gate.speed * delta;
  gate.phase += delta * 1.4;
  gate.y += Math.sin(gate.phase) * delta * 10;
  gate.y = clamp(gate.y, playTop() + gate.gap * 0.42, playBottom() - gate.gap * 0.42);

  const horizontalDistance = Math.abs(gate.x - glider.x);
  const difficulty = gliderDifficulty(session.step, session.maxSteps);
  const entryRange = gate.width * 1.55;
  const gateProgress = clamp(1 - horizontalDistance / Math.max(1, entryRange), 0, 1);

  if (!gate.entered && horizontalDistance <= entryRange) {
    gate.entered = true;
    gate.enteredAt = now;
    recordEvent("target-enter", targetPayload(gateProgress, now));
  }

  const outcome = classifyGatePass(gate.x, gate.width, gate.y, gate.gap, glider.x, glider.y, difficulty.passRatio);
  if (!gate.passed && outcome === "pass") {
    completeGate(now);
    return;
  }

  if (outcome === "miss") {
    damageGlider(now, "miss");
  }
}

function updateClouds(delta: number) {
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * delta * session.settings.motionSpeed * 1.45;
    cloud.phase += delta * 0.35;
    if (cloud.x < -cloud.size * 2.6) {
      cloud.x = width.value + cloud.size * randomRange(0.8, 2.2);
      cloud.y = randomRange(playTop() * 0.25, playBottom() * 0.78);
    }
  }
}

function addTrail() {
  trails.push({ x: glider.x - gliderSize() * 0.46, y: glider.y + Math.sin(glider.phase) * gliderSize() * 0.05, age: 0, life: 1.4, radius: randomRange(8, 16) });
  if (trails.length > 34) trails.shift();
}

function updateTrails(delta: number) {
  if (!session.settings.reduceMotion) {
    trailTimer += delta;
    while (trailTimer >= 0.11) {
      addTrail();
      trailTimer -= 0.11;
    }
  }

  for (let index = trails.length - 1; index >= 0; index -= 1) {
    const trail = trails[index];
    trail.age += delta;
    trail.x -= 24 * delta;
    trail.y += Math.sin(trail.age * 3) * delta * 8;
    if (trail.age >= trail.life) trails.splice(index, 1);
  }
}

function updateCleanup(delta: number, now: number) {
  cleanupElapsedMs += delta * 1000;
  cleanupProgress.value = clamp(cleanupElapsedMs / 1450, 0, 1);
  glider.x += delta * (220 + cleanupProgress.value * 180);
  glider.y -= delta * 44;
  glider.tilt += (-0.18 - glider.tilt) * Math.min(1, delta * 3.6);
  glider.glow += (1 - glider.glow) * Math.min(1, delta * 1.8);
  updateClouds(delta);
  updateTrails(delta);
  if (cleanupProgress.value >= 1) finishSession("game-complete");
}

function update(delta: number, now: number) {
  if (session.status !== "running") return;

  if (cleanupStartedAt > 0) {
    updateCleanup(delta, now);
    return;
  }

  updateGlider(delta, now);
  updateGate(delta, now);
  updateClouds(delta);
  updateTrails(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#dff6ff");
  sky.addColorStop(0.54, "#f2fbff");
  sky.addColorStop(1, "#f7efd8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  const sunX = width.value * 0.78 + Math.sin(now * 0.00008) * 16;
  const sunY = height.value * 0.24;
  const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(width.value, height.value) * 0.34);
  sun.addColorStop(0, "rgb(255 230 150 / 44%)");
  sun.addColorStop(1, "rgb(255 230 150 / 0%)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#96c3a4";
  for (let index = 0; index < 5; index += 1) {
    const hillX = width.value * (index * 0.26 - 0.08);
    const hillY = height.value * (0.91 + Math.sin(now * 0.00008 + index) * 0.012);
    ctx.beginPath();
    ctx.ellipse(hillX, hillY, width.value * 0.22, height.value * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud) {
  const bob = Math.sin(cloud.phase) * cloud.size * 0.05;
  ctx.save();
  ctx.globalAlpha = cloud.alpha;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(cloud.x, cloud.y + bob, cloud.size * 0.66, cloud.size * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse(cloud.x - cloud.size * 0.34, cloud.y + bob + cloud.size * 0.03, cloud.size * 0.34, cloud.size * 0.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cloud.x + cloud.size * 0.28, cloud.y + bob - cloud.size * 0.02, cloud.size * 0.38, cloud.size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, trail: Trail) {
  const progress = trail.age / trail.life;
  const alpha = (1 - progress) * 0.28;
  ctx.save();
  ctx.fillStyle = `rgb(255 255 255 / ${alpha})`;
  ctx.beginPath();
  ctx.arc(trail.x, trail.y, trail.radius * (1 + progress * 1.7), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGate(ctx: CanvasRenderingContext2D) {
  if (cleanupStartedAt > 0) return;
  const gapTop = gate.y - gate.gap * 0.5;
  const gapBottom = gate.y + gate.gap * 0.5;
  const pulse = 1 + Math.sin(gate.phase * 2.1) * 0.025;
  const columnWidth = gate.width * pulse;
  const glow = ctx.createRadialGradient(gate.x, gate.y, gate.gap * 0.16, gate.x, gate.y, gate.gap * 0.72);
  glow.addColorStop(0, "rgb(255 255 255 / 24%)");
  glow.addColorStop(0.58, "rgb(125 205 218 / 14%)");
  glow.addColorStop(1, "rgb(125 205 218 / 0%)");
  ctx.fillStyle = glow;
  ctx.fillRect(gate.x - gate.gap, gate.y - gate.gap, gate.gap * 2, gate.gap * 2);

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = hull.value <= 1 ? "rgb(255 224 205 / 88%)" : "rgb(255 255 255 / 82%)";
  ctx.lineWidth = Math.max(9, columnWidth * 0.15);
  ctx.beginPath();
  ctx.moveTo(gate.x, playTop() + 8);
  ctx.lineTo(gate.x, gapTop);
  ctx.moveTo(gate.x, gapBottom);
  ctx.lineTo(gate.x, playBottom() - 8);
  ctx.stroke();

  ctx.strokeStyle = "rgb(91 176 195 / 54%)";
  ctx.lineWidth = Math.max(4, columnWidth * 0.055);
  ctx.setLineDash([18, 18]);
  ctx.beginPath();
  ctx.arc(gate.x, gate.y, gate.gap * 0.5, -Math.PI * 0.44, Math.PI * 0.44);
  ctx.arc(gate.x, gate.y, gate.gap * 0.5, Math.PI * 0.56, Math.PI * 1.44);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgb(255 255 255 / 88%)";
  ctx.strokeStyle = "rgb(91 176 195 / 68%)";
  ctx.lineWidth = 4;
  for (const y of [gapTop, gapBottom]) {
    ctx.beginPath();
    ctx.arc(gate.x, y, Math.max(13, columnWidth * 0.17), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlider(ctx: CanvasRenderingContext2D) {
  const size = gliderSize();
  const bobY = Math.sin(glider.phase) * size * 0.035;
  ctx.save();
  const shake = damageFlash.value > 0 && !session.settings.reduceMotion ? Math.sin(performance.now() * 0.05) * size * 0.04 : 0;
  ctx.translate(glider.x + shake, glider.y + bobY);
  ctx.rotate(glider.tilt);

  const shadow = ctx.createRadialGradient(-size * 0.08, size * 0.28, size * 0.08, -size * 0.08, size * 0.28, size * 0.76);
  shadow.addColorStop(0, "rgb(62 96 118 / 20%)");
  shadow.addColorStop(1, "rgb(62 96 118 / 0%)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(-size * 0.02, size * 0.24, size * 0.84, size * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-size * 0.62, -size * 0.32, size * 0.74, size * 0.28);
  body.addColorStop(0, hull.value <= 1 ? "#ffe8dc" : "#f7fbff");
  body.addColorStop(0.52, hull.value <= 1 ? "#efb8aa" : "#cfeaf8");
  body.addColorStop(1, hull.value <= 1 ? "#bf6d67" : "#7cb8d4");
  ctx.fillStyle = body;
  ctx.strokeStyle = "rgb(73 129 158 / 52%)";
  ctx.lineWidth = Math.max(2, size * 0.025);

  ctx.beginPath();
  ctx.moveTo(size * 0.78, 0);
  ctx.lineTo(-size * 0.52, -size * 0.34);
  ctx.lineTo(-size * 0.26, 0);
  ctx.lineTo(-size * 0.52, size * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgb(255 255 255 / 70%)";
  ctx.beginPath();
  ctx.moveTo(size * 0.54, 0);
  ctx.lineTo(-size * 0.44, -size * 0.2);
  ctx.lineTo(-size * 0.12, 0);
  ctx.lineTo(-size * 0.44, size * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgb(255 255 255 / 82%)";
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, 0);
  ctx.lineTo(size * 0.62, 0);
  ctx.stroke();

  if (glider.glow > 0.03) {
    ctx.globalAlpha = Math.min(0.7, glider.glow * 0.42 + damageFlash.value * 0.32);
    ctx.strokeStyle = damageFlash.value > 0 ? "#ffe2c6" : "#ffffff";
    ctx.lineWidth = size * 0.11;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.68, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStatus(ctx: CanvasRenderingContext2D) {
  const fontSize = Math.max(15, Math.min(width.value, height.value) * 0.026);
  const x = Math.max(28, width.value * 0.04);
  const y = Math.max(78, height.value * 0.13);
  ctx.save();
  ctx.fillStyle = "rgb(34 55 74 / 72%)";
  ctx.strokeStyle = "rgb(255 255 255 / 28%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - fontSize * 0.8, y - fontSize * 1.45, fontSize * 15.2, fontSize * 3.4, fontSize * 0.65);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f8fbff";
  ctx.font = `800 ${fontSize}${String.fromCharCode(112, 120)} Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Маршрут ${session.step + 1}/${session.maxSteps}`, x, y - fontSize * 0.42);
  ctx.fillStyle = hull.value <= 1 ? "#ffd6c7" : "#e6fff4";
  ctx.fillText(`Крыло: ${hull.value}/${maxHull}`, x, y + fontSize * 0.82);
  ctx.restore();
}

function drawCleanup(ctx: CanvasRenderingContext2D) {
  if (cleanupProgress.value <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.16 * cleanupProgress.value;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width.value, height.value);
  ctx.globalAlpha = 0.42 * cleanupProgress.value;
  ctx.strokeStyle = "#fff4b8";
  ctx.lineWidth = Math.max(18, height.value * 0.035);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width.value * 0.18, height.value * 0.72);
  ctx.bezierCurveTo(width.value * 0.38, height.value * 0.56, width.value * 0.62, height.value * 0.42, width.value * 0.9, height.value * 0.28);
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const cloud of clouds) drawCloud(ctx, cloud);
  drawGate(ctx);
  for (const trail of trails) drawTrail(ctx, trail);
  drawGlider(ctx);
  drawStatus(ctx);
  drawCleanup(ctx);
}

function restart() {
  startSession();
  resetScene();
}

onMounted(() => {
  resetScene();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="glider-shell">
    <canvas ref="canvasRef" class="glider-canvas" />

    <v-card class="glider-hint px-4 py-3" color="surface" rounded="xl" variant="flat">
      <div class="d-flex align-center ga-3">
        <v-icon icon="mdi-airplane" color="primary" size="32" />
        <div>
          <div class="text-body-2 font-weight-medium">{{ guidanceText }}</div>
          <div class="text-caption text-medium-emphasis">Ворота уже, скорость выше, промах повреждает крыло.</div>
        </div>
      </div>
    </v-card>

    <GameHud
      title="Планер"
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
      title="Планер"
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
.glider-shell {
  background: #dff6ff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.glider-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.glider-hint {
  inset-block-end: max(1.125rem, env(safe-area-inset-bottom));
  inset-inline: 1.125rem;
  margin-inline: auto;
  max-inline-size: 40rem;
  opacity: 0.94;
  position: absolute;
  z-index: 3;
}
</style>
