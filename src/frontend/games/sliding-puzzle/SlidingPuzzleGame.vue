<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { createInitialBoard, isSolved, movableTileIndexes, moveTile, type SlidingPuzzleBoard } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("sliding-puzzle", {
  preset: "gentle",
  maxSteps: 12,
  dwellMs: 1200,
  sessionSeconds: 180,
  targetScale: 1.2,
  sound: false
}, {
  finishOnMistakes: false
});

const board = ref<SlidingPuzzleBoard>(createInitialBoard());
const feedbackMessage = ref("Собери картинку: выбирай плитку рядом с пустым местом.");
const hintedIndexes = ref<number[]>([]);
const wrongIndex = ref<number>();
const movedIndex = ref<number>();
let feedbackTimer = 0;

const resultVisible = computed(() => session.status === "finished");
const availableMoves = computed(() => movableTileIndexes(board.value));
const solved = computed(() => isSolved(board.value));

function tileTargetId(tile: number, index: number) {
  return `sliding-puzzle:tile:${tile}:index:${index}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearHints() {
  hintedIndexes.value = [];
  wrongIndex.value = undefined;
}

function chooseTile(tile: number, index: number) {
  if (session.status !== "running" || tile === 0) return;

  clearFeedbackTimer();
  const targetId = tileTargetId(tile, index);
  const result = moveTile(board.value, index);

  if (!result.moved) {
    const moves = availableMoves.value;
    hintedIndexes.value = moves;
    wrongIndex.value = index;
    movedIndex.value = undefined;
    feedbackMessage.value = "Эта плитка не рядом с пустым местом. Возможные ходы мягко подсвечены.";
    recordMistake({ targetId, answerId: tile, tileIndex: index, expectedIndexes: moves, isCorrect: false });
    recordHint({ targetId, reason: "not-adjacent", possibleMoves: moves });
    feedbackTimer = window.setTimeout(clearHints, 1600);
    return;
  }

  board.value = result.board;
  clearHints();
  movedIndex.value = result.toIndex;
  feedbackMessage.value = solved.value ? "Пятнашки собраны. Отличная спокойная стратегия." : `Плитка ${tile} мягко встала на пустое место. Ищи следующий соседний ход.`;
  recordSuccess({ targetId, answerId: tile, fromIndex: result.fromIndex, toIndex: result.toIndex, isCorrect: true });

  if (isSolved(board.value)) {
    finishSession("game-complete");
    return;
  }
}

function tileColor(tile: number, index: number) {
  if (hintedIndexes.value.includes(index)) return "primary";
  if (wrongIndex.value === index) return "orange-lighten-4";
  if (movedIndex.value === index) return "green-lighten-4";
  return tile % 2 === 0 ? "blue-lighten-5" : "amber-lighten-5";
}

function restart() {
  clearFeedbackTimer();
  board.value = createInitialBoard();
  feedbackMessage.value = "Собери картинку: выбирай плитку рядом с пустым местом.";
  hintedIndexes.value = [];
  wrongIndex.value = undefined;
  movedIndex.value = undefined;
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="sliding-puzzle-shell">
    <GameHud title="Пятнашки 3×3" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-4 pa-md-7" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Спокойная стратегия и зрительный поиск</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Пятнашки 3×3</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Выбирай только плитку-соседа пустой клетки. Ошибка не завершает игру, а показывает возможные ходы.</p>
              </div>
              <v-avatar color="primary" rounded="xl" size="76">
                <v-icon icon="mdi-puzzle-outline" size="46" />
              </v-avatar>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="hintedIndexes.length ? 'primary' : solved ? 'success' : 'secondary'" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <div class="puzzle-grid mx-auto" role="grid" aria-label="Поле пятнашек три на три">
              <div v-for="(tile, index) in board" :key="`${tile}-${index}`" class="puzzle-cell" role="gridcell">
                <v-card v-if="tile === 0" class="empty-tile" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                  <v-icon color="primary" icon="mdi-arrow-expand-all" size="42" />
                  <div class="text-caption font-weight-bold text-primary mt-1">пусто</div>
                </v-card>
                <GameDwellButton v-else :class="['tile-button', { 'tile-button--hint': hintedIndexes.includes(index), 'tile-button--wrong': wrongIndex === index }]" :target-id="tileTargetId(tile, index)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="132" :color="tileColor(tile, index)" @select="chooseTile(tile, index)">
                  <template #default>
                    <div class="tile-number">{{ tile }}</div>
                    <div v-if="availableMoves.includes(index)" class="text-caption font-weight-bold text-primary mt-1">можно</div>
                    <div v-else class="text-caption text-medium-emphasis mt-1">плитка</div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <v-expand-transition>
              <v-alert v-if="hintedIndexes.length" class="mt-5 text-h6" color="primary" icon="mdi-hand-pointing-up" rounded="xl" variant="tonal">
                Выбери одну из подсвеченных плиток рядом с пустой клеткой.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Пятнашки 3×3" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.sliding-puzzle-shell {
  background:
    radial-gradient(circle at 15% 18%, rgb(255 224 178 / 64%), transparent 30%),
    radial-gradient(circle at 84% 16%, rgb(187 222 251 / 62%), transparent 28%),
    linear-gradient(135deg, #fff8ed 0%, #eef7ff 52%, #f4f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.puzzle-grid {
  display: grid;
  gap: clamp(10px, 1.8vw, 18px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-inline-size: min(90vw, 660px);
}

.puzzle-cell,
.empty-tile,
.tile-button {
  aspect-ratio: 1;
}

.empty-tile {
  align-items: center;
  block-size: 100%;
  border: 4px dashed rgb(var(--v-theme-primary) / 22%);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tile-button {
  block-size: 100%;
}

.tile-button--hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.02);
}

.tile-button--wrong {
  filter: saturate(0.85);
}

.tile-number {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(3rem, min(12vw, 14vh), 6.8rem);
  font-weight: 900;
  line-height: 1;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }

  .puzzle-grid {
    gap: 0.55rem;
  }
}
</style>
