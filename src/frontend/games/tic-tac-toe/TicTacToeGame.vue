<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { chooseDeepQMove, createEmptyBoard, findWinner, winningLine, type TicTacToeBoard, type TicTacToeWinner } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSessionFor("tic-tac-toe", {
  maxSteps: 1,
  overrides: { sessionSeconds: 86400, targetScale: 1.25, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "tic-tac-toe", soundEnabled, warmAssetIds: ["tic-tac-toe.prompt", "tic-tac-toe.correct", "tic-tac-toe.mistake", "tic-tac-toe.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const aiMoveDelayMs = 900;
const playerTurnDelayMs = 850;

const board = ref<TicTacToeBoard>(createEmptyBoard());
const result = ref<TicTacToeWinner>();
const aiThinking = ref(false);
const playerTurnBlocked = ref(false);
const sleeping = ref(false);
const finalizing = ref(false);
const resultVisible = computed(() => session.status === "finished");
const line = computed(() => winningLine(board.value));
const gazeBlocked = computed(() => aiThinking.value || playerTurnBlocked.value || sleeping.value || finalizing.value);
const sleepDisabled = computed(() => session.status !== "running" || aiThinking.value || finalizing.value || Boolean(result.value));
let aiTimer = 0;

const statusText = computed(() => {
  if (sleeping.value) return " думаем над ходом";
  if (aiThinking.value) return "Компьютер думает над ходом";
  if (playerTurnBlocked.value) return "Пауза перед твоим ходом";
  if (result.value === "X") return "Ты собрал линию";
  if (result.value === "O") return "Компьютер собрал линию";
  if (result.value === "draw") return "Ничья";
  if (session.status === "paused") return "Пауза";
  return "Выбери клетку для крестика";
});

function cellTargetId(index: number) {
  return `tic-tac-toe:cell:${index}`;
}

function sleepTargetId() {
  return "tic-tac-toe:think-break";
}

function menuTargetId() {
  return "tic-tac-toe:menu";
}

function pauseTargetId() {
  return "tic-tac-toe:pause";
}

function isWinningCell(index: number) {
  return line.value?.some((cellIndex) => cellIndex === index) ?? false;
}

async function finishRound(nextResult: TicTacToeWinner) {
  result.value = nextResult;
  aiThinking.value = false;
  playerTurnBlocked.value = false;
  sleeping.value = false;
  finalizing.value = true;
  if (nextResult === "X") recordSuccess({ result: nextResult, board: board.value.join("") });
  else if (nextResult === "O") recordMistake({ result: nextResult, board: board.value.join("") });
  else recordEvent("level-start", { result: nextResult, board: board.value.join("") });

  if (nextResult === "O") void feedbackAudio.playMistake();
  else void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(nextResult === "X" ? ["tic-tac-toe.correct", "tic-tac-toe.complete"] : nextResult === "O" ? ["tic-tac-toe.mistake", "tic-tac-toe.complete"] : ["tic-tac-toe.complete"], 80, 170);

  if (session.status !== "finished") finishSession(nextResult === "draw" ? "game-draw" : nextResult === "X" ? "game-complete" : "game-lost");
  finalizing.value = false;
}

function applyAiMove() {
  if (session.status === "paused") {
    aiTimer = window.setTimeout(applyAiMove, 250);
    return;
  }

  aiThinking.value = false;
  if (session.status !== "running" || result.value) return;
  const move = chooseDeepQMove(board.value);
  if (move === undefined) return;
  board.value[move] = "O";
  recordEvent("target-click", { targetId: cellTargetId(move), actor: "deep-q", mark: "O" });
  const winner = findWinner(board.value);
  if (winner) void finishRound(winner);
  else blockPlayerTurn();
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

function chooseCell(index: number) {
  if (session.status !== "running" || gazeBlocked.value || result.value || board.value[index]) return;
  board.value[index] = "X";
  recordEvent("target-click", { targetId: cellTargetId(index), actor: "player", mark: "X" });

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
  promptAudio.play("tic-tac-toe.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("tic-tac-toe.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  window.clearTimeout(aiTimer);
});
</script>

<template>
  <div class="tic-shell">
    <div class="compact-controls d-flex align-center ga-2 pa-1">
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
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8" xl="6">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="10">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-6">
              <div>
                <div class="text-overline text-secondary mb-1">Классическая стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Крестики-нолики</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Ты играешь крестиками. Компьютер ходит ноликами.</p>
              </div>
              <div class="d-flex flex-column flex-sm-row align-center ga-2">
                <v-chip :color="gazeBlocked ? 'secondary' : 'primary'" size="large" variant="tonal">
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
            </div>

            <div class="board-grid mx-auto mb-6" role="grid" aria-label="Поле крестики-нолики">
              <GameDwellButton
                v-for="(cell, index) in board"
                :key="index"
                :target-id="cellTargetId(index)"
                :disabled="session.status !== 'running' || gazeBlocked || Boolean(result) || Boolean(cell)"
                :dwell-ms="session.settings.dwellMs"
                min-height="8.5rem"
                :color="cell ? 'surface-variant' : 'surface'"
                @select="chooseCell(index)"
              >
                <template #default>
                  <div :class="['cell-mark', cell === 'X' ? 'cell-mark--x' : 'cell-mark--o', { 'cell-mark--win': isWinningCell(index) }]">
                    {{ cell || "" }}
                  </div>
                </template>
              </GameDwellButton>
            </div>

            <div class="text-body-1 text-medium-emphasis text-center">Смотри на свободную клетку, дождись крестика и короткой паузы между ходами.</div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Крестики-нолики" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tic-shell {
  background:
    radial-gradient(circle at 18% 16%, rgb(187 222 251 / 58%), transparent 28%),
    radial-gradient(circle at 82% 24%, rgb(225 190 231 / 48%), transparent 30%),
    linear-gradient(135deg, #f7fbff 0%, #f2eefb 100%);
  min-block-size: 100vh;
}

.compact-controls {
  inset-block-start: max(0.75rem, env(safe-area-inset-top));
  inset-inline-start: max(0.75rem, env(safe-area-inset-left));
  position: fixed;
  z-index: 10;
}

.compact-controls :deep(.dwell-hitbox) {
  inline-size: 9.375rem;
}

.compact-controls :deep(.dwell-button) {
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
  padding-block-start: 8.25rem;
}

.board-grid {
  display: grid;
  gap: clamp(0.625rem, 2vw, 1.125rem);
  grid-template-columns: repeat(3, minmax(5.5rem, 1fr));
  max-inline-size: 32.5rem;
}

.game-container :deep(.dwell-hitbox) {
  min-inline-size: 0;
}

.game-container :deep(.d-flex >.dwell-hitbox) {
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

.cell-mark {
  align-items: center;
  block-size: 100%;
  display: flex;
  font-size: clamp(3.8rem, 9vw, 6.4rem);
  font-weight: 900;
  justify-content: center;
  line-height: 1;
  min-block-size: 5.75rem;
  transition: transform 180ms ease;
}

.cell-mark--x {
  color: rgb(var(--v-theme-primary));
}

.cell-mark--o {
  color: rgb(var(--v-theme-secondary));
}

.cell-mark--win {
  transform: scale(1.12);
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 7rem;
  }
}

@media (max-height: 42.5rem) {
 .compact-controls :deep(.dwell-hitbox) {
    inline-size: 7.5rem;
  }

 .compact-controls :deep(.dwell-button) {
    min-block-size: 6rem !important;
  }

 .game-container {
    padding-block-start: 4.75rem;
  }

 .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

 .game-container .text-overline,
 .game-container h1,
 .game-container p,
 .game-container > .v-row .text-body-1 .text-medium-emphasis {
    display: none;
  }

 .game-container.d-flex.flex-column.flex-md-row {
    display: none !important;
  }

 .board-grid {
    gap: 0.55rem;
    max-inline-size: 20rem;
  }

 .board-grid :deep(.dwell-button) {
    min-block-size: 5rem !important;
    padding: 0.5rem !important;
  }
}
</style>
