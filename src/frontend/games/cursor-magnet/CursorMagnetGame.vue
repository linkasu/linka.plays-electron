<script setup lang="ts">
import { computed, onMounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useGazePointer } from "../../composables/useGazePointer";
import { useCanvasStage, useGameLoop } from "../../core/canvas";
import { resolveMenuRoute } from "../../core/menuMode";
import { createMagneticLabState, currentLevel, cycleSelectedStrength, magneticLevels, nextLevel, resetLevel, selectMagnet, selectedMagnet, setSelectedPole, startSimulation, stepSimulation, type MagneticLabState, type MagnetConfig, type MagneticPole, type Point } from "./model";

type StageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const router = useRouter();
const { pointer } = useGazePointer();
const { canvasRef, context, width, height } = useCanvasStage();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordHint, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("cursor-magnet", {
  maxSteps: magneticLevels.length,
  overrides: { preset: "standard", dwellMs: 850, targetScale: 1.35, motionSpeed: 1, distractors: "low", hints: "medium" },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const taskAssetIds = magneticLevels.map((taskLevel) => `cursor-magnet.task.${taskLevel.id}`);
const promptAudio = useGamePromptAudio({ gameId: "cursor-magnet", soundEnabled, warmAssetIds: ["cursor-magnet.intro", ...taskAssetIds] });

const labState = ref<MagneticLabState>(createMagneticLabState());
const helperText = ref("Выбери заряд, настрой знак и силу, затем нажми Пуск.");
const lastHintAt = ref(0);
const canvasFontUnit = String.fromCharCode(112, 120);
const resultVisible = computed(() => session.status === "finished");
const level = computed(() => currentLevel(labState.value));
const taskText = computed(() => `Задача: ${level.value.brief}`);
const activeMagnet = computed(() => selectedMagnet(labState.value));
const levelText = computed(() => `${labState.value.levelIndex + 1}/${magneticLevels.length}`);
const canEdit = computed(() => labState.value.mode !== "running");
const canGoNext = computed(() => labState.value.mode === "success" && labState.value.levelIndex < magneticLevels.length - 1);
const modeLabel = computed(() => {
  if (labState.value.mode === "running") return "Симуляция";
  if (labState.value.mode === "success") return "Схема сработала";
  if (labState.value.mode === "failed") return failureText(labState.value.failureReason);
  return "Сборка схемы";
});

function stageRect(): StageRect {
  const compact = width.value < 860 || height.value < 650;
  return {
    x: width.value * (compact ? 0.045 : 0.055),
    y: height.value * (compact ? 0.17 : 0.18),
    width: width.value * (compact ? 0.52 : 0.58),
    height: height.value * (compact ? 0.74 : 0.72)
  };
}

function toStage(point: Point) {
  const rect = stageRect();
  return {
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height
  };
}

function stageLength(value: number) {
  const rect = stageRect();
  return value * Math.min(rect.width, rect.height);
}

function selectMagnetById(magnetId: string) {
  labState.value = selectMagnet(labState.value, magnetId);
  helperText.value = "Станция выбрана. Настрой знак заряда и силу перед запуском.";
  recordHint({ kind: "magnet-select", magnetId, levelId: level.value.id });
}

function setPole(pole: MagneticPole) {
  const magnet = activeMagnet.value;
  labState.value = setSelectedPole(labState.value, pole);
  helperText.value = pole === "negative" ? "Отрицательный заряд притягивает положительную капсулу." : "Положительный заряд отталкивает положительную капсулу.";
  recordHint({ kind: "magnet-pole", magnetId: magnet?.id, pole, levelId: level.value.id });
}

function cycleStrength() {
  const magnet = activeMagnet.value;
  labState.value = cycleSelectedStrength(labState.value);
  helperText.value = `Сила станции ${selectedMagnet(labState.value)?.label}: ${strengthText(selectedMagnet(labState.value)?.strength ?? 0)}.`;
  recordHint({ kind: "magnet-strength", magnetId: magnet?.id, strength: selectedMagnet(labState.value)?.strength, levelId: level.value.id });
}

function runSimulation() {
  labState.value = startSimulation(labState.value);
  helperText.value = "Симуляция запущена. Наблюдай, как поля ведут капсулу.";
  recordHint({ kind: "simulation-start", levelId: level.value.id, magnets: labState.value.magnets });
}

function resetCurrentLevel() {
  promptAudio.cancelPending();
  labState.value = resetLevel(labState.value);
  helperText.value = "Уровень сброшен. Проверь знаки и силу, затем нажми Пуск.";
  recordHint({ kind: "level-reset", levelId: level.value.id });
  playCurrentTask(120);
}

function openNextLevel() {
  if (!canGoNext.value) return;
  promptAudio.cancelPending();
  labState.value = nextLevel(labState.value);
  helperText.value = "Новая задача озвучена. Сначала изучи стены и расположение магнитов.";
  playCurrentTask(180);
}

function restart() {
  promptAudio.cancelPending();
  startSession();
  labState.value = createMagneticLabState();
  helperText.value = "Выбери заряд, настрой знак и силу, затем нажми Пуск.";
  playIntroAndTask(180);
}

function currentTaskAssetId() {
  return `cursor-magnet.task.${level.value.id}`;
}

function playCurrentTask(delayMs = 0) {
  promptAudio.play(currentTaskAssetId(), delayMs);
}

function playIntroAndTask(delayMs = 0) {
  promptAudio.playSequence(["cursor-magnet.intro", currentTaskAssetId()], delayMs, 220);
}

function onCanvasClick(event: MouseEvent) {
  if (!canEdit.value) return;
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  const magnet = nearestMagnet(point);
  if (magnet) selectMagnetById(magnet.id);
}

function nearestMagnet(point: Point) {
  return labState.value.magnets.find((magnet) => {
    const stagePoint = toStage(magnet);
    return Math.hypot(stagePoint.x - point.x, stagePoint.y - point.y) <= stageLength(0.065);
  });
}

function update(delta: number, now: number) {
  if (session.status !== "running") return;

  if (!pointer.value.valid && now - lastHintAt.value > 5000) {
    lastHintAt.value = now;
    recordHint({ kind: "mouse-fallback", levelId: level.value.id });
  }

  if (labState.value.mode !== "running") return;
  const result = stepSimulation(labState.value, delta);
  labState.value = result.state;
  if (result.event === "success") completeLevel();
  if (result.event === "failed") failLevel();
}

function completeLevel() {
  helperText.value = labState.value.levelIndex === magneticLevels.length - 1
    ? "Финальная схема сработала. Магнитная лаборатория пройдена."
    : "Схема сработала. Можно перейти к следующему контуру.";
  recordSuccess({ levelId: level.value.id, elapsedSeconds: Math.round(labState.value.elapsedSeconds * 10) / 10, magnets: labState.value.magnets });
  if (labState.value.levelIndex === magneticLevels.length - 1) finishSession("game-complete");
}

function failLevel() {
  helperText.value = `${failureText(labState.value.failureReason)} Перестрой знаки зарядов или силу и запусти снова.`;
  recordMistake({ levelId: level.value.id, reason: labState.value.failureReason, magnets: labState.value.magnets });
}

function failureText(reason: MagneticLabState["failureReason"]) {
  if (reason === "wall") return "Капсула ударилась в перегородку.";
  if (reason === "bounds") return "Капсулу выбросило за защитный контур.";
  if (reason === "stalled") return "Поле слишком слабое: капсула застряла.";
  return "Контур требует настройки.";
}

function strengthText(strength: MagnetConfig["strength"]) {
  if (strength === 0) return "выкл";
  if (strength === 1) return "мягкая";
  return "сильная";
}

function chargeSymbol(pole: MagneticPole) {
  return pole === "positive" ? "+" : "−";
}

function canvasFont(weight: number, size: number) {
  return `${weight} ${size}${canvasFontUnit} Roboto, sans-serif`;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, width.value, height.value);
  gradient.addColorStop(0, "#0a1022");
  gradient.addColorStop(0.48, "#111d33");
  gradient.addColorStop(1, "#18233d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width.value, height.value);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#8fd8ff";
  ctx.lineWidth = 1;
  const grid = Math.max(28, Math.min(width.value, height.value) * 0.055);
  for (let x = 0; x <= width.value; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height.value);
    ctx.stroke();
  }
  for (let y = 0; y <= height.value; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width.value, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabFrame(ctx: CanvasRenderingContext2D) {
  const rect = stageRect();
  ctx.save();
  ctx.fillStyle = "rgb(5 12 27 / 72%)";
  ctx.strokeStyle = "#63d9ff";
  ctx.lineWidth = Math.max(2, Math.min(rect.width, rect.height) * 0.006);
  ctx.shadowColor = "rgb(89 210 255 / 44%)";
  ctx.shadowBlur = Math.min(rect.width, rect.height) * 0.035;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, Math.min(rect.width, rect.height) * 0.035);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  const rect = stageRect();
  ctx.save();
  for (const wall of level.value.walls) {
    const x = rect.x + wall.x * rect.width;
    const y = rect.y + wall.y * rect.height;
    const wallWidth = wall.width * rect.width;
    const wallHeight = wall.height * rect.height;
    const fill = ctx.createLinearGradient(x, y, x + wallWidth, y + wallHeight);
    fill.addColorStop(0, "#2b385f");
    fill.addColorStop(1, "#60739e");
    ctx.fillStyle = fill;
    ctx.strokeStyle = "rgb(190 221 255 / 76%)";
    ctx.lineWidth = Math.max(2, Math.min(wallWidth, wallHeight) * 0.08);
    ctx.beginPath();
    ctx.roundRect(x, y, wallWidth, wallHeight, Math.min(wallWidth, wallHeight) * 0.22);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFieldLines(ctx: CanvasRenderingContext2D, now: number) {
  ctx.save();
  const time = session.settings.reduceMotion ? 0 : now * 0.001;
  for (const magnet of labState.value.magnets) {
    if (magnet.strength === 0) continue;
    const center = toStage(magnet);
    const color = magnet.pole === "positive" ? "255 73 92" : "73 152 255";
    ctx.strokeStyle = `rgb(${color} / ${magnet.id === labState.value.selectedMagnetId ? 42 : 25}%)`;
    ctx.lineWidth = magnet.id === labState.value.selectedMagnetId ? 3 : 2;
    for (let ring = 1; ring <= magnet.strength + 2; ring += 1) {
      const radius = stageLength(0.055 + ring * 0.055 + Math.sin(time + ring) * 0.004);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGoal(ctx: CanvasRenderingContext2D, now: number) {
  const goal = toStage(level.value.goal);
  const radius = stageLength(level.value.goal.radius);
  const pulse = session.settings.reduceMotion ? 0 : Math.sin(now * 0.004) * 0.08;
  ctx.save();
  const glow = ctx.createRadialGradient(goal.x, goal.y, radius * 0.25, goal.x, goal.y, radius * 2.4);
  glow.addColorStop(0, "rgb(128 255 209 / 58%)");
  glow.addColorStop(0.55, "rgb(57 206 255 / 22%)");
  glow.addColorStop(1, "rgb(57 206 255 / 0%)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, radius * (2.1 + pulse), 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7fffd4";
  ctx.lineWidth = Math.max(4, radius * 0.14);
  ctx.beginPath();
  ctx.arc(goal.x, goal.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#d8fff6";
  ctx.font = canvasFont(800, Math.max(14, radius * 0.42));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("R", goal.x, goal.y);
  ctx.restore();
}

function drawMagnets(ctx: CanvasRenderingContext2D) {
  for (const magnet of labState.value.magnets) drawMagnet(ctx, magnet);
}

function drawMagnet(ctx: CanvasRenderingContext2D, magnet: MagnetConfig) {
  const point = toStage(magnet);
  const radius = stageLength(0.048 + magnet.strength * 0.006);
  const selected = magnet.id === labState.value.selectedMagnetId;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.shadowColor = magnet.pole === "positive" ? "rgb(255 60 90 / 70%)" : "rgb(70 150 255 / 70%)";
  ctx.shadowBlur = selected ? radius * 0.75 : radius * 0.35;
  ctx.fillStyle = magnet.strength === 0 ? "#3b4257" : magnet.pole === "positive" ? "#e93d58" : "#3588ff";
  ctx.strokeStyle = selected ? "#ffffff" : "rgb(255 255 255 / 52%)";
  ctx.lineWidth = selected ? Math.max(4, radius * 0.13) : Math.max(2, radius * 0.08);
  ctx.beginPath();
  ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * 0.35);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = canvasFont(900, Math.max(16, radius * 0.5));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(chargeSymbol(magnet.pole), 0, -radius * 0.16);
  ctx.font = canvasFont(800, Math.max(12, radius * 0.26));
  ctx.fillText(`${magnet.label} · ${magnet.strength}`, 0, radius * 0.46);
  ctx.restore();
}

function drawCapsule(ctx: CanvasRenderingContext2D) {
  const point = toStage(labState.value.capsule);
  const radius = stageLength(0.035);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.shadowColor = "rgb(255 244 164 / 70%)";
  ctx.shadowBlur = radius * 0.75;
  const body = ctx.createLinearGradient(-radius, -radius, radius, radius);
  body.addColorStop(0, "#fff8ba");
  body.addColorStop(0.55, "#f2b84a");
  body.addColorStop(1, "#c06b20");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(3, radius * 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.22, radius * 0.82, Math.atan2(labState.value.capsule.vy, labState.value.capsule.vx), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#281600";
  ctx.font = canvasFont(900, Math.max(13, radius * 0.45));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+", 0, 0);
  ctx.restore();
}

function drawPointer(ctx: CanvasRenderingContext2D) {
  if (!pointer.value.valid) return;
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.strokeStyle = pointer.value.source === "mouse" ? "#ffffff" : "#7fffd4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pointer.value.x, pointer.value.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D) {
  const rect = stageRect();
  ctx.save();
  ctx.fillStyle = "rgb(232 246 255 / 92%)";
  ctx.font = canvasFont(800, Math.max(15, height.value * 0.024));
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`Контур ${levelText.value}: ${level.value.title}`, rect.x, rect.y - Math.max(26, height.value * 0.045));
  ctx.font = canvasFont(600, Math.max(12, height.value * 0.018));
  ctx.fillStyle = "rgb(188 211 230 / 90%)";
  ctx.fillText(modeLabel.value, rect.x, rect.y + rect.height + Math.max(10, height.value * 0.015));
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, _delta: number, now: number) {
  drawBackground(ctx);
  drawLabFrame(ctx);
  drawFieldLines(ctx, now);
  drawWalls(ctx);
  drawGoal(ctx, now);
  drawMagnets(ctx);
  drawCapsule(ctx);
  drawLabels(ctx);
  drawPointer(ctx);
}

onMounted(() => {
  helperText.value = "Выбери заряд, настрой знак и силу, затем нажми Пуск.";
  promptAudio.warm();
  playIntroAndTask(420);
});

useGameLoop({ context, update, draw });
</script>

<template>
  <div class="magnetic-lab-shell">
    <canvas ref="canvasRef" class="magnetic-lab-canvas" aria-label="Игра Магнитная лаборатория" @click="onCanvasClick" />

    <GameHud title="Магнитная лаборатория" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :paused="session.status === 'paused'" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />

    <aside class="magnetic-lab-panel" aria-label="Панель магнитной лаборатории">
      <v-card class="magnetic-card pa-3 pa-sm-4" rounded="xl" elevation="12">
        <div class="text-overline text-cyan-lighten-2">логика зарядов</div>
        <h1 class="text-h5 text-sm-h4 font-weight-black mb-1">Магнитная лаборатория</h1>
        <p class="task-text text-body-2 text-sm-body-1 mb-2">{{ taskText }}</p>
        <p class="hint-text text-caption text-sm-body-2 mb-3">{{ helperText }}</p>

        <div class="magnet-list mb-3">
          <GameDwellButton v-for="magnet in labState.magnets" :key="magnet.id" :target-id="`cursor-magnet:select:${magnet.id}`" :disabled="!canEdit" :dwell-ms="session.settings.dwellMs" min-height="clamp(3.7rem, 10dvh, 5.5rem)" color="indigo-darken-4" @select="selectMagnetById(magnet.id)">
            <div :class="['magnet-choice', { 'magnet-choice--selected': magnet.id === labState.selectedMagnetId }]">
              <strong>{{ magnet.label }}</strong>
              <span :class="magnet.pole === 'positive' ? 'charge-positive' : 'charge-negative'">{{ chargeSymbol(magnet.pole) }}</span>
              <small>{{ strengthText(magnet.strength) }}</small>
            </div>
          </GameDwellButton>
        </div>

        <div class="control-grid mb-3">
          <GameDwellButton target-id="cursor-magnet:positive" :disabled="!canEdit" :dwell-ms="session.settings.dwellMs" min-height="clamp(4rem, 10dvh, 5.6rem)" color="red-darken-3" @select="setPole('positive')">
            <div class="control-button"><strong>+</strong><span>положительный</span></div>
          </GameDwellButton>
          <GameDwellButton target-id="cursor-magnet:negative" :disabled="!canEdit" :dwell-ms="session.settings.dwellMs" min-height="clamp(4rem, 10dvh, 5.6rem)" color="blue-darken-3" @select="setPole('negative')">
            <div class="control-button"><strong>−</strong><span>отрицательный</span></div>
          </GameDwellButton>
          <GameDwellButton target-id="cursor-magnet:strength" :disabled="!canEdit" :dwell-ms="session.settings.dwellMs" min-height="clamp(4rem, 10dvh, 5.6rem)" color="deep-purple-darken-3" @select="cycleStrength">
            <div class="control-button"><v-icon icon="mdi-sine-wave" /><span>сила: {{ strengthText(activeMagnet?.strength ?? 0) }}</span></div>
          </GameDwellButton>
          <GameDwellButton target-id="cursor-magnet:run" :disabled="labState.mode === 'running'" :dwell-ms="session.settings.dwellMs" min-height="clamp(4rem, 10dvh, 5.6rem)" color="green-darken-3" @select="runSimulation">
            <div class="control-button"><v-icon icon="mdi-play" /><span>пуск</span></div>
          </GameDwellButton>
        </div>

        <div class="action-row">
          <GameDwellButton target-id="cursor-magnet:reset" :dwell-ms="session.settings.dwellMs" min-height="clamp(3.5rem, 8dvh, 4.8rem)" color="blue-grey-darken-4" @select="resetCurrentLevel">
            <div class="small-action"><v-icon icon="mdi-restore" />Сброс</div>
          </GameDwellButton>
          <GameDwellButton v-if="canGoNext" target-id="cursor-magnet:next" :dwell-ms="session.settings.dwellMs" min-height="clamp(3.5rem, 8dvh, 4.8rem)" color="cyan-darken-4" @select="openNextLevel">
            <div class="small-action"><v-icon icon="mdi-arrow-right-bold" />Дальше</div>
          </GameDwellButton>
        </div>
      </v-card>
    </aside>

    <GameResultDialog :model-value="resultVisible" title="Магнитная лаборатория" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
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

.magnetic-lab-panel {
  inline-size: min(34rem, 37dvw);
  inset-block-start: clamp(4.7rem, 10dvh, 6rem);
  inset-inline-end: clamp(0.8rem, 2vw, 2rem);
  pointer-events: auto;
  position: absolute;
  z-index: 2;
}

.magnetic-card {
  background: linear-gradient(180deg, rgb(13 25 45 / 94%), rgb(7 14 28 / 94%));
  border: 0.12rem solid rgb(126 232 255 / 28%);
  color: #eef8ff;
}

.magnetic-card p {
  color: #c9d8e8;
  font-weight: 650;
}

.magnet-list,
.control-grid,
.action-row {
  display: grid;
  gap: clamp(0.45rem, 1dvh, 0.75rem);
}

.magnet-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.control-grid,
.action-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.action-row {
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
}

.magnet-choice,
.control-button,
.small-action {
  align-items: center;
  color: #ffffff;
  display: flex;
  flex-direction: column;
  font-weight: 900;
  gap: 0.25rem;
  justify-content: center;
}

.magnet-choice strong,
.control-button strong {
  font-size: clamp(1.25rem, 3dvh, 2rem);
  line-height: 1;
}

.magnet-choice small,
.control-button span,
.small-action {
  font-size: clamp(0.78rem, 1.8dvh, 1rem);
  line-height: 1.1;
  text-align: center;
}

.magnet-choice--selected {
  text-shadow: 0 0 1rem rgb(126 232 255 / 80%);
}

.charge-positive {
  color: #ff8fa0;
}

.charge-negative {
  color: #8ec4ff;
}

.magnetic-lab-panel :deep(.dwell-button) {
  border: 0.1rem solid rgb(255 255 255 / 18%);
}

.magnetic-lab-panel :deep(.dwell-button--active) {
  box-shadow: 0 0 1.4rem rgb(126 232 255 / 44%);
}

@media (max-width: 53.75rem), (max-height: 40.625rem) {
  .magnetic-lab-panel {
    inline-size: min(23rem, 40dvw);
    inset-block-start: 4.6rem;
  }

  .magnetic-card h1,
  .magnetic-card .text-overline {
    display: none;
  }

  .magnetic-card {
    padding: 0.75rem !important;
  }

  .magnetic-card p {
    font-size: 0.82rem;
    margin-block-end: 0.55rem !important;
  }

  .magnetic-card .hint-text {
    display: none;
  }

  .magnetic-lab-panel :deep(.dwell-button) {
    padding: 0.65rem !important;
  }

  .magnet-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
