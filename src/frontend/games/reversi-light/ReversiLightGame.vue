<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { applyMove, cellIndex, chooseAiMove, countPieces, createInitialBoard, findWinner, hasAnyMove, reversiLightSize, validMoves, type ReversiLightBoard, type ReversiLightCell, type ReversiLightWinner } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("reversi-light", {
  maxSteps: 10,
  overrides: { dwellMs: 1300, sessionSeconds: 180, targetScale: 1.25, sound: false },
  finishOnMistakes: false
});

const aiMoveDelayMs = 850;
const passDelayMs = 700;

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

const statusText = computed(() => {
  if (result.value === "player") return "У тебя больше фишек";
  if (result.value === "ai") return "У луны больше фишек";
  if (result.value === "draw") return "Ровная партия";
  if (session.status === "paused") return "Пауза";
  if (aiThinking.value) return "Луна делает тихий ход";
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

function finishBoard(reason: "max-steps" | "game-complete" = "game-complete") {
  result.value = findWinner(board.value);
  aiThinking.value = false;
  if (result.value === "player") recordSuccess({ result: result.value, board: board.value.join("|"), final: true });
  else if (result.value === "ai") recordMistake({ result: result.value, board: board.value.join("|"), final: true });
  else recordEvent("level-start", { result: result.value, board: board.value.join("|") });
  if (session.status !== "finished") finishSession(reason);
}

function afterAiTurn() {
  if (!hasAnyMove(board.value) || board.value.every(Boolean)) {
    feedbackMessage.value = "Поле спокойно завершилось. Смотрим, у кого больше фишек.";
    finishBoard("game-complete");
    return;
  }

  if (!playerMoves.value.length && validMoves(board.value, "ai").length) {
    feedbackMessage.value = "Сейчас нет тёплого хода. Луна мягко ходит ещё раз.";
    scheduleAiMove(passDelayMs);
    return;
  }

  feedbackMessage.value = "Теперь снова твой ход. Подсвеченные клетки перевернут соседние фишки.";
}

function applyAiMove() {
  if (session.status === "paused") {
    aiTimer = window.setTimeout(applyAiMove, 250);
    return;
  }

  aiThinking.value = false;
  if (session.status !== "running" || result.value) return;

  const move = chooseAiMove(board.value);
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
  recordEvent("target-click", { targetId: cellTargetId(move), actor: "ai", mark: "ai", flipped: aiMove.flipped.length });
  afterAiTurn();
}

function scheduleAiMove(delayMs = aiMoveDelayMs) {
  aiThinking.value = true;
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(applyAiMove, delayMs);
}

function chooseCell(index: number) {
  if (!canChooseCell(index)) return;

  const targetId = cellTargetId(index);
  const move = applyMove(board.value, index, "player");
  if (!move) {
    feedbackMessage.value = "Эта клетка пока не переворачивает фишки. Посмотри на мягко подсвеченные места.";
    flippedCells.value = [];
    lastMove.value = index;
    recordMistake({ targetId, reason: "invalid-reversi-move", isCorrect: false });
    return;
  }

  board.value = move.board;
  flippedCells.value = move.flipped;
  lastMove.value = index;
  recordSuccess({ targetId, mark: "player", flipped: move.flipped.length, isCorrect: true });

  if (session.step >= session.maxSteps || !hasAnyMove(board.value) || board.value.every(Boolean)) {
    feedbackMessage.value = "Ходов достаточно. Завершаем спокойную мини-партию.";
    finishBoard(session.step >= session.maxSteps ? "max-steps" : "game-complete");
    return;
  }

  if (!validMoves(board.value, "ai").length) {
    feedbackMessage.value = "Луна пропускает ход. Можно выбрать следующую подсветку.";
    return;
  }

  feedbackMessage.value = "Хороший ход. Луна тихо отвечает.";
  scheduleAiMove();
}

function restart() {
  window.clearTimeout(aiTimer);
  board.value = createInitialBoard();
  result.value = undefined;
  aiThinking.value = false;
  flippedCells.value = [];
  lastMove.value = undefined;
  feedbackMessage.value = "Новая доска готова. Выбирай подсвеченную клетку без спешки.";
  startSession();
}

onUnmounted(() => {
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
                <p class="text-body-1 text-medium-emphasis mb-0">Ставь тёплую фишку на подсветку и переворачивай фишки луны.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Твои: {{ counts.player }}</v-chip>
                <v-chip color="indigo" size="large" variant="tonal">Луна: {{ counts.ai }}</v-chip>
                <v-chip :color="aiThinking ? 'secondary' : 'primary'" size="large" variant="flat">{{ statusText }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="playerMoves.length ? 'primary' : 'secondary'" icon="mdi-circle-double" rounded="xl" variant="tonal">
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
                  :min-height="126"
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
              <p class="text-body-2 text-medium-emphasis mb-0">Неверная пустая клетка не завершает игру: она только напоминает выбрать подсветку.</p>
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
  padding-block-start: 132px;
}

.board-grid {
  display: grid;
  gap: clamp(8px, 1.6vw, 14px);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-inline-size: min(92vw, 560px);
}

.board-grid :deep(.dwell-button) {
  padding: 10px !important;
}

.reversi-cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 22px;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 96px;
  position: relative;
}

.reversi-cell-content--valid {
  box-shadow: inset 0 0 0 5px rgb(var(--v-theme-primary) / 22%);
}

.reversi-cell-content--last {
  outline: 4px solid rgb(var(--v-theme-secondary) / 38%);
  outline-offset: -5px;
}

.reversi-cell-content--flipped .piece {
  transform: scale(1.06);
}

.piece {
  border-radius: 999px;
  block-size: clamp(52px, 10vw, 86px);
  box-shadow: 0 12px 24px rgb(45 40 30 / 18%), inset 0 -10px 18px rgb(0 0 0 / 10%);
  inline-size: clamp(52px, 10vw, 86px);
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
  block-size: 22px;
  border-radius: 999px;
  box-shadow: 0 0 0 14px rgb(var(--v-theme-primary) / 13%);
  inline-size: 22px;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 116px;
  }

  .reversi-cell-content {
    min-block-size: 74px;
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
    max-inline-size: min(100%, 28rem);
  }

  .board-grid :deep(.dwell-button) {
    min-block-size: 4rem !important;
    padding: 0.35rem !important;
  }

  .reversi-cell-content {
    min-block-size: 3.2rem;
  }

  .piece {
    block-size: 2.7rem;
    inline-size: 2.7rem;
  }
}
</style>
