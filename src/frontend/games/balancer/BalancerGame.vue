<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";

type Point = { x: number; y: number };
type BalanceZone = Point & {
  id: string;
  width: number;
  height: number;
  hue: number;
  phase: number;
};
type BalanceOrb = Point & {
  radius: number;
  phase: number;
  glow: number;
};
type BalanceSpark = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  hue: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("balancer", {
  maxSteps: 8,
  overrides: { preset: "gentle", dwellMs: 600, targetScale: 1.55, motionSpeed: 0.5, distractors: "none", hints: "high" },
  finishOnMistakes: false
});

const orb = reactive<BalanceOrb>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.56, radius: 64, phase: 0, glow: 0 });
const zone = reactive<BalanceZone>({ id: "balance-zone-0", x: window.innerWidth * 0.5, y: window.innerHeight * 0.56, width: 320, height: 210, hue: 190, phase: 0 });
const sparks = reactive<BalanceSpark[]>([]);
const holdProgress = ref(0);
const insideBalance = ref(false);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(holdProgress.value * 100));
const guideText = computed(() => {
  if (session.status === "paused") return "Пауза. Шар остаётся на месте и спокойно ждёт.";
  if (!pointer.value.valid) return "Можно вести шар взглядом или мышью. Зона баланса широкая и не спешит.";
  if (!insideBalance.value) return "Верни шар в мягкую светлую зону. Прогресс просто ждёт.";
  return "Удерживай шар в зоне баланса ещё немного.";
});

const zonePositions = [
  { x: 50, y: 56, hue: 190 },
  { x: 38, y: 50, hue: 206 },
  { x: 62, y: 50, hue: 172 },
  { x: 48, y: 66, hue: 150 },
  { x: 56, y: 42, hue: 224 },
  { x: 34, y: 62, hue: 184 },
  { x: 66, y: 62, hue: 198 },
  { x: 50, y: 52, hue: 166 }
];

let tracking = false;
let enteredAt = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
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

function orbRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.105;
  return Math.min(86, Math.max(54, Math.min(viewportLimit, 46 * session.settings.targetScale)));
}

function syncGeometry() {
  orb.radius = orbRadius();
  zone.width = Math.min(430, Math.max(270, Math.min(width.value * 0.52, 250 * session.settings.targetScale)));
  zone.height = Math.min(300, Math.max(180, Math.min(height.value * 0.32, 168 * session.settings.targetScale)));
  zone.x = clamp(zone.x, zone.width * 0.5 + 24, width.value - zone.width * 0.5 - 24);
  zone.y = clamp(zone.y, Math.max(138, zone.height * 0.5 + 36), height.value - zone.height * 0.5 - 40);
  orb.x = clamp(orb.x, orb.radius + 8, width.value - orb.radius - 8);
  orb.y = clamp(orb.y, Math.max(116, orb.radius + 8), height.value - orb.radius - 8);
}

function moveZone(step = session.step) {
  const next = zonePositions[step % zonePositions.length];
  zone.id = `balance-zone-${step}-${Date.now()}`;
  zone.x = width.value * next.x / 100;
  zone.y = height.value * next.y / 100;
  zone.hue = next.hue;
  zone.phase = randomRange(0, Math.PI * 2);
  syncGeometry();
}

function distanceRatioToZone(point: Point) {
  const dx = (point.x - zone.x) / Math.max(1, zone.width * 0.5);
  const dy = (point.y - zone.y) / Math.max(1, zone.height * 0.5);
  return Math.hypot(dx, dy);
}

function targetPayload(progress: number, now: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: zone.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: enteredAt === 0 ? 0 : Math.max(0, now - enteredAt),
    progress,
    pointer: copyPointer(),
    orb: { x: Math.round(orb.x), y: Math.round(orb.y) },
    reason
  };
}

function addCompletionSparks() {
  if (session.settings.reduceMotion) return;
  for (let index = 0; index < 22; index += 1) {
    const angle = randomRange(0, Math.PI * 2);
    const speed = randomRange(28, 92);
    sparks.push({
      x: orb.x + Math.cos(angle) * randomRange(6, orb.radius * 0.65),
      y: orb.y + Math.sin(angle) * randomRange(6, orb.radius * 0.65),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randomRange(4, 26),
      age: 0,
      life: randomRange(0.85, 1.35),
      radius: randomRange(3.2, 7.2),
      hue: zone.hue + randomRange(-18, 24)
    });
  }
  if (sparks.length > 90) sparks.splice(0, sparks.length - 90);
}

function completeBalance(now: number) {
  recordEvent("target-click", targetPayload(1, now));
  recordSuccess({ targetId: zone.id, balance: session.step + 1 });
  addCompletionSparks();
  holdProgress.value = 0;
  insideBalance.value = false;
  tracking = false;
  enteredAt = 0;
  if (session.status === "running") moveZone(session.step);
}

function updateOrb(delta: number) {
  const fallback = { x: width.value * 0.5 + Math.sin(orb.phase * 0.38) * 28, y: height.value * 0.56 };
  const target = pointer.value.valid ? pointer.value : fallback;
  const smoothing = pointer.value.valid ? 4.8 : 1.15;
  orb.x += (target.x - orb.x) * Math.min(1, delta * smoothing);
  orb.y += (target.y - orb.y) * Math.min(1, delta * smoothing);
  orb.x = clamp(orb.x, orb.radius + 8, width.value - orb.radius - 8);
  orb.y = clamp(orb.y, Math.max(116, orb.radius + 8), height.value - orb.radius - 8);
  orb.phase += delta * (session.settings.reduceMotion ? 0.85 : 1.75);
}

function updateBalance(delta: number, now: number) {
  const ratio = distanceRatioToZone(orb);
  const inside = pointer.value.valid && ratio <= 0.82;
  const near = pointer.value.valid && ratio <= 1.08;
  insideBalance.value = inside;
  const glowTarget = inside ? 1 : near ? 0.44 : 0;
  orb.glow += (glowTarget - orb.glow) * Math.min(1, delta * 4.8);

  if (inside && !tracking) {
    tracking = true;
    enteredAt = now;
    recordEvent("target-enter", targetPayload(holdProgress.value, now));
  }

  if (!inside && tracking) {
    recordEvent("target-cancel", targetPayload(holdProgress.value, now, pointer.value.valid ? "left" : "invalid-gaze"));
    tracking = false;
    enteredAt = 0;
  }

  if (!inside) return;

  holdProgress.value = Math.min(1, holdProgress.value + delta * 1000 / session.settings.dwellMs);
  if (holdProgress.value >= 1) completeBalance(now);
}

function updateSparks(delta: number) {
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.age += delta;
    spark.x += spark.vx * delta;
    spark.y += spark.vy * delta;
    spark.vy += 12 * delta;
    if (spark.age >= spark.life) sparks.splice(index, 1);
  }
}

function update(delta: number, now: number) {
  syncGeometry();
  if (session.status !== "running") return;
  zone.phase += session.settings.reduceMotion ? 0 : delta * 0.9;
  updateSparks(delta);
  updateOrb(delta);
  updateBalance(delta, now);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, height.value);
  sky.addColorStop(0, "#eef8ff");
  sky.addColorStop(0.56, "#f4fbf4");
  sky.addColorStop(1, "#fff7e7");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = "#d8f1ff";
  for (let index = 0; index < 6; index += 1) {
    const x = width.value * (0.08 + index * 0.18);
    const y = height.value * (0.2 + (index % 3) * 0.18);
    ctx.beginPath();
    ctx.ellipse(x, y, 92, 34, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawZone(ctx: CanvasRenderingContext2D) {
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(zone.phase) * 0.035;
  const hue = zone.hue;

  ctx.save();
  ctx.translate(zone.x, zone.y);
  ctx.scale(1 + pulse, 1 - pulse * 0.4);

  const fill = ctx.createRadialGradient(0, 0, zone.height * 0.12, 0, 0, zone.width * 0.58);
  fill.addColorStop(0, `hsla(${hue}, 82%, 78%, 0.5)`);
  fill.addColorStop(0.58, `hsla(${hue}, 72%, 76%, 0.25)`);
  fill.addColorStop(1, `hsla(${hue}, 70%, 74%, 0.04)`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, zone.width * 0.5, zone.height * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 7;
  ctx.strokeStyle = `hsla(${hue}, 72%, 44%, 0.32)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, zone.width * 0.42, zone.height * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = `hsla(${hue}, 82%, 34%, 0.2)`;
  ctx.beginPath();
  ctx.moveTo(-zone.width * 0.34, 0);
  ctx.lineTo(zone.width * 0.34, 0);
  ctx.moveTo(0, -zone.height * 0.28);
  ctx.lineTo(0, zone.height * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D) {
  const bob = session.settings.reduceMotion ? 0 : Math.sin(orb.phase * 2.1) * 3;
  const glowRadius = orb.radius * (1.85 + orb.glow * 0.35);

  ctx.save();
  ctx.translate(orb.x, orb.y + bob);

  const glow = ctx.createRadialGradient(0, 0, orb.radius * 0.2, 0, 0, glowRadius);
  glow.addColorStop(0, `hsla(${zone.hue}, 94%, 76%, ${0.34 + orb.glow * 0.22})`);
  glow.addColorStop(1, `hsla(${zone.hue}, 88%, 76%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-orb.radius * 0.3, -orb.radius * 0.34, orb.radius * 0.1, 0, 0, orb.radius);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.38, `hsl(${zone.hue}, 88%, 80%)`);
  body.addColorStop(1, `hsl(${zone.hue + 18}, 70%, 52%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = Math.max(4, orb.radius * 0.08);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.beginPath();
  ctx.arc(0, 0, orb.radius * (0.78 + holdProgress.value * 0.14), -Math.PI * 0.8, -Math.PI * 0.8 + Math.PI * 2 * holdProgress.value);
  ctx.stroke();
  ctx.restore();
}

function drawSparks(ctx: CanvasRenderingContext2D) {
  for (const spark of sparks) {
    const alpha = Math.max(0, 1 - spark.age / spark.life);
    ctx.save();
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = `hsl(${spark.hue}, 90%, 70%)`;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.radius * (0.45 + alpha * 0.8), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function draw(ctx: CanvasRenderingContext2D) {
  drawBackground(ctx);
  drawZone(ctx);
  drawSparks(ctx);
  drawOrb(ctx);
}

useGameLoop({ context, update, draw });

function restart() {
  holdProgress.value = 0;
  insideBalance.value = false;
  sparks.splice(0);
  tracking = false;
  enteredAt = 0;
  orb.x = width.value * 0.5;
  orb.y = height.value * 0.56;
  startSession();
  moveZone(0);
}

onMounted(() => {
  moveZone(0);
});
</script>

<template>
  <div class="balancer-shell">
    <canvas ref="canvasRef" class="balancer-canvas" />

    <GameHud
      title="Балансир"
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

    <v-card class="balancer-card pa-4 pa-sm-5" color="surface" elevation="8" rounded="xl">
      <div class="text-overline text-teal-darken-2">continuous control</div>
      <h1 class="text-h4 text-sm-h3 font-weight-bold">Балансир</h1>
      <p class="text-body-1 text-sm-h6 text-medium-emphasis mb-3">{{ guideText }}</p>
      <v-progress-linear :model-value="progressPercent" color="teal" height="0.625rem" rounded />
      <div class="text-caption text-medium-emphasis mt-2">Прогресс сохраняется и ждёт возвращения в зону.</div>
    </v-card>

    <div class="quiet-controls d-flex align-center ga-1 pa-1">
      <v-btn aria-label="В меню" color="surface" density="comfortable" icon="mdi-arrow-left" size="small" variant="text" @click="router.push(resolveMenuRoute())" />
      <v-btn
        :aria-label="session.status === 'paused' ? 'Продолжить' : 'Пауза'"
        color="surface"
        density="comfortable"
        :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'"
        size="small"
        variant="text"
        @click="session.status === 'paused' ? resumeSession() : pauseSession()"
      />
    </div>

    <GameResultDialog :model-value="resultVisible" title="Балансир" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.balancer-shell {
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.balancer-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.balancer-card {
  inline-size: min(38.75rem, calc(100dvw - 2rem));
  inset-block-start: max(6.5rem, calc(env(safe-area-inset-top) + 5.25rem));
  inset-inline-start: 50%;
  opacity: 0.92;
  position: absolute;
  text-align: center;
  transform: translateX(-50%);
  z-index: 2;
}

.quiet-controls {
  background: rgb(255 255 255 / 36%);
  border: 0.0625rem solid rgb(255 255 255 / 42%);
  border-radius: 1.125rem;
  box-shadow: 0 0.625rem 1.75rem rgb(64 128 136 / 12%);
  inset-block-start: max(1rem, env(safe-area-inset-top));
  inset-inline-start: max(1rem, env(safe-area-inset-left));
  opacity: 0.58;
  position: absolute;
  transition: opacity 160ms ease;
  z-index: 3;
}

.quiet-controls:focus-within,
.quiet-controls:hover {
  opacity: 0.95;
}

@media (max-width: 42.5rem) {
  .balancer-card {
    inset-block-start: auto;
    inset-block-end: max(1rem, env(safe-area-inset-bottom));
  }
}
</style>
