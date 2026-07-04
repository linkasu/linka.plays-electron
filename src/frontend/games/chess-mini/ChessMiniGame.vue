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
import { boardCells, chessInitialFen, chessPieceMeta, fenSideToMove, isWhitePiece, pieceSide, squareLabel, statusLabel, type ChessPiece, type ChessStatus } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("chess-mini", {
  maxSteps: 80,
  overrides: { targetScale: 1.1, sound: true, sessionSeconds: 86400 },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});

const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "chess-mini", soundEnabled, warmAssetIds: ["chess-mini.prompt", "chess-mini.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const fen = ref(chessInitialFen);
const legalMoves = ref<ChessMiniMove[]>([]);
const selectedIndex = ref<number>();
const wrongTarget = ref<number>();
const lastMove = ref<{ fromIndex: number; toIndex: number }>();
const pending = ref(false);
const status = ref<ChessStatus>("playing");
const check = ref(false);
const feedbackMessage = ref("Ты играешь белыми. Выбери белую фигуру, затем клетку для хода.");
let feedbackTimer = 0;

const cells = computed(() => boardCells(fen.value));
const sideToMove = computed(() => fenSideToMove(fen.value));
const selectedMoves = computed(() => selectedIndex.value === undefined ? [] : legalMoves.value.filter((move) => move.fromIndex === selectedIndex.value));
const movableFrom = computed(() => new Set(legalMoves.value.map((move) => move.fromIndex)));
const selectedTargets = computed(() => new Set(selectedMoves.value.map((move) => move.toIndex)));
const resultVisible = computed(() => session.status === "finished");
const statusText = computed(() => {
  if (pending.value && sideToMove.value === "black") return "Чёрные думают";
  if (pending.value) return "Проверяю ход";
  if (status.value !== "playing") return statusLabel(status.value, check.value);
  return sideToMove.value === "white" ? "Ход белых" : "Ход чёрных";
});

function targetId(index: number) {
  return `chess-mini:cell:${index}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearWrongMark() {
  wrongTarget.value = undefined;
}

function isPlayerPiece(piece: ChessPiece) {
  return isWhitePiece(piece);
}

function describeSelectedPiece(index: number, piece: ChessPiece) {
  const moves = legalMoves.value.filter((move) => move.fromIndex === index).length;
  if (moves > 0) return `${pieceLabel(piece)} ${squareLabel(index)} выбрана. Теперь выбери подсвеченную клетку.`;
  return `${pieceLabel(piece)} ${squareLabel(index)} выбрана, но сейчас у этой фигуры нет хода. Можно выбрать другую белую фигуру.`;
}

function pieceIcon(piece: ChessPiece) {
  return piece === "." ? undefined : chessPieceMeta[piece].icon;
}

function pieceLabel(piece: ChessPiece) {
  return piece === "." ? "Пустая клетка" : chessPieceMeta[piece].label;
}

function cellColor(index: number, piece: ChessPiece) {
  if (wrongTarget.value === index) return "orange-lighten-4";
  if (selectedIndex.value === index) return "amber-lighten-3";
  if (selectedTargets.value.has(index)) return "green-lighten-4";
  if (lastMove.value?.fromIndex === index || lastMove.value?.toIndex === index) return "cyan-lighten-5";
  if (isPlayerPiece(piece) && movableFrom.value.has(index)) return "amber-lighten-5";
  if (isPlayerPiece(piece)) return "brown-lighten-5";
  return (Math.floor(index / 8) + index % 8) % 2 === 0 ? "brown-lighten-5" : "blue-grey-lighten-5";
}

function cellClasses(index: number, piece: ChessPiece) {
  return {
    "piece-white": pieceSide(piece) === "white",
    "piece-black": pieceSide(piece) === "black",
    "cell-target": selectedTargets.value.has(index),
    "cell-selected": selectedIndex.value === index
  };
}

function applyNativeResult(result: ChessMiniAiResult) {
  if (!result.ok || !result.fen || !result.status) return false;
  fen.value = result.fen;
  legalMoves.value = result.moves ?? [];
  status.value = result.status;
  check.value = Boolean(result.check);
  if (result.fromIndex !== undefined && result.toIndex !== undefined && result.fromIndex >= 0 && result.toIndex >= 0) lastMove.value = { fromIndex: result.fromIndex, toIndex: result.toIndex };
  selectedIndex.value = undefined;
  return true;
}

function finishIfNeeded() {
  if (status.value === "playing") return false;
  feedbackMessage.value = statusLabel(status.value, check.value);
  if (status.value === "white-win") finishSession("game-complete");
  else if (status.value === "black-win") finishSession("game-lost");
  else finishSession("game-draw");
  promptAudio.play("chess-mini.complete", 180);
  return true;
}

async function loadLegalMoves() {
  if (!window.linkaAi?.chessMiniLegalMoves) {
    feedbackMessage.value = "Шахматный движок недоступен. Открой игру в Electron.";
    return;
  }

  pending.value = true;
  const result = await window.linkaAi.chessMiniLegalMoves({ fen: fen.value });
  if (!applyNativeResult(result)) feedbackMessage.value = "Не удалось получить ходы от шахматного движка.";
  pending.value = false;
}

async function makeAiMove() {
  if (status.value !== "playing" || sideToMove.value !== "black" || !window.linkaAi?.chessMiniBestMove) return;
  pending.value = true;
  feedbackMessage.value = "Чёрные думают над ответом.";
  const result = await window.linkaAi.chessMiniBestMove({ fen: fen.value, depth: 16, timeLimitMs: 5000 });
  if (applyNativeResult(result)) {
    feedbackMessage.value = check.value ? "Чёрные сходили. У белого короля шах." : "Чёрные сходили. Теперь ход белых.";
    finishIfNeeded();
  } else {
    feedbackMessage.value = "Чёрные не смогли сделать ход. Можно начать заново.";
  }
  pending.value = false;
}

async function applyPlayerMove(move: ChessMiniMove) {
  if (!window.linkaAi?.chessMiniApplyMove) return;
  pending.value = true;
  const result = await window.linkaAi.chessMiniApplyMove({ fen: fen.value, fromIndex: move.fromIndex, toIndex: move.toIndex, promotion: move.promotion ?? "q" });
  if (!applyNativeResult(result)) {
    feedbackMessage.value = "Этот ход не проходит по правилам. Выбери другой ход.";
    wrongTarget.value = move.toIndex;
    recordMistake({ targetId: targetId(move.toIndex), from: move.fromIndex, to: move.toIndex, isCorrect: false });
    void feedbackAudio.playMistake();
    feedbackTimer = window.setTimeout(clearWrongMark, 1400);
    pending.value = false;
    return;
  }

  recordSuccess({ targetId: targetId(move.toIndex), from: move.fromIndex, to: move.toIndex, isCorrect: true });
  void feedbackAudio.playSuccess();
  feedbackMessage.value = check.value ? "Ход принят. Чёрному королю шах." : "Ход принят.";
  if (finishIfNeeded()) {
    pending.value = false;
    return;
  }
  pending.value = false;
  await makeAiMove();
}

async function chooseCell(index: number) {
  if (session.status !== "running" || pending.value || sideToMove.value !== "white" || status.value !== "playing") return;
  clearFeedbackTimer();
  clearWrongMark();

  const cell = cells.value[index];
  if (selectedIndex.value === undefined) {
    if (isPlayerPiece(cell.piece)) {
      selectedIndex.value = index;
      feedbackMessage.value = describeSelectedPiece(index, cell.piece);
      return;
    }
    wrongTarget.value = index;
    feedbackMessage.value = "Выбери белую фигуру, у которой есть ход.";
    recordMistake({ targetId: targetId(index), selected: index, isCorrect: false });
    void feedbackAudio.playMistake();
    feedbackTimer = window.setTimeout(clearWrongMark, 1400);
    return;
  }

  if (selectedIndex.value === index) {
    selectedIndex.value = undefined;
    feedbackMessage.value = "Выбор снят. Выбери белую фигуру.";
    return;
  }

  const move = selectedMoves.value.find((candidate) => candidate.toIndex === index);
  if (!move) {
    if (isPlayerPiece(cell.piece)) {
      selectedIndex.value = index;
      feedbackMessage.value = describeSelectedPiece(index, cell.piece);
      return;
    }
    wrongTarget.value = index;
    feedbackMessage.value = "Так ходить нельзя. Выбери одну из зелёных клеток.";
    recordMistake({ targetId: targetId(index), from: selectedIndex.value, selected: index, isCorrect: false });
    void feedbackAudio.playMistake();
    feedbackTimer = window.setTimeout(clearWrongMark, 1400);
    return;
  }

  await applyPlayerMove(move);
}

function restart() {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  fen.value = chessInitialFen;
  legalMoves.value = [];
  selectedIndex.value = undefined;
  wrongTarget.value = undefined;
  lastMove.value = undefined;
  pending.value = false;
  status.value = "playing";
  check.value = false;
  feedbackMessage.value = "Ты играешь белыми. Выбери белую фигуру, затем клетку для хода.";
  startSession();
  promptAudio.play("chess-mini.prompt", 220);
  void loadLegalMoves();
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("chess-mini.prompt", 420);
  void loadLegalMoves();
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="chess-shell">
    <GameHud title="Шахматы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :paused="session.status === 'paused'" :show-progress="false" :show-timer="false" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="11">
          <v-card class="game-card pa-3 pa-md-4" color="rgba(255, 255, 255, 0.95)" rounded="xl" elevation="10">
            <div class="game-layout">
              <section class="board-section" aria-label="Шахматная доска">
                <div class="board-grid" role="grid" aria-label="Шахматная доска восемь на восемь">
                  <GameDwellButton
                    v-for="cell in cells"
                    :key="`${fen}-${cell.index}`"
                    :target-id="targetId(cell.index)"
                    :disabled="session.status !== 'running' || pending || sideToMove !== 'white' || status !== 'playing'"
                    :dwell-ms="session.settings.dwellMs"
                    min-height="clamp(2rem, 5.8dvh, 4.25rem)"
                    :color="cellColor(cell.index, cell.piece)"
                    @select="chooseCell(cell.index)"
                  >
                    <template #default>
                      <div class="cell-content" :class="cellClasses(cell.index, cell.piece)">
                        <div class="cell-label">{{ cell.label }}</div>
                        <v-icon v-if="pieceIcon(cell.piece)" :icon="pieceIcon(cell.piece)" class="piece-icon" size="clamp(1.75rem, 4.8dvh, 3.6rem)" />
                        <v-icon v-else-if="selectedTargets.has(cell.index)" icon="mdi-circle-outline" class="target-icon" size="clamp(1.2rem, 3dvh, 2.2rem)" />
                      </div>
                    </template>
                  </GameDwellButton>
                </div>
              </section>

              <aside class="side-panel">
                <div>
                  <div class="text-overline text-secondary mb-1">Полные шахматы 8×8</div>
                  <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Шахматы</h1>
                  <p class="text-body-1 text-medium-emphasis mb-0">Играй белыми. Выбери фигуру, затем подсвеченный легальный ход. Чёрные отвечают C++ движком.</p>
                </div>

                <v-alert class="text-body-1 font-weight-medium" :color="check ? 'warning' : 'secondary'" icon="mdi-chess-king" rounded="xl" variant="tonal">
                  {{ feedbackMessage }} {{ statusText }}
                </v-alert>

                <div class="d-flex flex-wrap ga-2">
                  <v-chip color="primary" size="large" variant="flat">Белые: игрок</v-chip>
                  <v-chip color="blue-grey" size="large" variant="tonal">Чёрные: ИИ</v-chip>
                  <v-chip v-if="selectedIndex !== undefined" color="success" size="large" variant="tonal">{{ squareLabel(selectedIndex) }}: ходов {{ selectedMoves.length }}</v-chip>
                  <v-chip v-if="check" color="warning" size="large" variant="flat">Шах</v-chip>
                </div>

                <div class="d-flex ga-3">
                  <v-btn color="primary" prepend-icon="mdi-restart" rounded="xl" size="large" variant="tonal" @click="restart">Новая партия</v-btn>
                </div>
              </aside>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Шахматы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.chess-shell {
  background:
    radial-gradient(circle at 14% 18%, rgb(255 224 178 / 62%), transparent 30%),
    radial-gradient(circle at 86% 14%, rgb(187 222 251 / 58%), transparent 28%),
    linear-gradient(135deg, #fff8ec 0%, #edf4ff 52%, #f4fff4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: clamp(5.5rem, 12dvh, 7.75rem);
}

.game-card {
  max-block-size: calc(100dvh - clamp(6.25rem, 13dvh, 8.5rem));
  overflow: hidden;
}

.game-layout {
  align-items: center;
  display: grid;
  gap: clamp(0.75rem, 2vw, 1.6rem);
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 0.58fr);
}

.board-section {
  min-inline-size: 0;
}

.board-grid {
  display: grid;
  gap: clamp(0.12rem, 0.38vw, 0.32rem);
  grid-template-columns: repeat(8, minmax(0, 1fr));
  inline-size: min(76dvh, 54vw, 38rem);
  margin-inline: auto;
}

.board-grid > * {
  min-inline-size: 0;
}

.board-grid :deep(.dwell-button) {
  border-radius: clamp(0.45rem, 1.2dvh, 0.9rem) !important;
  min-inline-size: 0;
  padding: clamp(0.08rem, 0.28dvh, 0.22rem) !important;
}

.cell-content {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  min-block-size: 100%;
  position: relative;
}

.cell-label {
  color: rgb(var(--v-theme-on-surface) / 68%);
  font-size: clamp(0.55rem, 1.2dvh, 0.75rem);
  font-weight: 800;
  inset-block-start: 0.1rem;
  inset-inline-start: 0.28rem;
  position: absolute;
}

.piece-icon {
  filter: drop-shadow(0 0.2rem 0.24rem rgb(0 0 0 / 18%));
}

.piece-white .piece-icon {
  color: #4e342e;
}

.piece-black .piece-icon {
  color: #0d47a1;
}

.cell-target::after,
.cell-selected::after {
  border-radius: 999rem;
  content: "";
  inset: 12%;
  pointer-events: none;
  position: absolute;
}

.cell-target::after {
  border: 0.18rem solid rgb(var(--v-theme-success));
}

.cell-selected::after {
  border: 0.2rem solid rgb(var(--v-theme-warning));
}

.target-icon {
  color: rgb(var(--v-theme-success));
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(0.55rem, 1.4dvh, 1rem);
  min-inline-size: 0;
}

@media (max-width: 48rem) {
  .game-card {
    max-block-size: none;
    overflow: visible;
  }

  .game-layout {
    grid-template-columns: 1fr;
  }

  .board-grid {
    inline-size: min(92vw, 68dvh, 36rem);
  }
}
</style>
