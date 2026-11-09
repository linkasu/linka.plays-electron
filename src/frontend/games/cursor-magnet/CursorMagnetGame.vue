<script setup lang="ts">
import { scenePalette } from "../../core/themeSettings";
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  createMagneticLabState,
  currentLevel,
  cycleMagnet,
  magneticLevels,
  nextLevel,
  resetLevel,
  startSimulation,
  stepSimulation,
  type MagneticLabState,
  type MagnetConfig,
  type MagnetMode,
  type Point,
} from "./model";

// Testers: «убрать, играть невозможно». Reworked 2026-11-09 without changing the idea: the
// magnets on the field are the gaze targets themselves (look at one to switch it), the only
// other buttons are a big «Пуск» and «Сначала», the task is one short voiced line and the
// rules sit behind «Правила» in the top bar. After a try the ball comes back by itself.

type StageRect = { x: number; y: number; width: number; height: number };

const router = useRouter();
const { canvasRef, context, width, height } = useCanvasStage();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordMistake,
  recordSuccess,
  startSession,
} = useGameSessionFor("cursor-magnet", {
  maxSteps: magneticLevels.length,
  overrides: {
    preset: "standard",
    dwellMs: 850,
    targetScale: 1.35,
    motionSpeed: 1,
    distractors: "low",
    hints: "medium",
  },
  finishOnMistakes: false,
  finishOnTimeout: false,
});
const promptAudio = useGamePromptAudio({
  gameId: "cursor-magnet",
  soundEnabled: toRef(session.settings, "sound"),
  warmAssetIds: ["cursor-magnet.task", "cursor-magnet.success", "cursor-magnet.retry"],
});

const labState = ref<MagneticLabState>(createMagneticLabState());
const stage = ref<StageRect>({ x: 0, y: 0, width: 1, height: 1 });
const panelRef = ref<HTMLElement>();
/** True while the result of a try is being said: the ball waits, buttons rest. */
const settling = ref(false);
const resultVisible = computed(() => session.status === "finished");
const level = computed(() => currentLevel(labState.value));
const canEdit = computed(
  () => session.status === "running" && labState.value.mode !== "running" && !settling.value,
);
const magnetSide = computed(() =>
  Math.round(Math.min(stage.value.height * 0.2, stage.value.width * 0.12)),
);
let timer: ReturnType<typeof setTimeout> | undefined;

const modeView: Record<MagnetMode, { word: string; icon: string; color: string }> = {
  pull: { word: "тянет", icon: "mdi-arrow-collapse-horizontal", color: "#2f7cf6" },
  push: { word: "толкает", icon: "mdi-arrow-expand-horizontal", color: "#e5484d" },
  off: { word: "выключен", icon: "mdi-power", color: "#5c6577" },
};

function toStage(point: Point) {
  return {
    x: stage.value.x + point.x * stage.value.width,
    y: stage.value.y + point.y * stage.value.height,
  };
}

function stageLength(value: number) {
  return value * Math.min(stage.value.width, stage.value.height);
}

function magnetStyle(magnet: MagnetConfig) {
  const center = toStage(magnet);
  const side = magnetSide.value;
  return {
    "--magnet-color": modeView[magnet.mode].color,
    "blockSize": `${side}px`,
    "inlineSize": `${side}px`,
    "left": `${center.x - side / 2}px`,
    "top": `${center.y - side / 2}px`,
  };
}

const ballStyle = computed(() => {
  const center = toStage(labState.value.capsule);
  const size = Math.max(22, stageLength(0.08));
  return {
    blockSize: `${size}px`,
    inlineSize: `${size}px`,
    left: `${center.x - size / 2}px`,
    top: `${center.y - size / 2}px`,
  };
});

function updateStage() {
  // The field takes the room between the top bar and the bottom, left of the buttons.
  const hudBottom = document.querySelector(".game-hud")?.getBoundingClientRect().bottom ?? 0;
  const panelLeft = panelRef.value?.getBoundingClientRect().left ?? window.innerWidth * 0.8;
  const gap = Math.max(12, window.innerWidth * 0.015);
  const top = Math.max(hudBottom, window.innerHeight * 0.12) + gap * 0.6;
  stage.value = {
    x: gap,
    y: top,
    width: Math.max(200, panelLeft - gap * 2),
    height: Math.max(200, window.innerHeight - top - gap),
  };
}

function switchMagnet(magnetId: string) {
  if (!canEdit.value) return;
  labState.value = cycleMagnet(labState.value, magnetId);
}

function launch() {
  if (!canEdit.value) return;
  promptAudio.cancelPending();
  labState.value = startSimulation(labState.value);
}

function resetCurrentLevel() {
  if (!canEdit.value) return;
  labState.value = resetLevel(labState.value);
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

function playTask(delayMs = 0) {
  promptAudio.play("cursor-magnet.task", delayMs);
}

function restart() {
  clearTimer();
  promptAudio.cancelPending();
  settling.value = false;
  startSession();
  labState.value = createMagneticLabState();
  playTask(300);
}

function update(delta: number) {
  updateStage();
  if (session.status !== "running" || labState.value.mode !== "running") return;
  const result = stepSimulation(labState.value, delta);
  labState.value = result.state;
  if (result.event === "success") completeLevel();
  if (result.event === "failed") failLevel();
}

function completeLevel() {
  settling.value = true;
  recordSuccess({
    levelId: level.value.id,
    elapsedSeconds: Math.round(labState.value.elapsedSeconds * 10) / 10,
    magnets: labState.value.magnets.map((magnet) => magnet.mode),
  });
  promptAudio.play("cursor-magnet.success", 120);
  if (session.status !== "running") return;
  timer = setTimeout(() => {
    settling.value = false;
    labState.value = nextLevel(labState.value);
    playTask(200);
  }, 2200);
}

function failLevel() {
  settling.value = true;
  recordMistake({
    levelId: level.value.id,
    reason: labState.value.failureReason,
    magnets: labState.value.magnets.map((magnet) => magnet.mode),
  });
  promptAudio.play("cursor-magnet.retry", 120);
  // The same magnets stay; the ball comes back to its start for the next try.
  timer = setTimeout(() => {
    settling.value = false;
    labState.value = { ...resetLevel(labState.value), magnets: labState.value.magnets };
  }, 1600);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const palette = scenePalette("night").background;
  const gradient = ctx.createLinearGradient(0, 0, width.value, height.value);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.48, palette[1]);
  gradient.addColorStop(1, palette[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);
}

function drawField(ctx: CanvasRenderingContext2D) {
  const rect = stage.value;
  const corner = Math.min(rect.width, rect.height) * 0.035;
  ctx.save();
  ctx.fillStyle = "rgb(5 12 27 / 72%)";
  ctx.strokeStyle = "#63d9ff";
  ctx.lineWidth = Math.max(2, Math.min(rect.width, rect.height) * 0.006);
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, corner);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (const wall of level.value.walls) {
    const x = stage.value.x + wall.x * stage.value.width;
    const y = stage.value.y + wall.y * stage.value.height;
    const wallWidth = wall.width * stage.value.width;
    const wallHeight = wall.height * stage.value.height;
    ctx.fillStyle = "#6b7fae";
    ctx.strokeStyle = "rgb(210 228 255 / 80%)";
    ctx.lineWidth = Math.max(2, Math.min(wallWidth, wallHeight) * 0.08);
    ctx.beginPath();
    ctx.roundRect(x, y, wallWidth, wallHeight, Math.min(wallWidth, wallHeight) * 0.22);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Rings around a working magnet: they run inwards when it pulls and outwards when it pushes. */
function drawFieldRings(ctx: CanvasRenderingContext2D, now: number) {
  const time = session.settings.reduceMotion ? 0 : now * 0.0006;
  ctx.save();
  ctx.beginPath();
  ctx.rect(stage.value.x, stage.value.y, stage.value.width, stage.value.height);
  ctx.clip();
  for (const magnet of labState.value.magnets) {
    if (magnet.mode === "off") continue;
    const center = toStage(magnet);
    const base = magnetSide.value * 0.55;
    const span = stageLength(0.1 + magnet.strength * 0.06);
    const color = magnet.mode === "pull" ? "47 124 246" : "229 72 77";
    for (let ring = 0; ring < 3; ring += 1) {
      let phase = (time + ring / 3) % 1;
      if (magnet.mode === "pull") phase = 1 - phase;
      ctx.strokeStyle = `rgb(${color} / ${Math.round(55 * (1 - phase))}%)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(center.x, center.y, base + span * phase, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, now: number) {
  const center = toStage(level.value.goal);
  const radius = stageLength(level.value.goal.radius) * 1.25;
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(now * 0.004) * 0.06;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.shadowColor = "rgb(255 220 90 / 80%)";
  ctx.shadowBlur = radius * 0.8;
  ctx.fillStyle = "#ffd54a";
  ctx.strokeStyle = "#fff6c8";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const r = (point % 2 === 0 ? radius : radius * 0.45) * (1 + pulse);
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx);
  drawField(ctx);
  drawFieldRings(ctx, now);
  drawWalls(ctx);
  drawStar(ctx, now);
}

onMounted(() => {
  updateStage();
  promptAudio.warm();
  playTask(420);
});

onUnmounted(() => {
  clearTimer();
  promptAudio.cancelPending();
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="magnetic-lab-shell">
    <canvas ref="canvasRef" class="magnetic-lab-canvas" aria-label="Игра Магнитная лаборатория" />

    <GameHud
      title="Магнитная лаборатория"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :paused="session.status === 'paused'"
      :show-timer="false"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <div class="magnet-layer">
      <GameDwellButton
        v-for="magnet in labState.magnets"
        :key="`${level.id}:${magnet.id}`"
        class="magnet-target"
        :style="magnetStyle(magnet)"
        :target-id="`cursor-magnet:magnet:${magnet.id}`"
        :disabled="!canEdit"
        :dwell-ms="session.settings.dwellMs"
        :hit-padding="12"
        min-height="0"
        :color="modeView[magnet.mode].color"
        @select="switchMagnet(magnet.id)"
      >
        <div class="magnet-face">
          <v-icon :icon="modeView[magnet.mode].icon" class="magnet-icon" />
          <span class="magnet-word">{{ modeView[magnet.mode].word }}</span>
        </div>
      </GameDwellButton>
    </div>

    <div class="magnet-ball" :style="ballStyle" aria-hidden="true" />

    <aside ref="panelRef" class="magnetic-lab-panel" aria-label="Пуск">
      <p class="task-text">Настрой магниты и докати шарик до звезды.</p>
      <GameDwellButton
        class="run-button"
        target-id="cursor-magnet:run"
        :disabled="!canEdit"
        :dwell-ms="session.settings.dwellMs"
        min-height="clamp(8rem, 30dvh, 15rem)"
        color="green-darken-2"
        @select="launch"
      >
        <div class="panel-action">
          <v-icon icon="mdi-play" class="panel-icon" />
          <span>Пуск</span>
        </div>
      </GameDwellButton>
      <GameDwellButton
        target-id="cursor-magnet:reset"
        :disabled="!canEdit"
        :dwell-ms="session.settings.dwellMs"
        min-height="clamp(5rem, 16dvh, 8rem)"
        color="blue-grey-darken-3"
        @select="resetCurrentLevel"
      >
        <div class="panel-action panel-action--small">
          <v-icon icon="mdi-restore" class="panel-icon" />
          <span>Сначала</span>
        </div>
      </GameDwellButton>
    </aside>

    <GameResultDialog
      :model-value="resultVisible"
      title="Магнитная лаборатория"
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
.magnetic-lab-shell {
  block-size: 100dvh;
  color: #eef8ff;
  inline-size: 100dvw;
  overflow: hidden;
  position: relative;
}

.magnetic-lab-canvas {
  display: block;
  inset: 0;
  position: absolute;
}

.magnet-layer {
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 1;
}

.magnet-target {
  pointer-events: auto;
  position: absolute;
}

.magnet-target :deep(.dwell-button) {
  block-size: 100%;
  border: 0.2rem solid rgb(255 255 255 / 85%) !important;
  border-radius: 22% !important;
  box-shadow: 0 0 1.2rem var(--magnet-color) !important;
  padding: 0 !important;
}

/* A magnet that cannot be switched now keeps its look. */
.magnet-target :deep(.v-card--disabled > *) {
  opacity: 1;
}

.magnet-face {
  align-items: center;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  justify-content: center;
}

.magnet-icon {
  font-size: clamp(1.8rem, 5dvh, 3rem);
}

.magnet-word {
  font-size: clamp(0.85rem, 2.2dvh, 1.25rem);
  font-weight: 900;
  line-height: 1;
}

.magnet-ball {
  background: radial-gradient(circle at 35% 30%, #ffffff, #c9d3df 35%, #7b8794 75%, #4c5562);
  border-radius: 50%;
  box-shadow: 0 0.2rem 0.6rem rgb(0 0 0 / 45%);
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

.magnetic-lab-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(0.8rem, 3dvh, 1.6rem);
  inline-size: clamp(11rem, 19vw, 18rem);
  inset-block-start: clamp(8.5rem, 26dvh, 13rem);
  inset-inline-end: clamp(0.8rem, 1.5vw, 1.6rem);
  position: absolute;
  z-index: 2;
}

.task-text {
  color: #eef8ff;
  font-size: clamp(1rem, 2.6dvh, 1.5rem);
  font-weight: 800;
  line-height: 1.25;
  margin: 0;
}

.panel-action {
  align-items: center;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  font-size: clamp(1.4rem, 4dvh, 2.2rem);
  font-weight: 900;
  gap: 0.3rem;
}

.panel-action--small {
  font-size: clamp(1.1rem, 3dvh, 1.6rem);
}

.panel-icon {
  font-size: clamp(2.4rem, 7dvh, 4rem);
}

.panel-action--small .panel-icon {
  font-size: clamp(1.6rem, 4.5dvh, 2.6rem);
}
</style>
