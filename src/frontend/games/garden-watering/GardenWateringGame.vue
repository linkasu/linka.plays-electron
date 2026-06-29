<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { percentToPixels } from "../../core/placement";
import { advanceFlowerGrowth } from "./model";

type Point = { x: number; y: number };
type GardenFlower = Point & {
  id: string;
  radius: number;
  hue: number;
  petals: number;
  age: number;
  growth: number;
  wateredSeconds: number;
  completed: boolean;
  bloomPulse: number;
  entered: boolean;
};
type WaterDrop = Point & {
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordEvent, recordSuccess, startSession } = useGameSessionFor("garden-watering", {
  maxSteps: 6,
  overrides: { preset: "gentle", dwellMs: 1200, sessionSeconds: 120, targetScale: 1.45, motionSpeed: 0.55, distractors: "none", hints: "high" },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const flowers = reactive<GardenFlower[]>([]);
const drops = reactive<WaterDrop[]>([]);
const wateringCan = reactive<Point>({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.48 });
const resultVisible = computed(() => session.status === "finished");

const flowerHues = [328, 286, 42, 18, 204, 252, 136, 6];
const flowerLayout = [
  { x: 30, y: 70 },
  { x: 58, y: 66 },
  { x: 76, y: 79 },
  { x: 42, y: 84 },
  { x: 20, y: 82 },
  { x: 67, y: 88 },
  { x: 84, y: 62 },
  { x: 50, y: 75 }
];
let dropTimer = 0;
let finishAfter = 0;
let finishDelayRemainingMs = 0;

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function flowerRadius() {
  const viewportLimit = Math.min(width.value, height.value) * 0.12;
  return Math.min(112, Math.max(72, Math.min(viewportLimit, 70 * session.settings.targetScale)));
}

function waterRadius(flower: GardenFlower) {
  return flower.radius * 1.55;
}

function currentFlowerHead(flower: GardenFlower) {
  const base = percentToPixels(flower);
  const easedGrowth = 1 - Math.pow(1 - flower.growth, 2.4);
  const groundY = base.y + flower.radius * 0.8;
  return {
    x: base.x,
    y: groundY - flower.radius * (0.2 + easedGrowth * 0.95)
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

function targetPayload(flower: GardenFlower, now: number, progress: number) {
  return {
    targetId: flower.id,
    at: Date.now(),
    elapsedMs: Math.round(flower.wateredSeconds * 1000),
    progress,
    pointer: copyPointer(),
    now
  };
}

function createFlowers() {
  flowers.splice(0);
  drops.splice(0);
  finishAfter = 0;
  finishDelayRemainingMs = 0;

  for (let index = 0; index < session.maxSteps; index += 1) {
    const layout = flowerLayout[index % flowerLayout.length];
    flowers.push({
      id: `garden-flower-${Date.now()}-${index}`,
      x: Math.min(90, Math.max(10, layout.x + randomRange(-2.5, 2.5))),
      y: Math.min(91, Math.max(58, layout.y + randomRange(-2, 2))),
      radius: flowerRadius() * randomRange(0.92, 1.08),
      hue: flowerHues[index % flowerHues.length],
      petals: 6 + index % 3 * 2,
      age: randomRange(0, 3),
      growth: 0,
      wateredSeconds: 0,
      completed: false,
      bloomPulse: 0,
      entered: false
    });
  }
}

function updateWateringCan(delta: number) {
  const target = pointer.value.valid ? pointer.value : { x: width.value * 0.5, y: height.value * 0.5 };
  const smoothing = pointer.value.valid ? 6.4 : 1.25;
  wateringCan.x += (target.x - wateringCan.x) * Math.min(1, delta * smoothing);
  wateringCan.y += (target.y - wateringCan.y) * Math.min(1, delta * smoothing);
}

function spawnDrop() {
  drops.push({
    x: wateringCan.x + randomRange(-8, 8),
    y: wateringCan.y + randomRange(-2, 8),
    vx: randomRange(-16, 16),
    vy: randomRange(72, 128),
    age: 0,
    life: randomRange(0.75, 1.15),
    radius: randomRange(3.2, 6.4)
  });
  if (drops.length > 90) drops.shift();
}

function updateDrops(delta: number) {
  if (pointer.value.valid && !session.settings.reduceMotion) {
    dropTimer += delta;
    const interval = 0.075 / session.settings.motionSpeed;
    while (dropTimer >= interval) {
      spawnDrop();
      dropTimer -= interval;
    }
  } else {
    dropTimer = 0;
  }

  for (let index = drops.length - 1; index >= 0; index -= 1) {
    const drop = drops[index];
    drop.age += delta;
    drop.x += drop.vx * delta;
    drop.y += drop.vy * delta;
    if (drop.age >= drop.life || drop.y > height.value + 24) drops.splice(index, 1);
  }
}

function completeFlower(flower: GardenFlower, now: number) {
  recordEvent("target-click", targetPayload(flower, now, 1));
  recordSuccess({ targetId: flower.id, wateredSeconds: Number(flower.wateredSeconds.toFixed(2)) });

  if (flowers.every((candidate) => candidate.completed) && finishAfter === 0) {
    finishAfter = now + 1800;
    finishDelayRemainingMs = 1800;
  }
}

function updateFlowers(delta: number, now: number) {
  for (const flower of flowers) {
    flower.age += delta;
    const head = currentFlowerHead(flower);
    const next = advanceFlowerGrowth(flower, {
      deltaSeconds: delta,
      distancePx: pointer.value.valid ? distance(wateringCan, head) : Number.POSITIVE_INFINITY,
      waterRadiusPx: waterRadius(flower),
      growthPerSecond: 0.23 * session.settings.motionSpeed
    });
    const wasCompleted = flower.completed;

    flower.growth = next.growth;
    flower.wateredSeconds = next.wateredSeconds;
    flower.completed = next.completed;
    flower.bloomPulse = next.bloomPulse;

    if (!flower.entered && flower.bloomPulse > 0.2) {
      flower.entered = true;
      recordEvent("target-enter", targetPayload(flower, now, flower.growth));
    }
    if (!wasCompleted && flower.completed) completeFlower(flower, now);
  }

  if (finishDelayRemainingMs > 0) {
    finishDelayRemainingMs = Math.max(0, finishDelayRemainingMs - delta * 1000);
    if (finishDelayRemainingMs === 0) finishSession("max-steps");
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, now: number) {
  const visualNow = session.settings.reduceMotion ? 0 : now;
  const sky = ctx.createLinearGradient(0, 0, 0, height.value * 0.72);
  sky.addColorStop(0, "#cdeeff");
  sky.addColorStop(0.58, "#ecf8ff");
  sky.addColorStop(1, "#fbf2dc");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.36;
  for (let index = 0; index < 4; index += 1) {
    const cloudX = (width.value * (0.18 + index * 0.22) + Math.sin(visualNow * 0.00008 + index) * 34) % (width.value + 180);
    const cloudY = height.value * (0.14 + index % 2 * 0.09);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(cloudX - 48, cloudY + 8, 58, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX, cloudY, 72, 28, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 54, cloudY + 10, 52, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const meadowTop = height.value * 0.52;
  const meadow = ctx.createLinearGradient(0, meadowTop, 0, height.value);
  meadow.addColorStop(0, "#dcedbd");
  meadow.addColorStop(0.56, "#bde18d");
  meadow.addColorStop(1, "#8dc46f");
  ctx.fillStyle = meadow;
  ctx.fillRect(0, meadowTop, width.value, height.value - meadowTop);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = "#6aa85d";
  ctx.lineWidth = 2;
  for (let index = 0; index < 42; index += 1) {
    const x = index / 41 * width.value;
    const y = meadowTop + 20 + Math.sin(index * 1.7) * 10;
    ctx.beginPath();
    ctx.moveTo(x, height.value);
    ctx.quadraticCurveTo(x + Math.sin(index) * 28, (y + height.value) / 2, x + Math.cos(index) * 8, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlower(ctx: CanvasRenderingContext2D, flower: GardenFlower) {
  const base = percentToPixels(flower);
  const head = currentFlowerHead(flower);
  const bloom = Math.max(0, (flower.growth - 0.42) / 0.58);
  const stemAlpha = 0.35 + flower.growth * 0.55;
  const pulse = flower.bloomPulse;

  ctx.save();
  ctx.fillStyle = "rgb(54 94 52 / 16%)";
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + flower.radius * 0.86, flower.radius * 0.58, flower.radius * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (!flower.completed) {
    ctx.globalAlpha = 0.12 + pulse * 0.18;
    ctx.strokeStyle = "#247e78";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.arc(head.x, head.y, waterRadius(flower) * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.globalAlpha = stemAlpha;
  ctx.strokeStyle = "#4f9658";
  ctx.lineWidth = Math.max(4, flower.radius * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(base.x, base.y + flower.radius * 0.74);
  ctx.quadraticCurveTo(base.x - flower.radius * 0.08, (base.y + head.y) / 2, head.x, head.y + flower.radius * 0.1);
  ctx.stroke();

  ctx.fillStyle = "#5fac69";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(base.x + side * flower.radius * 0.04, base.y + flower.radius * (0.42 - flower.growth * 0.24));
    ctx.scale(side, 1);
    ctx.rotate(-0.48 + (session.settings.reduceMotion ? 0 : Math.sin(flower.age * 1.2) * 0.04));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(flower.radius * 0.3, -flower.radius * 0.16, flower.radius * (0.5 + flower.growth * 0.14), 0);
    ctx.quadraticCurveTo(flower.radius * 0.3, flower.radius * 0.16, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  if (bloom <= 0) {
    ctx.fillStyle = `hsl(${flower.hue}, 72%, 72%)`;
    ctx.beginPath();
    ctx.arc(head.x, head.y, flower.radius * (0.1 + flower.growth * 0.12), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.translate(head.x, head.y);
  const petalDistance = flower.radius * (0.08 + bloom * 0.28 + pulse * 0.035);
  const petalRadius = flower.radius * (0.16 + bloom * 0.19 + pulse * 0.03);
  for (let index = 0; index < flower.petals; index += 1) {
    const angle = index / flower.petals * Math.PI * 2 + (session.settings.reduceMotion ? 0 : Math.sin(flower.age * 0.45) * 0.025);
    ctx.save();
    ctx.rotate(angle);
    const gradient = ctx.createRadialGradient(0, -petalDistance, 1, 0, -petalDistance, petalRadius * 1.45);
    gradient.addColorStop(0, `hsl(${flower.hue + 8}, 94%, 88%)`);
    gradient.addColorStop(1, `hsl(${flower.hue}, 72%, 64%)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, -petalDistance, petalRadius * 0.66, petalRadius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const core = ctx.createRadialGradient(0, 0, 1, 0, 0, flower.radius * 0.2);
  core.addColorStop(0, "#fff8b5");
  core.addColorStop(1, "#e0ad51");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, flower.radius * (0.11 + bloom * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDrop(ctx: CanvasRenderingContext2D, drop: WaterDrop) {
  const progress = drop.age / drop.life;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.58 * (1 - progress));
  ctx.fillStyle = "#6ab7d8";
  ctx.beginPath();
  ctx.ellipse(drop.x, drop.y, drop.radius * 0.72, drop.radius * 1.18, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWateringCan(ctx: CanvasRenderingContext2D) {
  const x = wateringCan.x;
  const y = wateringCan.y;
  const scale = Math.min(1, Math.max(0.72, Math.min(width.value, height.value) / 600));
  ctx.save();
  ctx.globalAlpha = pointer.value.valid ? 0.9 : 0.45;

  ctx.strokeStyle = "#4d8f9a";
  ctx.lineWidth = 13 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 70 * scale, y - 32 * scale);
  ctx.quadraticCurveTo(x - 34 * scale, y - 28 * scale, x - 4 * scale, y - 2 * scale);
  ctx.stroke();

  const body = ctx.createLinearGradient(x - 118 * scale, y - 78 * scale, x - 36 * scale, y - 4 * scale);
  body.addColorStop(0, "#b7d8d0");
  body.addColorStop(1, "#76adab");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x - 92 * scale, y - 42 * scale, 42 * scale, 31 * scale, -0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5f9b99";
  ctx.lineWidth = 8 * scale;
  ctx.beginPath();
  ctx.arc(x - 126 * scale, y - 42 * scale, 24 * scale, Math.PI * 0.62, Math.PI * 1.38);
  ctx.stroke();

  ctx.fillStyle = "#d8ece7";
  ctx.beginPath();
  ctx.ellipse(x - 92 * scale, y - 72 * scale, 24 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgb(255 255 255 / 42%)";
  ctx.beginPath();
  ctx.ellipse(x - 102 * scale, y - 52 * scale, 12 * scale, 7 * scale, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx, now);
  for (const flower of flowers) drawFlower(ctx, flower);
  for (const drop of drops) drawDrop(ctx, drop);
  drawWateringCan(ctx);
}

function update(rawDelta: number, now: number) {
  const delta = session.status === "paused" ? 0 : rawDelta;
  if (session.status === "running") {
    updateWateringCan(delta);
    updateFlowers(delta, now);
    updateDrops(delta);
  }
}

function restart() {
  startSession();
  createFlowers();
}

onMounted(() => {
  createFlowers();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="garden-watering-shell">
    <canvas ref="canvasRef" class="garden-watering-canvas" />

    <GameHud
      title="Садовая лейка"
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
      title="Садовая лейка"
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
.garden-watering-shell {
  background: #cdeeff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.garden-watering-canvas {
  display: block;
  inset: 0;
  position: absolute;
}
</style>
