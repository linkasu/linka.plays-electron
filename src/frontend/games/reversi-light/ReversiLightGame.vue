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
import { applyMove, cellIndex, chooseAiMove, countPieces, createInitialBoard, findWinner, hasAnyMove, reversiLightSize, validMoves, type ReversiLightBoard, type ReversiLightCell, type ReversiLightWinner } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("reversi-light", {
  maxSteps: 10,
  overrides: { dwellMs: 1300, sessionSeconds: 180, targetScale: 1.25, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "reversi-light", soundEnabled, warmAssetIds: ["reversi-light.prompt", "reversi-light.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const aiMoveDelayMs = 850;
const passDelayMs = 700;
const aiSearchDepth = 12;
const aiSearchTimeLimitMs = 800;

const board = ref<ReversiLightBoard>(createInitialBoard());
const result = ref<ReversiLightWinner>();
const aiThinking = ref(false);
const flippedCells = ref<number[]>([]);
const lastMove = ref<number>();
const feedbackMessage = ref("Твои тёплые фишки ходят на подсвеченные клетки. Неподходящая клетка просто даст подсказку.");
const resultVisible = computed(() => session.status === "finished");
const playerMoves = computed(() => validMoves(board.value, "player"));
const counts = computed(() => countPieces(board.value));
const rows = Array.from({ length: reversiLightSize }, (_, row) => row);
const columns = Array.from({ length: reversiLightSize }, (_, column) => column);
let aiTimer = 0;
let aiRequestId = 0;

const statusText = computed(() => {
  if (result.value === "player") return "У тебя больше фишек";
  if (result.value === "ai") return "У луны больше фишек";
  if (result.value === "draw") return "Ровная партия";
  if (session.status === "paused") return "Пауза";
  if (aiThinking.value) return "Луна делает ход";
  if (!playerMoves.value.length) return "Сейчас ход пропускается";
  return "Выбери подсвеченную клетку";
});

function cellTargetId(index: number) {
  return `reversi-light:cell:${index}`;
}

function markAt(row: number, column: number): ReversiLightCell {
  return board.value[cellIndex(row, column)];
}

function isValidPlayerCell(index: number) {
  return playerMoves.value.includes(index);
}

function canChooseCell(index: number) {
  return session.status === "running" && !aiThinking.value && !result.value && !board.value[index];
}

function isSessionPaused() {
  return (session.status as string) === "paused";
}

function encodeBoardForAi(nextBoard: ReversiLightBoard) {
  return nextBoard.map((cell) => cell === "player" ? "R" : cell === "ai" ? "Y" : ".").join("");
}

async function chooseNativeAiMove(snapshot: ReversiLightBoard) {
  const nativeResult = await window.linkaAi?.reversiLightBestMove({
    board: encodeBoardForAi(snapshot),
    player: "Y",
    depth: aiSearchDepth,
    timeLimitMs: aiSearchTimeLimitMs
  });

  if (nativeResult?.ok && typeof nativeResult.move === "number" && validMoves(snapshot, "ai").includes(nativeResult.move)) {
    return { move: nativeResult.move, source: nativeResult.source, depth: nativeResult.depth, nodes: nativeResult.nodes, elapsedMs: nativeResult.elapsedMs };
  }

  return { move: chooseAiMove(snapshot), source: "fallback" as const };
}

function cellColor(index: number, cell: ReversiLightCell) {
  if (cell) return "surface";
  if (isValidPlayerCell(index)) return "primary";
  return "blue-grey-lighten-5";
}

function cellClasses(index: number, cell: ReversiLightCell) {
  return [
    "reversi-cell-content",
    {
      "reversi-cell-content--valid": !cell && isValidPlayerCell(index),
      "reversi-cell-content--last": lastMove.value === index,
      "reversi-cell-content--flipped": flippedCells.value.includes(index)
    }
  ];
}

function pieceClasses(cell: ReversiLightCell) {
  return ["piece", { "piece--player": cell === "player", "piece--ai": cell === "ai" }];
}

async function finishBoard(reason: "max-steps" | "game-complete" = "game-complete") {
  result.value = findWinner(board.value);
  aiThinking.value = false;
  if (result.value === "player") recordSuccess({ result: result.value, board: board.value.join("|"), final: true });
  else if (result.value === "ai") recordMistake({ result: result.value, board: board.value.join("|"), final: true });
  else recordEvent("level-start", { result: result.value, board: board.value.join("|") });
  if (result.value === "ai") void feedbackAudio.playMistake();
  else void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(["reversi-light.complete"], 80, 170);
  if (session.status !== "finished") finishSession(reason === "max-steps" ? "max-steps" : result.value === "draw" ? "game-draw" : result.value === "player" ? "game-complete" : "game-lost");
}

function afterAiTurn() {
  if (!hasAnyMove(board.value) || board.value.every(Boolean)) {
    feedbackMessage.value = "Поле завершилось. Смотрим, у кого больше фишек.";
    void finishBoard("game-complete");
    return;
  }

  if (!playerMoves.value.length && validMoves(board.value, "ai").length) {
    feedbackMessage.value = "Сейчас нет подходящего хода. Луна ходит ещё раз.";
    scheduleAiMove(passDelayMs);
    return;
  }

  feedbackMessage.value = "Теперь снова твой ход. Подсвеченные клетки перевернут соседние фишки.";
}

async function applyAiMove() {
  if (isSessionPaused()) {
    aiTimer = window.setTimeout(applyAiMove, 250);
    return;
  }

  if (session.status !== "running" || result.value) return;

  const requestId = ++aiRequestId;
  const snapshot = [...board.value] as ReversiLightBoard;
  const aiMoveChoice = await chooseNativeAiMove(snapshot);
  if (requestId !== aiRequestId) return;
  if (isSessionPaused()) {
    aiTimer = window.setTimeout(applyAiMove, 250);
    return;
  }

  aiThinking.value = false;
  if (session.status !== "running" || result.value) return;

  const move = typeof aiMoveChoice.move === "number" && validMoves(board.value, "ai").includes(aiMoveChoice.move) ? aiMoveChoice.move : chooseAiMove(board.value);
  if (move === undefined) {
    feedbackMessage.value = "Луна пропускает ход. Выбирай подсвеченную клетку.";
    afterAiTurn();
    return;
  }

  const aiMove = applyMove(board.value, move, "ai");
  if (!aiMove) return;
  board.value = aiMove.board;
  flippedCells.value = aiMove.flipped;
  lastMove.value = move;
  recordEvent("target-click", { targetId: cellTargetId(move), actor: "ai", mark: "ai", flipped: aiMove.flipped.length, ai: aiMoveChoice });
  afterAiTurn();
}

function scheduleAiMove(delayMs = aiMoveDelayMs) {
  aiThinking.value = true;
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(applyAiMove, delayMs);
}

async function chooseCell(index: number) {
  if (!canChooseCell(index)) return;

  const targetId = cellTargetId(index);
  const move = applyMove(board.value, index, "player");
  if (!move) {
    feedbackMessage.value = "Эта клетка пока не переворачивает фишки. Выбери одну из отмеченных клеток.";
    flippedCells.value = [];
    lastMove.value = index;
    recordMistake({ targetId, reason: "invalid-reversi-move", isCorrect: false });
    void feedbackAudio.playMistake();
    return;
  }

  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  board.value = move.board;
  flippedCells.value = move.flipped;
  lastMove.value = index;
  recordSuccess({ targetId, mark: "player", flipped: move.flipped.length, isCorrect: true });

  if (finishedAfterSuccess || !hasAnyMove(board.value) || board.value.every(Boolean)) {
    feedbackMessage.value = "Ходов достаточно. Завершаем мини-партию.";
    await finishBoard(finishedAfterSuccess ? "max-steps" : "game-complete");
    return;
  }

  if (!validMoves(board.value, "ai").length) {
    feedbackMessage.value = "Луна пропускает ход. Можно выбрать следующую подсветку.";
    void feedbackAudio.playSuccess();
    return;
  }

  feedbackMessage.value = "Хороший ход. Луна отвечает.";
  void feedbackAudio.playSuccess();
  aiRequestId += 1;
  scheduleAiMove();
}

function restart() {
  promptAudio.cancelPending();
  aiRequestId += 1;
  window.clearTimeout(aiTimer);
  board.value = createInitialBoard();
  result.value = undefined;
  aiThinking.value = false;
  flippedCells.value = [];
  lastMove.value = undefined;
  feedbackMessage.value = "Новая доска готова. Выбирай подсвеченную клетку.";
  startSession();
  promptAudio.play("reversi-light.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("reversi-light.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  aiRequestId += 1;
  window.clearTimeout(aiTimer);
});
</script>

<template>
  <div class="reversi-shell">
    <GameHud title="Реверси light" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Мини-стратегия 4×4</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Реверси light</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Ставь тёплую фишку на отмеченную клетку и переворачивай фишки луны.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Твои: {{ counts.player }}</v-chip>
                <v-chip color="indigo" size="large" variant="tonal">Луна: {{ counts.ai }}</v-chip>
                <v-chip :color="aiThinking ? 'secondary' : 'primary'" size="large" variant="flat">{{ statusText }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="playerMoves.length ? 'primary' : 'secondary'" icon="mdi-circle-double" rounded="xl" role="status" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <div class="board-grid mx-auto" role="grid" aria-label="Поле реверси четыре на четыре">
              <template v-for="row in rows" :key="row">
                <GameDwellButton
                  v-for="column in columns"
                  :key="`${row}-${column}`"
                  :target-id="cellTargetId(cellIndex(row, column))"
                  :disabled="!canChooseCell(cellIndex(row, column))"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(5.25rem, 11.5vh, 8.5rem)"
                  :color="cellColor(cellIndex(row, column), markAt(row, column))"
                  @select="chooseCell(cellIndex(row, column))"
                >
                  <template #default>
                    <div :class="cellClasses(cellIndex(row, column), markAt(row, column))">
                      <div v-if="markAt(row, column)" :class="pieceClasses(markAt(row, column))" />
                      <div v-else-if="isValidPlayerCell(cellIndex(row, column))" class="valid-dot" />
                    </div>
                  </template>
                </GameDwellButton>
              </template>
            </div>

            <div class="d-flex flex-column flex-sm-row align-center justify-space-between ga-3 mt-5">
              <p class="text-body-2 text-medium-emphasis mb-0">Другая пустая клетка не завершает игру: она только напоминает выбрать отмеченное место.</p>
              <v-btn color="secondary" prepend-icon="mdi-arrow-left" rounded="xl" size="large" variant="tonal" @click="router.push(resolveMenuRoute())">В меню</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Реверси light" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.reversi-shell {
  background:
    radial-gradient(circle at 18% 20%, rgb(255 224 178 / 60%), transparent 30%),
    radial-gradient(circle at 82% 18%, rgb(197 202 233 / 58%), transparent 28%),
    linear-gradient(135deg, #fffaf1 0%, #eef3ff 58%, #f8fff4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.board-grid {
  display: grid;
  gap: clamp(0.5rem, 1.6vw, 0.875rem);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-inline-size: min(92vw, 55vh, 36.875rem);
}

.board-grid :deep(.dwell-button) {
  padding: 0.625rem !important;
}

.reversi-cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 1.375rem;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: clamp(4.5rem, 10vh, 6rem);
  position: relative;
}

.reversi-cell-content--valid {
  box-shadow: inset 0 0 0 0.3125rem rgb(var(--v-theme-primary) / 22%);
}

.reversi-cell-content--last {
  outline: 0.25rem solid rgb(var(--v-theme-secondary) / 38%);
  outline-offset: -0.3125rem;
}

.reversi-cell-content--flipped.piece {
  transform: scale(1.06);
}

.piece {
  border-radius: 999px;
  block-size: clamp(3.25rem, 10vw, 5.375rem);
  box-shadow: 0 0.75rem 1.5rem rgb(45 40 30 / 18%), inset 0 -0.625rem 1.125rem rgb(0 0 0 / 10%);
  inline-size: clamp(3.25rem, 10vw, 5.375rem);
  transition: transform 180ms ease;
}

.piece--player {
  background: radial-gradient(circle at 34% 28%, #fff8e1 0 24%, #ffca28 25% 66%, #f57f17 100%);
}

.piece--ai {
  background: radial-gradient(circle at 34% 28%, #eef2ff 0 22%, #7986cb 23% 68%, #283593 100%);
}

.valid-dot {
  background: rgb(var(--v-theme-primary) / 72%);
  block-size: 1.375rem;
  border-radius: 999px;
  box-shadow: 0 0 0 0.875rem rgb(var(--v-theme-primary) / 13%);
  inline-size: 1.375rem;
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 7.25rem;
  }

 .reversi-cell-content {
    min-block-size: 4.625rem;
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
 .game-container .v-btn {
    display: none;
  }

 .game-container.d-flex.flex-column.flex-md-row {
    margin-block-end: 0.75rem !important;
  }

 .board-grid {
    gap: 0.45rem;
    max-inline-size: min(100%, 37rem);
  }

 .board-grid :deep(.dwell-button) {
    min-block-size: 5.625rem !important;
    padding: 0.35rem !important;
  }

 .reversi-cell-content {
    min-block-size: 4.5rem;
  }

 .piece {
    block-size: 2.7rem;
    inline-size: 2.7rem;
  }
}
</style>
