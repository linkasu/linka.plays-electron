<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import {
  applySokobanLargeMove,
  createSokobanLargeState,
  getSokobanLargeExpectedDirection,
  isSokobanLargeComplete,
  pointsEqual,
  sokobanLargeDirectionLabels,
  type SokobanLargeDirection,
  type SokobanLargePoint
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("sokoban-large", {
  maxSteps: 12,
  dwellMs: 1200,
  sessionSeconds: 180,
  targetScale: 1.2,
  sound: false
}, { finishOnMistakes: false });

const directionControls: { direction: SokobanLargeDirection; label: string; icon: string }[] = [
  { direction: "up", label: "Вверх", icon: "mdi-arrow-up-bold" },
  { direction: "left", label: "Влево", icon: "mdi-arrow-left-bold" },
  { direction: "right", label: "Вправо", icon: "mdi-arrow-right-bold" },
  { direction: "down", label: "Вниз", icon: "mdi-arrow-down-bold" }
];

const boardState = ref(createSokobanLargeState());
const feedbackMessage = ref("Выбери ход. Если направление не подходит, ящик не двигается, а игра подсказывает мягко.");
const wrongDirection = ref<SokobanLargeDirection>();
const hintedDirection = ref<SokobanLargeDirection>();
const successDirection = ref<SokobanLargeDirection>();
const pendingChoice = ref(false);
let feedbackTimer = 0;

const rows = computed(() => Array.from({ length: boardState.value.height }, (_, row) => row));
const columns = computed(() => Array.from({ length: boardState.value.width }, (_, column) => column));
const expectedDirection = computed(() => getSokobanLargeExpectedDirection(boardState.value));
const resultVisible = computed(() => session.status === "finished");
const complete = computed(() => isSokobanLargeComplete(boardState.value));
const progressPercent = computed(() => Math.round((boardState.value.stepIndex / session.maxSteps) * 100));

function directionTargetId(direction: SokobanLargeDirection) {
  return `sokoban-large:direction:${direction}`;
}

function pointTargetId(point: SokobanLargePoint) {
  return `sokoban-large:cell:${point.row}:${point.column}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetChoiceState() {
  clearFeedbackTimer();
  pendingChoice.value = false;
  wrongDirection.value = undefined;
  hintedDirection.value = undefined;
  successDirection.value = undefined;
}

function chooseDirection(direction: SokobanLargeDirection) {
  if (session.status !== "running" || pendingChoice.value || complete.value) return;

  const targetId = directionTargetId(direction);
  const before = boardState.value;
  const result = applySokobanLargeMove(before, direction);
  clearFeedbackTimer();

  if (!result.moved) {
    const hint = result.expectedDirection ?? expectedDirection.value;
    wrongDirection.value = direction;
    hintedDirection.value = hint;
    pendingChoice.value = true;
    feedbackMessage.value = hint
      ? `Этот ход не применяем. Подсказка: спокойно выбери ${sokobanLargeDirectionLabels[hint]}.`
      : "Ящик уже на цели. Можно начать заново или вернуться в меню.";
    recordMistake({ targetId, direction, reason: result.event, expectedDirection: hint, isCorrect: false });
    if (hint) recordHint({ targetId: directionTargetId(hint), reason: "next-sokoban-move", expectedDirection: hint, selectedDirection: direction });
    feedbackTimer = window.setTimeout(() => {
      pendingChoice.value = false;
      wrongDirection.value = undefined;
    }, 1100);
    return;
  }

  boardState.value = result.state;
  successDirection.value = direction;
  hintedDirection.value = undefined;
  wrongDirection.value = undefined;
  pendingChoice.value = true;
  recordSuccess({
    targetId,
    direction,
    pushed: result.pushed,
    player: result.state.player,
    box: result.state.box,
    goal: result.state.goal,
    isCorrect: true
  });

  if (result.event === "complete") {
    feedbackMessage.value = "Готово: ящик спокойно встал на цель.";
    return;
  }

  feedbackMessage.value = result.pushed
    ? "Отлично, ящик сдвинулся ближе к цели. Выбери следующий ход."
    : "Хорошо, герой занял место для толкания. Продолжаем по подсказкам.";
  feedbackTimer = window.setTimeout(() => {
    pendingChoice.value = false;
    successDirection.value = undefined;
    const nextDirection = expectedDirection.value;
    feedbackMessage.value = nextDirection
      ? `Следующий спокойный ход: ${sokobanLargeDirectionLabels[nextDirection]}.`
      : "Ящик на цели.";
  }, 650);
}

function restart() {
  boardState.value = createSokobanLargeState();
  resetChoiceState();
  feedbackMessage.value = "Новая доска готова. Выбери направление, чтобы довести ящик до цели.";
  startSession();
}

function controlColor(direction: SokobanLargeDirection) {
  if (successDirection.value === direction) return "green-lighten-4";
  if (wrongDirection.value === direction) return "orange-lighten-4";
  if (hintedDirection.value === direction) return "blue-lighten-5";
  return "surface";
}

function hasPlayer(row: number, column: number) {
  return pointsEqual(boardState.value.player, { row, column });
}

function hasBox(row: number, column: number) {
  return pointsEqual(boardState.value.box, { row, column });
}

function hasGoal(row: number, column: number) {
  return pointsEqual(boardState.value.goal, { row, column });
}

function cellClasses(row: number, column: number) {
  return [
    "sokoban-cell",
    {
      "sokoban-cell--goal": hasGoal(row, column),
      "sokoban-cell--box": hasBox(row, column),
      "sokoban-cell--player": hasPlayer(row, column)
    }
  ];
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="sokoban-large-shell">
    <GameHud title="Сокобан крупный" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="sokoban-large-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-primary mb-1">Спокойная стратегия на крупной сетке</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Доведи ящик до цели</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Выбирай направление взгляда. Неверный ход не сдвигает героя или ящик, а только показывает подсказку.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Ход {{ boardState.stepIndex }} / {{ session.maxSteps }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Цель: верхний правый угол</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="hintedDirection ? 'primary' : 'secondary'" :icon="hintedDirection ? 'mdi-lightbulb-on-outline' : 'mdi-package-variant-closed'" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="7">
                <div class="sokoban-board mx-auto" role="grid" aria-label="Поле сокобана пять на пять">
                  <div v-for="row in rows" :key="row" class="sokoban-row" role="row">
                    <div v-for="column in columns" :key="column" :class="cellClasses(row, column)" role="gridcell" :aria-label="pointTargetId({ row, column })">
                      <v-icon v-if="hasGoal(row, column)" class="goal-icon" icon="mdi-bullseye" />
                      <v-icon v-if="hasBox(row, column)" class="box-icon" icon="mdi-package-variant-closed" />
                      <v-icon v-if="hasPlayer(row, column)" class="player-icon" icon="mdi-account" />
                    </div>
                  </div>
                </div>

                <v-progress-linear class="mt-5" :model-value="progressPercent" color="primary" height="14" rounded />
              </v-col>

              <v-col cols="12" md="5">
                <div class="text-h6 font-weight-bold text-center mb-3">Выбери следующий ход</div>
                <v-row dense>
                  <v-col v-for="control in directionControls" :key="control.direction" cols="6">
                    <GameDwellButton :target-id="directionTargetId(control.direction)" :disabled="session.status !== 'running' || pendingChoice || complete" :dwell-ms="session.settings.dwellMs" :min-height="148" :color="controlColor(control.direction)" @select="chooseDirection(control.direction)">
                      <template #default="{ active, progress }">
                        <div class="direction-content">
                          <v-icon :icon="control.icon" size="48" color="primary" />
                          <span>{{ control.label }}</span>
                          <v-chip v-if="hintedDirection === control.direction" color="primary" size="small" variant="flat">Подсказка</v-chip>
                          <v-chip v-else-if="active" color="secondary" size="small" variant="flat">{{ Math.round(progress * 100) }}%</v-chip>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>

                <v-alert class="mt-4" color="info" rounded="xl" variant="tonal">
                  План спокойный: сначала герой подходит к ящику, потом толкает его вверх и вправо к мишени.
                </v-alert>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Сокобан крупный" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.sokoban-large-shell {
  background:
    radial-gradient(circle at 18% 16%, rgb(255 236 179 / 72%), transparent 30%),
    radial-gradient(circle at 82% 22%, rgb(187 222 251 / 60%), transparent 28%),
    linear-gradient(135deg, #f8fbef 0%, #eef7ff 52%, #fff6e7 100%);
  min-block-size: 100vh;
}

.sokoban-large-container {
  padding-block-start: 132px;
}

.sokoban-board {
  background: rgb(var(--v-theme-primary) / 14%);
  border: 8px solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 30px;
  display: grid;
  gap: clamp(8px, 1.3vw, 14px);
  max-inline-size: min(92vw, 620px);
  padding: clamp(10px, 1.6vw, 16px);
}

.sokoban-row {
  display: grid;
  gap: clamp(8px, 1.3vw, 14px);
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.sokoban-cell {
  align-items: center;
  aspect-ratio: 1;
  background: #f7fbf4;
  border-radius: clamp(14px, 2vw, 24px);
  box-shadow: inset 0 0 0 2px rgb(92 116 84 / 8%);
  display: flex;
  justify-content: center;
  position: relative;
}

.sokoban-cell--goal {
  background: #fff7d6;
}

.sokoban-cell--box {
  background: #ffe0b2;
  box-shadow: 0 0 0 5px rgb(var(--v-theme-secondary) / 20%);
}

.sokoban-cell--player {
  background: #dcedc8;
}

.goal-icon {
  color: rgb(var(--v-theme-secondary));
  font-size: clamp(2rem, 5vw, 4.4rem);
  opacity: 0.86;
  position: absolute;
}

.box-icon,
.player-icon {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(2.4rem, 6vw, 5.2rem);
  position: relative;
  z-index: 1;
}

.direction-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 1.08rem;
  font-weight: 800;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 600px) {
  .sokoban-large-container {
    padding-block-start: 164px;
  }
}
</style>
