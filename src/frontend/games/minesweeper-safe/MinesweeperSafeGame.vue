<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { createInitialCellStates, findSuggestedSafeIndex, generateMinesweeperSafeBoard, minesweeperSafeChoiceOutcome, type MinesweeperSafeCell } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("minesweeper-safe", {
  maxSteps: 10,
  finishOnMistakes: false
});

const roundIndex = ref(1);
const board = ref(generateMinesweeperSafeBoard(session.settings, roundIndex.value));
const cellStates = ref(createInitialCellStates(board.value));
const hintedIndex = ref<number>();
const lastFlaggedIndex = ref<number>();

const resultVisible = computed(() => session.status === "finished");
const safeRemaining = computed(() => board.value.cells.filter((cell) => !cell.mine && cellStates.value[cell.index] === "hidden").length);
const helperText = computed(() => {
  if (lastFlaggedIndex.value !== undefined) return "Это была мина. Партия завершена: в сапёре мина считается проигрышем.";
  if (hintedIndex.value !== undefined) return "Мягкая подсказка включена: выбери подсвеченную безопасную клетку.";
  return "Открытые числа показывают, сколько мин рядом. Выбирай закрытые клетки, которые выглядят безопасно.";
});

function cellTargetId(index: number) {
  return `minesweeper-safe:cell:${index}`;
}

function hintTargetId() {
  return "minesweeper-safe:hint";
}

function isDisabled(cell: MinesweeperSafeCell) {
  return session.status !== "running" || cellStates.value[cell.index] !== "hidden";
}

function cellColor(cell: MinesweeperSafeCell) {
  const state = cellStates.value[cell.index];
  if (state === "flagged") return "warning";
  if (state === "revealed") return "surface";
  if (hintedIndex.value === cell.index) return "success";
  return "surface";
}

function cellNumberColor(count: number) {
  if (count >= 3) return "deep-purple";
  if (count === 2) return "indigo";
  if (count === 1) return "teal";
  return "green";
}

function revealNextBoardIfNeeded() {
  if (session.status !== "running" || safeRemaining.value > 0) return;
  roundIndex.value += 1;
  board.value = generateMinesweeperSafeBoard(session.settings, roundIndex.value);
  cellStates.value = createInitialCellStates(board.value);
  hintedIndex.value = undefined;
  lastFlaggedIndex.value = undefined;
}

function requestHint(reason = "manual") {
  if (session.status !== "running") return;
  const suggestion = findSuggestedSafeIndex(board.value.cells, cellStates.value);
  if (suggestion === undefined) return;
  hintedIndex.value = suggestion;
  recordHint({ roundId: board.value.roundId, targetId: cellTargetId(suggestion), reason });
}

function chooseCell(cell: MinesweeperSafeCell) {
  if (isDisabled(cell)) return;

  const outcome = minesweeperSafeChoiceOutcome(cell, cellStates.value[cell.index]);
  if (outcome === "ignored") return;

  if (outcome === "mine") {
    lastFlaggedIndex.value = cell.index;
    recordMistake({ roundId: board.value.roundId, targetId: cellTargetId(cell.index), result: "mine", isCorrect: false });
    finishSession("game-lost");
    return;
  }

  cellStates.value[cell.index] = "revealed";
  lastFlaggedIndex.value = undefined;
  if (hintedIndex.value === cell.index) hintedIndex.value = undefined;
  recordSuccess({ roundId: board.value.roundId, targetId: cellTargetId(cell.index), adjacentMines: cell.adjacentMines });
  revealNextBoardIfNeeded();
}

function restart() {
  roundIndex.value = 1;
  board.value = generateMinesweeperSafeBoard(session.settings, roundIndex.value);
  cellStates.value = createInitialCellStates(board.value);
  hintedIndex.value = undefined;
  lastFlaggedIndex.value = undefined;
  startSession();
}
</script>

<template>
  <div class="minesweeper-safe-shell">
    <GameHud title="Сапёр" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Спокойная стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Сапёр</h1>
                <p class="text-body-1 text-md-h6 text-medium-emphasis mb-0">{{ helperText }}</p>
              </div>
              <div class="d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3">
                <v-chip color="primary" prepend-icon="mdi-shield-check-outline" size="large" variant="tonal">
                  Безопасных: {{ safeRemaining }}
                </v-chip>
                <GameDwellButton :target-id="hintTargetId()" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="136" color="deep-purple-darken-3" @select="requestHint()">
                  <template #default>
                    <div class="hint-button-content">
                      <v-icon icon="mdi-map-marker-question-outline" size="30" />
                      <span>Подсказка</span>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <div class="board-wrap mx-auto" :style="{ '--board-size': board.size }" role="grid" aria-label="Поле сапёра">
              <GameDwellButton
                v-for="cell in board.cells"
                :key="`${board.roundId}:${cell.index}`"
                :class="['mine-cell', { 'mine-cell--hinted': hintedIndex === cell.index, 'mine-cell--flagged': cellStates[cell.index] === 'flagged' }]"
                :target-id="cellTargetId(cell.index)"
                :disabled="isDisabled(cell)"
                :dwell-ms="session.settings.dwellMs"
                  :min-height="136"
                :color="cellColor(cell)"
                role="gridcell"
                @select="chooseCell(cell)"
              >
                <template #default>
                  <div v-if="cellStates[cell.index] === 'revealed'" class="revealed-cell">
                    <v-icon v-if="cell.adjacentMines === 0" icon="mdi-shield-check-outline" color="success" size="34" />
                    <span v-else class="cell-number" :class="`text-${cellNumberColor(cell.adjacentMines)}`" style="color: #17212b">{{ cell.adjacentMines }}</span>
                  </div>
                  <div v-else-if="cellStates[cell.index] === 'flagged'" class="flagged-cell">
                    <v-icon icon="mdi-flag-variant" color="warning" size="42" />
                    <span class="text-caption font-weight-bold">флажок</span>
                  </div>
                  <div v-else class="hidden-cell">
                    <v-icon :icon="hintedIndex === cell.index ? 'mdi-shield-check-outline' : 'mdi-map-marker-question-outline'" :color="hintedIndex === cell.index ? 'success' : 'blue-grey-lighten-1'" size="34" />
                    <span class="text-caption font-weight-bold">{{ hintedIndex === cell.index ? 'можно' : 'клетка' }}</span>
                  </div>
                </template>
              </GameDwellButton>
            </div>

            <v-alert class="mt-5 text-body-1" color="info" icon="mdi-flag-variant" rounded="xl" variant="tonal">
              Если выбрать мину, партия завершится. Используй числа и подсказку, чтобы искать безопасные клетки.
            </v-alert>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Сапёр" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.minesweeper-safe-shell {
  background:
    radial-gradient(circle at 16% 18%, rgb(200 230 201 / 62%), transparent 28%),
    radial-gradient(circle at 82% 22%, rgb(187 222 251 / 54%), transparent 30%),
    linear-gradient(135deg, #f7fbf6 0%, #eef7ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 7rem;
}

.hint-button-content,
.hidden-cell,
.flagged-cell,
.revealed-cell {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  justify-content: center;
}

.hidden-cell,
.flagged-cell {
  color: #17212b !important;
}

.hidden-cell span,
.flagged-cell span,
.hidden-cell :deep(.v-icon),
.flagged-cell :deep(.v-icon) {
  color: #17212b !important;
}

.hint-button-content {
  font-weight: 800;
}

.board-wrap {
  display: grid;
  gap: clamp(0.45rem, 1.4vw, 0.85rem);
  grid-template-columns: repeat(var(--board-size), minmax(4.8rem, 1fr));
  max-inline-size: min(47rem, 100%);
}

.mine-cell {
  min-inline-size: 0;
}

.mine-cell--hinted {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-success) / 44%));
}

.mine-cell--flagged {
  opacity: 0.92;
}

.cell-number {
  color: #17212b !important;
  font-size: clamp(2.2rem, min(7vw, 9vh), 4.2rem);
  font-weight: 900;
  line-height: 1;
}

@media (max-width: 720px) {
  .game-container {
    padding-block-start: 8.75rem;
  }

  .board-wrap {
    gap: 0.4rem;
    grid-template-columns: repeat(var(--board-size), minmax(3.6rem, 1fr));
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7rem;
  }
}

@media (min-height: 681px) and (max-height: 920px) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container p,
  .game-container .v-alert,
  .game-container h1,
  .game-container .d-flex.flex-column.flex-md-row {
    display: none !important;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container p,
  .game-container .v-alert {
    display: none;
  }

  .game-container .d-flex.flex-column.flex-md-row {
    display: none !important;
  }

  .game-container h1 {
    display: none;
  }

  .board-wrap {
    gap: 0.4rem;
    grid-template-columns: repeat(var(--board-size), minmax(0, 1fr));
    max-inline-size: min(100%, 47rem);
  }

  .mine-cell :deep(.dwell-button) {
    min-block-size: 5.625rem !important;
    padding: 0.35rem !important;
  }

  .hidden-cell,
  .flagged-cell,
  .revealed-cell {
    gap: 0.15rem;
  }

  .hidden-cell :deep(.v-icon),
  .flagged-cell :deep(.v-icon),
  .revealed-cell :deep(.v-icon) {
    font-size: 1.55rem !important;
  }

  .cell-number {
    font-size: 2.2rem;
  }
}
</style>
