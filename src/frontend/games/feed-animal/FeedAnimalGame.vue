<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { feedAnimalFeedback } from "./audio";
import { animalEatsFood, generateFeedAnimalRound, type FeedAnimalFood, type FeedAnimalRound } from "./model";

const router = useRouter();
const isFeeding = ref(false);
const selectedFood = ref<FeedAnimalFood>();
const revealedFoodId = ref<string>();
const mistakeFoodId = ref<string>();
const feedbackText = ref("Выбери, что ест зверёк.");
let feedbackTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("feed-animal", {
  maxSteps: 8,
  overrides: {
    preset: "gentle",
    targetScale: 1.6,
    motionSpeed: 0.45,
    distractors: "none",
    hints: "high"
  },
  finishOnMistakes: false
});
const promptAudio = useGamePromptAudio({ gameId: "feed-animal", soundEnabled: toRef(session.settings, "sound") });
const responseAudio = useGamePromptAudio({ gameId: "feed-animal", soundEnabled: toRef(session.settings, "sound") });

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame<FeedAnimalRound>({
  session,
  startSession,
  generateRound: generateFeedAnimalRound
});

function foodTargetId(roundId: string, foodId: string) {
  return `feed-animal:${roundId}:food:${foodId}`;
}

function playPrompt(delayMs = 0) {
  promptAudio.cancelPending();
  promptAudio.play(`feed-animal.prompt.${round.value.animal.id}`, delayMs);
}

function playResponseTts(id: string, delayMs = 920) {
  responseAudio.cancelPending();
  responseAudio.play(id, delayMs);
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
    void feedAnimalFeedback.playSuccess(session.settings.sound);
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
  void feedAnimalFeedback.playMistake(session.settings.sound);
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
}

function restart() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  responseAudio.cancelPending();
  resetRoundState();
  restartRound();
  playPrompt(160);
}

onMounted(() => {
  feedAnimalFeedback.warm(session.settings.sound);
  promptAudio.warm();
  responseAudio.warm();
  playPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  feedAnimalFeedback.warm(enabled);
});

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
  promptAudio.dispose();
  responseAudio.dispose();
  feedAnimalFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff7e8 0%, #ecfff2 52%, #eef7ff 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Покорми зверька" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="feed-animal-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="feed-animal-card pa-4 pa-md-5" color="surface" rounded="xl" elevation="8">
            <div class="feed-animal-overline text-overline text-secondary text-center mb-2">Что ест зверёк</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Покорми зверька</h1>
            <p class="feed-animal-feedback text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>

            <v-card class="animal-card pa-4 pa-md-5 mb-5 text-center" color="green-lighten-5" rounded="xl" variant="tonal">
              <div :class="['animal-emoji emoji-glyph', { 'animal-emoji--fed': isFeeding }]">{{ round.animal.emoji }}</div>
              <div class="animal-card__text">
                <div class="animal-title text-h4 text-md-h3 font-weight-bold">{{ round.animal.name }}</div>
                <v-chip class="animal-chip mt-3" color="success" size="large" variant="flat" :prepend-icon="isFeeding ? 'mdi-heart' : 'mdi-paw'">
                {{ isFeeding && selectedFood && animalEatsFood(round.animal, selectedFood) ? `Ням, ${selectedFood.name.toLowerCase()}!` : round.animal.phrase }}
                </v-chip>
              </div>
            </v-card>

            <v-row justify="center">
              <v-col v-for="food in round.foods" :key="food.id" cols="12" sm="4">
                <GameDwellButton :class="[{ 'food-choice--hint': revealedFoodId === food.id, 'food-choice--mistake': mistakeFoodId === food.id }]" :target-id="foodTargetId(round.roundId, food.id)" :disabled="session.status !== 'running' || isFeeding" :dwell-ms="session.settings.dwellMs" min-height="clamp(9.25rem, 20vh, 13rem)" :color="food.color" @select="feed(food)">
                  <template #default="{ active, progress }">
                    <div class="food-emoji emoji-glyph">{{ food.emoji }}</div>
                    <div class="food-choice-label text-h4 font-weight-bold mt-2">{{ food.name }}</div>
                    <div class="food-choice-status text-body-1 font-weight-medium mt-2">
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
  </GamePageShell>
</template>

<style scoped>
.animal-card {
  align-items: center;
  background: rgb(var(--v-theme-success) / 12%) !important;
  display: flex;
  gap: clamp(1rem, 3vw, 2rem);
  justify-content: center;
  overflow: hidden;
}

.animal-card__text {
  color: rgb(var(--v-theme-on-surface));
  min-inline-size: 0;
}

.animal-title {
  color: rgb(var(--v-theme-on-surface));
}

.animal-chip {
  color: rgb(var(--v-theme-on-success)) !important;
}

.animal-emoji {
  font-size: clamp(5.5rem, min(10vw, 14vh), 8rem);
  line-height: 1;
  transition: transform 260ms ease;
}

.animal-emoji--fed {
  transform: scale(1.08) rotate(-3deg);
}

.food-emoji {
  font-size: clamp(3.75rem, min(8vw, 12vh), 6rem);
  line-height: 1;
}

.food-choice-label,
.food-choice-status {
  color: rgb(var(--v-theme-on-surface));
}

.food-choice--hint {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-success) / 42%));
  transform: scale(1.02);
}

.food-choice--mistake {
  filter: saturate(0.72) opacity(0.76);
}

@media (max-height: 920px) {
 .feed-animal-overline {
    display: none;
  }

 .feed-animal-feedback {
    margin-block-end: 1rem !important;
  }

 .feed-animal-card {
    padding-block: 1rem !important;
  }

 .animal-card {
    margin-block-end: 1rem !important;
    padding-block: 0.75rem !important;
  }

 .animal-emoji {
    font-size: clamp(4rem, min(8vw, 11vh), 5.75rem);
  }

 .animal-title {
    font-size: clamp(1.5rem, 3vw, 2rem) !important;
  }

 .animal-chip {
    font-size: 0.95rem !important;
  }
}
</style>
