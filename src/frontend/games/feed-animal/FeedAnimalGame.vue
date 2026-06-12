<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeFeedAnimalAudio, playFeedAnimalMistakeMelody, playFeedAnimalSuccessMelody, warmFeedAnimalAudio } from "./audio";
import { animalEatsFood, generateFeedAnimalRound, type FeedAnimalFood, type FeedAnimalRound } from "./model";

const router = useRouter();
const isFeeding = ref(false);
const selectedFood = ref<FeedAnimalFood>();
const revealedFoodId = ref<string>();
const mistakeFoodId = ref<string>();
const feedbackText = ref("Выбери, что ест зверёк.");
const feedAnimalTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "feed-animal");
let feedbackTimer = 0;
let promptTimer = 0;
let responseTtsTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("feed-animal", {
  preset: "gentle",
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 90,
  targetScale: 1.6,
  motionSpeed: 0.45,
  distractors: "none",
  hints: "high"
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame<FeedAnimalRound>({
  session,
  startSession,
  generateRound: generateFeedAnimalRound
});

function foodTargetId(roundId: string, foodId: string) {
  return `feed-animal:${roundId}:food:${foodId}`;
}

function ttsAsset(id: string) {
  return feedAnimalTtsAssets.find((asset) => asset.id === id);
}

function playPrompt(delayMs = 0) {
  window.clearTimeout(promptTimer);
  promptTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(`feed-animal.prompt.${round.value.animal.id}`), 0.36);
  }, delayMs);
}

function playResponseTts(id: string, delayMs = 920) {
  window.clearTimeout(responseTtsTimer);
  responseTtsTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(id), 0.36);
  }, delayMs);
}

function resetRoundState() {
  selectedFood.value = undefined;
  revealedFoodId.value = undefined;
  mistakeFoodId.value = undefined;
  isFeeding.value = false;
  feedbackText.value = "Выбери, что ест зверёк.";
}

function prepareNextRound() {
  window.clearTimeout(feedbackTimer);
  isFeeding.value = true;
  feedbackTimer = window.setTimeout(() => {
    resetRoundState();
    if (session.status === "running" && session.step < session.maxSteps) {
      nextRound();
      playPrompt(160);
    }
  }, 2300);
}

function feed(food: FeedAnimalFood) {
  if (session.status !== "running" || isFeeding.value) return;

  selectedFood.value = food;
  const isCorrect = animalEatsFood(round.value.animal, food);
  const targetId = foodTargetId(round.value.roundId, food.id);
  const expectedTargetId = foodTargetId(round.value.roundId, round.value.correctFood.id);

  if (isCorrect) {
    feedbackText.value = `Да, ${round.value.animal.name.toLowerCase()} это ест.`;
    revealedFoodId.value = food.id;
    mistakeFoodId.value = undefined;
    void playFeedAnimalSuccessMelody(session.settings.sound);
    playResponseTts("feed-animal.correct");
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      animalId: round.value.animal.id,
      foodId: food.id,
      label: `${round.value.animal.name}: ${food.name}`,
      isCorrect: true
    });
    prepareNextRound();
    return;
  }

  feedbackText.value = `Нет, ${round.value.animal.name.toLowerCase()} это не ест. Подходит: ${round.value.correctFood.name.toLowerCase()}.`;
  revealedFoodId.value = round.value.correctFood.id;
  mistakeFoodId.value = food.id;
  void playFeedAnimalMistakeMelody(session.settings.sound);
  playResponseTts("feed-animal.mistake");
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    animalId: round.value.animal.id,
    foodId: food.id,
    expectedFoodId: round.value.correctFood.id,
    label: `${round.value.animal.name}: ${food.name}`,
    isCorrect: false
  });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, message: "Показана подходящая еда." });
  prepareNextRound();
}

function restart() {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTtsTimer);
  resetRoundState();
  restartRound();
  playPrompt(160);
}

onMounted(() => {
  warmFeedAnimalAudio(session.settings.sound);
  warmTtsAssets(session.settings.sound, feedAnimalTtsAssets);
  playPrompt(450);
});

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTtsTimer);
  disposeFeedAnimalAudio();
  disposeTtsAssets(feedAnimalTtsAssets);
});
</script>

<template>
  <div class="feed-animal-shell">
    <GameHud title="Покорми зверька" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="feed-animal-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="feed-animal-overline text-overline text-secondary text-center mb-2">Что ест зверёк</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Покорми зверька</h1>
            <p class="feed-animal-feedback text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>

            <v-card class="animal-card pa-5 pa-md-7 mb-6 text-center" color="green-lighten-5" rounded="xl" variant="tonal">
              <div :class="['animal-emoji emoji-glyph', { 'animal-emoji--fed': isFeeding }]">{{ round.animal.emoji }}</div>
              <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ round.animal.name }}</div>
              <v-chip class="mt-4" color="success" size="large" variant="flat" :prepend-icon="isFeeding ? 'mdi-heart' : 'mdi-paw'">
                {{ isFeeding && selectedFood && animalEatsFood(round.animal, selectedFood) ? `Ням, ${selectedFood.name.toLowerCase()}!` : round.animal.phrase }}
              </v-chip>
            </v-card>

            <v-row justify="center">
              <v-col v-for="food in round.foods" :key="food.id" cols="12" sm="4">
                <GameDwellButton :class="[{ 'food-choice--hint': revealedFoodId === food.id, 'food-choice--mistake': mistakeFoodId === food.id }]" :target-id="foodTargetId(round.roundId, food.id)" :disabled="session.status !== 'running' || isFeeding" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="food.color" @select="feed(food)">
                  <template #default="{ active, progress }">
                    <div class="food-emoji emoji-glyph">{{ food.emoji }}</div>
                    <div class="text-h4 font-weight-bold mt-2">{{ food.name }}</div>
                    <div class="text-body-1 text-medium-emphasis mt-2">
                      {{ revealedFoodId === food.id ? "Подходит" : mistakeFoodId === food.id ? "Не подходит" : active && progress > 0.8 ? "Проверяем" : "Выбери" }}
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Покорми зверька" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.feed-animal-shell {
  background: linear-gradient(135deg, #fff7e8 0%, #ecfff2 52%, #eef7ff 100%);
  min-block-size: 100vh;
}

.feed-animal-container {
  padding-block-start: 132px;
}

.animal-card {
  overflow: hidden;
}

.animal-emoji {
  font-size: clamp(7rem, 17vw, 12rem);
  line-height: 1;
  transition: transform 260ms ease;
}

.animal-emoji--fed {
  transform: scale(1.08) rotate(-3deg);
}

.food-emoji {
  font-size: clamp(4.5rem, 10vw, 7rem);
  line-height: 1;
}

.food-choice--hint {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-success) / 42%));
  transform: scale(1.02);
}

.food-choice--mistake {
  filter: saturate(0.72) opacity(0.76);
}

@media (max-height: 920px) {
  .feed-animal-container {
    padding-block-start: 6.75rem;
  }

  .feed-animal-overline {
    display: none;
  }

  .feed-animal-feedback {
    margin-block-end: 1rem !important;
  }

  .animal-card {
    display: none;
  }
}
</style>
