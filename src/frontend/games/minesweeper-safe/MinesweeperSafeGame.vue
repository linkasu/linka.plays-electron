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
import { areAllMinesFlagged, createInitialCellStates, findSuggestedSafeIndex, generateMinesweeperSafeBoard, minesweeperSafeChoiceOutcome, type MinesweeperSafeCell } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("minesweeper-safe", {
  maxSteps: 10,
  overrides: { sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "minesweeper-safe", soundEnabled, warmAssetIds: ["minesweeper-safe.prompt"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const roundIndex = ref(1);
const board = ref(generateMinesweeperSafeBoard(session.settings, roundIndex.value));
const cellStates = ref(createInitialCellStates(board.value));
const hintedIndex = ref<number>();
const lastFlaggedIndex = ref<number>();
const bombMode = ref(false);
const isSpeaking = ref(false);

const resultVisible = computed(() => session.status === "finished");
const safeRemaining = computed(() => board.value.cells.filter((cell) => !cell.mine && cellStates.value[cell.index] === "hidden").length);
const flaggedCount = computed(() => cellStates.value.filter((state) => state === "flagged").length);
const helperText = computed(() => {
  if (lastFlaggedIndex.value !== undefined) return "Флажок стоит на клетке. Пометь все бомбы, чтобы победить.";
  if (bombMode.value) return "Режим бомбы: выбери закрытую клетку, чтобы поставить или снять флажок.";
  if (hintedIndex.value !== undefined) return "Мягкая подсказка включена: выбери подсвеченную клетку, если хочешь.";
  return "Открытые числа показывают, сколько мин рядом. Выбирай закрытые клетки, которые выглядят безопасно.";
});

function cellTargetId(index: number) {
  return `minesweeper-safe:cell:${index}`;
}

function hintTargetId() {
  return "minesweeper-safe:hint";
}

function bombTargetId() {
  return "minesweeper-safe:bomb";
}

function isDisabled(cell: MinesweeperSafeCell) {
  return session.status !== "running" || isSpeaking.value || cellStates.value[cell.index] === "revealed";
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
  bombMode.value = false;
}

async function completeBoardIfMinesFlagged() {
  if (!areAllMinesFlagged(board.value.cells, cellStates.value)) return false;

  recordSuccess({ roundId: board.value.roundId, targetId: bombTargetId(), result: "all-mines-flagged" });
  void feedbackAudio.playSuccess();
  finishSession("game-complete");
  return true;
}

function requestHint(reason = "manual") {
  if (session.status !== "running" || isSpeaking.value) return;
  const suggestion = findSuggestedSafeIndex(board.value.cells, cellStates.value);
  if (suggestion === undefined) return;
  hintedIndex.value = suggestion;
  recordHint({ roundId: board.value.roundId, targetId: cellTargetId(suggestion), reason });
}

function toggleBombMode() {
  if (session.status !== "running" || isSpeaking.value) return;
  bombMode.value = !bombMode.value;
}

async function chooseCell(cell: MinesweeperSafeCell) {
  if (isDisabled(cell)) return;

  if (bombMode.value) {
    const nextState = cellStates.value[cell.index] === "flagged" ? "hidden" : "flagged";
    cellStates.value[cell.index] = nextState;
    hintedIndex.value = undefined;
    lastFlaggedIndex.value = nextState === "flagged" ? cell.index : undefined;
    if (nextState === "flagged") recordHint({ roundId: board.value.roundId, targetId: cellTargetId(cell.index), reason: "bomb-flag" });
    await completeBoardIfMinesFlagged();
    return;
  }

  if (cellStates.value[cell.index] === "flagged") return;

  const outcome = minesweeperSafeChoiceOutcome(cell, cellStates.value[cell.index]);
  if (outcome === "ignored") return;

  if (outcome === "mine") {
    lastFlaggedIndex.value = cell.index;
    recordMistake({ roundId: board.value.roundId, targetId: cellTargetId(cell.index), result: "mine", isCorrect: false });
    void feedbackAudio.playMistake();
    finishSession("game-lost");
    return;
  }

  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  cellStates.value[cell.index] = "revealed";
  lastFlaggedIndex.value = undefined;
  if (hintedIndex.value === cell.index) hintedIndex.value = undefined;
  recordSuccess({ roundId: board.value.roundId, targetId: cellTargetId(cell.index), adjacentMines: cell.adjacentMines });
  void feedbackAudio.playSuccess();
  if (finishedAfterSuccess) {
    finishSession("game-complete");
    return;
  }
  revealNextBoardIfNeeded();
}

function restart() {
  promptAudio.cancelPending();
  roundIndex.value = 1;
  board.value = generateMinesweeperSafeBoard(session.settings, roundIndex.value);
  cellStates.value = createInitialCellStates(board.value);
  hintedIndex.value = undefined;
  lastFlaggedIndex.value = undefined;
  bombMode.value = false;
  isSpeaking.value = false;
  startSession();
  promptAudio.play("minesweeper-safe.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("minesweeper-safe.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="minesweeper-safe-shell">
    <GameHud title="Сапёр" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="minesweeper-card pa-4 pa-md-7" rounded="xl" elevation="10">
            <div class="board-header d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div class="intro-copy">
                <div class="text-overline text-secondary mb-1">Спокойная стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Сапёр</h1>
                <p class="text-body-1 text-md-h6 text-medium-emphasis mb-0">{{ helperText }}</p>
              </div>
              <div class="header-actions d-flex flex-column flex-sm-row align-stretch align-sm-center ga-3">
                <v-chip color="primary" prepend-icon="mdi-shield-check-outline" size="large" variant="tonal">
                  Безопасных: {{ safeRemaining }}
                </v-chip>
                <v-chip color="warning" prepend-icon="mdi-bomb" size="large" variant="tonal">
                  Бомб: {{ flaggedCount }} / {{ board.mineCount }}
                </v-chip>
                <GameDwellButton :target-id="bombTargetId()" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="112" :color="bombMode ? 'warning' : 'surface'" @select="toggleBombMode">
                  <template #default>
                    <div class="hint-button-content">
                      <v-icon icon="mdi-bomb" size="30" />
                      <span>{{ bombMode ? 'Бомба: вкл' : 'Бомба' }}</span>
                    </div>
                  </template>
                </GameDwellButton>
                <GameDwellButton :target-id="hintTargetId()" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="136" color="deep-purple-darken-3" @select="requestHint()">
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
                min-height="clamp(4.5rem, 12vh, 8.5rem)"
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
              Если выбрать опасную клетку, раунд остановится. Используй числа и подсказку, чтобы искать безопасные клетки.
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
  padding-block: clamp(4.75rem, 9vh, 7rem) clamp(2rem, 5vh, 4rem) !important;
}

.minesweeper-card {
  max-block-size: calc(100vh - clamp(6.75rem, 14vh, 11rem));
  overflow: hidden;
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
  gap: clamp(0.25rem, 1vh, 0.85rem);
  grid-auto-rows: minmax(0, 1fr);
  grid-template-columns: repeat(var(--board-size), minmax(0, 1fr));
  inline-size: min(100%, calc(100vh - clamp(11rem, 22vh, 18rem)));
  max-inline-size: 47rem;
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

@media (max-width: 45rem) {
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
    padding-block: 4.75rem 4vh !important;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .intro-copy,
  .game-container .v-alert {
    display: none !important;
  }

  .board-header {
    justify-content: center !important;
    margin-block-end: clamp(0.5rem, 1.2vh, 1rem) !important;
  }

  .header-actions {
    flex-direction: row !important;
  }

  .header-actions :deep(.dwell-button) {
    min-block-size: clamp(4.75rem, 9vh, 6.5rem) !important;
    padding: 0.45rem !important;
  }

  .board-wrap {
    gap: 0.8vh;
    inline-size: min(100%, 67vh);
    max-inline-size: none;
  }

  .mine-cell :deep(.dwell-button) {
    min-block-size: min(11.2vh, 5.75rem) !important;
    padding: 0.35rem !important;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block: 4.75rem 4vh !important;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container p,
  .game-container .v-alert {
    display: none;
  }

  .game-container .intro-copy {
    display: none !important;
  }

  .board-header {
    justify-content: center !important;
    margin-block-end: 0.5rem !important;
  }

  .header-actions {
    flex-direction: row !important;
  }

  .header-actions .v-chip {
    display: none;
  }

  .header-actions :deep(.dwell-button) {
    min-block-size: 4.5rem !important;
    padding: 0.35rem !important;
  }

  .board-wrap {
    gap: 0.6vh;
    grid-template-columns: repeat(var(--board-size), minmax(0, 1fr));
    inline-size: min(100%, 65vh);
    max-inline-size: none;
  }

  .mine-cell :deep(.dwell-button) {
    min-block-size: 9.5vh !important;
    padding: 0.3rem !important;
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
