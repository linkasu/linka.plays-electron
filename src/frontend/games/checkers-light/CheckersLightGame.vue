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
  cellIndex,
  cellPosition,
  checkersLightSize,
  chooseCheckersLightAiMove,
  chooseCheckersLightCell,
  countCheckersLightPieces,
  createInitialCheckersLightState,
  encodeCheckersLightBoard,
  getLegalMoves,
  getMovablePieceIndexes,
  getMoveForTarget,
  getMoveTargets,
  isDarkCell,
  type CheckersLightCell,
  type CheckersLightMove,
  type CheckersLightPieceSide
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("checkers-light", {
  maxSteps: 999,
  overrides: { targetScale: 1.08, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "checkers-light", soundEnabled, warmAssetIds: ["checkers-light.prompt", "checkers-light.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const aiSearchDepth = 6;
const aiSearchTimeLimitMs = 1200;
const aiMoveDelayMs = 650;

const gameState = ref(createInitialCheckersLightState());
const aiThinking = ref(false);
const lastMove = ref<CheckersLightMove>();
const lastCapturedIndex = ref<number>();
const feedbackMessage = ref("Цель — оставить синего врага без ходов или без шашек. Если есть взятие, его нужно выполнить.");
let aiTimer = 0;
let aiRequestId = 0;

const rows = Array.from({ length: checkersLightSize }, (_, row) => row);
const columns = Array.from({ length: checkersLightSize }, (_, column) => column);
const board = computed(() => gameState.value.board);
const legalMoves = computed(() => getLegalMoves(gameState.value));
const moveTargets = computed(() => gameState.value.selectedIndex === undefined ? [] : getMoveTargets(gameState.value, gameState.value.selectedIndex));
const movablePieceIndexes = computed(() => getMovablePieceIndexes(gameState.value));
const counts = computed(() => countCheckersLightPieces(board.value));
const resultVisible = computed(() => session.status === "finished");
const statusText = computed(() => {
  if (gameState.value.status === "gold-win") return "Победа: у синего нет хода";
  if (gameState.value.status === "blue-win") return "Синий выиграл партию";
  if (aiThinking.value) return "Синий думает над ходом";
  if (gameState.value.turn === "blue") return "Синий ходит";
  if (gameState.value.forcedFromIndex !== undefined) return "Продолжи обязательное взятие";
  if (legalMoves.value.some((move) => move.capture)) return "Нужно выбрать шашку, которая бьёт";
  return gameState.value.selectedIndex === undefined ? "Выбери золотую шашку" : "Выбери подсвеченную клетку";
});

function targetId(index: number) {
  return `checkers-light:cell:${index}`;
}

function pieceLabel(piece: CheckersLightCell) {
  if (!piece) return "";
  const side = piece.side === "gold" ? "Золотая" : "Синяя";
  return piece.king ? `${side} дамка` : `${side} шашка`;
}

function isSelected(index: number) {
  return gameState.value.selectedIndex === index;
}

function isMoveTarget(index: number) {
  return moveTargets.value.includes(index);
}

function isMovablePiece(index: number) {
  return movablePieceIndexes.value.includes(index);
}

function cellColor(index: number, piece: CheckersLightCell) {
  if (isSelected(index)) return "secondary";
  if (isMoveTarget(index)) return "success";
  if (piece) return "surface";
  return isDarkCell(index) ? "brown-lighten-4" : "blue-grey-lighten-5";
}

function cellClasses(index: number) {
  return [
    "cell-content",
    {
      "cell-content--dark": isDarkCell(index),
      "cell-content--selected": isSelected(index),
      "cell-content--target": isMoveTarget(index),
      "cell-content--movable": isMovablePiece(index),
      "cell-content--last": lastMove.value?.fromIndex === index || lastMove.value?.toIndex === index,
      "cell-content--captured": lastCapturedIndex.value === index
    }
  ];
}

function finishIfNeeded(sideJustMoved: CheckersLightPieceSide) {
  if (gameState.value.status === "playing") return false;
  const goldWon = gameState.value.status === "gold-win";
  feedbackMessage.value = goldWon ? "Партия выиграна: у синего больше нет хода." : "Партия завершена: у золотых больше нет хода.";
  if (goldWon) void feedbackAudio.playSuccess();
  else void feedbackAudio.playMistake();
  promptAudio.play("checkers-light.complete", 120);
  finishSession(goldWon ? "game-complete" : sideJustMoved === "blue" ? "game-lost" : "game-complete");
  return true;
}

function applyMove(move: CheckersLightMove, actor: CheckersLightPieceSide, source: Record<string, unknown> = {}) {
  const result = applyCheckersLightMove(gameState.value, move.fromIndex, move.toIndex);
  if (!result || Array.isArray(result)) return false;
  gameState.value = result.state;
  lastMove.value = move;
  lastCapturedIndex.value = move.capturedIndex;
  const target = targetId(move.toIndex);
  if (actor === "gold") {
    recordSuccess({ targetId: target, side: actor, fromIndex: move.fromIndex, toIndex: move.toIndex, capture: move.capture, king: board.value[move.toIndex]?.king, isCorrect: true });
  } else {
    recordEvent("target-click", { targetId: target, side: actor, fromIndex: move.fromIndex, toIndex: move.toIndex, capture: move.capture, ...source });
  }

  if (result.mustContinue) {
    feedbackMessage.value = actor === "gold" ? "Есть продолжение взятия. Этой же шашкой нужно бить дальше." : "Синий продолжает цепочку взятия.";
    return true;
  }

  if (finishIfNeeded(actor)) return true;
  feedbackMessage.value = actor === "gold" ? "Ход принят. Синий отвечает." : "Синий сделал ход. Теперь ход золотых.";
  return true;
}

async function chooseNativeAiMove() {
  const nativeResult = await window.linkaAi?.checkersLightBestMove({
    board: encodeCheckersLightBoard(gameState.value.board),
    side: "blue",
    depth: aiSearchDepth,
    timeLimitMs: aiSearchTimeLimitMs,
    forcedFrom: gameState.value.forcedFromIndex ?? -1
  });
  const legal = getLegalMoves(gameState.value, "blue");
  if (nativeResult?.ok && typeof nativeResult.fromIndex === "number" && typeof nativeResult.toIndex === "number") {
    const move = legal.find((candidate) => candidate.fromIndex === nativeResult.fromIndex && candidate.toIndex === nativeResult.toIndex);
    if (move) return { move, source: { aiSource: nativeResult.source, aiDepth: nativeResult.depth, aiElapsedMs: nativeResult.elapsedMs } };
  }
  return { move: chooseCheckersLightAiMove(gameState.value, 5), source: { aiSource: "fallback" } };
}

async function applyAiTurn() {
  if (session.status !== "running" || gameState.value.turn !== "blue" || gameState.value.status !== "playing") return;
  const requestId = ++aiRequestId;
  aiThinking.value = true;
  const aiChoice = await chooseNativeAiMove();
  if (requestId !== aiRequestId) return;
  aiThinking.value = false;
  if (!aiChoice.move) {
    gameState.value = { ...gameState.value, status: "gold-win" };
    finishIfNeeded("gold");
    return;
  }
  applyMove(aiChoice.move, "blue", aiChoice.source);
  if (gameState.value.turn === "blue" && gameState.value.status === "playing") scheduleAiMove(350);
}

function scheduleAiMove(delayMs = aiMoveDelayMs) {
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => void applyAiTurn(), delayMs);
}

function selectCell(index: number) {
  if (session.status !== "running" || aiThinking.value || gameState.value.turn !== "gold") return;
  const result = chooseCheckersLightCell(gameState.value, index);
  if (result.event === "selected") {
    gameState.value = result.state;
    feedbackMessage.value = legalMoves.value.some((move) => move.capture) ? "Выбрана бьющая шашка. Выбери подсвеченную клетку взятия." : "Шашка выбрана. Выбери подсвеченную клетку.";
    return;
  }
  if (result.event === "invalid" || !result.result?.move) {
    const reason = gameState.value.forcedFromIndex !== undefined ? "must-continue-capture" : "invalid-checkers-move";
    feedbackMessage.value = gameState.value.forcedFromIndex !== undefined ? "Нужно продолжить взятие этой же шашкой." : "Выбери доступную золотую шашку или подсвеченную клетку.";
    recordMistake({ targetId: targetId(index), reason, isCorrect: false });
    void feedbackAudio.playMistake();
    return;
  }

  gameState.value = result.state;
  lastMove.value = result.result.move;
  lastCapturedIndex.value = result.result.move.capturedIndex;
  recordSuccess({ targetId: targetId(index), side: "gold", fromIndex: result.result.move.fromIndex, toIndex: result.result.move.toIndex, capture: result.result.move.capture, king: board.value[index]?.king, isCorrect: true });
  void feedbackAudio.playSuccess();
  if (result.result.mustContinue) {
    feedbackMessage.value = "Есть ещё одно взятие. Продолжи этой же шашкой.";
    return;
  }
  if (!finishIfNeeded("gold")) scheduleAiMove();
}

function restart() {
  promptAudio.cancelPending();
  window.clearTimeout(aiTimer);
  aiRequestId += 1;
  gameState.value = createInitialCheckersLightState();
  aiThinking.value = false;
  lastMove.value = undefined;
  lastCapturedIndex.value = undefined;
  feedbackMessage.value = "Новая партия готова. Золотые ходят первыми. Взятие обязательно.";
  startSession();
  promptAudio.play("checkers-light.prompt", 220);
  recordEvent("level-start", { board: "checkers-light-full" });
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("checkers-light.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  window.clearTimeout(aiTimer);
  aiRequestId += 1;
});
</script>

<template>
  <div class="checkers-shell">
    <GameHud title="Шашки" :step="gameState.moveCount" :max-steps="session.maxSteps" :score="counts.gold" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" :show-progress="false" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="game-card pa-4 pa-md-5" rounded="xl" elevation="10">
            <div class="game-header d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-3 mb-4">
              <div>
                <div class="text-overline text-secondary mb-1">Русские шашки 8×8</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-1">Шашки</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Ходи золотыми шашками. Взятие обязательно, дамки ходят по диагонали на дальние клетки.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="amber" size="large" variant="tonal">Золотые: {{ counts.gold }}</v-chip>
                <v-chip color="blue" size="large" variant="tonal">Синие: {{ counts.blue }}</v-chip>
                <v-chip :color="gameState.turn === 'gold' ? 'primary' : 'secondary'" size="large" variant="flat">{{ statusText }}</v-chip>
              </div>
            </div>

            <v-alert class="feedback-alert mb-4 text-body-1 font-weight-medium" color="primary" icon="mdi-checkerboard" rounded="xl" role="status" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <div class="board mx-auto" role="grid" aria-label="Поле русских шашек восемь на восемь">
              <template v-for="row in rows" :key="row">
                <GameDwellButton
                  v-for="column in columns"
                  :key="`${row}-${column}`"
                  :class="['board-cell', { 'board-cell--dark': isDarkCell(cellIndex(row, column)) }]"
                  :target-id="targetId(cellIndex(row, column))"
                  :disabled="session.status !== 'running' || aiThinking || gameState.status !== 'playing'"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(3rem, 8vh, 5rem)"
                  :color="cellColor(cellIndex(row, column), board[cellIndex(row, column)])"
                  role="gridcell"
                  @select="selectCell(cellIndex(row, column))"
                >
                  <template #default>
                    <div :class="cellClasses(cellIndex(row, column))">
                      <div v-if="board[cellIndex(row, column)]" :class="['piece', `piece--${board[cellIndex(row, column)]?.side}`, { 'piece--king': board[cellIndex(row, column)]?.king }]">
                        <v-icon :icon="board[cellIndex(row, column)]?.king ? 'mdi-crown-circle' : 'mdi-circle'" />
                        <span class="piece-label">{{ board[cellIndex(row, column)]?.king ? 'дамка' : pieceLabel(board[cellIndex(row, column)]).split(' ')[1] }}</span>
                      </div>
                      <div v-else-if="isMoveTarget(cellIndex(row, column))" class="move-cue">
                        <v-icon :icon="getMoveForTarget(gameState, gameState.selectedIndex ?? -1, cellIndex(row, column))?.capture ? 'mdi-close-circle' : 'mdi-check-circle'" />
                      </div>
                      <div v-else-if="!isDarkCell(cellIndex(row, column))" class="light-cell" />
                      <div v-else class="cell-coordinate text-caption">
                        {{ cellPosition(cellIndex(row, column)).row + 1 }}{{ cellPosition(cellIndex(row, column)).column + 1 }}
                      </div>
                    </div>
                  </template>
                </GameDwellButton>
              </template>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Шашки" :score="counts.gold" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
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
  padding-block-start: 7rem;
}

.game-card {
  margin-inline: auto;
}

.board {
  display: grid;
  gap: clamp(0.22rem, 0.55vw, 0.45rem);
  grid-template-columns: repeat(8, minmax(0, 1fr));
  inline-size: min(94vw, 42rem, 68vh);
}

.board-cell :deep(.dwell-button) {
  border: 0.12rem solid rgb(var(--v-theme-outline-variant));
  padding: clamp(0.18rem, 0.55vw, 0.45rem) !important;
}

.board-cell--dark :deep(.dwell-button) {
  border-color: rgb(var(--v-theme-primary) / 34%);
}

.cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 0.95rem;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: clamp(2.6rem, 6.3vh, 4.1rem);
  position: relative;
}

.cell-content--selected {
  outline: 0.22rem solid rgb(var(--v-theme-secondary) / 64%);
  outline-offset: -0.28rem;
}

.cell-content--target {
  box-shadow: inset 0 0 0 0.22rem rgb(var(--v-theme-success) / 38%);
}

.cell-content--movable::after {
  background: rgb(var(--v-theme-primary));
  block-size: 0.5rem;
  border-radius: 999rem;
  content: "";
  inline-size: 0.5rem;
  inset-block-start: 0.35rem;
  inset-inline-end: 0.35rem;
  position: absolute;
}

.cell-content--last {
  outline: 0.2rem dashed rgb(var(--v-theme-primary) / 48%);
  outline-offset: -0.25rem;
}

.cell-content--captured {
  background: rgb(var(--v-theme-error) / 12%);
}

.piece,
.move-cue {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-weight: 800;
  gap: 0.1rem;
}

.piece :deep(.v-icon),
.move-cue :deep(.v-icon) {
  font-size: clamp(2rem, 4.8vw, 3.35rem);
}

.piece--gold {
  color: #d38b00;
}

.piece--blue {
  color: #1976d2;
}

.piece--king {
  filter: drop-shadow(0 0 0.45rem rgb(255 193 7 / 42%));
}

.piece-label {
  color: #17212b !important;
  font-size: clamp(0.58rem, 1.25vw, 0.78rem);
  line-height: 1;
}

.move-cue {
  color: #0d2a17;
}

.cell-coordinate {
  color: #17212b !important;
  opacity: 0.52;
}

.light-cell {
  opacity: 0.24;
}

@media (max-height: 68rem) {
 .game-container {
    padding-block-start: 4.5rem;
  }

 .game-card {
    padding-block: 1rem !important;
  }

 .game-header {
    margin-block-end: 0.8rem !important;
  }

 .game-header .text-overline,
 .game-header p,
 .feedback-alert,
 .game-card .v-btn {
    display: none !important;
  }

 .board {
    inline-size: min(94vw, 39rem, 70vh);
  }
}

@media (max-height: 42.5rem) {
 .game-container {
    padding-block-start: 4.25rem;
  }

 .game-header {
    display: none !important;
  }

 .board {
    gap: 0.18rem;
    inline-size: min(94vw, 29rem, 58vh);
  }

 .board-cell :deep(.dwell-button) {
    min-block-size: 2.65rem !important;
    padding: 0.2rem !important;
  }

 .cell-content {
    min-block-size: 2.35rem;
  }

 .piece-label,
 .cell-coordinate {
    display: none;
  }

 .piece :deep(.v-icon),
 .move-cue :deep(.v-icon) {
    font-size: 1.95rem;
  }
}
</style>
