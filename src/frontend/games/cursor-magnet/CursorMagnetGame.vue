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

type MagnetItem = Point & {
  id: string;
  label: string;
  hue: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  radius: number;
  entered: boolean;
  captured: boolean;
  captureAge: number;
  goalHoldMs: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordHint, recordSuccess, startSession } = useGameSession("cursor-magnet", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 600,
  sessionSeconds: 150,
  targetScale: 1.45,
  motionSpeed: 0.5,
  distractors: "none",
  hints: "high"
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const items = reactive<MagnetItem[]>([]);
const magnet = reactive({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.5, pulse: 0 });
const cleanupProgress = ref(0);
const resultVisible = computed(() => session.status === "finished");
const progressText = computed(() => `${session.step}/${session.maxSteps}`);
const helperText = computed(() => {
  if (session.status === "paused") return "Пауза. Предметы спокойно подождут.";
  if (cleanupProgress.value > 0) return "Все предметы на месте. Поле мягко очищается.";
  if (!pointer.value.valid) return "Можно вести магнит взглядом или мышью. Ошибок здесь нет.";
  return "Подведи магнит к предмету и плавно перенеси его в светлую цель.";
});

const itemLabels = ["лист", "камень", "ракушка", "облако", "звезда", "перо", "капля", "огонёк"];
const itemHues = [132, 202, 32, 178, 48, 286, 214, 12];
const cleanupDurationMs = 1550;
let finishAfter = 0;
let lastHintAt = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function itemRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.09;
  return Math.min(66, Math.max(42, Math.min(viewportLimit, 42 * session.settings.targetScale)));
}

function influenceRadius() {
  return itemRadius() * 2.55;
}

function goalRadius() {
  return itemRadius() * 1.65;
}

function goalPoint(): Point {
  if (width.value < 720) return { x: width.value * 0.5, y: height.value * 0.76 };
  return { x: width.value * 0.78, y: height.value * 0.56 };
}

function clampToStage(point: Point) {
  return {
    x: clamp(point.x, 28, width.value - 28),
    y: clamp(point.y, 120, height.value - 28)
  };
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

function targetPayload(item: MagnetItem, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: item.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: Math.round(item.goalHoldMs),
    progress,
    pointer: copyPointer(),
    reason
  };
}

function layoutPoints() {
  if (width.value < 720) {
    return [
      { x: 24, y: 29 },
      { x: 69, y: 31 },
      { x: 34, y: 43 },
      { x: 76, y: 47 },
      { x: 22, y: 58 },
      { x: 68, y: 61 },
      { x: 35, y: 70 },
      { x: 81, y: 71 }
    ];
  }

  return [
    { x: 18, y: 35 },
    { x: 36, y: 28 },
    { x: 27, y: 52 },
    { x: 47, y: 45 },
    { x: 18, y: 70 },
    { x: 43, y: 72 },
    { x: 58, y: 34 },
    { x: 61, y: 64 }
  ];
}

function createItems() {
  const radius = itemRadius();
  items.splice(0);
  finishAfter = 0;
  cleanupProgress.value = 0;

  layoutPoints().forEach((point, index) => {
    const x = width.value * point.x / 100;
    const y = height.value * point.y / 100;
    items.push({
      id: `cursor-magnet-item-${Date.now()}-${index}`,
      label: itemLabels[index],
      hue: itemHues[index],
      x,
      y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      radius: radius * (0.92 + (index % 3) * 0.05),
      entered: false,
      captured: false,
      captureAge: 0,
      goalHoldMs: 0
    });
  });

  const goal = goalPoint();
  magnet.x = width.value * 0.5;
  magnet.y = Math.min(goal.y, height.value * 0.5);
}

function capVelocity(item: MagnetItem) {
  const maxSpeed = 430 * session.settings.motionSpeed;
  const speed = Math.hypot(item.vx, item.vy);
  if (speed <= maxSpeed) return;
  item.vx = item.vx / speed * maxSpeed;
  item.vy = item.vy / speed * maxSpeed;
}

function updateMagnet(delta: number) {
  magnet.pulse += delta;
  const target = clampToStage(pointer.value.valid ? pointer.value : { x: width.value * 0.5, y: height.value * 0.52 });
  const smoothing = pointer.value.valid ? 7.2 : 1.4;
  magnet.x += (target.x - magnet.x) * Math.min(1, delta * smoothing);
  magnet.y += (target.y - magnet.y) * Math.min(1, delta * smoothing);
}

function captureItem(item: MagnetItem, now: number) {
  item.captured = true;
  item.entered = false;
  item.captureAge = 0;
  item.vx = 0;
  item.vy = 0;
  item.goalHoldMs = session.settings.dwellMs;
  recordEvent("target-click", targetPayload(item, 1));

  const nextStep = session.step + 1;
  recordSuccess({ targetId: item.id, item: item.label, heldMs: session.settings.dwellMs });
  if (nextStep >= session.maxSteps && finishAfter === 0) {
    cleanupProgress.value = 0.001;
    finishAfter = now + cleanupDurationMs;
  }
}

function updateCapturedItem(item: MagnetItem, delta: number, index: number) {
  const goal = goalPoint();
  item.captureAge += delta;
  const angle = index * 0.72 + item.captureAge * 0.42;
  const orbit = Math.min(goalRadius() * 0.38, 18 + item.captureAge * 8);
  const target = {
    x: goal.x + Math.cos(angle) * orbit,
    y: goal.y + Math.sin(angle) * orbit * 0.48
  };
  item.x += (target.x - item.x) * Math.min(1, delta * 3.8);
  item.y += (target.y - item.y) * Math.min(1, delta * 3.8);
}

function updateFreeItem(item: MagnetItem, delta: number, now: number) {
  const goal = goalPoint();
  const magnetDistance = distance(item, magnet);
  const goalDistance = distance(item, goal);
  const inField = pointer.value.valid && magnetDistance <= influenceRadius();
  const inGoal = goalDistance <= goalRadius() * 0.9;

  if (inField && !item.entered) {
    item.entered = true;
    recordEvent("target-enter", targetPayload(item, 0));
  }

  if (!inField && item.entered) {
    item.entered = false;
    recordEvent("target-cancel", targetPayload(item, item.goalHoldMs / session.settings.dwellMs, pointer.value.valid ? "left" : "invalid-gaze"));
  }

  if (inField) {
    const fieldStrength = 1 - magnetDistance / influenceRadius();
    item.vx += (magnet.x - item.x) * (1.8 + fieldStrength * 5.2) * delta;
    item.vy += (magnet.y - item.y) * (1.8 + fieldStrength * 5.2) * delta;
  } else {
    item.vx += (item.homeX - item.x) * 0.42 * delta;
    item.vy += (item.homeY - item.y) * 0.42 * delta;
  }

  if (goalDistance <= goalRadius() * 2.25 || distance(magnet, goal) <= goalRadius() * 2.2) {
    const pull = goalDistance <= goalRadius() * 1.25 ? 4.6 : 2.2;
    item.vx += (goal.x - item.x) * pull * delta;
    item.vy += (goal.y - item.y) * pull * delta;
  }

  if (inGoal) {
    item.goalHoldMs = Math.min(session.settings.dwellMs, item.goalHoldMs + delta * 1000);
  } else {
    item.goalHoldMs = Math.max(0, item.goalHoldMs - delta * 520);
  }

  capVelocity(item);
  const damping = Math.pow(inField ? 0.24 : 0.18, delta);
  item.vx *= damping;
  item.vy *= damping;
  item.x = clamp(item.x + item.vx * delta, item.radius, width.value - item.radius);
  item.y = clamp(item.y + item.vy * delta, 118 + item.radius, height.value - item.radius);

  if (item.goalHoldMs >= session.settings.dwellMs) captureItem(item, now);
}

function update(delta: number, now: number) {
  updateMagnet(delta);

  if (session.status !== "running") return;

  if (!pointer.value.valid && now - lastHintAt > 3400) {
    lastHintAt = now;
    recordHint({ kind: "move-magnet", pointer: copyPointer() });
  }

  if (finishAfter > 0) {
    cleanupProgress.value = clamp(1 - (finishAfter - now) / cleanupDurationMs, 0.001, 1);
    items.forEach((item, index) => updateCapturedItem(item, delta, index));
    if (now >= finishAfter) finishSession("max-steps");
    return;
  }

  items.forEach((item, index) => {
    if (item.captured) updateCapturedItem(item, delta, index);
    else updateFreeItem(item, delta, now);
  });
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#f4fbff");
  sky.addColorStop(0.52, "#eef6ff");
  sky.addColorStop(1, "#fbf0dc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let index = 0; index < 5; index += 1) {
    const x = width.value * (0.1 + index * 0.22) + Math.sin(now * 0.00012 + index) * 28;
    const y = height.value * (0.18 + index % 2 * 0.13);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(x - 44, y + 10, 54, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(x, y, 70, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 52, y + 9, 48, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const groundTop = height.value * 0.66;
  const ground = ctx.createLinearGradient(0, groundTop, 0, height.value);
  ground.addColorStop(0, "#e6f2cf");
  ground.addColorStop(1, "#c7dfac");
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundTop, width.value, height.value - groundTop);
}

function drawGoal(ctx: CanvasRenderingContext2D, now: number) {
  const goal = goalPoint();
  const radius = goalRadius();
  const pulse = 1 + Math.sin(now * 0.002) * 0.025;
  const ready = cleanupProgress.value > 0 ? cleanupProgress.value : session.step / session.maxSteps;

  ctx.save();
  ctx.translate(goal.x, goal.y);
  ctx.fillStyle = "rgb(71 102 126 / 14%)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.82, radius * 1.1, radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  const glow = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius * 1.5 * pulse);
  glow.addColorStop(0, `rgb(255 236 173 / ${0.5 + ready * 0.25})`);
  glow.addColorStop(0.55, "rgb(151 215 205 / 24%)");
  glow.addColorStop(1, "rgb(151 215 205 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.5 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff8d8";
  ctx.strokeStyle = "#77b9ad";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#47667e";
  ctx.font = `700 ${Math.max(17, radius * 0.24)}px Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("цель", 0, -radius * 0.06);
  ctx.font = `600 ${Math.max(14, radius * 0.16)}px Roboto, sans-serif`;
  ctx.fillText(progressText.value, 0, radius * 0.24);
  ctx.restore();
}

function drawItem(ctx: CanvasRenderingContext2D, item: MagnetItem) {
  const hold = item.goalHoldMs / session.settings.dwellMs;
  const radius = item.radius * (item.captured ? 0.84 : 1);
  const glowRadius = radius * (1.28 + hold * 0.34);

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.globalAlpha = item.captured ? Math.max(0.35, 1 - item.captureAge * 0.18) : 1;
  ctx.fillStyle = "rgb(70 100 112 / 16%)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.76, radius * 0.7, radius * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  const glow = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, glowRadius);
  glow.addColorStop(0, `hsl(${item.hue} 90% 80% / ${0.44 + hold * 0.28})`);
  glow.addColorStop(1, `hsl(${item.hue} 70% 72% / 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${item.hue} 70% 78%)`;
  ctx.strokeStyle = `hsl(${item.hue} 50% 52%)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-radius, -radius * 0.72, radius * 2, radius * 1.44, radius * 0.45);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#314856";
  ctx.font = `700 ${Math.max(14, radius * 0.28)}px Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(item.label, 0, 0);

  if (hold > 0 && !item.captured) {
    ctx.strokeStyle = "rgb(70 140 132 / 68%)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.08, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hold);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMagnet(ctx: CanvasRenderingContext2D, now: number) {
  const radius = influenceRadius();
  const active = pointer.value.valid && session.status === "running" && cleanupProgress.value === 0;
  const wave = Math.sin(now * 0.004) * 0.04;

  ctx.save();
  ctx.translate(magnet.x, magnet.y);
  ctx.globalAlpha = active ? 0.32 : 0.16;
  const aura = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * (0.95 + wave));
  aura.addColorStop(0, "rgb(120 182 216 / 48%)");
  aura.addColorStop(0.52, "rgb(120 182 216 / 14%)");
  aura.addColorStop(1, "rgb(120 182 216 / 0%)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, radius * (0.95 + wave), 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#e76f68";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 2, 32, Math.PI * 0.14, Math.PI * 0.86, false);
  ctx.stroke();
  ctx.strokeStyle = "#5aa9d6";
  ctx.beginPath();
  ctx.moveTo(-30, -8);
  ctx.lineTo(-30, 26);
  ctx.moveTo(30, -8);
  ctx.lineTo(30, 26);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-30, 29, 9, 0, Math.PI * 2);
  ctx.arc(30, 29, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCleanup(ctx: CanvasRenderingContext2D) {
  if (cleanupProgress.value <= 0) return;

  const goal = goalPoint();
  const radius = goalRadius() * (1 + cleanupProgress.value * 1.3);
  ctx.save();
  ctx.globalAlpha = 1 - cleanupProgress.value * 0.2;
  ctx.strokeStyle = "rgb(118 185 173 / 46%)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.2 + cleanupProgress.value * 0.26;
  ctx.fillStyle = "#fff8dd";
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, goalRadius() * cleanupProgress.value, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  drawGoal(ctx, now);
  items.filter((item) => !item.captured).forEach((item) => drawItem(ctx, item));
  items.filter((item) => item.captured).forEach((item) => drawItem(ctx, item));
  drawMagnet(ctx, now);
  drawCleanup(ctx);
}

function restart() {
  startSession();
  createItems();
}

onMounted(() => {
  createItems();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="cursor-magnet-shell">
    <canvas ref="canvasRef" class="cursor-magnet-canvas" aria-label="Игра Курсор-магнит" />

    <GameHud
      title="Курсор-магнит"
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

    <v-container class="cursor-magnet-overlay" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" md="9" lg="7">
          <v-card class="pa-4 pa-sm-5 text-center" color="surface" elevation="8" rounded="xl">
            <div class="text-overline text-primary">continuous control</div>
            <h1 class="text-h4 text-sm-h3 font-weight-bold mb-2">Курсор-магнит</h1>
            <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-4">{{ helperText }}</p>
            <v-chip color="primary" prepend-icon="mdi-magnet-on" rounded="pill" size="large" variant="tonal">
              Мягкое притяжение · без ошибок
            </v-chip>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog
      :model-value="resultVisible"
      title="Курсор-магнит"
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
.cursor-magnet-shell {
  min-block-size: 100vh;
  overflow: hidden;
  position: relative;
}

.cursor-magnet-canvas {
  display: block;
  inset: 0;
  position: fixed;
}

.cursor-magnet-overlay {
  padding-block-start: 7.5rem;
  pointer-events: none;
  position: relative;
  z-index: 1;
}

.cursor-magnet-overlay :deep(.v-card) {
  opacity: 0.94;
}

@media (max-width: 720px) {
  .cursor-magnet-overlay {
    padding-block-start: 6.75rem;
  }
}
</style>
