<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { cellIndex, chessMiniSize, createChessMiniTasks, isLegalMove, squareLabel, type ChessMiniPiece } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("chess-mini", {
  maxSteps: 8,
  overrides: { targetScale: 1.25, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "chess-mini", soundEnabled, warmAssetIds: ["chess-mini.prompt", "chess-mini.correct", "chess-mini.mistake", "chess-mini.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const tasks = createChessMiniTasks();
const taskIndex = ref(0);
const wrongTarget = ref<number>();
const lastTarget = ref<number>();
const isSpeaking = ref(false);
const feedbackMessage = ref("Посмотри на фигуру и выбери любую клетку, куда она может сходить.");
const rows = Array.from({ length: chessMiniSize }, (_, row) => row);
const columns = Array.from({ length: chessMiniSize }, (_, column) => column);
const resultVisible = computed(() => session.status === "finished");
const currentTask = computed(() => tasks[taskIndex.value]);
let feedbackTimer = 0;

const pieceMeta: Record<ChessMiniPiece, { label: string; icon: string }> = {
  rook: { label: "Ладья", icon: "mdi-chess-rook" },
  bishop: { label: "Слон", icon: "mdi-chess-bishop" },
  knight: { label: "Конь", icon: "mdi-chess-knight" },
  queen: { label: "Ферзь", icon: "mdi-chess-queen" },
  king: { label: "Король", icon: "mdi-chess-king" }
};

const statusText = computed(() => {
  if (session.status === "paused") return "Пауза";
  return `Задача ${Math.min(session.step + 1, session.maxSteps)} из ${session.maxSteps}`;
});

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearWrongMark() {
  wrongTarget.value = undefined;
}

function targetId(index: number) {
  return `chess-mini:${currentTask.value.id}:cell:${index}`;
}

function isPieceCell(index: number) {
  return currentTask.value.from === index;
}

function isBlockerCell(index: number) {
  return currentTask.value.blockers.includes(index);
}

function cellColor(index: number) {
  if (wrongTarget.value === index) return "orange-lighten-4";
  if (lastTarget.value === index) return "green-lighten-4";
  if (isPieceCell(index)) return "amber-lighten-4";
  if (isBlockerCell(index)) return "blue-grey-lighten-4";
  return (Math.floor(index / chessMiniSize) + index % chessMiniSize) % 2 === 0 ? "brown-lighten-5" : "blue-grey-lighten-5";
}

async function chooseCell(index: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  clearFeedbackTimer();
  const task = currentTask.value;
  const selectedTargetId = targetId(index);

  if (!isLegalMove(task, index)) {
    wrongTarget.value = index;
    lastTarget.value = undefined;
    feedbackMessage.value = "Ход не подходит. Можно попробовать другую клетку.";
    recordMistake({ targetId: selectedTargetId, piece: task.piece, from: task.from, selected: index, isCorrect: false });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["chess-mini.mistake"], 80);
    isSpeaking.value = false;
    feedbackTimer = window.setTimeout(clearWrongMark, 1600);
    return;
  }

  recordSuccess({ targetId: selectedTargetId, piece: task.piece, from: task.from, to: index, isCorrect: true });
  clearWrongMark();
  lastTarget.value = index;
  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;

  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["chess-mini.correct", "chess-mini.complete"] : ["chess-mini.correct"], 80, 170);

  if (finishedAfterSuccess) {
    feedbackMessage.value = "Все мини-задачи решены спокойно и точно.";
    finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }

  taskIndex.value = (taskIndex.value + 1) % tasks.length;
  feedbackMessage.value = "Ход подходит. Посмотри на следующую фигуру и выбери её допустимый ход.";
  isSpeaking.value = false;
}

function restart() {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  taskIndex.value = 0;
  wrongTarget.value = undefined;
  lastTarget.value = undefined;
  isSpeaking.value = false;
  feedbackMessage.value = "Посмотри на фигуру и выбери любую клетку, куда она может сходить.";
  startSession();
  promptAudio.play("chess-mini.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("chess-mini.prompt", 420);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="chess-mini-shell">
    <GameHud title="Chess mini" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Мини-задачи на шахматной доске 4×4</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Chess mini</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Выбери допустимый ход фигуры. Ошибка не завершает игру, а спокойно показывает возможные клетки.</p>
              </div>
              <div class="d-flex flex-wrap align-center ga-2">
                <v-chip color="primary" size="large" variant="tonal">{{ statusText }}</v-chip>
                <v-chip color="secondary" size="large" variant="flat">
                  <v-icon :icon="pieceMeta[currentTask.piece].icon" start />
                  {{ pieceMeta[currentTask.piece].label }} {{ squareLabel(currentTask.from) }}
                </v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="wrongTarget !== undefined ? 'warning' : 'secondary'" icon="mdi-chess-knight" rounded="xl" variant="tonal">
              {{ feedbackMessage }} {{ currentTask.prompt }}
            </v-alert>

            <div class="board-grid mx-auto" role="grid" aria-label="Шахматная мини-доска четыре на четыре">
              <template v-for="row in rows" :key="row">
                <GameDwellButton
                  v-for="column in columns"
                  :key="`${currentTask.id}-${row}-${column}`"
                  :target-id="targetId(cellIndex(row, column))"
                  :disabled="session.status !== 'running' || isSpeaking"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(4.5rem, 11vh, 7.875rem)"
                  :color="cellColor(cellIndex(row, column))"
                  @select="chooseCell(cellIndex(row, column))"
                >
                  <template #default>
                    <div class="cell-content">
                      <div class="cell-label">{{ squareLabel(cellIndex(row, column)) }}</div>
                      <v-icon v-if="isPieceCell(cellIndex(row, column))" :icon="pieceMeta[currentTask.piece].icon" class="piece-icon" size="3.375rem" />
                      <v-icon v-else-if="isBlockerCell(cellIndex(row, column))" icon="mdi-circle-medium" class="blocker-icon" size="2.875rem" />
                      <v-icon v-else-if="wrongTarget === cellIndex(row, column)" icon="mdi-alert-circle-outline" class="wrong-icon" size="2.625rem" />
                    </div>
                  </template>
                </GameDwellButton>
              </template>
            </div>

            <div class="d-flex flex-column flex-sm-row align-center justify-space-between ga-3 mt-5">
              <p class="text-body-2 text-medium-emphasis mb-0">Преграды нельзя выбирать и через них не ходят ладья, слон и ферзь. Конь перепрыгивает.</p>
              <v-btn color="secondary" prepend-icon="mdi-arrow-left" rounded="xl" size="large" variant="tonal" @click="router.push(resolveMenuRoute())">В меню</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Chess mini" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.chess-mini-shell {
  background:
    radial-gradient(circle at 16% 18%, rgb(255 224 178 / 62%), transparent 30%),
    radial-gradient(circle at 84% 16%, rgb(197 202 233 / 56%), transparent 28%),
    linear-gradient(135deg, #fff8ec 0%, #eef3ff 54%, #f4fff4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.board-grid {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 1rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-inline-size: min(92vw, 42.5rem, 50vh);
}

.cell-content {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 100%;
  position: relative;
}

.cell-label {
  color: rgb(var(--v-theme-on-surface) / 78%);
  font-size: 0.78rem;
  font-weight: 800;
  inset-block-start: 0.15rem;
  inset-inline-start: 0.35rem;
  position: absolute;
}

.piece-icon {
  color: #4e342e;
  filter: drop-shadow(0 0.25rem 0.35rem rgb(0 0 0 / 14%));
}

.blocker-icon {
  color: #455a64;
}

.wrong-icon {
  color: #e65100;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .board-grid {
    gap: 0.45rem;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 4.5rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container h1,
  .game-container p,
  .game-container .v-alert,
  .game-container .v-btn {
    display: none;
  }

  .game-container .d-flex.flex-column.flex-md-row {
    margin-block-end: 0.75rem !important;
  }

  .board-grid {
    gap: 0.45rem;
    max-inline-size: min(100%, 26rem);
  }

  .board-grid :deep(.dwell-button) {
    min-block-size: 3.5rem !important;
    padding: 0.35rem !important;
  }

  .piece-icon,
  .blocker-icon,
  .wrong-icon {
    font-size: 2rem !important;
  }
}
</style>
