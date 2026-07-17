<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import GazePointerOverlay from "../../components/game/GazePointerOverlay.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateWordCategoriesRound, type WordCategoriesMode, type WordCategory, type WordCategoryChoice } from "./model";

const wordCategoriesFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("word-categories", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
pauseSession();
const mode = ref<WordCategoriesMode>("item-to-category");
const selectingMode = ref(true);
const promptAudio = useGamePromptAudio({
  gameId: "word-categories",
  soundEnabled: toRef(session.settings, "sound"),
  volume: 0.34,
  warmAssetIds: ["word-categories.intro", "word-categories.correct", "word-categories.mistake", "word-categories.complete"]
});

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateWordCategoriesRound(session.settings, mode.value, roundIndex)
});

const feedbackMessage = ref("Посмотри на картинку и выбери ответ.");
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
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

function itemAssetId(itemId: string) {
  return `word-categories.item.${itemId}`;
}

function playRoundItemPrompt(delayMs = 0) {
  if (round.value.mode !== "item-to-category") return;
  promptAudio.play(itemAssetId(round.value.targetItem.id), delayMs);
}

function playIntroPrompt(delayMs = 0) {
  if (round.value.mode !== "item-to-category") return;
  promptAudio.playSequence(["word-categories.intro", itemAssetId(round.value.targetItem.id)], delayMs);
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
  feedbackMessage.value = "Посмотри на картинку и выбери ответ.";
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

async function choose(choice: WordCategoryChoice) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice);
  const expectedChoice = round.value.choices[round.value.correctIndex];
  const expectedTargetId = expectedChoice ? choiceTargetId(expectedChoice) : undefined;
  const isCorrect = choice.id === round.value.correctChoiceId;

  clearFeedbackTimer();

  if (isCorrect) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = `Верно. ${round.value.explanation}`;
    void wordCategoriesFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.correctChoiceId, actual: choice.id, mode: round.value.mode, itemId: round.value.targetItem.id, categoryId: round.value.targetCategory.id, isCorrect: true });
    const finishedAfterSuccess = session.step >= session.maxSteps;
    const successAudio = isCategoryChoice(choice) ? ["word-categories.correct"] : ["word-categories.correct", itemAssetId(choice.id)];
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [...successAudio, "word-categories.complete"] : successAudio, 80, 170);
    isSpeaking.value = false;

    if (finishedAfterSuccess) {
      finishSession("game-complete");
      return;
    }

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
        promptAudio.cancelPending();
        playRoundItemPrompt(350);
      }, isCategoryChoice(choice) ? 900 : 2400);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = "Посмотри на картинку и попробуй выбрать другой ответ.";
  void wordCategoriesFeedback.playMistake(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.correctChoiceId, actual: choice.id, mode: round.value.mode, itemId: round.value.targetItem.id, categoryId: round.value.targetCategory.id, isCorrect: false });
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["word-categories.mistake"], 80);
  isSpeaking.value = false;

  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, isCategoryChoice(choice) ? 1200 : 1700);
}

function restart() {
  startGame(mode.value);
}

function startGame(nextMode: WordCategoriesMode) {
  resetFeedback();
  promptAudio.cancelPending();
  mode.value = nextMode;
  selectingMode.value = false;
  restartRounds();
  playIntroPrompt(300);
}

onMounted(() => {
  wordCategoriesFeedback.warm(session.settings.sound);
  promptAudio.warm();
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  wordCategoriesFeedback.dispose();
});
</script>

<template>
  <div class="word-categories-shell">
    <GameHud v-if="!selectingMode" title="Категории слов" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GazePointerOverlay v-else />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="word-game-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div v-if="selectingMode" class="text-center">
              <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Как будем искать слова?</h1>
              <p class="text-body-1 text-md-h6 text-medium-emphasis mb-6">Выбери один режим. Правило не изменится до конца игры.</p>
              <v-row justify="center">
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="word-categories:mode:item-to-category" :dwell-ms="session.settings.dwellMs" min-height="12rem" color="orange-lighten-5" @select="startGame('item-to-category')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <div class="mode-emoji emoji-glyph" aria-hidden="true">🍎</div>
                        <div class="text-h5 font-weight-bold">Предмет → категория</div>
                        <div class="text-body-2 text-grey-darken-3">Посмотри на предмет и выбери его категорию</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="word-categories:mode:category-to-item" :dwell-ms="session.settings.dwellMs" min-height="12rem" color="green-lighten-5" @select="startGame('category-to-item')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <div class="mode-emoji emoji-glyph" aria-hidden="true">🧺</div>
                        <div class="text-h5 font-weight-bold">Категория → предмет</div>
                        <div class="text-body-2 text-grey-darken-3">Посмотри на категорию и выбери предмет</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </div>

            <template v-else>
              <div class="text-overline text-secondary text-center mb-2">{{ round.instruction }}</div>
              <h1 class="word-prompt text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
              <p class="word-feedback text-body-1 text-center mb-6">{{ feedbackMessage }}</p>

              <v-card class="target-card pa-5 pa-md-6 mb-6" color="indigo-lighten-5" rounded="xl" variant="flat">
                <div class="target-caption text-caption mb-2">{{ targetCardTitle }}</div>
                <div class="d-flex flex-column flex-sm-row align-center justify-center ga-4">
                  <GameWordImage v-if="round.mode === 'item-to-category'" class="target-emoji" :word-id="round.targetItem.id" :word="round.targetItem.word" :emoji="round.targetItem.emoji" decorative />
                  <div v-else class="target-emoji emoji-glyph" aria-hidden="true">{{ targetEmoji }}</div>
                  <div class="text-center text-sm-start">
                    <div class="text-h4 font-weight-bold">{{ targetLabel }}</div>
                    <v-chip class="mt-2 text-white" color="deep-purple-darken-3" variant="flat" size="large">{{ modeChip }}</v-chip>
                  </div>
                </div>
              </v-card>

              <v-row justify="center">
                <v-col v-for="choice in round.choices" :key="choice.id" cols="6" :sm="12 / round.choices.length" :md="12 / round.choices.length">
                  <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="11.875rem" :color="choiceColor(choice)" @select="choose(choice)">
                    <template #default>
                      <div class="choice-content">
                        <div v-if="isCategoryChoice(choice)" class="choice-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                        <GameWordImage v-else class="choice-emoji" :word-id="choice.id" :word="choice.word" :emoji="choice.emoji" decorative />
                        <div class="text-h5 font-weight-bold mt-2">{{ choiceLabel(choice) }}</div>
                        <div class="choice-hint text-body-2 mt-2">{{ choiceHint(choice) }}</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </template>
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
  padding-block-start: 8.25rem;
}

.target-card {
  border: 0.125rem solid rgb(var(--v-theme-primary) / 14%);
}

.mode-emoji {
  font-size: clamp(4rem, 9vw, 7rem);
  line-height: 1;
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
  min-block-size: 9.375rem;
  text-align: center;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 5.8rem);
  line-height: 1;
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 9.75rem;
  }
}

@media (max-height: 42rem) {
 .game-container {
    padding-block-start: 4.75rem;
  }

 .word-game-card {
    padding: 1rem !important;
  }

  .word-prompt {
    font-size: clamp(1.6rem, 4vw, 2rem) !important;
    line-height: 1.15;
    margin-block-start: 2rem;
  }

 .word-feedback {
    margin-block-end: 0.75rem !important;
  }

 .target-card {
    margin-block-end: 0.75rem !important;
    padding: 0.75rem !important;
  }

 .target-emoji,
 .choice-emoji {
    font-size: clamp(2.75rem, 6vw, 3.8rem);
  }

 .choice-content,
 .game-container :deep(.dwell-button) {
    min-block-size: 7rem !important;
  }

 .choice-content .text-h5 {
    font-size: 1.25rem !important;
  }

 .choice-hint {
    font-size: 0.78rem !important;
    line-height: 1.15;
  }
}
</style>
