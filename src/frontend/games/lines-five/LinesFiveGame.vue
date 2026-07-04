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
import { cellIndex, chooseLinesFiveCell, columnOf, countColors, createInitialLinesFiveState, linesFiveSize, reachableDestinationIndexes, rowOf, type LinesFiveCell, type LinesFiveColor } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordHint, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("lines-five", {
  maxSteps: 999,
  overrides: { targetScale: 1.18, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "lines-five", soundEnabled, warmAssetIds: ["lines-five.prompt", "lines-five.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const colorLabels: Record<LinesFiveColor, string> = {
  sky: "голубой",
  sun: "солнечный",
  leaf: "зелёный",
  berry: "ягодный"
};

const gameState = ref(createInitialLinesFiveState());
const lastMovedFrom = ref<number>();
const lastMovedTo = ref<number>();
const clearedIndexes = ref<number[]>([]);
const spawnedIndexes = ref<number[]>([]);
const pathIndexes = ref<number[]>([]);
const feedbackMessage = ref("Выбери шарик, затем свободную клетку, до которой есть путь. Собирай линию из пяти одинаковых шаров.");

const rows = Array.from({ length: linesFiveSize }, (_, row) => row);
const columns = Array.from({ length: linesFiveSize }, (_, column) => column);
const board = computed(() => gameState.value.board);
const selectedIndex = computed(() => gameState.value.selectedIndex);
const reachableIndexes = computed(() => selectedIndex.value === undefined ? [] : reachableDestinationIndexes(board.value, selectedIndex.value));
const counts = computed(() => countColors(board.value));
const resultVisible = computed(() => session.status === "finished");

function targetId(index: number) {
  return `lines-five:cell:${index}`;
}

function cellColor(index: number, cell: LinesFiveCell) {
  if (selectedIndex.value === index) return "secondary";
  if (reachableIndexes.value.includes(index)) return "primary";
  if (cell) return "surface";
  return "blue-grey-lighten-5";
}

function cellClasses(index: number, cell: LinesFiveCell) {
  return [
    "lines-cell-content",
    cell ? `lines-cell-content--${cell}` : "",
    {
      "lines-cell-content--selected": selectedIndex.value === index,
      "lines-cell-content--last": lastMovedTo.value === index || lastMovedFrom.value === index,
      "lines-cell-content--reachable": reachableIndexes.value.includes(index),
      "lines-cell-content--path": pathIndexes.value.includes(index),
      "lines-cell-content--cleared": clearedIndexes.value.includes(index),
      "lines-cell-content--spawned": spawnedIndexes.value.includes(index)
    }
  ];
}

async function finishGame() {
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["lines-five.complete"], 80, 170);
  if (session.status !== "finished") finishSession("game-lost");
}

function chooseCell(index: number) {
  if (session.status !== "running") return;

  const target = targetId(index);
  const result = chooseLinesFiveCell(gameState.value, index);
  gameState.value = result.state;
  clearedIndexes.value = result.cleared;
  spawnedIndexes.value = result.spawned;
  pathIndexes.value = result.path;
  lastMovedFrom.value = result.movedFrom;
  lastMovedTo.value = result.movedTo;

  if (result.event === "selected") {
    feedbackMessage.value = `Шарик выбран. Теперь выбери подсвеченную свободную клетку для перемещения.`;
    recordHint({ targetId: target, text: "Выбран шарик для перемещения." });
    return;
  }

  if (result.event === "invalid") {
    feedbackMessage.value = selectedIndex.value === undefined
      ? "Сначала выбери шарик, который нужно передвинуть."
      : "До этой клетки нет свободного пути. Выбери подсвеченную клетку или другой шарик.";
    recordMistake({ targetId: target, row: rowOf(index), column: columnOf(index), reason: "invalid-lines-move", isCorrect: false });
    void feedbackAudio.playMistake();
    return;
  }

  recordSuccess({
    targetId: target,
    row: rowOf(index),
    column: columnOf(index),
    movedFrom: result.movedFrom,
    movedTo: result.movedTo,
    cleared: result.cleared.length,
    spawned: result.spawned.length,
    score: result.state.score,
    isCorrect: true
  });

  if (result.event === "cleared") {
    feedbackMessage.value = `Линия из пяти собрана: убрано ${result.cleared.length} шаров. Новые шары не появились.`;
    void feedbackAudio.playSuccess();
    return;
  }

  if (result.event === "spawn-cleared") {
    feedbackMessage.value = `Ход сделан. Новые шары собрали линию: убрано ${result.cleared.length}.`;
    void feedbackAudio.playSuccess();
    return;
  }

  if (result.event === "loss") {
    feedbackMessage.value = "Поле заполнилось. Раунд завершён, можно попробовать снова.";
    recordMistake({ targetId: target, row: rowOf(index), column: columnOf(index), reason: "board-full", isCorrect: false });
    void finishGame();
    return;
  }

  feedbackMessage.value = `Шарик передвинут. Появились ${result.spawned.length} новых шара. Продолжай собирать линию из пяти.`;
  void feedbackAudio.playSuccess();
}

function restart() {
  promptAudio.cancelPending();
  gameState.value = createInitialLinesFiveState();
  lastMovedFrom.value = undefined;
  lastMovedTo.value = undefined;
  clearedIndexes.value = [];
  spawnedIndexes.value = [];
  pathIndexes.value = [];
  feedbackMessage.value = "Новая доска готова. Выбери шарик, затем подсвеченную клетку для перемещения.";
  startSession();
  promptAudio.play("lines-five.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("lines-five.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="lines-five-shell">
    <GameHud title="Lines 5" :step="session.step" :max-steps="session.maxSteps" :score="gameState.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" :show-progress="false" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Полноценная стратегия Lines 5</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Lines 5</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Выбери шарик, передвинь его по свободному пути и собирай линии из пяти одинаковых цветов.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Очки: {{ gameState.score }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Ходов: {{ gameState.moveCount }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" color="primary" icon="mdi-vector-line" rounded="xl" role="status" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="8" class="board-column">
                <div class="board-grid mx-auto" role="grid" aria-label="Поле Lines Five шесть на шесть">
                  <template v-for="row in rows" :key="row">
                    <GameDwellButton
                      v-for="column in columns"
                      :key="`${row}-${column}`"
                      :target-id="targetId(cellIndex(row, column))"
                      :disabled="session.status !== 'running' || gameState.status !== 'playing'"
                      :dwell-ms="session.settings.dwellMs"
                      min-height="clamp(3.75rem, 8.5vh, 6rem)"
                      :color="cellColor(cellIndex(row, column), board[cellIndex(row, column)])"
                      role="gridcell"
                      @select="chooseCell(cellIndex(row, column))"
                    >
                      <template #default>
                        <div :class="cellClasses(cellIndex(row, column), board[cellIndex(row, column)])">
                          <div v-if="board[cellIndex(row, column)]" :class="['ball', `ball--${board[cellIndex(row, column)]}`]" />
                          <v-icon v-else-if="reachableIndexes.includes(cellIndex(row, column))" class="reachable-icon" icon="mdi-arrow-expand" />
                        </div>
                      </template>
                    </GameDwellButton>
                  </template>
                </div>
              </v-col>

              <v-col cols="12" md="4" class="side-column">
                <v-card class="side-info-card pa-4" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                  <div class="text-h6 font-weight-bold mb-3 text-blue-grey-darken-4">На поле</div>
                  <v-list bg-color="transparent" density="compact">
                    <v-list-item v-for="color in ['sky', 'sun', 'leaf', 'berry']" :key="color" class="side-list-item" :title="colorLabels[color as LinesFiveColor]" :subtitle="`${counts[color as LinesFiveColor]} шар.`">
                      <template #prepend>
                        <span :class="['mini-ball', `ball--${color}`]" />
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>

                <v-card class="side-info-card pa-4 mt-4" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                  <div class="text-h6 font-weight-bold mb-3 text-blue-grey-darken-4">Следующие</div>
                  <div class="d-flex ga-3 align-center">
                    <span v-for="(color, index) in gameState.nextBalls" :key="`${color}-${index}`" :class="['mini-ball', `ball--${color}`]" />
                  </div>
                </v-card>

                <v-alert class="side-rule-alert mt-4 text-body-2" color="info" icon="mdi-heart-outline" rounded="xl" variant="flat">
                  Если ход не собрал линию, появятся три новых шара. Линия из пяти освобождает клетки.
                </v-alert>
              </v-col>
            </v-row>

            <div class="d-flex justify-end mt-5">
              <v-btn color="secondary" prepend-icon="mdi-arrow-left" rounded="xl" size="large" variant="tonal" @click="router.push(resolveMenuRoute())">В меню</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Lines 5" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.lines-five-shell {
  background:
    radial-gradient(circle at 18% 18%, rgb(179 229 252 / 58%), transparent 30%),
    radial-gradient(circle at 84% 18%, rgb(255 224 178 / 58%), transparent 28%),
    linear-gradient(135deg, #f6fbff 0%, #fffaf0 56%, #f4fff7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 7rem;
}

.board-grid {
  display: grid;
  gap: clamp(0.3rem, 0.9vw, 0.625rem);
  grid-template-columns: repeat(6, minmax(0, 1fr));
  max-inline-size: min(92vw, 42rem, 72vh);
}

.board-grid :deep(.dwell-button) {
  padding: 0.5rem !important;
}

.lines-cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 1.125rem;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: clamp(3.4rem, 7.4vh, 5rem);
  transition: outline 160ms ease, transform 160ms ease;
}

.lines-cell-content--selected {
  outline: 0.3rem solid rgb(var(--v-theme-secondary) / 60%);
  outline-offset: -0.35rem;
}

.lines-cell-content--reachable {
  box-shadow: inset 0 0 0 0.25rem rgb(var(--v-theme-primary) / 28%);
}

.lines-cell-content--path {
  background: rgb(var(--v-theme-primary) / 10%);
}

.lines-cell-content--last {
  outline: 0.25rem solid rgb(var(--v-theme-secondary) / 42%);
  outline-offset: -0.3125rem;
}

.lines-cell-content--cleared {
  transform: scale(1.04);
}

.lines-cell-content--spawned {
  outline: 0.22rem dashed rgb(var(--v-theme-primary) / 32%);
  outline-offset: -0.28rem;
}

.reachable-icon {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.4rem, 3vw, 2rem);
  opacity: 0.72;
}

.ball,
.mini-ball {
  border-radius: 999px;
  box-shadow: 0 0.75rem 1.375rem rgb(42 38 30 / 18%), inset 0 -0.5625rem 1rem rgb(0 0 0 / 10%);
  display: inline-block;
}

.ball {
  block-size: clamp(2.3rem, 5.8vw, 3.9rem);
  inline-size: clamp(2.3rem, 5.8vw, 3.9rem);
}

.mini-ball {
  block-size: 1.75rem;
  inline-size: 1.75rem;
}

.side-info-card {
  background: rgb(236 243 246) !important;
  color: rgb(47 79 79) !important;
}

.side-list-item {
  color: rgb(47 79 79) !important;
}

.side-list-item :deep(.v-list-item-title) {
  color: rgb(38 68 68) !important;
  font-weight: 800;
}

.side-list-item :deep(.v-list-item-subtitle) {
  color: rgb(76 103 103) !important;
  opacity: 1;
}

.side-rule-alert {
  background: rgb(227 238 244) !important;
  color: rgb(68 100 122) !important;
}

.ball--sky {
  background: radial-gradient(circle at 34% 28%, #f3fbff 0 24%, #4fc3f7 25% 66%, #0277bd 100%);
}

.ball--sun {
  background: radial-gradient(circle at 34% 28%, #fffde7 0 24%, #ffd54f 25% 66%, #f57f17 100%);
}

.ball--leaf {
  background: radial-gradient(circle at 34% 28%, #f1f8e9 0 24%, #81c784 25% 66%, #2e7d32 100%);
}

.ball--berry {
  background: radial-gradient(circle at 34% 28%, #fce4ec 0 24%, #f06292 25% 66%, #ad1457 100%);
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .lines-cell-content {
    min-block-size: 3.25rem;
  }
}

@media (min-height: 42.5625rem) and (max-height: 68rem) {
  .game-container {
    padding-block-start: 4.25rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 0.9rem !important;
  }

  .game-container .text-overline,
  .game-container h1,
  .game-container p,
  .game-container .v-btn {
    display: none !important;
  }

  .game-container .d-flex.flex-column.flex-md-row {
    margin-block-end: 0.8rem !important;
  }

  .game-container .v-alert {
    margin-block-end: 0.8rem !important;
    padding-block: 0.65rem !important;
  }

  .board-grid {
    max-inline-size: min(100%, 36rem, 58vh);
  }

  .board-grid :deep(.dwell-button) {
    min-block-size: clamp(3.6rem, 8vh, 5rem) !important;
  }

  .lines-cell-content {
    min-block-size: clamp(3.4rem, 7.4vh, 4.75rem);
  }

  .ball {
    block-size: clamp(2.2rem, 4.8vh, 3.4rem);
    inline-size: clamp(2.2rem, 4.8vh, 3.4rem);
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container h1,
  .game-container p,
  .game-container .v-alert,
  .game-container .v-btn,
  .side-column {
    display: none;
  }

  .board-column {
    flex-basis: 100%;
    max-inline-size: 100%;
  }

  .game-container .d-flex.flex-column.flex-md-row {
    display: none !important;
  }

  .board-grid {
    gap: 0.28rem;
    max-inline-size: min(100%, 34rem, 64vh);
  }

  .board-grid :deep(.dwell-button) {
    min-block-size: 3.55rem !important;
    padding: 0.35rem !important;
  }

  .lines-cell-content {
    min-block-size: 3.35rem;
  }

  .ball {
    block-size: 2.3rem;
    inline-size: 2.3rem;
  }
}
</style>
