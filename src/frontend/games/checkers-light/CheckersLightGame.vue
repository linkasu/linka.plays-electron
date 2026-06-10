<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import {
  applyCheckersLightMove,
  cellPosition,
  checkersLightSize,
  createInitialCheckersLightBoard,
  getMovablePieceIndexes,
  getMoveTargets,
  isDarkCell,
  type CheckersLightCell
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordSuccess, startSession } = useGameSession("checkers-light", {
  maxSteps: 10,
  dwellMs: 1300,
  sessionSeconds: 180,
  targetScale: 1.15
}, {
  finishOnMistakes: false
});

const board = ref(createInitialCheckersLightBoard());
const selectedIndex = ref<number>();
const rows = Array.from({ length: checkersLightSize }, (_, row) => row);
const columns = Array.from({ length: checkersLightSize }, (_, column) => column);

const moveTargets = computed(() => selectedIndex.value === undefined ? [] : getMoveTargets(board.value, selectedIndex.value));
const movablePieceIndexes = computed(() => getMovablePieceIndexes(board.value));
const resultVisible = computed(() => session.status === "finished");
const statusText = computed(() => selectedIndex.value === undefined
  ? "Выбери любую доступную шашку"
  : "Теперь выбери подсвеченную клетку");

function targetId(index: number) {
  return `checkers-light:cell:${index}`;
}

function pieceLabel(piece: CheckersLightCell) {
  if (!piece) return "";
  return piece.side === "gold" ? "Светлая шашка" : "Синяя шашка";
}

function isSelected(index: number) {
  return selectedIndex.value === index;
}

function isMoveTarget(index: number) {
  return moveTargets.value.includes(index);
}

function isMovablePiece(index: number) {
  return movablePieceIndexes.value.includes(index);
}

function cellColor(index: number, piece: CheckersLightCell) {
  if (isSelected(index)) return "primary";
  if (isMoveTarget(index)) return "success";
  if (piece) return "surface";
  return isDarkCell(index) ? "brown-lighten-5" : "blue-grey-lighten-5";
}

function selectCell(index: number) {
  if (session.status !== "running") return;

  const piece = board.value[index];
  if (selectedIndex.value === undefined) {
    if (piece && isMovablePiece(index)) selectedIndex.value = index;
    return;
  }

  if (isMoveTarget(index)) {
    moveSelectedPiece(index);
    return;
  }

  if (piece && isMovablePiece(index)) {
    selectedIndex.value = index;
    return;
  }

  selectedIndex.value = undefined;
}

function moveSelectedPiece(toIndex: number) {
  const fromIndex = selectedIndex.value;
  if (fromIndex === undefined) return;

  const piece = board.value[fromIndex];
  const nextBoard = applyCheckersLightMove(board.value, fromIndex, toIndex);
  if (!nextBoard || !piece) return;

  board.value = getMovablePieceIndexes(nextBoard).length ? nextBoard : createInitialCheckersLightBoard();
  selectedIndex.value = undefined;
  recordSuccess({
    pieceId: piece.id,
    side: piece.side,
    fromIndex,
    toIndex
  });
}

function restart() {
  board.value = createInitialCheckersLightBoard();
  selectedIndex.value = undefined;
  startSession();
  recordEvent("level-start", { board: "checkers-light" });
}
</script>

<template>
  <div class="checkers-shell">
    <GameHud title="Шашки light" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" md="10" lg="8" xl="6">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="10">
            <div class="text-overline text-secondary text-center mb-2">Спокойная стратегия 4×4</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">Шашки light</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">
              Выбери шашку, затем одну из подсвеченных клеток. Ошибок и проигрыша нет.
            </p>
            <v-chip class="d-flex mx-auto mb-5 status-chip" color="primary" size="large" variant="tonal">
              {{ statusText }}
            </v-chip>

            <div class="board mx-auto" role="grid" aria-label="Поле упрощённых шашек 4 на 4">
              <div v-for="row in rows" :key="row" class="board-row" role="row">
                <GameDwellButton
                  v-for="column in columns"
                  :key="column"
                  :class="['board-cell', { 'board-cell--dark': isDarkCell(row * checkersLightSize + column), 'board-cell--target': isMoveTarget(row * checkersLightSize + column), 'board-cell--selected': isSelected(row * checkersLightSize + column) }]"
                  :target-id="targetId(row * checkersLightSize + column)"
                  :disabled="session.status !== 'running'"
                  :dwell-ms="session.settings.dwellMs"
                  :min-height="118"
                  :color="cellColor(row * checkersLightSize + column, board[row * checkersLightSize + column])"
                  role="gridcell"
                  @select="selectCell(row * checkersLightSize + column)"
                >
                  <template #default>
                    <div class="cell-content">
                      <div v-if="board[row * checkersLightSize + column]" :class="['piece', `piece--${board[row * checkersLightSize + column]?.side}`]">
                        <v-icon icon="mdi-circle" size="58" />
                        <span class="piece-label">{{ pieceLabel(board[row * checkersLightSize + column]) }}</span>
                      </div>
                      <div v-else-if="isMoveTarget(row * checkersLightSize + column)" class="move-cue">
                        <v-icon icon="mdi-check" size="44" />
                        <span>ход</span>
                      </div>
                      <div v-else class="cell-coordinate text-caption text-medium-emphasis">
                        {{ cellPosition(row * checkersLightSize + column).row + 1 }}{{ cellPosition(row * checkersLightSize + column).column + 1 }}
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <v-alert class="mt-5 text-body-1" color="success" icon="mdi-checkerboard" rounded="xl" variant="tonal">
              Возможные ходы подсвечены зелёным. Можно спокойно сменить выбор или снять его взглядом с пустой клетки.
            </v-alert>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Шашки light" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.checkers-shell {
  background:
    radial-gradient(circle at 18% 18%, rgb(255 224 178 / 58%), transparent 30%),
    radial-gradient(circle at 82% 18%, rgb(187 222 251 / 48%), transparent 30%),
    linear-gradient(135deg, #fffaf1 0%, #edf7ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.status-chip {
  inline-size: fit-content;
}

.board {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 0.85rem);
  inline-size: min(100%, 34rem);
}

.board-row {
  display: grid;
  gap: clamp(0.5rem, 1.5vw, 0.85rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.board-cell :deep(.dwell-button) {
  border: 0.18rem solid rgb(var(--v-theme-outline-variant));
  padding: clamp(0.65rem, 2vw, 1rem) !important;
}

.board-cell--dark :deep(.dwell-button) {
  border-color: rgb(var(--v-theme-primary) / 34%);
}

.board-cell--target :deep(.dwell-button) {
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-success) / 20%);
}

.board-cell--selected :deep(.dwell-button) {
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-primary) / 28%);
}

.cell-content {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: clamp(4.5rem, 12vw, 6.5rem);
}

.piece,
.move-cue {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-weight: 800;
  gap: 0.25rem;
}

.piece--gold {
  color: #d38b00;
}

.piece--blue {
  color: #1976d2;
}

.piece-label {
  font-size: clamp(0.7rem, 1.8vw, 0.9rem);
  line-height: 1.1;
}

.move-cue {
  color: rgb(var(--v-theme-success));
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .cell-content {
    min-block-size: 3.8rem;
  }
}
</style>
