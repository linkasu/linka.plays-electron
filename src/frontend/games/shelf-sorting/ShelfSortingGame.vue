<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateShelfSortingRound, type ShelfSortingShelf } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("shelf-sorting", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 135
}, {
  finishOnMistakes: false
});

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
    feedbackMessage.value = `Верно. ${round.value.item.label} на своей полке.`;
    recordSuccess({ roundId: round.value.roundId, targetId, itemId: round.value.item.id, expected: round.value.correctShelfId, actual: shelf.id, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 650);
    }
    return;
  }

  pendingSelection.value = true;
  wrongShelfId.value = shelf.id;
  hintedShelfId.value = round.value.correctShelfId;
  feedbackMessage.value = `Почти. Подсказка: ${round.value.hint} Правильная полка мягко подсвечена.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, itemId: round.value.item.id, expected: round.value.correctShelfId, actual: shelf.id, isCorrect: false });
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongShelfId.value = undefined;
    hintedShelfId.value = undefined;
  }, 1100);
}

function shelfColor(shelf: ShelfSortingShelf) {
  if (wrongShelfId.value === shelf.id) return "orange-lighten-4";
  if (successShelfId.value === shelf.id) return "green-lighten-4";
  return shelf.color;
}

function restart() {
  resetFeedback();
  restartRounds();
}

onUnmounted(() => {
  clearFeedbackTimer();
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
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <v-card class="item-card pa-5 pa-md-6 mb-6" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-2">Предмет для сортировки</div>
              <div class="d-flex flex-column flex-sm-row align-center justify-center ga-4">
                <div class="item-emoji emoji-glyph" aria-hidden="true">{{ round.item.emoji }}</div>
                <div class="text-center text-sm-start">
                  <div class="text-h4 font-weight-bold">{{ round.item.label }}</div>
                  <v-chip class="mt-2" color="primary" variant="tonal" size="large">{{ round.rule === "category" ? "сортируем по категории" : "сортируем по цвету" }}</v-chip>
                </div>
              </div>
            </v-card>

            <v-row justify="center">
              <v-col v-for="shelf in round.shelves" :key="shelf.id" cols="12" md="4">
                <GameDwellButton :class="{ 'shelf-choice--hint': hintedShelfId === shelf.id }" :target-id="shelfTargetId(shelf)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="220" :color="shelfColor(shelf)" @select="chooseShelf(shelf)">
                  <template #default>
                    <div class="shelf-choice-content">
                      <v-icon class="shelf-icon mb-3" :icon="shelf.icon" color="brown-darken-2" />
                      <div class="text-h5 font-weight-bold mb-2">{{ shelf.title }}</div>
                      <div class="text-body-2 text-medium-emphasis">{{ shelf.hint }}</div>
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

.item-emoji {
  font-size: clamp(4.8rem, 10vw, 7.8rem);
  line-height: 1;
}

.shelf-choice-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  min-block-size: 170px;
  justify-content: center;
  text-align: center;
}

.shelf-icon {
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 14%));
  font-size: clamp(4.2rem, 8vw, 6.4rem);
}

.shelf-choice--hint {
  box-shadow: 0 0 0 6px rgb(var(--v-theme-warning) / 36%);
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }
}
</style>
