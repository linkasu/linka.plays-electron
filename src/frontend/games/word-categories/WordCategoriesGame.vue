<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateWordCategoriesRound, type WordCategory, type WordCategoryChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("word-categories", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125 },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: generateWordCategoriesRound
});

const feedbackMessage = ref("Посмотри на картинку и выбери ответ без спешки.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const hintedChoiceId = ref<string>();
let feedbackTimer = 0;

const targetCardTitle = computed(() => round.value.mode === "item-to-category" ? "Предмет" : "Категория");
const targetEmoji = computed(() => round.value.mode === "item-to-category" ? round.value.targetItem.emoji : round.value.targetCategory.emoji);
const targetLabel = computed(() => round.value.mode === "item-to-category" ? round.value.targetItem.word : round.value.targetCategory.title);
const modeChip = computed(() => round.value.mode === "item-to-category" ? "предмет → категория" : "категория → предмет");

function isCategoryChoice(choice: WordCategoryChoice): choice is WordCategory {
  return "title" in choice;
}

function choiceLabel(choice: WordCategoryChoice) {
  return isCategoryChoice(choice) ? choice.title : choice.word;
}

function choiceHint(choice: WordCategoryChoice) {
  return isCategoryChoice(choice) ? choice.hint : "предмет";
}

function choiceColor(choice: WordCategoryChoice) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (isCategoryChoice(choice)) return choice.color;
  return "blue-grey-lighten-5";
}

function choiceTargetId(choice: WordCategoryChoice) {
  return `word-categories:${round.value.mode}:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Посмотри на картинку и выбери ответ без спешки.";
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
  hintedChoiceId.value = undefined;
}

function choose(choice: WordCategoryChoice) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice);
  const expectedChoice = round.value.choices[round.value.correctIndex];
  const expectedTargetId = expectedChoice ? choiceTargetId(expectedChoice) : undefined;
  const isCorrect = choice.id === round.value.correctChoiceId;

  clearFeedbackTimer();

  if (isCorrect) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = `Верно. ${round.value.explanation}`;
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.correctChoiceId, actual: choice.id, mode: round.value.mode, itemId: round.value.targetItem.id, categoryId: round.value.targetCategory.id, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 650);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  hintedChoiceId.value = round.value.correctChoiceId;
  feedbackMessage.value = `Почти. ${round.value.explanation} Правильный ответ мягко подсвечен.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.correctChoiceId, actual: choice.id, mode: round.value.mode, itemId: round.value.targetItem.id, categoryId: round.value.targetCategory.id, isCorrect: false });

  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
    hintedChoiceId.value = undefined;
  }, 1200);
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
  <div class="word-categories-shell">
    <GameHud title="Категории слов" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">{{ round.instruction }}</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="word-feedback text-body-1 text-center mb-6">{{ feedbackMessage }}</p>

            <v-card class="target-card pa-5 pa-md-6 mb-6" color="indigo-lighten-5" rounded="xl" variant="flat">
              <div class="target-caption text-caption mb-2">{{ targetCardTitle }}</div>
              <div class="d-flex flex-column flex-sm-row align-center justify-center ga-4">
                <div class="target-emoji emoji-glyph" aria-hidden="true">{{ targetEmoji }}</div>
                <div class="text-center text-sm-start">
                  <div class="text-h4 font-weight-bold">{{ targetLabel }}</div>
                  <v-chip class="mt-2 text-white" color="deep-purple-darken-3" variant="flat" size="large">{{ modeChip }}</v-chip>
                </div>
              </div>
            </v-card>

            <v-row justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" sm="3" md="3">
                <GameDwellButton :class="{ 'choice--hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="choice-content">
                      <div class="choice-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                      <div class="text-h5 font-weight-bold mt-2">{{ choiceLabel(choice) }}</div>
                      <div class="choice-hint text-body-2 mt-2">{{ choiceHint(choice) }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Категории слов" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.word-categories-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #fff7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.target-card {
  border: 2px solid rgb(var(--v-theme-primary) / 14%);
}

.word-feedback,
.target-caption,
.choice-hint {
  color: #263238;
}

.target-emoji {
  font-size: clamp(4.8rem, 10vw, 7.4rem);
  line-height: 1;
}

.choice-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 150px;
  text-align: center;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 5.8rem);
  line-height: 1;
}

.choice--hint {
  box-shadow: 0 0 0 6px rgb(var(--v-theme-warning) / 36%);
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 116px;
  }

  .target-card {
    margin-block-end: 1rem !important;
    padding: 1rem !important;
  }

  .target-emoji,
  .choice-emoji {
    font-size: clamp(3rem, 7vw, 4.5rem);
  }

  .choice-content,
  .game-container :deep(.dwell-button) {
    min-block-size: 9.5rem !important;
  }
}
</style>
