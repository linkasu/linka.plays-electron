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
import {
  applyCheckersLightMove,
  cellPosition,
  checkersLightSize,
  checkersLightOutcome,
  createInitialCheckersLightBoard,
  getMovablePieceIndexes,
  getMoveTargets,
  isDarkCell,
  type CheckersLightCell
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("checkers-light", {
  maxSteps: 10,
  overrides: { targetScale: 1.15, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "checkers-light", soundEnabled, warmAssetIds: ["checkers-light.prompt", "checkers-light.correct", "checkers-light.mistake", "checkers-light.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const board = ref(createInitialCheckersLightBoard());
const selectedIndex = ref<number>();
const isSpeaking = ref(false);
const feedbackMessage = ref("Выбери шашку, затем одну из отмеченных клеток. Если ходов не осталось, раунд завершится.");
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

async function playMistakeFeedback(targetId: string, reason: string) {
  recordMistake({ targetId, reason, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["checkers-light.mistake"], 80);
  isSpeaking.value = false;
}

async function selectCell(index: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const piece = board.value[index];
  if (selectedIndex.value === undefined) {
    if (piece && isMovablePiece(index)) {
      selectedIndex.value = index;
      feedbackMessage.value = "Шашка выбрана. Теперь выбери отмеченную клетку для хода.";
      return;
    }
    feedbackMessage.value = "Эта клетка сейчас не выбирается. Найди шашку, у которой есть ход.";
    await playMistakeFeedback(targetId(index), "not-movable-piece");
    return;
  }

  if (isMoveTarget(index)) {
    await moveSelectedPiece(index);
    return;
  }

  if (piece && isMovablePiece(index)) {
    selectedIndex.value = index;
    feedbackMessage.value = "Выбрана другая шашка. Теперь выбери отмеченную клетку.";
    return;
  }

  feedbackMessage.value = "Эта клетка не подходит для выбранной шашки. Можно выбрать отмеченное место или другую шашку.";
  await playMistakeFeedback(targetId(index), "invalid-checkers-target");
}

async function moveSelectedPiece(toIndex: number) {
  const fromIndex = selectedIndex.value;
  if (fromIndex === undefined) return;

  const piece = board.value[fromIndex];
  const nextBoard = applyCheckersLightMove(board.value, fromIndex, toIndex);
  if (!nextBoard || !piece) return;

  board.value = nextBoard;
  selectedIndex.value = undefined;
  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  recordSuccess({
    pieceId: piece.id,
    side: piece.side,
    fromIndex,
    toIndex
  });

  if (checkersLightOutcome(nextBoard) === "loss") {
    feedbackMessage.value = "Ходов больше нет. Раунд завершён, можно начать снова.";
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(["checkers-light.correct", "checkers-light.complete"], 80, 170);
    finishSession("game-lost");
    isSpeaking.value = false;
    return;
  }

  feedbackMessage.value = "Ход засчитан. Можно выбрать следующую доступную шашку.";
  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["checkers-light.correct", "checkers-light.complete"] : ["checkers-light.correct"], 80, 170);
  if (finishedAfterSuccess) {
    finishSession("game-complete");
  }
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  board.value = createInitialCheckersLightBoard();
  selectedIndex.value = undefined;
  isSpeaking.value = false;
  feedbackMessage.value = "Новая доска готова. Выбирай шашку без спешки.";
  startSession();
  promptAudio.play("checkers-light.prompt", 220);
  recordEvent("level-start", { board: "checkers-light" });
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("checkers-light.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
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
              Выбери шашку, затем одну из отмеченных клеток. Если ходов не осталось, раунд завершится.
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
                  :disabled="session.status !== 'running' || isSpeaking"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(4.5rem, 9vh, 8.5rem)"
                  :color="cellColor(row * checkersLightSize + column, board[row * checkersLightSize + column])"
                  role="gridcell"
                  @select="selectCell(row * checkersLightSize + column)"
                >
                  <template #default>
                    <div class="cell-content">
                      <div v-if="board[row * checkersLightSize + column]" :class="['piece', `piece--${board[row * checkersLightSize + column]?.side}`]">
                        <v-icon icon="mdi-circle" size="3.625rem" />
                        <span class="piece-label">{{ pieceLabel(board[row * checkersLightSize + column]) }}</span>
                      </div>
                      <div v-else-if="isMoveTarget(row * checkersLightSize + column)" class="move-cue">
                        <v-icon icon="mdi-check" size="2.75rem" />
                        <span>ход</span>
                      </div>
                      <div v-else class="cell-coordinate text-caption">
                        {{ cellPosition(row * checkersLightSize + column).row + 1 }}{{ cellPosition(row * checkersLightSize + column).column + 1 }}
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <v-alert class="mt-5 text-body-1" color="success" icon="mdi-checkerboard" rounded="xl" role="status" variant="tonal">
              {{ feedbackMessage }}
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
  gap: clamp(0.4rem, 1.2vw, 0.75rem);
  inline-size: min(100%, 37rem);
}

.board-row {
  display: grid;
  gap: clamp(0.4rem, 1.2vw, 0.75rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.board-cell :deep(.dwell-button) {
  border: 0.18rem solid rgb(var(--v-theme-outline-variant));
  padding: clamp(0.35rem, 1.2vw, 0.75rem) !important;
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
  min-block-size: clamp(3.25rem, 7.5vh, 5.5rem);
}

.cell-coordinate {
  color: #17212b !important;
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
  color: #17212b !important;
  font-size: clamp(0.7rem, 1.8vw, 0.9rem);
  line-height: 1.1;
}

.board-cell--selected :deep(.piece-label),
.board-cell--selected .cell-coordinate,
.board-cell--selected :deep(.move-cue) {
  color: #ffffff !important;
}

.board-cell--target :deep(.piece-label),
.board-cell--target .cell-coordinate,
.board-cell--target :deep(.move-cue) {
  color: #0d2a17 !important;
}

.move-cue {
  color: #17212b;
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .cell-content {
    min-block-size: 3.8rem;
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
  .game-container .v-alert {
    display: none;
  }

  .status-chip {
    margin-block-end: 0.75rem !important;
  }

  .board {
    gap: 0.45rem;
    inline-size: min(100%, 37rem);
  }

  .board-row {
    gap: 0.45rem;
  }

  .board-cell :deep(.dwell-button) {
    min-block-size: 5.625rem !important;
    padding: 0.35rem !important;
  }

  .cell-content {
    min-block-size: 4.5rem;
  }
}
</style>
