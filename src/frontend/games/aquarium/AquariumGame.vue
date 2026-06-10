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
type AquariumFish = Point & {
  id: string;
  size: number;
  hue: number;
  accentHue: number;
  age: number;
  angle: number;
  speed: number;
  dwellProgress: number;
  enteredAt?: number;
  fedAge: number;
  foodCooldown: number;
  wander: Point;
};
type FoodCrumb = Point & {
  age: number;
  life: number;
  radius: number;
  drift: number;
};
type AirBubble = Point & {
  age: number;
  life: number;
  radius: number;
  speed: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("aquarium", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1350,
  sessionSeconds: 88,
  targetScale: 1.55,
  motionSpeed: 0.38,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const fishes = reactive<AquariumFish[]>([]);
const food = reactive<FoodCrumb[]>([]);
const bubbles = reactive<AirBubble[]>([]);
const resultVisible = computed(() => session.status === "finished");

const fishHues = [24, 42, 178, 204, 286];
let ambientBubbleTimer = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function waterTop() {
  return Math.max(98, height.value * 0.15);
}

function safePoint(padding = 84): Point {
  return {
    x: randomRange(padding, Math.max(padding + 1, width.value - padding)),
    y: randomRange(waterTop() + padding * 0.35, Math.max(waterTop() + padding, height.value - padding * 0.72))
  };
}

function fishCount() {
  return width.value < 720 ? 4 : 5;
}

function fishSize(index: number) {
  const viewportLimit = Math.min(width.value, height.value) * 0.13;
  const base = Math.min(116, Math.max(72, Math.min(viewportLimit, 76 * session.settings.targetScale)));
  return base * (0.88 + index / Math.max(1, fishCount() - 1) * 0.2);
}

function createFish(index: number): AquariumFish {
  const size = fishSize(index);
  const start = safePoint(size);
  return {
    id: `aquarium-fish-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
    x: start.x,
    y: start.y,
    size,
    hue: fishHues[index % fishHues.length],
    accentHue: index % 2 === 0 ? 14 : 194,
    age: randomRange(0, Math.PI * 2),
    angle: randomRange(-0.4, 0.4),
    speed: randomRange(34, 52) * session.settings.motionSpeed,
    dwellProgress: 0,
    fedAge: 0,
    foodCooldown: randomRange(0.2, 0.8),
    wander: safePoint(size)
  };
}

function initAquarium() {
  fishes.splice(0);
  food.splice(0);
  bubbles.splice(0);
  ambientBubbleTimer = 0;
  for (let index = 0; index < fishCount(); index += 1) fishes.push(createFish(index));
}

function ensureFish() {
  while (fishes.length < fishCount()) fishes.push(createFish(fishes.length));
  while (fishes.length > fishCount()) fishes.pop();
  fishes.forEach((fish, index) => {
    fish.size = fishSize(index);
  });
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

function targetPayload(fish: AquariumFish, now: number, progress: number, reason?: "left" | "invalid-gaze") {
  return {
    targetId: fish.id,
    at: Date.now(),
    dwellMs: session.settings.dwellMs,
    elapsedMs: fish.enteredAt === undefined ? 0 : now - fish.enteredAt,
    progress,
    pointer: copyPointer(),
    reason
  };
}

function addFood(point: Point, amount = 8) {
  for (let index = 0; index < amount; index += 1) {
    food.push({
      x: point.x + randomRange(-24, 24),
      y: point.y + randomRange(-18, 12),
      age: 0,
      life: randomRange(3.2, 4.8),
      radius: randomRange(2.4, 5.2),
      drift: randomRange(-1.2, 1.2)
    });
  }
  if (food.length > 56) food.splice(0, food.length - 56);
}

function addBubble(point?: Point) {
  bubbles.push({
    x: point?.x ?? randomRange(36, Math.max(37, width.value - 36)),
    y: point?.y ?? height.value + randomRange(8, 56),
    age: 0,
    life: randomRange(5.2, 7.8),
    radius: randomRange(4, 12),
    speed: randomRange(18, 34)
  });
  if (bubbles.length > 46) bubbles.shift();
}

function closestGazeFish() {
  if (!pointer.value.valid || session.step >= session.maxSteps) return undefined;

  let closest: AquariumFish | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const fish of fishes) {
    if (fish.fedAge > 0) continue;
    const hitRadius = fish.size * 1.22;
    const nextDistance = distance(fish, pointer.value);
    if (nextDistance <= hitRadius && nextDistance < closestDistance) {
      closest = fish;
      closestDistance = nextDistance;
    }
  }
  return closest;
}

function cancelFish(fish: AquariumFish, now: number, reason: "left" | "invalid-gaze") {
  recordEvent("target-cancel", targetPayload(fish, now, fish.dwellProgress, reason));
  fish.enteredAt = undefined;
  fish.dwellProgress = 0;
}

function feedFish(fish: AquariumFish, now: number) {
  recordEvent("target-click", targetPayload(fish, now, 1));
  addFood(fish, 10);
  for (let index = 0; index < 4; index += 1) addBubble({ x: fish.x + randomRange(-28, 28), y: fish.y + randomRange(-22, 18) });
  fish.fedAge = 2.1;
  fish.enteredAt = undefined;
  fish.dwellProgress = 1;
  fish.foodCooldown = 0.8;
  fish.wander = safePoint(fish.size);
  recordSuccess({ targetId: fish.id, hue: fish.hue });
}

function updateFishGaze(fish: AquariumFish, delta: number, now: number, gazeFish?: AquariumFish) {
  fish.foodCooldown = Math.max(0, fish.foodCooldown - delta);

  if (fish.fedAge > 0 || session.status !== "running") return;
  if (gazeFish !== fish) {
    if (fish.enteredAt !== undefined) cancelFish(fish, now, pointer.value.valid ? "left" : "invalid-gaze");
    return;
  }

  if (fish.enteredAt === undefined) {
    fish.enteredAt = now;
    recordEvent("target-enter", targetPayload(fish, now, 0));
  }

  fish.dwellProgress = Math.min(1, (now - fish.enteredAt) / session.settings.dwellMs);
  if (fish.foodCooldown <= 0) {
    addFood({ x: fish.x, y: fish.y - fish.size * 0.28 }, 2);
    fish.foodCooldown = Math.max(0.32, 0.86 - fish.dwellProgress * 0.38);
  }
  if (fish.dwellProgress >= 1) feedFish(fish, now);
}

function updateFishMovement(fish: AquariumFish, delta: number) {
  fish.age += delta;
  if (fish.fedAge > 0) fish.fedAge = Math.max(0, fish.fedAge - delta);

  const hasGaze = pointer.value.valid && session.status === "running" && session.step < session.maxSteps;
  const target = hasGaze ? pointer.value : fish.wander;
  if (!hasGaze && distance(fish, fish.wander) < fish.size * 0.72) fish.wander = safePoint(fish.size);

  const dx = target.x - fish.x;
  const dy = target.y - fish.y;
  const angle = Math.atan2(dy, dx);
  const approach = Math.min(distance(fish, target), fish.speed * (hasGaze ? 0.42 : 0.24) * delta);
  const sway = Math.sin(fish.age * 1.7) * fish.size * 0.018 * delta;
  fish.x += Math.cos(angle) * approach - Math.sin(angle) * sway;
  fish.y += Math.sin(angle) * approach + Math.cos(angle) * sway;
  fish.angle += (angle - fish.angle) * Math.min(1, delta * 1.65);

  const margin = fish.size * 0.7;
  fish.x = Math.min(width.value - margin, Math.max(margin, fish.x));
  fish.y = Math.min(height.value - margin * 0.62, Math.max(waterTop() + margin * 0.35, fish.y));
}

function updateFood(delta: number) {
  for (let index = food.length - 1; index >= 0; index -= 1) {
    const crumb = food[index];
    crumb.age += delta;
    crumb.y += delta * 7;
    crumb.x += Math.sin(crumb.age * 1.45 + crumb.drift) * delta * 7;
    if (crumb.age >= crumb.life) food.splice(index, 1);
  }
}

function updateBubbles(delta: number) {
  ambientBubbleTimer += delta;
  if (ambientBubbleTimer >= 1.35) {
    addBubble();
    ambientBubbleTimer = 0;
  }

  for (let index = bubbles.length - 1; index >= 0; index -= 1) {
    const bubble = bubbles[index];
    bubble.age += delta;
    bubble.y -= bubble.speed * delta;
    bubble.x += Math.sin(bubble.age * 1.4) * delta * 8;
    if (bubble.age >= bubble.life || bubble.y < waterTop() - 24) bubbles.splice(index, 1);
  }
}

function updateAquarium(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status !== "running") return;

  ensureFish();
  const gazeFish = closestGazeFish();
  for (const fish of fishes) {
    updateFishMovement(fish, delta);
    updateFishGaze(fish, delta, now, gazeFish);
  }
  updateFood(delta);
  updateBubbles(delta);
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const top = waterTop();
  const room = ctx.createLinearGradient(0, 0, 0, top);
  room.addColorStop(0, "#e9f7f1");
  room.addColorStop(1, "#cfeae6");
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, width.value, top);

  const water = ctx.createLinearGradient(0, top, 0, height.value);
  water.addColorStop(0, "#a9e4dc");
  water.addColorStop(0.48, "#5fb8c4");
  water.addColorStop(1, "#246d86");
  ctx.fillStyle = water;
  ctx.fillRect(0, top, width.value, height.value - top);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#efffff";
  ctx.lineWidth = 2;
  for (let row = 0; row < 8; row += 1) {
    const y = top + height.value * (0.05 + row * 0.095);
    const phase = now * 0.00016 + row * 0.7;
    ctx.beginPath();
    for (let x = -40; x <= width.value + 40; x += 48) {
      const waveY = y + Math.sin(x * 0.012 + phase) * 6;
      if (x === -40) ctx.moveTo(x, waveY);
      else ctx.quadraticCurveTo(x - 24, y + Math.cos(x * 0.01 + phase) * 4, x, waveY);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#2d735c";
  for (let index = 0; index < 9; index += 1) {
    const baseX = (index * 131 + 38) % Math.max(width.value, 1);
    const baseY = height.value - 8;
    const stalkHeight = 70 + (index % 4) * 24;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY - stalkHeight * 0.46, 9 + index % 3 * 4, stalkHeight, Math.sin(index) * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFood(ctx: CanvasRenderingContext2D, crumb: FoodCrumb) {
  const progress = Math.min(1, crumb.age / crumb.life);
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.72;
  ctx.fillStyle = "#f1d48f";
  ctx.beginPath();
  ctx.arc(crumb.x, crumb.y, crumb.radius * (1 - progress * 0.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, bubble: AirBubble) {
  const progress = Math.min(1, bubble.age / bubble.life);
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.48;
  ctx.strokeStyle = "#d9fff8";
  ctx.lineWidth = Math.max(1.2, bubble.radius * 0.18);
  ctx.beginPath();
  ctx.arc(bubble.x, bubble.y, bubble.radius * (1 + progress * 0.32), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFish(ctx: CanvasRenderingContext2D, fish: AquariumFish) {
  const focus = fish.dwellProgress;
  const fed = fish.fedAge > 0 ? fish.fedAge / 2.1 : 0;
  const pulse = Math.sin(fish.age * 2.4) * 0.035;
  const length = fish.size * (1.2 + pulse);
  const body = fish.size * (0.42 + focus * 0.035);

  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.rotate(fish.angle);

  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#11495d";
  ctx.beginPath();
  ctx.ellipse(0, body * 0.34, length * 0.58, body * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = `hsla(${fish.accentHue}, 82%, 64%, 0.76)`;
  ctx.beginPath();
  ctx.moveTo(-length * 0.5, 0);
  ctx.quadraticCurveTo(-length * 0.76, -body * 0.62, -length * 0.9, -body * 0.22);
  ctx.quadraticCurveTo(-length * 0.72, 0, -length * 0.9, body * 0.22);
  ctx.quadraticCurveTo(-length * 0.76, body * 0.62, -length * 0.5, 0);
  ctx.fill();

  const fill = ctx.createRadialGradient(-length * 0.16, -body * 0.3, body * 0.14, 0, 0, length * 0.56);
  fill.addColorStop(0, "#fff7df");
  fill.addColorStop(0.56, `hsl(${fish.hue}, 82%, ${64 + focus * 8 + fed * 5}%)`);
  fill.addColorStop(1, `hsl(${fish.hue - 10}, 68%, ${45 + fed * 8}%)`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0, length * 0.54, body, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsla(${fish.accentHue}, 88%, 58%, 0.58)`;
  ctx.beginPath();
  ctx.ellipse(-length * 0.08, -body * 0.24, length * 0.15, body * 0.36, -0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(length * 0.16, body * 0.18, length * 0.12, body * 0.28, 0.28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#153b49";
  ctx.beginPath();
  ctx.arc(length * 0.38, -body * 0.22, Math.max(2.6, body * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${fish.hue + 22}, 92%, 88%, ${0.24 + focus * 0.4 + fed * 0.24})`;
  ctx.lineWidth = Math.max(2, fish.size * 0.026);
  ctx.beginPath();
  ctx.ellipse(0, 0, length * (0.61 + focus * 0.08), body * (1.15 + focus * 0.1), 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const bubble of bubbles) drawBubble(ctx, bubble);
  for (const crumb of food) drawFood(ctx, crumb);
  for (const fish of fishes) drawFish(ctx, fish);
}

function restart() {
  startSession();
  initAquarium();
}

onMounted(() => {
  initAquarium();
});

useGameLoop({ context, update: updateAquarium, draw });
</script>

<template>
  <div class="aquarium-shell">
    <canvas ref="canvasRef" class="aquarium-canvas" />

    <GameHud
      title="Аквариум"
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
      title="Аквариум"
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
.aquarium-shell {
  background: #5fb8c4;
  block-size: 100vh;
  inline-size: 100vw;
  overflow: hidden;
  position: relative;
}

.aquarium-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
