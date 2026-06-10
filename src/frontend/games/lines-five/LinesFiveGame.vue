<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { cellIndex, columnOf, countColors, createInitialLinesFiveBoard, linesFiveOutcome, linesFiveSize, nextColorForStep, placeBall, rowOf, suggestedMoveIndexes, type LinesFiveCell, type LinesFiveColor } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordHint, recordMistake, recordSuccess, startSession, finishSession } = useGameSession("lines-five", {
  maxSteps: 10,
  dwellMs: 1300,
  sessionSeconds: 180,
  targetScale: 1.18,
  sound: false
}, { finishOnMistakes: false });

const colorLabels: Record<LinesFiveColor, string> = {
  sky: "голубой",
  sun: "солнечный",
  leaf: "зелёный",
  berry: "ягодный"
};

const board = ref(createInitialLinesFiveBoard());
const lastPlacedIndex = ref<number>();
const clearedIndexes = ref<number[]>([]);
const hintActive = ref(false);
const feedbackMessage = ref("Поставь голубой шарик так, чтобы собрать линию из трёх и мягко убрать её.");

const rows = Array.from({ length: linesFiveSize }, (_, row) => row);
const columns = Array.from({ length: linesFiveSize }, (_, column) => column);
const nextColor = computed(() => nextColorForStep(session.step));
const suggestedMoves = computed(() => suggestedMoveIndexes(board.value, nextColor.value));
const counts = computed(() => countColors(board.value));
const resultVisible = computed(() => session.status === "finished");

function targetId(index: number) {
  return `lines-five:cell:${index}`;
}

function isSuggested(index: number) {
  return suggestedMoves.value.includes(index);
}

function cellColor(index: number, cell: LinesFiveCell) {
  if (cell) return "surface";
  if (hintActive.value && isSuggested(index)) return "primary";
  return "blue-grey-lighten-5";
}

function cellClasses(index: number, cell: LinesFiveCell) {
  return [
    "lines-cell-content",
    cell ? `lines-cell-content--${cell}` : "",
    {
      "lines-cell-content--suggested": hintActive.value && !cell && isSuggested(index),
      "lines-cell-content--last": lastPlacedIndex.value === index,
      "lines-cell-content--cleared": clearedIndexes.value.includes(index)
    }
  ];
}

function chooseCell(index: number) {
  if (session.status !== "running") return;

  const target = targetId(index);
  const result = placeBall(board.value, index, nextColor.value);
  if (!result) {
    hintActive.value = true;
    clearedIndexes.value = [];
    lastPlacedIndex.value = index;
    feedbackMessage.value = `Эта клетка уже занята. Посмотри на пустые клетки: подсказка ведёт ${colorLabels[nextColor.value]} шарик к линии.`;
    recordMistake({ targetId: target, row: rowOf(index), column: columnOf(index), reason: "occupied-cell", isCorrect: false });
    recordHint({ targetId: target, suggestedMoves: suggestedMoves.value });
    return;
  }

  board.value = result.board;
  lastPlacedIndex.value = result.placedIndex;
  clearedIndexes.value = result.cleared;
  hintActive.value = result.cleared.length === 0;
  recordSuccess({
    targetId: target,
    row: rowOf(index),
    column: columnOf(index),
    color: nextColor.value,
    cleared: result.cleared.length,
    lines: result.completedLines.length,
    isCorrect: true
  });

  if (result.cleared.length) {
    feedbackMessage.value = `Отлично: линия из ${result.cleared.length} шариков мягко исчезла. Готовим следующий шарик.`;
    return;
  }

  if (linesFiveOutcome(board.value) === "loss") {
    feedbackMessage.value = "Поле заполнилось, а линия не собралась. Партия проиграна.";
    recordMistake({ targetId: target, row: rowOf(index), column: columnOf(index), reason: "board-full", isCorrect: false });
    finishSession("game-lost");
    return;
  }

  feedbackMessage.value = "Шарик встал на место. Подсветка покажет, где может сложиться следующая линия.";
}

function restart() {
  board.value = createInitialLinesFiveBoard();
  lastPlacedIndex.value = undefined;
  clearedIndexes.value = [];
  hintActive.value = false;
  feedbackMessage.value = "Новая маленькая доска готова. Собирай линии из трёх, четырёх или пяти шариков.";
  startSession();
}
</script>

<template>
  <div class="lines-five-shell">
    <GameHud title="Lines 5" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Мини-стратегия 5×5</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Lines 5</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Ставь шарики и собирай линии из 3–5 одинаковых цветов. Если поле заполнится без линии, партия закончится.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Следующий: {{ colorLabels[nextColor] }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Линий: {{ session.score }} / {{ session.maxSteps }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="hintActive ? 'secondary' : 'primary'" :icon="hintActive ? 'mdi-lightbulb-on-outline' : 'mdi-vector-line'" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="8">
                <div class="board-grid mx-auto" role="grid" aria-label="Поле Lines Five пять на пять">
                  <template v-for="row in rows" :key="row">
                    <GameDwellButton
                      v-for="column in columns"
                      :key="`${row}-${column}`"
                      :target-id="targetId(cellIndex(row, column))"
                      :disabled="session.status !== 'running'"
                      :dwell-ms="session.settings.dwellMs"
                      :min-height="104"
                      :color="cellColor(cellIndex(row, column), board[cellIndex(row, column)])"
                      role="gridcell"
                      @select="chooseCell(cellIndex(row, column))"
                    >
                      <template #default>
                        <div :class="cellClasses(cellIndex(row, column), board[cellIndex(row, column)])">
                          <div v-if="board[cellIndex(row, column)]" :class="['ball', `ball--${board[cellIndex(row, column)]}`]" />
                          <div v-else-if="hintActive && isSuggested(cellIndex(row, column))" class="soft-hint">
                            <v-icon icon="mdi-plus-circle-outline" size="34" />
                          </div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </template>
                </div>
              </v-col>

              <v-col cols="12" md="4">
                <v-card class="pa-4" color="surface" rounded="xl" variant="tonal">
                  <div class="text-h6 font-weight-bold mb-3">На поле</div>
                  <v-list bg-color="transparent" density="compact">
                    <v-list-item v-for="color in ['sky', 'sun', 'leaf', 'berry']" :key="color" :title="colorLabels[color as LinesFiveColor]" :subtitle="`${counts[color as LinesFiveColor]} шар.`">
                      <template #prepend>
                        <span :class="['mini-ball', `ball--${color}`]" />
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>

                <v-alert class="mt-4 text-body-2" color="info" icon="mdi-heart-outline" rounded="xl" variant="tonal">
                  Если выбрать занятую клетку, игра покажет подсказку. Если заполнить всё поле без линии, партия завершится.
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
  padding-block-start: 132px;
}

.board-grid {
  display: grid;
  gap: clamp(6px, 1.2vw, 12px);
  grid-template-columns: repeat(5, minmax(0, 1fr));
  max-inline-size: min(92vw, 590px);
}

.board-grid :deep(.dwell-button) {
  padding: 8px !important;
}

.lines-cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 18px;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 76px;
  transition: outline 160ms ease, transform 160ms ease;
}

.lines-cell-content--suggested {
  outline: 4px solid rgb(var(--v-theme-primary) / 24%);
  outline-offset: -5px;
}

.lines-cell-content--last {
  outline: 4px solid rgb(var(--v-theme-secondary) / 42%);
  outline-offset: -5px;
}

.lines-cell-content--cleared {
  transform: scale(1.04);
}

.ball,
.mini-ball {
  border-radius: 999px;
  box-shadow: 0 12px 22px rgb(42 38 30 / 18%), inset 0 -9px 16px rgb(0 0 0 / 10%);
  display: inline-block;
}

.ball {
  block-size: clamp(44px, 8vw, 72px);
  inline-size: clamp(44px, 8vw, 72px);
}

.mini-ball {
  block-size: 28px;
  inline-size: 28px;
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

.soft-hint {
  color: rgb(var(--v-theme-primary));
  opacity: 0.75;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }

  .lines-cell-content {
    min-block-size: 58px;
  }
}
</style>
