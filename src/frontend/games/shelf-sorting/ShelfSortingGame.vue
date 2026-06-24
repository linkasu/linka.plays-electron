<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateShelfSortingRound, type ShelfSortingShelf } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("shelf-sorting", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 135 },
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "shelf-sorting", soundEnabled: toRef(session.settings, "sound"), volume: 0.3 });

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: generateShelfSortingRound
});

const feedbackMessage = ref("Посмотри на предмет и выбери подходящую полку.");
const pendingSelection = ref(false);
const wrongShelfId = ref<string>();
const successShelfId = ref<string>();
const hintedShelfId = ref<string>();
let feedbackTimer = 0;

function shelfTargetId(shelf: ShelfSortingShelf) {
  return `shelf-sorting:shelf:${round.value.rule}:${shelf.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Посмотри на предмет и выбери подходящую полку.";
  pendingSelection.value = false;
  wrongShelfId.value = undefined;
  successShelfId.value = undefined;
  hintedShelfId.value = undefined;
}

function chooseShelf(shelf: ShelfSortingShelf) {
  if (session.status !== "running" || pendingSelection.value) return;

  const isCorrect = shelf.id === round.value.correctShelfId;
  const targetId = shelfTargetId(shelf);
  const expectedShelf = round.value.shelves[round.value.correctIndex];
  const expectedTargetId = expectedShelf ? shelfTargetId(expectedShelf) : undefined;

  clearFeedbackTimer();

  if (isCorrect) {
    pendingSelection.value = true;
    successShelfId.value = shelf.id;
    feedbackMessage.value = `Верно. ${round.value.item.label} лежит на полке «${shelf.title}».`;
    promptAudio.play("shelf-sorting.correct", 80);
    recordSuccess({ roundId: round.value.roundId, targetId, itemId: round.value.item.id, expected: round.value.correctShelfId, actual: shelf.id, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 950);
    }
    return;
  }

  pendingSelection.value = true;
  wrongShelfId.value = shelf.id;
  hintedShelfId.value = round.value.correctShelfId;
  feedbackMessage.value = `Не эта полка. Подсказка: ${round.value.hint} Подходящая полка подсвечена.`;
  promptAudio.play("shelf-sorting.mistake", 80);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, itemId: round.value.item.id, expected: round.value.correctShelfId, actual: shelf.id, isCorrect: false });
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongShelfId.value = undefined;
    hintedShelfId.value = undefined;
  }, 1300);
}

function shelfColor(shelf: ShelfSortingShelf) {
  if (wrongShelfId.value === shelf.id) return "orange-lighten-4";
  if (successShelfId.value === shelf.id) return "green-lighten-4";
  return shelf.color;
}

function shelfStatus(shelf: ShelfSortingShelf) {
  if (successShelfId.value === shelf.id) return "предмет на полке";
  if (hintedShelfId.value === shelf.id) return "подходящая полка";
  return shelf.hint;
}

function restart() {
  resetFeedback();
  restartRounds();
  promptAudio.play("shelf-sorting.intro", 180);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("shelf-sorting.intro", 420);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="shelf-sorting-shell">
    <GameHud title="Сортировка по полкам" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">{{ round.prompt }}</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Куда положить предмет?</h1>
            <p class="shelf-feedback text-body-1 text-center mb-6">{{ feedbackMessage }}</p>

            <v-card class="item-card pa-5 pa-md-6 mb-6" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="item-caption text-caption mb-2">Предмет для сортировки</div>
              <div class="d-flex flex-column flex-sm-row align-center justify-center ga-4">
                <div :class="['item-emoji emoji-glyph', { 'item-emoji--placed': successShelfId }]" aria-hidden="true">{{ round.item.emoji }}</div>
                <div class="text-center text-sm-start">
                  <div class="text-h4 font-weight-bold">{{ round.item.label }}</div>
                  <v-chip class="mt-2 text-white" color="deep-purple-darken-3" variant="flat" size="large">{{ round.rule === "category" ? "сортируем по категории" : "сортируем по цвету" }}</v-chip>
                </div>
              </div>
            </v-card>

            <v-row justify="center">
              <v-col v-for="shelf in round.shelves" :key="shelf.id" cols="12" sm="4" md="4">
                <GameDwellButton :class="{ 'shelf-choice--hint': hintedShelfId === shelf.id, 'shelf-choice--wrong': wrongShelfId === shelf.id, 'shelf-choice--success': successShelfId === shelf.id }" :target-id="shelfTargetId(shelf)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="shelfColor(shelf)" @select="chooseShelf(shelf)">
                  <template #default>
                    <div class="shelf-choice-content">
                      <div class="shelf-visual mb-4" aria-hidden="true">
                        <div v-if="successShelfId === shelf.id" class="shelf-placed-item emoji-glyph">{{ round.item.emoji }}</div>
                        <v-icon class="shelf-icon" :icon="shelf.icon" color="brown-darken-2" />
                        <div class="shelf-board" />
                      </div>
                      <div class="text-h5 font-weight-bold mb-2">{{ shelf.title }}</div>
                      <div class="shelf-hint text-body-2">{{ shelfStatus(shelf) }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сортировка по полкам" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shelf-sorting-shell {
  background: linear-gradient(135deg, #fff7e6 0%, #eaf7f0 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.item-card {
  border: 2px solid rgb(var(--v-theme-primary) / 16%);
}

.shelf-feedback,
.item-caption,
.shelf-hint {
  color: #263238;
}

.item-emoji {
  font-size: clamp(4.8rem, 10vw, 7.8rem);
  line-height: 1;
  transition: opacity 180ms ease, transform 180ms ease;
}

.item-emoji--placed {
  opacity: 0.35;
  transform: scale(0.84);
}

.shelf-choice-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  min-block-size: 170px;
  justify-content: center;
  text-align: center;
}

.shelf-visual {
  align-items: center;
  block-size: clamp(4.5rem, 9vw, 7rem);
  display: flex;
  inline-size: min(12rem, 78%);
  justify-content: center;
  position: relative;
}

.shelf-icon {
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 14%));
  font-size: clamp(4.2rem, 8vw, 6.4rem);
}

.shelf-board {
  background: #6d4c41;
  block-size: clamp(0.45rem, 1.1vw, 0.75rem);
  border-radius: 999rem;
  box-shadow: 0 0.35rem 0 rgb(72 45 36 / 16%);
  inline-size: 76%;
  inset-block-end: 0.2rem;
  position: absolute;
}

.shelf-placed-item {
  font-size: clamp(2.6rem, 5.5vw, 4.4rem);
  inset-block-start: -0.15rem;
  position: absolute;
  z-index: 1;
}

.shelf-choice--hint {
  box-shadow: 0 0 0 0.375rem rgb(var(--v-theme-warning) / 36%);
}

.shelf-choice--success {
  box-shadow: 0 0 0 0.375rem rgb(var(--v-theme-success) / 30%);
}

.shelf-choice--wrong {
  animation: shelf-wrong 240ms ease-in-out 2;
}

@keyframes shelf-wrong {
  0%, 100% { transform: translateX(0); }
  35% { transform: translateX(-0.35rem); }
  70% { transform: translateX(0.35rem); }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.75rem;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .item-card {
    margin-block-end: 1rem !important;
    padding: 1rem !important;
  }

  .item-emoji,
  .shelf-icon {
    font-size: clamp(3rem, 7vw, 4.5rem);
  }

  .shelf-visual {
    block-size: 4.2rem;
  }

  .shelf-choice-content,
  .game-container :deep(.dwell-button) {
    min-block-size: 9rem !important;
  }
}
</style>
