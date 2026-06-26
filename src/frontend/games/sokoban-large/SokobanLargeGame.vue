<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWasdPanel, { type GameWasdControl } from "../../components/game/GameWasdPanel.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  applySokobanLargeMove,
  createSokobanLargeState,
  isSokobanLargeComplete,
  pointsEqual,
  sokobanLargeChoiceOutcome,
  type SokobanLargeDirection,
  type SokobanLargePoint
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("sokoban-large", {
  maxSteps: 12,
  overrides: { targetScale: 1.2, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "sokoban-large", soundEnabled, warmAssetIds: ["sokoban-large.prompt", "sokoban-large.correct", "sokoban-large.mistake", "sokoban-large.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const directionControls: { direction: SokobanLargeDirection; key: "w" | "a" | "s" | "d"; label: string; icon: string }[] = [
  { direction: "up", key: "w", label: "Вверх", icon: "mdi-arrow-up-bold" },
  { direction: "left", key: "a", label: "Влево", icon: "mdi-arrow-left-bold" },
  { direction: "down", key: "s", label: "Вниз", icon: "mdi-arrow-down-bold" },
  { direction: "right", key: "d", label: "Вправо", icon: "mdi-arrow-right-bold" }
];

const boardState = ref(createSokobanLargeState());
const feedbackMessage = ref("Выбери ход. Если направление не подходит, ящик не двигается, а правило можно проверить ещё раз.");
const wrongDirection = ref<SokobanLargeDirection>();
const successDirection = ref<SokobanLargeDirection>();
const pendingChoice = ref(false);
const isSpeaking = ref(false);
let feedbackTimer = 0;

const rows = computed(() => Array.from({ length: boardState.value.height }, (_, row) => row));
const columns = computed(() => Array.from({ length: boardState.value.width }, (_, column) => column));
const resultVisible = computed(() => session.status === "finished");
const complete = computed(() => isSokobanLargeComplete(boardState.value));
const progressPercent = computed(() => Math.round((boardState.value.stepIndex / session.maxSteps) * 100));
const directionButtons = computed<GameWasdControl[]>(() => directionControls.map((control) => ({
  id: control.direction,
  key: control.key,
  label: control.label,
  icon: control.icon,
  targetId: directionTargetId(control.direction),
  color: "surface"
})));

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
  successDirection.value = undefined;
}

async function chooseDirection(direction: SokobanLargeDirection) {
  if (session.status !== "running" || pendingChoice.value || isSpeaking.value || complete.value) return;

  const targetId = directionTargetId(direction);
  const before = boardState.value;
  const result = applySokobanLargeMove(before, direction);
  clearFeedbackTimer();

  if (!result.moved) {
    const outcome = sokobanLargeChoiceOutcome(result, session.mistakes + 1);
    wrongDirection.value = direction;
    pendingChoice.value = true;
    feedbackMessage.value = outcome === "loss"
      ? "Раунд остановлен. Можно начать заново и спокойно проверить маршрут."
      : "Этот ход не двигает ящик. Посмотри на героя, ящик и цель, затем выбери другое направление.";
    recordMistake({ targetId, direction, reason: result.event, outcome, isCorrect: false });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(outcome === "loss" ? ["sokoban-large.mistake", "sokoban-large.complete"] : ["sokoban-large.mistake"], 80, 170);
    if (outcome === "loss") {
      finishSession("game-lost");
      isSpeaking.value = false;
      return;
    }
    isSpeaking.value = false;
    pendingChoice.value = false;
    feedbackTimer = window.setTimeout(() => {
      wrongDirection.value = undefined;
    }, 1100);
    return;
  }

  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  boardState.value = result.state;
  successDirection.value = direction;
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
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(["sokoban-large.correct", "sokoban-large.complete"], 80, 170);
    finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }

  feedbackMessage.value = result.pushed
    ? "Ящик сдвинулся ближе к цели. Выбери следующий ход."
    : "Герой занял место для толкания. Осмотрись и выбери следующий ход.";
  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["sokoban-large.correct", "sokoban-large.complete"] : ["sokoban-large.correct"], 80, 170);
  if (finishedAfterSuccess) {
    finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }
  isSpeaking.value = false;
  pendingChoice.value = false;
  feedbackTimer = window.setTimeout(() => {
    successDirection.value = undefined;
    feedbackMessage.value = "Продолжай спокойно: смотри на героя, ящик и цель.";
  }, 650);
}

function chooseDirectionButton(control: GameWasdControl) {
  void chooseDirection(control.id as SokobanLargeDirection);
}

function restart() {
  promptAudio.cancelPending();
  boardState.value = createSokobanLargeState();
  resetChoiceState();
  isSpeaking.value = false;
  feedbackMessage.value = "Новая доска готова. Выбери направление, чтобы довести ящик до цели.";
  startSession();
  promptAudio.play("sokoban-large.prompt", 220);
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

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("sokoban-large.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
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
                <p class="text-body-1 text-medium-emphasis mb-0">Выбирай направление взгляда. Если ход не сработал, осмотрись и попробуй другой.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Ход {{ boardState.stepIndex }} / {{ session.maxSteps }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Цель: верхний правый угол</v-chip>
              </div>
            </div>

            <v-alert class="compact-feedback mb-5 text-body-1 font-weight-medium" :color="wrongDirection ? 'primary' : 'secondary'" :icon="wrongDirection ? 'mdi-lightbulb-on-outline' : 'mdi-package-variant-closed'" rounded="xl" role="status" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="7" class="order-2 order-md-1">
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

              <v-col cols="12" md="5" class="order-1 order-md-2">
                <div class="text-h6 font-weight-bold text-center mb-3">Выбери следующий ход</div>
                <GameWasdPanel :controls="directionButtons" :disabled="session.status !== 'running' || pendingChoice || isSpeaking || complete" :dwell-ms="session.settings.dwellMs" aria-label="Направления сокобана" @select="chooseDirectionButton">
                  <template #control="{ control, active, progress }">
                    <div class="direction-content">
                      <span class="direction-key">{{ control.key.toUpperCase() }}</span>
                      <v-icon class="direction-icon" :icon="control.icon" size="44" />
                      <span>{{ control.label }}</span>
                      <v-chip v-if="control.chipText" color="primary" size="small" variant="flat">{{ control.chipText }}</v-chip>
                      <v-chip v-else-if="active" color="secondary" size="small" variant="flat">{{ Math.round(progress * 100) }}%</v-chip>
                    </div>
                  </template>
                </GameWasdPanel>

                <v-alert class="mt-4" color="info" rounded="xl" variant="tonal">
                  Смотри на свободные клетки вокруг героя и ящика. Ход можно спокойно проверить.
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
  padding-block-start: 8.25rem;
}

.sokoban-board {
  background: rgb(var(--v-theme-primary) / 14%);
  border: 0.5rem solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 1.875rem;
  display: grid;
  gap: clamp(0.5rem, 1.3vw, 0.875rem);
  max-inline-size: min(92vw, 38.75rem);
  padding: clamp(0.625rem, 1.6vw, 1rem);
}

.sokoban-row {
  display: grid;
  gap: clamp(0.5rem, 1.3vw, 0.875rem);
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.sokoban-cell {
  align-items: center;
  aspect-ratio: 1;
  background: #f7fbf4;
  border-radius: clamp(0.875rem, 2vw, 1.5rem);
  box-shadow: inset 0 0 0 0.125rem rgb(92 116 84 / 8%);
  display: flex;
  justify-content: center;
  position: relative;
}

.sokoban-cell--goal {
  background: #fff7d6;
}

.sokoban-cell--box {
  background: #ffe0b2;
  box-shadow: 0 0 0 0.3125rem rgb(var(--v-theme-secondary) / 20%);
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
  color: #000000;
  display: flex;
  flex-direction: column;
  font-size: 1.08rem;
  font-weight: 800;
  gap: 0.5rem;
  justify-content: center;
}

.direction-icon {
  color: #000000 !important;
}

.direction-key {
  border: 0.1em solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 0.65em;
  color: #000000;
  font-size: 0.8em;
  line-height: 1;
  min-inline-size: 1.9em;
  padding: 0.32em 0.5em;
}

@media (max-width: 37.5rem) {
  .sokoban-large-container {
    padding-block-start: 10.25rem;
  }
}

@media (max-height: 42.5rem) {
  .sokoban-large-container {
    padding-block-start: 4.75rem;
  }

  .sokoban-large-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .sokoban-large-container .d-flex.flex-column.flex-lg-row,
  .sokoban-large-container .text-h6 {
    display: none !important;
  }

  .sokoban-board {
    gap: 0.4rem;
    max-inline-size: min(100%, 42vh, 26rem);
    padding: 0.5rem;
  }

  .sokoban-row {
    gap: 0.4rem;
  }

  .compact-feedback {
    display: none;
  }
}
</style>
