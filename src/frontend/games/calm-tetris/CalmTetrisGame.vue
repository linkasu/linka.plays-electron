<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWasdPanel, { type GameWasdControl } from "../../components/game/GameWasdPanel.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import {
  calmTetrisColumns,
  calmTetrisPieceIds,
  calmTetrisRows,
  calmTetrisSpawnOutcome,
  cellIndex,
  createEmptyBoard,
  createPiece,
  createSpawnPlacement,
  getGhostPlacement,
  isValidPlacement,
  lockPiece,
  movePlacement,
  placementCells,
  rotatePlacement,
  type CalmTetrisBoard,
  type CalmTetrisCell,
  type CalmTetrisPieceId,
  type CalmTetrisPlacement
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSession("calm-tetris", {
  maxSteps: 24,
  dwellMs: 1100,
  sessionSeconds: 180,
  targetScale: 1.25
}, {
  finishOnMistakes: false
});

const pieceSequence: CalmTetrisPieceId[] = ["o", "t", "i", "l", "s", "t", "o", "l", "s", "i"];
const rows = Array.from({ length: calmTetrisRows }, (_, row) => row);
const columns = Array.from({ length: calmTetrisColumns }, (_, column) => column);
const pieceColors = Object.fromEntries(calmTetrisPieceIds.map((id) => [id, createPiece(id).color])) as Record<CalmTetrisPieceId, string>;

const board = ref<CalmTetrisBoard>(createEmptyBoard());
const pieceIndex = ref(0);
const currentPlacement = ref(createSpawnPlacement(createPiece(pieceSequence[0])));
const feedbackMessage = ref("Выбери колонку шагами, поверни фигуру и спокойно поставь её вниз.");
const resultVisible = computed(() => session.status === "finished");
const ghostPlacement = computed(() => getGhostPlacement(board.value, currentPlacement.value));
const canPlay = computed(() => session.status === "running");
const canMoveLeft = computed(() => canPlay.value && isValidPlacement(board.value, movePlacement(currentPlacement.value, 0, -1)));
const canMoveRight = computed(() => canPlay.value && isValidPlacement(board.value, movePlacement(currentPlacement.value, 0, 1)));
const validRotation = computed(() => findValidRotation(currentPlacement.value));
const canRotate = computed(() => canPlay.value && Boolean(validRotation.value));
const canDrop = computed(() => canPlay.value && Boolean(ghostPlacement.value));
const currentColumnLabel = computed(() => currentPlacement.value.column + 1);
const actionButtons = computed<GameWasdControl[]>(() => [
  { id: "rotate", key: "w", label: "Повернуть", icon: "mdi-rotate-right", targetId: cellTargetId("rotate"), disabled: !canRotate.value, color: "secondary" },
  { id: "left", key: "a", label: "Влево", icon: "mdi-arrow-left-bold", targetId: cellTargetId("left"), disabled: !canMoveLeft.value, color: "surface" },
  { id: "drop", key: "s", label: "Поставить", icon: "mdi-arrow-down-bold-box", targetId: cellTargetId("drop"), disabled: !canDrop.value, color: "primary" },
  { id: "right", key: "d", label: "Вправо", icon: "mdi-arrow-right-bold", targetId: cellTargetId("right"), disabled: !canMoveRight.value, color: "surface" }
]);

function cellTargetId(action: string) {
  return `calm-tetris:${action}`;
}

function cellKey(row: number, column: number) {
  return `${row}:${column}`;
}

const currentCellKeys = computed(() => new Set(placementCells(currentPlacement.value).map((cell) => cellKey(cell.row, cell.column))));
const ghostCellKeys = computed(() => new Set((ghostPlacement.value ? placementCells(ghostPlacement.value) : []).map((cell) => cellKey(cell.row, cell.column))));

function lockedCell(row: number, column: number) {
  return board.value[cellIndex(row, column)];
}

function cellClasses(row: number, column: number) {
  const locked = lockedCell(row, column);
  const key = cellKey(row, column);
  return {
    "board-cell--locked": Boolean(locked),
    "board-cell--current": currentCellKeys.value.has(key),
    "board-cell--ghost": !currentCellKeys.value.has(key) && ghostCellKeys.value.has(key)
  };
}

function cellStyle(row: number, column: number) {
  const locked = lockedCell(row, column);
  const key = cellKey(row, column);
  const color = currentCellKeys.value.has(key) || ghostCellKeys.value.has(key)
    ? currentPlacement.value.piece.color
    : locked
      ? pieceColors[locked]
      : "transparent";
  return { "--cell-color": color };
}

function findValidRotation(placement: CalmTetrisPlacement) {
  const rotated = rotatePlacement(placement);
  for (const columnOffset of [0, -1, 1, -2, 2]) {
    const next = movePlacement(rotated, 0, columnOffset);
    if (isValidPlacement(board.value, next)) return next;
  }
  return undefined;
}

function setCurrentPlacement(nextPlacement: CalmTetrisPlacement, message: string) {
  currentPlacement.value = nextPlacement;
  feedbackMessage.value = message;
}

function moveCurrent(columnOffset: number) {
  if (!canPlay.value) return;
  const nextPlacement = movePlacement(currentPlacement.value, 0, columnOffset);
  if (!isValidPlacement(board.value, nextPlacement)) return;
  setCurrentPlacement(nextPlacement, columnOffset < 0 ? "Фигура сдвинулась влево." : "Фигура сдвинулась вправо.");
}

function rotateCurrent() {
  if (!canPlay.value || !validRotation.value) return;
  setCurrentPlacement(validRotation.value, "Фигура повернулась. Можно ещё подвигать или поставить.");
}

function nextPiece() {
  pieceIndex.value += 1;
  const piece = createPiece(pieceSequence[pieceIndex.value % pieceSequence.length]);
  const placement = createSpawnPlacement(piece);

  if (calmTetrisSpawnOutcome(board.value, piece) === "playing") {
    currentPlacement.value = placement;
    return;
  }

  currentPlacement.value = placement;
  feedbackMessage.value = "Наверху нет места для новой фигуры. Это top-out: партия проиграна.";
  recordMistake({ kind: "top-out", piece: piece.id, isCorrect: false });
  finishSession("game-lost");
}

function dropCurrent() {
  if (!canPlay.value || !ghostPlacement.value) return;
  const result = lockPiece(board.value, ghostPlacement.value);
  if (!result) return;

  board.value = result.board;
  recordSuccess({ piece: currentPlacement.value.piece.id, clearedLines: result.clearedLines });
  recordEvent("level-start", { kind: "piece-locked", piece: currentPlacement.value.piece.id, clearedLines: result.clearedLines });
  feedbackMessage.value = result.clearedLines > 0
    ? `Линии мягко исчезли: ${result.clearedLines}.`
    : "Фигура спокойно легла на место.";

  if (session.status === "running") nextPiece();
}

function chooseAction(control: GameWasdControl) {
  if (control.id === "left") moveCurrent(-1);
  if (control.id === "right") moveCurrent(1);
  if (control.id === "rotate") rotateCurrent();
  if (control.id === "drop") dropCurrent();
}

function restart() {
  board.value = createEmptyBoard();
  pieceIndex.value = 0;
  currentPlacement.value = createSpawnPlacement(createPiece(pieceSequence[0]));
  feedbackMessage.value = "Выбери колонку шагами, поверни фигуру и спокойно поставь её вниз.";
  startSession();
}
</script>

<template>
  <div class="calm-tetris-shell">
    <GameHud title="Тетрис спокойный" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="game-card pa-4 pa-md-6" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Пошаговая стратегия без таймера падения</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Тетрис спокойный</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Двигай фигуру по одному шагу. Пунктир показывает, куда она мягко опустится.</p>
              </div>
              <v-chip color="primary" size="large" variant="tonal">
                Колонка {{ currentColumnLabel }} · {{ currentPlacement.piece.label }}
              </v-chip>
            </div>

            <v-row align="stretch" class="ga-2" no-gutters>
              <v-col cols="12" lg="7" class="order-2 order-lg-1 pe-lg-5">
                <div class="board mx-auto" role="grid" aria-label="Поле спокойного тетриса">
                  <div v-for="row in rows" :key="row" class="board-row" role="row">
                    <div
                      v-for="column in columns"
                      :key="column"
                      :class="['board-cell', cellClasses(row, column)]"
                      :style="cellStyle(row, column)"
                      role="gridcell"
                    />
                  </div>
                </div>
              </v-col>

              <v-col cols="12" lg="5" class="order-1 order-lg-2">
                <v-card class="side-panel pa-4 pa-md-5 h-100" color="indigo-lighten-5" rounded="xl" variant="flat">
                  <div class="text-body-1 text-medium-emphasis mb-4">{{ feedbackMessage }}</div>
                  <GameWasdPanel :controls="actionButtons" :dwell-ms="session.settings.dwellMs" aria-label="WASD управление тетрисом" @select="chooseAction">
                    <template #control="{ control }">
                      <div class="control-content">
                        <span class="control-key">{{ control.key.toUpperCase() }}</span>
                        <v-icon :icon="control.icon" size="38" />
                        <span>{{ control.label }}</span>
                      </div>
                    </template>
                  </GameWasdPanel>
                </v-card>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Тетрис спокойный" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calm-tetris-shell {
  background:
    radial-gradient(circle at 18% 18%, rgb(178 223 219 / 58%), transparent 26%),
    radial-gradient(circle at 86% 20%, rgb(209 196 233 / 56%), transparent 28%),
    linear-gradient(135deg, #f9fbf2 0%, #eef5ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 112px;
}

.game-card {
  margin-inline: auto;
}

.board {
  background: rgb(var(--v-theme-surface) / 78%);
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 24px;
  display: grid;
  gap: 5px;
  inline-size: min(100%, 620px);
  padding: clamp(10px, 2vw, 18px);
}

.board-row {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(10, minmax(0, 1fr));
}

.board-cell {
  aspect-ratio: 1;
  background: rgb(var(--v-theme-surface-variant) / 38%);
  border: 2px solid transparent;
  border-radius: clamp(8px, 1.3vw, 15px);
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-outline-variant) / 40%);
}

.board-cell--locked,
.board-cell--current {
  background: var(--cell-color);
  box-shadow: inset 0 -7px 10px rgb(0 0 0 / 13%), 0 4px 10px rgb(56 70 90 / 12%);
}

.board-cell--current {
  outline: 3px solid rgb(var(--v-theme-primary) / 32%);
}

.board-cell--ghost {
  background: rgb(var(--v-theme-surface) / 46%);
  border-color: var(--cell-color);
  border-style: dashed;
}

.side-panel {
  min-block-size: 100%;
}

.controls-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.control-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  font-weight: 800;
  gap: 8px;
  justify-content: center;
}

.control-key {
  border: 0.1em solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 0.65em;
  color: rgb(var(--v-theme-primary));
  font-size: 0.78em;
  line-height: 1;
  min-inline-size: 1.9em;
  padding: 0.32em 0.5em;
}

@media (max-width: 720px) {
  .game-container {
    padding-block-start: 140px;
  }

  .controls-grid {
    grid-template-columns: 1fr;
  }
}
</style>
