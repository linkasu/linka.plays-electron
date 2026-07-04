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
import { createInitialBoard, isSolved, moveTile, type SlidingPuzzleBoard } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, finishSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("sliding-puzzle", {
  maxSteps: 12,
  overrides: { preset: "gentle", dwellMs: 1200, sessionSeconds: 180, targetScale: 1.2, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "sliding-puzzle", soundEnabled, warmAssetIds: ["sliding-puzzle.prompt", "sliding-puzzle.correct", "sliding-puzzle.mistake", "sliding-puzzle.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const board = ref<SlidingPuzzleBoard>(createInitialBoard());
const feedbackMessage = ref("Собери картинку: выбирай плитку рядом с пустым местом.");
const wrongIndex = ref<number>();
const movedIndex = ref<number>();
const isSpeaking = ref(false);
let feedbackTimer = 0;

const resultVisible = computed(() => session.status === "finished");
const solved = computed(() => isSolved(board.value));

function tileTargetId(tile: number, index: number) {
  return `sliding-puzzle:tile:${tile}:index:${index}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearHints() {
  wrongIndex.value = undefined;
}

async function chooseTile(tile: number, index: number) {
  if (session.status !== "running" || isSpeaking.value || tile === 0) return;

  clearFeedbackTimer();
  const targetId = tileTargetId(tile, index);
  const result = moveTile(board.value, index);

  if (!result.moved) {
    wrongIndex.value = index;
    movedIndex.value = undefined;
    feedbackMessage.value = "Эта плитка не рядом с пустым местом. Найди соседа пустой клетки и попробуй другую.";
    recordMistake({ targetId, answerId: tile, tileIndex: index, isCorrect: false });
    recordHint({ targetId, reason: "not-adjacent", text: "Найти плитку рядом с пустой клеткой." });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["sliding-puzzle.mistake"], 80);
    isSpeaking.value = false;
    feedbackTimer = window.setTimeout(clearHints, 1600);
    return;
  }

  const finishedAfterSuccess = session.step + 1 >= session.maxSteps;
  board.value = result.board;
  clearHints();
  movedIndex.value = result.toIndex;
  const solvedAfterMove = isSolved(board.value);
  feedbackMessage.value = solvedAfterMove ? "Пятнашки собраны. Отличная стратегия." : `Плитка ${tile} встала на пустое место. Ищи следующий соседний ход.`;
  recordSuccess({ targetId, answerId: tile, fromIndex: result.fromIndex, toIndex: result.toIndex, isCorrect: true });

  isSpeaking.value = true;
  void feedbackAudio.playSuccess();
  await promptAudio.playSequenceAndWait(solvedAfterMove || finishedAfterSuccess ? ["sliding-puzzle.correct", "sliding-puzzle.complete"] : ["sliding-puzzle.correct"], 80, 170);
  if (solvedAfterMove) {
    finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }
  if (finishedAfterSuccess) {
    finishSession("max-steps");
    isSpeaking.value = false;
    return;
  }
  promptAudio.play("sliding-puzzle.prompt", 180);
  isSpeaking.value = false;
}

function tileColor(tile: number, index: number) {
  if (wrongIndex.value === index) return "orange-lighten-4";
  if (movedIndex.value === index) return "green-lighten-4";
  return tile % 2 === 0 ? "blue-lighten-5" : "amber-lighten-5";
}

function restart() {
  promptAudio.cancelPending();
  clearFeedbackTimer();
  board.value = createInitialBoard();
  feedbackMessage.value = "Собери картинку: выбирай плитку рядом с пустым местом.";
  wrongIndex.value = undefined;
  movedIndex.value = undefined;
  isSpeaking.value = false;
  startSession();
  promptAudio.play("sliding-puzzle.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("sliding-puzzle.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
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
                <div class="text-overline text-secondary mb-1"> стратегия и зрительный поиск</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Пятнашки 3×3</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Выбирай только плитку-соседа пустой клетки. Ошибка не завершает игру: правило можно проверить ещё раз.</p>
              </div>
              <v-avatar color="primary" rounded="xl" size="76">
                <v-icon icon="mdi-puzzle-outline" size="46" />
              </v-avatar>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="wrongIndex !== undefined ? 'primary' : solved ? 'success' : 'secondary'" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <div class="puzzle-grid mx-auto" role="grid" aria-label="Поле пятнашек три на три">
              <div v-for="(tile, index) in board" :key="`${tile}-${index}`" class="puzzle-cell" role="gridcell">
                <v-card v-if="tile === 0" class="empty-tile" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                  <v-icon color="primary" icon="mdi-arrow-expand-all" size="42" />
                  <div class="text-caption font-weight-bold text-primary mt-1">пусто</div>
                </v-card>
                <GameDwellButton v-else :class="['tile-button', { 'tile-button--wrong': wrongIndex === index }]" :target-id="tileTargetId(tile, index)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="132" :color="tileColor(tile, index)" @select="chooseTile(tile, index)">
                  <template #default>
                    <div class="tile-number">{{ tile }}</div>
                    <div class="tile-caption text-caption mt-1">плитка</div>
                  </template>
                </GameDwellButton>
              </div>
            </div>

            <v-expand-transition>
              <v-alert v-if="wrongIndex !== undefined" class="mt-5 text-h6" color="primary" icon="mdi-hand-pointing-up" rounded="xl" variant="tonal">
                Найди плитку, которая касается пустого места стороной.
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
  padding-block-start: 7rem;
}

.puzzle-grid {
  display: grid;
  gap: clamp(0.625rem, 1.8vw, 1.125rem);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-inline-size: min(90vw, 55vh, 41.25rem);
}

.puzzle-cell,
.empty-tile,
.tile-button {
  aspect-ratio: 1;
}

.empty-tile {
  align-items: center;
  block-size: 100%;
  border: 0.25rem dashed rgb(var(--v-theme-primary) / 22%);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.tile-button {
  block-size: 100%;
}

.tile-button--wrong {
  filter: saturate(0.85);
}

.tile-number {
  color: #0b1117 !important;
  font-size: clamp(3rem, min(12vw, 14vh), 6.8rem);
  font-weight: 900;
  line-height: 1;
}

.tile-caption {
  color: #0b1117 !important;
  font-weight: 800;
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 9.75rem;
  }

 .puzzle-grid {
    gap: 0.55rem;
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
 .game-container.v-avatar,
 .game-container .v-alert {
    display: none;
  }

 .game-container.d-flex.flex-column.flex-md-row {
    margin-block-end: 0.75rem !important;
  }

 .puzzle-grid {
    gap: 0.45rem;
    max-inline-size: min(100%, 28rem);
  }

 .puzzle-grid :deep(.dwell-button) {
    min-block-size: 4rem !important;
    padding: 0.4rem !important;
  }

 .tile-number {
    font-size: 3.1rem;
  }
}
</style>
