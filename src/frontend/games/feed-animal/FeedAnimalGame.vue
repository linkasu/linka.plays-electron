<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type Animal = {
  id: string;
  name: string;
  emoji: string;
  phrase: string;
};

type Food = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

type FeedAnimalRound = {
  roundId: string;
  animal: Animal;
  foods: Food[];
};

const animals: Animal[] = [
  { id: "rabbit", name: "Зайка", emoji: "🐰", phrase: "Зайка ждёт угощение" },
  { id: "puppy", name: "Щенок", emoji: "🐶", phrase: "Щенок смотрит спокойно" },
  { id: "bear", name: "Мишка", emoji: "🐻", phrase: "Мишке можно дать еду" },
  { id: "hamster", name: "Хомяк", emoji: "🐹", phrase: "Хомяк готов кушать" }
];

const foods: Food[] = [
  { id: "apple", name: "Яблоко", emoji: "🍎", color: "red-lighten-4" },
  { id: "carrot", name: "Морковка", emoji: "🥕", color: "orange-lighten-4" },
  { id: "banana", name: "Банан", emoji: "🍌", color: "yellow-lighten-4" },
  { id: "berries", name: "Ягоды", emoji: "🫐", color: "indigo-lighten-4" },
  { id: "pear", name: "Груша", emoji: "🍐", color: "green-lighten-4" },
  { id: "bread", name: "Хлеб", emoji: "🥖", color: "brown-lighten-4" }
];

const router = useRouter();
const isFeeding = ref(false);
const selectedFood = ref<Food>();
let feedbackTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, startSession } = useGameSession("feed-animal", {
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

function foodTargetId(roundId: string, foodId: string) {
  return `feed-animal:${roundId}:food:${foodId}`;
}

function chooseFoods(roundIndex: number) {
  const count = Math.min(3, 1 + ((roundIndex - 1) % 3));
  const start = (roundIndex * 2) % foods.length;
  return Array.from({ length: count }, (_, index) => foods[(start + index) % foods.length]);
}

function generateRound(roundIndex: number): FeedAnimalRound {
  return {
    roundId: `feed-animal-${roundIndex}`,
    animal: animals[(roundIndex - 1) % animals.length],
    foods: chooseFoods(roundIndex)
  };
}

const { round, resultVisible, nextRound, restart: restartRound } = useRoundGame<FeedAnimalRound>({
  session,
  startSession,
  generateRound
});

function feed(food: Food) {
  if (session.status !== "running" || isFeeding.value) return;

  isFeeding.value = true;
  selectedFood.value = food;
  recordSuccess({
    roundId: round.value.roundId,
    targetId: foodTargetId(round.value.roundId, food.id),
    animalId: round.value.animal.id,
    foodId: food.id,
    label: `${round.value.animal.name}: ${food.name}`
  });

  window.clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    selectedFood.value = undefined;
    isFeeding.value = false;
    if (session.status === "running" && session.step < session.maxSteps) nextRound();
  }, 850);
}

function restart() {
  window.clearTimeout(feedbackTimer);
  selectedFood.value = undefined;
  isFeeding.value = false;
  restartRound();
}

onUnmounted(() => {
  window.clearTimeout(feedbackTimer);
});
</script>

<template>
  <div class="feed-animal-shell">
    <GameHud title="Покорми зверька" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="feed-animal-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="8">
          <v-card class="pa-5 pa-md-8" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Любая еда подойдёт</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Покорми зверька</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">Выбери взглядом любую большую еду. Ошибок здесь нет.</p>

            <v-card class="animal-card pa-5 pa-md-7 mb-6 text-center" color="green-lighten-5" rounded="xl" variant="tonal">
              <div :class="['animal-emoji emoji-glyph', { 'animal-emoji--fed': isFeeding }]">{{ round.animal.emoji }}</div>
              <div class="text-h4 text-md-h3 font-weight-bold mt-3">{{ round.animal.name }}</div>
              <v-chip class="mt-4" color="success" size="large" variant="flat" :prepend-icon="isFeeding ? 'mdi-heart' : 'mdi-paw'">
                {{ isFeeding && selectedFood ? `Ням, ${selectedFood.name.toLowerCase()}!` : round.animal.phrase }}
              </v-chip>
            </v-card>

            <v-row justify="center">
              <v-col v-for="food in round.foods" :key="food.id" :cols="round.foods.length === 1 ? 12 : 6" :md="round.foods.length === 1 ? 8 : round.foods.length === 2 ? 6 : 4">
                <GameDwellButton :target-id="foodTargetId(round.roundId, food.id)" :disabled="session.status !== 'running' || isFeeding" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="food.color" @select="feed(food)">
                  <template #default="{ active, progress }">
                    <div class="food-emoji emoji-glyph">{{ food.emoji }}</div>
                    <div class="text-h4 font-weight-bold mt-2">{{ food.name }}</div>
                    <div class="text-body-1 text-medium-emphasis mt-2">
                      {{ active && progress > 0.8 ? "Кормим" : "Выбери" }}
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

@media (max-height: 920px) {
  .feed-animal-container {
    padding-block-start: 7.25rem;
  }

  .animal-card {
    display: none;
  }
}
</style>
