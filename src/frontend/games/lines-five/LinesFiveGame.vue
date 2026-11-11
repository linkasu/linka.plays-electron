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
  cellIndex,
  chooseLinesFiveCell,
  columnOf,
  createInitialLinesFiveState,
  linesFiveSize,
  reachableDestinationIndexes,
  rowOf,
  type LinesFiveCell,
} from "./model";

const router = useRouter();
const {
  session,
  durationMs,
  metrics,
  recommendation,
  pauseSession,
  resumeSession,
  recordHint,
  recordMistake,
  recordSuccess,
  startSession,
  finishSession,
} = useGameSessionFor("lines-five", {
  maxSteps: 999,
  overrides: { targetScale: 1.18, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false,
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "lines-five",
  soundEnabled,
  warmAssetIds: ["lines-five.prompt", "lines-five.complete"],
});
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const gameState = ref(createInitialLinesFiveState());
const lastMovedFrom = ref<number>();
const lastMovedTo = ref<number>();
const clearedIndexes = ref<number[]>([]);
const spawnedIndexes = ref<number[]>([]);
const pathIndexes = ref<number[]>([]);
const feedbackMessage = ref("Собери четыре одинаковых шарика в ряд.");

const rows = Array.from({ length: linesFiveSize }, (_, row) => row);
const columns = Array.from({ length: linesFiveSize }, (_, column) => column);
const board = computed(() => gameState.value.board);
const selectedIndex = computed(() => gameState.value.selectedIndex);
const reachableIndexes = computed(() =>
  selectedIndex.value === undefined
    ? []
    : reachableDestinationIndexes(board.value, selectedIndex.value),
);
const resultVisible = computed(() => session.status === "finished");

function targetId(index: number) {
  return `lines-five:cell:${index}`;
}

function cellColor(index: number, cell: LinesFiveCell) {
  if (selectedIndex.value === index) return "secondary";
  if (reachableIndexes.value.includes(index)) return "primary";
  if (cell) return "surface";
  return "blue-grey-lighten-5";
}

function cellClasses(index: number, cell: LinesFiveCell) {
  return [
    "lines-cell-content",
    cell ? `lines-cell-content--${cell}` : "",
    {
      "lines-cell-content--selected": selectedIndex.value === index,
      "lines-cell-content--last": lastMovedTo.value === index || lastMovedFrom.value === index,
      "lines-cell-content--reachable": reachableIndexes.value.includes(index),
      "lines-cell-content--path": pathIndexes.value.includes(index),
      "lines-cell-content--cleared": clearedIndexes.value.includes(index),
      "lines-cell-content--spawned": spawnedIndexes.value.includes(index),
    },
  ];
}

async function finishGame() {
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["lines-five.complete"], 80, 170);
  if (session.status !== "finished") finishSession("game-lost");
}

function chooseCell(index: number) {
  if (session.status !== "running") return;

  const target = targetId(index);
  const result = chooseLinesFiveCell(gameState.value, index);
  gameState.value = result.state;
  clearedIndexes.value = result.cleared;
  spawnedIndexes.value = result.spawned;
  pathIndexes.value = result.path;
  lastMovedFrom.value = result.movedFrom;
  lastMovedTo.value = result.movedTo;

  if (result.event === "selected") {
    feedbackMessage.value = `Шарик выбран. Теперь выбери подсвеченную свободную клетку для перемещения.`;
    recordHint({ targetId: target, text: "Выбран шарик для перемещения." });
    return;
  }

  if (result.event === "invalid") {
    feedbackMessage.value =
      selectedIndex.value === undefined
        ? "Сначала выбери шарик, который нужно передвинуть."
        : "До этой клетки нет свободного пути. Выбери подсвеченную клетку или другой шарик.";
    recordMistake({
      targetId: target,
      row: rowOf(index),
      column: columnOf(index),
      reason: "invalid-lines-move",
      isCorrect: false,
    });
    void feedbackAudio.playMistake();
    return;
  }

  recordSuccess({
    targetId: target,
    row: rowOf(index),
    column: columnOf(index),
    movedFrom: result.movedFrom,
    movedTo: result.movedTo,
    cleared: result.cleared.length,
    spawned: result.spawned.length,
    score: result.state.score,
    isCorrect: true,
  });

  if (result.event === "cleared") {
    feedbackMessage.value = "Ряд собран, шарики исчезли.";
    void feedbackAudio.playSuccess();
    return;
  }

  if (result.event === "spawn-cleared") {
    feedbackMessage.value = `Ход сделан. Новые шары собрали линию: убрано ${result.cleared.length}.`;
    void feedbackAudio.playSuccess();
    return;
  }

  if (result.event === "loss") {
    feedbackMessage.value = "Поле заполнилось. Раунд завершён, можно попробовать снова.";
    recordMistake({
      targetId: target,
      row: rowOf(index),
      column: columnOf(index),
      reason: "board-full",
      isCorrect: false,
    });
    void finishGame();
    return;
  }

  feedbackMessage.value = "Шарик перекатился. Появились два новых шарика.";
  void feedbackAudio.playSuccess();
}

function restart() {
  promptAudio.cancelPending();
  gameState.value = createInitialLinesFiveState();
  lastMovedFrom.value = undefined;
  lastMovedTo.value = undefined;
  clearedIndexes.value = [];
  spawnedIndexes.value = [];
  pathIndexes.value = [];
  feedbackMessage.value =
    "Новая доска готова. Выбери шарик, затем подсвеченную клетку для перемещения.";
  startSession();
  promptAudio.play("lines-five.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("lines-five.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="lines-five-shell">
    <GameHud
      title="Линии"
      :step="session.step"
      :max-steps="session.maxSteps"
      :score="gameState.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :session-seconds="session.settings.sessionSeconds"
      :paused="session.status === 'paused'"
      :show-progress="false"
      :show-timer="false"
      @pause="pauseSession"
      @resume="resumeSession"
    />

    <!-- Testers (recheck): «предлагаю убрать, очень мелко, играть невозможно». A 5×5 board as large
         as the window allows, the next balls beside it; the rules are behind «Правила». -->
    <div class="lines-layout">
      <div class="board-grid" role="grid" aria-label="Поле: пять на пять">
        <template v-for="row in rows" :key="row">
          <GameDwellButton
            v-for="column in columns"
            :key="`${row}-${column}`"
            :target-id="targetId(cellIndex(row, column))"
            :disabled="session.status !== 'running' || gameState.status !== 'playing'"
            :dwell-ms="session.settings.dwellMs"
            min-height="0"
            :color="cellColor(cellIndex(row, column), board[cellIndex(row, column)])"
            role="gridcell"
            @select="chooseCell(cellIndex(row, column))"
          >
            <template #default>
              <div :class="cellClasses(cellIndex(row, column), board[cellIndex(row, column)])">
                <div
                  v-if="board[cellIndex(row, column)]"
                  :class="['ball', `ball--${board[cellIndex(row, column)]}`]"
                />
                <v-icon
                  v-else-if="reachableIndexes.includes(cellIndex(row, column))"
                  class="reachable-icon"
                  icon="mdi-arrow-expand"
                />
              </div>
            </template>
          </GameDwellButton>
        </template>
      </div>

      <aside class="side-column">
        <p class="task-text">{{ feedbackMessage }}</p>
        <div class="next-card">
          <div class="next-title">Следующие</div>
          <div class="d-flex ga-3 align-center justify-center">
            <span
              v-for="(color, index) in gameState.nextBalls"
              :key="`${color}-${index}`"
              :class="['mini-ball', `ball--${color}`]"
            />
          </div>
        </div>
      </aside>
    </div>

    <GameResultDialog
      :model-value="resultVisible"
      title="Линии"
      :score="session.score"
      :mistakes="session.mistakes"
      :duration-ms="durationMs"
      :metrics="metrics"
      :recommendation="recommendation"
      @menu="router.push(resolveMenuRoute())"
      @restart="restart"
    />
  </div>
</template>

<style scoped>
.lines-five-shell {
  background: var(--linka-scene-paper);
  min-block-size: 100dvh;
}

.lines-layout {
  --board-edge: min(calc(100dvh - var(--game-hud-clearance, 10.5rem) - 2rem), calc(100vw - 22rem));

  align-items: center;
  display: grid;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  grid-template-columns: var(--board-edge) minmax(12rem, 18rem);
  justify-content: center;
  padding-block: calc(var(--game-hud-clearance, 10.5rem) + 0.5rem) 1rem;
  padding-inline: 1rem;
}

.board-grid {
  aspect-ratio: 1;
  display: grid;
  gap: clamp(1.25rem, 3.4dvh, 2.25rem);
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(0, 1fr));
  inline-size: var(--board-edge);
}

.board-grid :deep(.dwell-hitbox),
.board-grid :deep(.dwell-button) {
  block-size: 100%;
}

.board-grid :deep(.dwell-button) {
  padding: 0.35rem !important;
}

.lines-cell-content {
  align-items: center;
  block-size: 100%;
  border-radius: 1.125rem;
  display: flex;
  inline-size: 100%;
  justify-content: center;
  transition:
    outline 160ms ease,
    transform 160ms ease;
}

.lines-cell-content--selected {
  outline: 0.35rem solid rgb(var(--v-theme-secondary) / 70%);
  outline-offset: -0.35rem;
}

.lines-cell-content--reachable {
  box-shadow: inset 0 0 0 0.25rem rgb(var(--v-theme-primary) / 28%);
}

.lines-cell-content--path {
  background: rgb(var(--v-theme-primary) / 10%);
}

.lines-cell-content--last {
  outline: 0.25rem solid rgb(var(--v-theme-secondary) / 42%);
  outline-offset: -0.3125rem;
}

.lines-cell-content--cleared {
  transform: scale(1.04);
}

.lines-cell-content--spawned {
  outline: 0.22rem dashed rgb(var(--v-theme-primary) / 32%);
  outline-offset: -0.28rem;
}

.reachable-icon {
  color: rgb(var(--v-theme-primary));
  font-size: calc(var(--board-edge) / 14);
  opacity: 0.72;
}

.ball,
.mini-ball {
  border-radius: 999rem;
  box-shadow:
    0 0.75rem 1.375rem rgb(42 38 30 / 18%),
    inset 0 -0.5625rem 1rem rgb(0 0 0 / 10%);
  display: inline-block;
}

.ball {
  block-size: calc(var(--board-edge) / 8);
  inline-size: calc(var(--board-edge) / 8);
}

.mini-ball {
  block-size: 2.6rem;
  inline-size: 2.6rem;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.task-text {
  color: rgb(38 68 68);
  font-size: clamp(1rem, 2.4dvh, 1.35rem);
  font-weight: 800;
  line-height: 1.3;
  margin: 0;
}

.next-card {
  background: rgb(236 243 246);
  border-radius: 1.25rem;
  padding: 1rem;
}

.next-title {
  color: rgb(38 68 68);
  font-size: 1.15rem;
  font-weight: 800;
  margin-block-end: 0.75rem;
  text-align: center;
}

.ball--sky {
  background: radial-gradient(circle at 34% 28%, #f3fbff 0 24%, #4fc3f7 25% 66%, #0277bd 100%);
}

.ball--sun {
  background: radial-gradient(circle at 34% 28%, #fffde7 0 24%, #ffd54f 25% 66%, #f57f17 100%);
}

.ball--leaf {
  background: radial-gradient(circle at 34% 28%, #f1f8e9 0 24%, #81c784 25% 66%, #2e7d32 100%);
}

.ball--berry {
  background: radial-gradient(circle at 34% 28%, #fce4ec 0 24%, #f06292 25% 66%, #ad1457 100%);
}

@media (max-width: 45rem) {
  .lines-layout {
    --board-edge: min(
      calc(100vw - 2rem),
      calc(100dvh - var(--game-hud-clearance, 10.5rem) - 12rem)
    );

    grid-template-columns: var(--board-edge);
  }
}
</style>
