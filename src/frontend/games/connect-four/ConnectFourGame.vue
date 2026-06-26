<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import {
  availableColumns,
  cellIndex,
  chooseDeepQMove,
  connectFourColumns,
  connectFourRows,
  createEmptyBoard,
  dropDisc,
  findWinner,
  winningLine,
  type ConnectFourBoard,
  type ConnectFourCell,
  type ConnectFourWinner
} from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("connect-four", {
  maxSteps: 1,
  overrides: { dwellMs: 1450, sessionSeconds: 86400, targetScale: 1.35, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "connect-four", soundEnabled, warmAssetIds: ["connect-four.prompt", "connect-four.correct", "connect-four.mistake", "connect-four.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const aiMoveDelayMs = 950;
const playerTurnDelayMs = 900;

const board = ref<ConnectFourBoard>(createEmptyBoard());
const result = ref<ConnectFourWinner>();
const aiThinking = ref(false);
const playerTurnBlocked = ref(false);
const sleeping = ref(false);
const finalizing = ref(false);
const resultVisible = computed(() => session.status === "finished");
const line = computed(() => winningLine(board.value));
const gazeBlocked = computed(() => aiThinking.value || playerTurnBlocked.value || sleeping.value || finalizing.value);
const sleepDisabled = computed(() => session.status !== "running" || aiThinking.value || finalizing.value || Boolean(result.value));
let aiTimer = 0;

const rows = Array.from({ length: connectFourRows }, (_, row) => row);
const columns = Array.from({ length: connectFourColumns }, (_, column) => column);

const statusText = computed(() => {
  if (sleeping.value) return "Спокойно думаем над ходом";
  if (aiThinking.value) return "Компьютер думает над ходом";
  if (playerTurnBlocked.value) return "Пауза перед твоим ходом";
  if (result.value === "R") return "Ты собрал 4 в ряд";
  if (result.value === "Y") return "Компьютер собрал 4 в ряд";
  if (result.value === "draw") return "Ничья";
  if (session.status === "paused") return "Пауза";
  return "Выбери колонку для красной фишки";
});

function columnTargetId(column: number) {
  return `connect-four:column:${column}`;
}

function sleepTargetId() {
  return "connect-four:think-break";
}

function menuTargetId() {
  return "connect-four:menu";
}

function pauseTargetId() {
  return "connect-four:pause";
}

function markAt(row: number, column: number): ConnectFourCell {
  return board.value[cellIndex(row, column)];
}

function cellClasses(row: number, column: number) {
  const mark = markAt(row, column);
  return [
    "disc",
    {
      "disc--empty": !mark,
      "disc--player": mark === "R",
      "disc--ai": mark === "Y",
      "disc--win": isWinningCell(row, column)
    }
  ];
}

function isWinningCell(row: number, column: number) {
  const index = cellIndex(row, column);
  return line.value?.some((cell) => cell === index) ?? false;
}

function canChooseColumn(column: number) {
  return session.status === "running" && !gazeBlocked.value && !result.value && availableColumns(board.value).includes(column);
}

async function finishRound(nextResult: ConnectFourWinner) {
  result.value = nextResult;
  aiThinking.value = false;
  playerTurnBlocked.value = false;
  sleeping.value = false;
  finalizing.value = true;
  if (nextResult === "R") recordSuccess({ result: nextResult, board: board.value.join("") });
  else if (nextResult === "Y") recordMistake({ result: nextResult, board: board.value.join("") });
  else recordEvent("level-start", { result: nextResult, board: board.value.join("") });

  if (nextResult === "Y") void feedbackAudio.playMistake();
  else void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(nextResult === "R" ? ["connect-four.correct", "connect-four.complete"] : nextResult === "Y" ? ["connect-four.mistake", "connect-four.complete"] : ["connect-four.complete"], 80, 170);

  if (session.status !== "finished") finishSession(nextResult === "draw" ? "game-draw" : nextResult === "R" ? "game-complete" : "game-lost");
  finalizing.value = false;
}

function blockPlayerTurn() {
  playerTurnBlocked.value = true;
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(() => {
    if (session.status === "paused") {
      blockPlayerTurn();
      return;
    }
    playerTurnBlocked.value = false;
  }, playerTurnDelayMs);
}

function applyAiMove() {
  if (session.status === "paused") {
    aiTimer = window.setTimeout(applyAiMove, 250);
    return;
  }

  aiThinking.value = false;
  if (session.status !== "running" || result.value) return;
  const column = chooseDeepQMove(board.value);
  if (column === undefined) return;
  const index = dropDisc(board.value, column, "Y");
  recordEvent("target-click", { targetId: columnTargetId(column), actor: "deep-q", mark: "Y", column, index });
  const winner = findWinner(board.value);
  if (winner) void finishRound(winner);
  else blockPlayerTurn();
}

function chooseColumn(column: number) {
  if (!canChooseColumn(column)) return;
  const index = dropDisc(board.value, column, "R");
  recordEvent("target-click", { targetId: columnTargetId(column), actor: "player", mark: "R", column, index });

  const winner = findWinner(board.value);
  if (winner) {
    void finishRound(winner);
    return;
  }

  aiThinking.value = true;
  window.clearTimeout(aiTimer);
  aiTimer = window.setTimeout(applyAiMove, aiMoveDelayMs);
}

function toggleThinkMode() {
  if (session.status !== "running" || aiThinking.value || finalizing.value || result.value) return;
  sleeping.value = !sleeping.value;
  recordEvent("hint", { kind: "think-switch", enabled: sleeping.value });
}

function togglePause() {
  if (session.status === "paused") resumeSession();
  else if (session.status === "running") pauseSession();
}

function restart() {
  promptAudio.cancelPending();
  window.clearTimeout(aiTimer);
  board.value = createEmptyBoard();
  result.value = undefined;
  aiThinking.value = false;
  playerTurnBlocked.value = false;
  sleeping.value = false;
  finalizing.value = false;
  startSession();
  promptAudio.play("connect-four.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("connect-four.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  window.clearTimeout(aiTimer);
});
</script>

<template>
  <div class="connect-shell">
    <div class="quiet-controls d-flex align-center ga-2 pa-1">
      <GameDwellButton :target-id="menuTargetId()" :disabled="finalizing" :dwell-ms="session.settings.dwellMs" min-height="8.5rem" color="surface" @select="router.push(resolveMenuRoute())">
        <template #default>
          <div class="control-button-content">
            <v-icon icon="mdi-arrow-left" size="26" />
            <span>В меню</span>
          </div>
        </template>
      </GameDwellButton>
      <GameDwellButton :target-id="pauseTargetId()" :disabled="session.status === 'finished' || finalizing" :dwell-ms="session.settings.dwellMs" min-height="8.5rem" color="surface" @select="togglePause">
        <template #default>
          <div class="control-button-content">
            <v-icon :icon="session.status === 'paused' ? 'mdi-play' : 'mdi-pause'" size="26" />
            <span>{{ session.status === "paused" ? "Дальше" : "Пауза" }}</span>
          </div>
        </template>
      </GameDwellButton>
    </div>

    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12">
          <v-card class="game-card pa-2 pa-sm-3 pa-md-4" rounded="xl" elevation="10">
            <div class="game-header d-flex flex-column flex-sm-row align-center justify-center ga-2 mb-3">
              <v-chip :color="gazeBlocked ? 'secondary' : 'primary'" size="large" variant="flat">
                {{ statusText }}
              </v-chip>
                  <GameDwellButton :target-id="sleepTargetId()" :disabled="sleepDisabled" :dwell-ms="session.settings.dwellMs" min-height="8.5rem" color="deep-purple-darken-3" @select="toggleThinkMode">
                <template #default>
                  <div class="think-button-content">
                      <v-icon :icon="sleeping ? 'mdi-check-circle' : 'mdi-sleep'" size="32" style="color: #ffffff" />
                      <span style="color: #ffffff">{{ sleeping ? "Готов ходить" : "Подумать" }}</span>
                  </div>
                </template>
              </GameDwellButton>
            </div>

            <div class="play-area mx-auto">
              <div class="board mb-5" role="grid" aria-label="Поле 4 в ряд">
                <div class="column-hit-zones" aria-label="Выбор колонки">
                  <GameDwellButton
                    v-for="column in columns"
                    :key="column"
                    :target-id="columnTargetId(column)"
                    :disabled="!canChooseColumn(column)"
                    :dwell-ms="session.settings.dwellMs"
                    min-height="20rem"
                    color="transparent"
                    @select="chooseColumn(column)"
                  >
                    <template #default>
                      <span class="column-target-cue" aria-hidden="true" />
                    </template>
                  </GameDwellButton>
                </div>

                <div v-for="row in rows" :key="row" class="board-row" role="row">
                  <div v-for="column in columns" :key="column" class="slot" role="gridcell">
                    <div :class="cellClasses(row, column)" />
                  </div>
                </div>
              </div>
            </div>

            <div class="help-text text-body-2 text-medium-emphasis text-center">Смотри в любую часть нужной колонки. После хода есть короткая пауза.</div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="4 в ряд" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.connect-shell {
  background:
    radial-gradient(circle at 14% 18%, rgb(255 224 178 / 58%), transparent 28%),
    radial-gradient(circle at 86% 20%, rgb(187 222 251 / 58%), transparent 30%),
    linear-gradient(135deg, #fff8ec 0%, #edf6ff 100%);
  block-size: 100vh;
  overflow: hidden;
}

.quiet-controls {
  inset-block-start: max(0.75rem, env(safe-area-inset-top));
  inset-inline-start: max(0.75rem, env(safe-area-inset-left));
  position: fixed;
  z-index: 10;
}

.quiet-controls :deep(.dwell-hitbox) {
  inline-size: 9.375rem;
}

.quiet-controls :deep(.dwell-button) {
  padding: 0.625rem !important;
}

.control-button-content {
  align-items: center;
  display: flex;
  font-weight: 800;
  gap: 0.5rem;
  justify-content: center;
}

.game-container {
  box-sizing: border-box;
  block-size: 100%;
  padding: 5rem clamp(0.5rem, 2vw, 1.5rem) 0.625rem;
}

.game-card {
  margin-inline: auto;
  inline-size: 100%;
}

.game-header :deep(.dwell-hitbox) {
  inline-size: min(100%, 260px);
}

.think-button-content {
  align-items: center;
  color: #ffffff;
  display: flex;
  font-size: 1.1rem;
  font-weight: 700;
  gap: 0.625rem;
  justify-content: center;
}

.play-area {
  inline-size: min(100%, calc((100vh - 13.75rem) * 1.8), 82.5rem);
}

.board {
  display: grid;
  gap: clamp(0.3125rem, 0.75vw, 0.625rem);
  grid-template-columns: repeat(7, minmax(0, 1fr));
  inline-size: 100%;
}

.column-hit-zones {
  display: grid;
  gap: clamp(0.3125rem, 0.75vw, 0.625rem);
  grid-template-columns: repeat(7, minmax(0, 1fr));
  inset: 0;
  padding: clamp(0.375rem, 1.2vw, 0.875rem);
  position: absolute;
  z-index: 3;
}

.column-target-cue {
  display: block;
}

.column-hit-zones :deep(.dwell-hitbox) {
  block-size: 100%;
  min-inline-size: 0;
}

.column-hit-zones :deep(.dwell-button) {
  background: transparent !important;
  block-size: 100%;
  box-shadow: none !important;
  color: rgb(var(--v-theme-primary));
  padding-block-start: 0.625rem !important;
}

.column-hit-zones :deep(.dwell-button--active) {
  background: rgb(255 255 255 / 18%) !important;
  box-shadow: inset 0 0 0 0.25rem rgb(255 255 255 / 45%) !important;
}

.board {
  background: linear-gradient(180deg, #3f7fd6 0%, #245fac 100%);
  border: 0.25rem solid rgb(18 67 132 / 72%);
  border-radius: 1.5rem;
  box-shadow: 0 1.125rem 2.375rem rgb(36 95 172 / 20%);
  padding: clamp(0.375rem, 1.2vw, 0.875rem);
  position: relative;
}

.board-row {
  display: contents;
}

.slot {
  align-items: center;
  aspect-ratio: 1.85;
  background: rgb(13 60 125 / 28%);
  border-radius: 999px;
  display: flex;
  justify-content: center;
  padding: clamp(0.25rem, 0.8vw, 0.4375rem);
}

.disc {
  aspect-ratio: 1;
  block-size: min(100%, 100cqi);
  border-radius: 999px;
  inline-size: auto;
  margin: auto;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.disc--empty {
  background: rgb(255 255 255 / 84%);
  box-shadow: inset 0 0.3125rem 0.75rem rgb(22 72 136 / 24%);
}

.disc--player {
  background: radial-gradient(circle at 34% 28%, #ffd2c5 0%, #ee6464 42%, #b83337 100%);
  box-shadow: inset -0.3125rem -0.375rem 0 rgb(85 24 28 / 22%);
}

.disc--ai {
  background: radial-gradient(circle at 34% 28%, #d8f0ff 0%, #4aa3ff 46%, #1759c5 100%);
  box-shadow: 0 0 0 0.1875rem rgb(255 255 255 / 44%), inset -0.3125rem -0.375rem 0 rgb(15 48 120 / 24%);
}

.disc--win {
  box-shadow: 0 0 0 0.3125rem rgb(255 255 255 / 72%), inset -0.3125rem -0.375rem 0 rgb(85 24 28 / 20%);
  transform: scale(1.08);
}

@media (max-width: 37.5rem) {
  .game-container {
    padding: 5.5rem 0.375rem 0.625rem;
  }

  .game-header {
    margin-block-end: 0.5rem !important;
  }

  .play-area {
    inline-size: min(100%, calc((100vh - 11.875rem) * 1.45));
  }

  .board {
    gap: 0.3125rem;
  }

  .board {
    border-radius: 1.25rem;
    border-width: 0.1875rem;
    padding: 0.375rem;
  }
}

@media (max-height: 48.75rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-header {
    display: none !important;
  }

  .game-header p,
  .help-text {
    display: none;
  }

  .play-area {
    inline-size: min(100%, calc((100vh - 7rem) * 1.45), 45rem);
  }

  .board,
  .column-hit-zones {
    gap: 0.125rem;
    padding: 0.25rem;
  }
}
</style>
