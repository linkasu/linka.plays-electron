<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGazePointer } from "../../composables/useGazePointer";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { carSize, createHighwayState, highwayRoad, highwaySegments, laneCenter, laneCount, laneDashPattern, syncHighwayGeometry, updateHighway, type HighwayObstacle, type HighwayState, type Point, type ViewportSize } from "./model";

type RoadSideItem = Point & {
  size: number;
  phase: number;
  kind: "tree" | "sign";
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("smooth-car", {
  maxSteps: highwaySegments.length,
  overrides: { preset: "standard", dwellMs: 600, targetScale: 1.25, motionSpeed: 0.9, distractors: "low", hints: "medium" },
  finishOnMistakes: false
});

const viewport = computed<ViewportSize>(() => ({ width: Math.max(1, width.value), height: Math.max(1, height.value) }));
const highwayState = ref<HighwayState>(createHighwayState({ width: window.innerWidth, height: window.innerHeight }));
const roadsideItems = reactive<RoadSideItem[]>([]);
const resultVisible = computed(() => session.status === "finished");
const currentSegment = computed(() => highwaySegments[highwayState.value.segmentIndex]);
const canvasFontUnit = String.fromCharCode(112, 120);
const guidanceText = computed(() => {
  if (session.status === "paused") return "Пауза. Машина держит полосу.";
  if (!pointer.value.valid) return "Можно вести машину взглядом или мышью: смотри на нужную полосу.";
  if (highwayState.value.hull <= 1) return "Осторожно: машина повреждена. Выбирай свободную полосу заранее.";
  return "Выбери полосу, собери жёлтый знак и объезжай встречные машины.";
});

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function resetRoadside() {
  roadsideItems.splice(0);
  const count = width.value < 760 ? 8 : 14;
  for (let index = 0; index < count; index += 1) roadsideItems.push(createRoadsideItem(index));
}

function createRoadsideItem(index: number): RoadSideItem {
  const road = highwayRoad(viewport.value);
  const leftSide = index % 2 === 0;
  return {
    x: leftSide ? randomRange(12, Math.max(20, road.left - 28)) : randomRange(Math.min(width.value - 20, road.right + 28), width.value - 12),
    y: randomRange(0, height.value),
    size: randomRange(16, 34),
    phase: randomRange(0, Math.PI * 2),
    kind: index % 5 === 0 ? "sign" : "tree"
  };
}

function resetScene() {
  highwayState.value = createHighwayState(viewport.value);
  resetRoadside();
}

function updateRoadside(delta: number) {
  const speed = carSize(viewport.value) * 2.1 * session.settings.motionSpeed;
  for (let index = 0; index < roadsideItems.length; index += 1) {
    const item = roadsideItems[index];
    item.y += speed * delta;
    item.phase += session.settings.reduceMotion ? 0 : delta * 1.2;
    if (item.y > height.value + item.size * 2) {
      const next = createRoadsideItem(index);
      item.x = next.x;
      item.y = -item.size * 2;
      item.size = next.size;
      item.phase = next.phase;
      item.kind = next.kind;
    }
  }
}

function update(delta: number) {
  if (session.status === "paused") return;
  highwayState.value = syncHighwayGeometry(highwayState.value, viewport.value);
  if (session.status !== "running") return;
  updateRoadside(delta);
  const result = updateHighway(highwayState.value, pointer.value.valid ? pointer.value.x : undefined, delta, viewport.value, session.settings.motionSpeed);
  highwayState.value = result.state;
  if (result.event.type === "success") {
    recordSuccess({ segmentId: highwaySegments[result.event.segmentIndex]?.id, lane: result.event.lane, goalId: result.event.goalId, hull: highwayState.value.hull });
    if (highwayState.value.mode === "finished") finishSession("game-complete");
  }
  if (result.event.type === "damage" || result.event.type === "crashed") {
    recordMistake({ segmentId: highwaySegments[result.event.segmentIndex]?.id, lane: result.event.lane, obstacleId: result.event.obstacleId, hull: highwayState.value.hull });
    if (result.event.type === "crashed") finishSession("game-lost");
  }
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height.value);
  gradient.addColorStop(0, "#b9ecff");
  gradient.addColorStop(0.48, "#e5f5d8");
  gradient.addColorStop(1, "#b8d895");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);
  for (const item of roadsideItems) drawRoadsideItem(ctx, item);
}

function drawRoadsideItem(ctx: CanvasRenderingContext2D, item: RoadSideItem) {
  ctx.save();
  ctx.translate(item.x, item.y + (session.settings.reduceMotion ? 0 : Math.sin(item.phase) * 3));
  if (item.kind === "sign") {
    ctx.fillStyle = "#f7e29a";
    ctx.strokeStyle = "rgb(82 96 74 / 46%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-item.size * 0.58, -item.size * 0.34, item.size * 1.16, item.size * 0.68, item.size * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#7f6d43";
    ctx.beginPath();
    ctx.moveTo(0, item.size * 0.34);
    ctx.lineTo(0, item.size * 1.1);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#6aa05d";
  ctx.beginPath();
  ctx.ellipse(0, 0, item.size * 0.72, item.size * 0.48, Math.sin(item.phase) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgb(57 102 48 / 65%)";
  ctx.beginPath();
  ctx.ellipse(item.size * 0.08, -item.size * 0.04, item.size * 0.42, item.size * 0.28, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRoad(ctx: CanvasRenderingContext2D) {
  const road = highwayRoad(viewport.value);
  ctx.save();
  ctx.fillStyle = "#3c4651";
  ctx.beginPath();
  ctx.roundRect(road.left, road.top, road.right - road.left, road.bottom - road.top, Math.min(34, road.laneWidth * 0.18));
  ctx.fill();

  ctx.fillStyle = "rgb(255 255 255 / 10%)";
  ctx.fillRect(road.left, road.top, road.right - road.left, road.bottom - road.top);

  ctx.strokeStyle = "#f7f0c4";
  ctx.lineWidth = Math.max(4, road.laneWidth * 0.035);
  ctx.beginPath();
  ctx.moveTo(road.left + 3, road.top);
  ctx.lineTo(road.left + 3, road.bottom);
  ctx.moveTo(road.right - 3, road.top);
  ctx.lineTo(road.right - 3, road.bottom);
  ctx.stroke();

  ctx.strokeStyle = "rgb(255 255 255 / 78%)";
  ctx.lineWidth = Math.max(3, road.laneWidth * 0.026);
  const dashPattern = laneDashPattern(viewport.value);
  ctx.setLineDash([dashPattern.dash, dashPattern.gap]);
  ctx.lineDashOffset = -(highwayState.value.roadOffset % dashPattern.cycle);
  for (let lane = 1; lane < laneCount; lane += 1) {
    const x = road.left + road.laneWidth * lane;
    ctx.beginPath();
    ctx.moveTo(x, road.top + 10);
    ctx.lineTo(x, road.bottom - 10);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGoal(ctx: CanvasRenderingContext2D) {
  const road = highwayRoad(viewport.value);
  const goal = highwayState.value.goal;
  const x = laneCenter(road, goal.lane);
  const radius = goal.radius;
  ctx.save();
  const glow = ctx.createRadialGradient(x, goal.y, radius * 0.1, x, goal.y, radius * 2.2);
  glow.addColorStop(0, "rgb(255 245 148 / 66%)");
  glow.addColorStop(0.52, "rgb(255 208 64 / 30%)");
  glow.addColorStop(1, "rgb(255 208 64 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, goal.y, radius * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd84b";
  ctx.strokeStyle = "#fff7c2";
  ctx.lineWidth = Math.max(3, radius * 0.1);
  ctx.beginPath();
  ctx.arc(x, goal.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#745710";
  ctx.font = `900 ${Math.max(16, radius * 0.72)}${canvasFontUnit} Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✓", x, goal.y + radius * 0.04);
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: HighwayObstacle) {
  const road = highwayRoad(viewport.value);
  const size = carSize(viewport.value);
  const x = laneCenter(road, obstacle.lane);
  const widthValue = obstacle.kind === "truck" ? size * 0.74 : size * 0.64;
  const heightValue = obstacle.kind === "truck" ? obstacle.length * 1.2 : obstacle.length;
  ctx.save();
  ctx.translate(x, obstacle.y);
  ctx.fillStyle = obstacle.kind === "truck" ? "#7e8b99" : "#d45a55";
  ctx.strokeStyle = "rgb(24 34 44 / 58%)";
  ctx.lineWidth = Math.max(3, size * 0.035);
  ctx.beginPath();
  ctx.roundRect(-widthValue / 2, -heightValue / 2, widthValue, heightValue, size * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgb(210 238 255 / 82%)";
  ctx.beginPath();
  ctx.roundRect(-widthValue * 0.32, -heightValue * 0.28, widthValue * 0.64, heightValue * 0.22, size * 0.04);
  ctx.fill();
  ctx.fillStyle = "rgb(255 244 180 / 86%)";
  ctx.beginPath();
  ctx.arc(-widthValue * 0.28, heightValue * 0.42, size * 0.045, 0, Math.PI * 2);
  ctx.arc(widthValue * 0.28, heightValue * 0.42, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayerCar(ctx: CanvasRenderingContext2D) {
  const state = highwayState.value;
  const size = carSize(viewport.value);
  const damage = state.car.damageFlash;
  const hullRatio = state.hull / state.maxHull;
  ctx.save();
  ctx.translate(state.car.x, state.car.y);
  const glow = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * (0.9 + damage * 0.35));
  glow.addColorStop(0, `rgb(255 236 155 / ${0.2 + damage * 0.22})`);
  glow.addColorStop(1, "rgb(255 236 155 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hullRatio <= 0.34 ? "#a85c4e" : hullRatio <= 0.67 ? "#e98f54" : "#43a5ff";
  ctx.strokeStyle = damage > 0 ? "#fff7c2" : "rgb(12 54 92 / 62%)";
  ctx.lineWidth = Math.max(3, size * 0.04 + damage * 3);
  ctx.beginPath();
  ctx.roundRect(-size * 0.36, -size * 0.5, size * 0.72, size, size * 0.12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgb(220 245 255 / 90%)";
  ctx.beginPath();
  ctx.roundRect(-size * 0.23, -size * 0.24, size * 0.46, size * 0.24, size * 0.05);
  ctx.fill();
  ctx.fillStyle = "#1e2935";
  for (const x of [-size * 0.42, size * 0.42]) {
    ctx.beginPath();
    ctx.roundRect(x - size * 0.055, -size * 0.34, size * 0.11, size * 0.28, size * 0.04);
    ctx.roundRect(x - size * 0.055, size * 0.12, size * 0.11, size * 0.28, size * 0.04);
    ctx.fill();
  }
  ctx.fillStyle = "#fff0a3";
  ctx.beginPath();
  ctx.arc(-size * 0.2, -size * 0.52, size * 0.045, 0, Math.PI * 2);
  ctx.arc(size * 0.2, -size * 0.52, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStatus(ctx: CanvasRenderingContext2D) {
  const fontSize = Math.max(15, Math.min(width.value, height.value) * 0.026);
  const x = Math.max(28, width.value * 0.04);
  const y = Math.max(70, height.value * 0.12);
  ctx.save();
  ctx.fillStyle = "rgb(20 34 48 / 72%)";
  ctx.strokeStyle = "rgb(255 255 255 / 24%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - fontSize * 0.8, y - fontSize * 1.55, fontSize * 17.5, fontSize * 3.6, fontSize * 0.65);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f6fbff";
  ctx.font = `800 ${fontSize}${canvasFontUnit} Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`Шоссе ${highwayState.value.segmentIndex + 1}/${highwaySegments.length}: ${currentSegment.value.title}`, x, y - fontSize * 0.45);
  ctx.fillStyle = highwayState.value.hull <= 1 ? "#ffd2c5" : "#dfffe8";
  ctx.fillText(`Прочность: ${highwayState.value.hull}/${highwayState.value.maxHull}`, x, y + fontSize * 0.85);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D) {
  drawBackground(ctx);
  drawRoad(ctx);
  drawGoal(ctx);
  for (const obstacle of highwayState.value.obstacles) drawObstacle(ctx, obstacle);
  drawPlayerCar(ctx);
  drawStatus(ctx);
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
  <div class="smooth-car-shell">
    <canvas ref="canvasRef" class="smooth-car-canvas" aria-label="Игра Плавная машинка: 4-полосное шоссе" />

    <v-card class="smooth-car-hint px-4 py-3" color="surface" rounded="xl" variant="flat">
      <div class="text-body-2 font-weight-medium">{{ guidanceText }}</div>
      <div class="text-caption text-medium-emphasis">Четыре полосы. Жёлтый знак собери, встречные машины объезжай.</div>
    </v-card>

    <GameHud
      title="Плавная машинка"
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
      title="Плавная машинка"
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
.smooth-car-shell {
  background: #b9ecff;
  block-size: 100dvh;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.smooth-car-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.smooth-car-hint {
  inset-block-end: max(1.125rem, env(safe-area-inset-bottom));
  inset-inline: 1.125rem;
  margin-inline: auto;
  max-inline-size: 42rem;
  opacity: 0.95;
  position: absolute;
  z-index: 3;
}

@media (max-width: 45rem), (max-height: 40rem) {
  .smooth-car-hint {
    display: none;
  }
}
</style>
