<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { createSoupRecipeRound, type SoupIngredient } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSession("soup-recipe", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 135
}, {
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const round = createSoupRecipeRound(session.maxSteps);
const placedIngredientIds = ref<string[]>([]);
const hintedIngredientId = ref<string>();
const lastMistakeId = ref<string>();
const resultVisible = ref(false);
const feedbackMessage = ref("Добавляй ингредиенты по порядку. Если ошибёшься, суп спокойно подскажет следующий шаг.");
const currentRoundId = computed(() => `soup-recipe:step:${session.step + 1}`);
const placedIngredients = computed(() => placedIngredientIds.value
  .map((id) => round.ingredients.find((ingredient) => ingredient.id === id))
  .filter((ingredient): ingredient is SoupIngredient => Boolean(ingredient)));
const nextIngredient = computed(() => round.ingredients.find((ingredient) => !placedIngredientIds.value.includes(ingredient.id)));
const recipeComplete = computed(() => placedIngredientIds.value.length >= round.ingredients.length);
let resultTimer = 0;

function ingredientTargetId(ingredient: SoupIngredient) {
  return `soup-recipe:ingredient:${ingredient.id}`;
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function scheduleResultDialog() {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, 1400);
}

function chooseIngredient(ingredient: SoupIngredient) {
  if (session.status !== "running" || placedIngredientIds.value.includes(ingredient.id) || recipeComplete.value) return;

  const expectedIngredient = nextIngredient.value;
  const targetId = ingredientTargetId(ingredient);
  const expectedTargetId = expectedIngredient ? ingredientTargetId(expectedIngredient) : undefined;

  if (ingredient.id !== expectedIngredient?.id) {
    recordMistake({ roundId: currentRoundId.value, targetId, expectedTargetId, expected: expectedIngredient?.id, actual: ingredient.id, isCorrect: false });
    if (expectedIngredient) recordHint({ roundId: currentRoundId.value, targetId: expectedTargetId, reason: "wrong-ingredient-selected" });
    hintedIngredientId.value = expectedIngredient?.id;
    lastMistakeId.value = ingredient.id;
    feedbackMessage.value = expectedIngredient ? `Почти. Следующий ингредиент подсвечен: ${expectedIngredient.label}.` : "Суп уже собран.";
    return;
  }

  placedIngredientIds.value = [...placedIngredientIds.value, ingredient.id];
  hintedIngredientId.value = undefined;
  lastMistakeId.value = undefined;
  recordSuccess({ roundId: currentRoundId.value, targetId, expected: ingredient.id, actual: ingredient.id, isCorrect: true });

  if (recipeComplete.value && session.status === "running") {
    feedbackMessage.value = "Суп готов. Все ингредиенты добавлены по рецепту.";
    finishSession("game-complete");
    return;
  }

  const next = nextIngredient.value;
  feedbackMessage.value = next ? `Верно. Теперь добавь: ${next.label}.` : "Суп готов.";
}

function restart() {
  clearResultTimer();
  resultVisible.value = false;
  placedIngredientIds.value = [];
  hintedIngredientId.value = undefined;
  lastMistakeId.value = undefined;
  feedbackMessage.value = "Добавляй ингредиенты по порядку. Если ошибёшься, суп спокойно подскажет следующий шаг.";
  startSession();
}

onUnmounted(() => {
  clearResultTimer();
});

watch(() => session.status, (status) => {
  if (status === "finished") scheduleResultDialog();
  else {
    clearResultTimer();
    resultVisible.value = false;
  }
});
</script>

<template>
  <div class="soup-recipe-shell">
    <GameHud title="Рецепт супа" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Спокойная кухня</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Свари суп по рецепту</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">Выбирай ингредиенты в нужной очереди. Ошибка не сбрасывает суп, а только мягко показывает следующий шаг.</p>

            <v-card class="recipe-strip pa-4 pa-md-5 mb-6" color="orange-lighten-5" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-3">Рецепт</div>
              <div class="recipe-steps">
                <div v-for="ingredient in round.ingredients" :key="`recipe-${ingredient.id}`" :class="['recipe-step', { 'recipe-step--done': placedIngredientIds.includes(ingredient.id), 'recipe-step--next': ingredient.id === nextIngredient?.id, 'recipe-step--hint': ingredient.id === hintedIngredientId }]">
                  <v-icon :icon="ingredient.icon" size="24" />
                  <span>{{ ingredient.orderIndex }}. {{ ingredient.label }}</span>
                </div>
              </div>
            </v-card>

            <div class="play-area">
              <v-card class="pot-card pa-5 pa-md-6" color="deep-orange-lighten-5" rounded="xl" variant="flat">
                <div class="pot-scene" aria-label="Кастрюля с супом">
                  <div class="steam steam--left" />
                  <div class="steam steam--right" />
                  <div class="pot">
                    <div class="soup-surface">
                      <div v-for="ingredient in placedIngredients" :key="`in-pot-${ingredient.id}`" class="soup-bit" :style="{ background: ingredient.color }">
                        <v-icon :icon="ingredient.icon" size="24" />
                      </div>
                    </div>
                    <div class="pot-body">
                      <v-icon icon="mdi-pot-steam-outline" size="96" />
                    </div>
                  </div>
                </div>
                <div class="text-body-1 text-center text-medium-emphasis mt-4">{{ feedbackMessage }}</div>
                <v-expand-transition>
                  <v-alert v-if="hintedIngredientId && nextIngredient" class="mt-4 text-body-1" color="primary" icon="mdi-lightbulb-on-outline" rounded="xl" variant="tonal">
                    Ошибки не страшны. Посмотри на ингредиент: {{ nextIngredient.label }}.
                  </v-alert>
                </v-expand-transition>
              </v-card>

              <div class="ingredient-grid" aria-label="Ингредиенты для супа">
                <GameDwellButton v-for="ingredient in round.ingredients" :key="ingredient.id" :class="{ 'ingredient-choice--hint': ingredient.id === hintedIngredientId, 'ingredient-choice--mistake': ingredient.id === lastMistakeId }" :target-id="ingredientTargetId(ingredient)" :disabled="session.status !== 'running' || placedIngredientIds.includes(ingredient.id)" :dwell-ms="session.settings.dwellMs" :min-height="150" :color="ingredient.id === hintedIngredientId ? 'primary' : 'surface'" @select="chooseIngredient(ingredient)">
                  <template #default>
                    <div class="ingredient-content" :style="{ opacity: placedIngredientIds.includes(ingredient.id) ? 0.28 : 1 }">
                      <v-avatar :color="ingredient.color" size="64" class="mb-3">
                        <v-icon :icon="ingredient.icon" size="36" />
                      </v-avatar>
                      <div class="text-h6 font-weight-bold">{{ ingredient.label }}</div>
                      <div class="text-caption text-medium-emphasis">шаг {{ ingredient.orderIndex }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Рецепт супа" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.soup-recipe-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #eef7f0 52%, #e3f2fd 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.recipe-strip {
  border: 2px solid rgb(var(--v-theme-secondary) / 14%);
}

.recipe-steps {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.recipe-step {
  align-items: center;
  background: rgb(255 255 255 / 62%);
  border: 2px solid transparent;
  border-radius: 18px;
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.recipe-step--done {
  background: rgb(200 230 201 / 72%);
  color: rgb(27 94 32);
}

.recipe-step--next {
  border-color: rgb(var(--v-theme-secondary) / 32%);
}

.recipe-step--hint {
  border-color: rgb(var(--v-theme-primary) / 54%);
  box-shadow: 0 0 0 6px rgb(var(--v-theme-primary) / 10%);
  transform: translateY(-2px);
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(320px, 1fr) minmax(420px, 1.1fr);
}

.pot-card {
  min-inline-size: 0;
}

.pot-scene {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: 380px;
  overflow: hidden;
  position: relative;
}

.pot {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
}

.pot-body {
  align-items: center;
  background: linear-gradient(180deg, #ffcc80 0%, #ff9800 100%);
  border: 4px solid rgb(121 85 72 / 30%);
  border-radius: 42px 42px 56px 56px;
  box-shadow: inset 0 -16px 22px rgb(93 64 55 / 14%), 0 18px 28px rgb(93 64 55 / 16%);
  color: rgb(93 64 55 / 70%);
  display: flex;
  inline-size: min(360px, 86vw);
  justify-content: center;
  min-block-size: 190px;
}

.soup-surface {
  align-content: center;
  background: radial-gradient(circle, #fff3e0 0%, #ffcc80 54%, #ffb74d 100%);
  border: 4px solid rgb(121 85 72 / 24%);
  border-radius: 999px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  inline-size: min(310px, 74vw);
  justify-content: center;
  min-block-size: 118px;
  padding: 18px;
  transform: translateY(38px);
  z-index: 2;
}

.soup-bit {
  align-items: center;
  border: 2px solid rgb(255 255 255 / 64%);
  border-radius: 999px;
  box-shadow: 0 6px 12px rgb(93 64 55 / 12%);
  display: flex;
  inline-size: 44px;
  justify-content: center;
  min-block-size: 44px;
}

.steam {
  background: rgb(255 255 255 / 64%);
  border-radius: 999px;
  filter: blur(1px);
  inline-size: 22px;
  min-block-size: 118px;
  position: absolute;
  top: 16px;
}

.steam--left {
  inset-inline-start: 34%;
  transform: rotate(10deg);
}

.steam--right {
  inset-inline-end: 34%;
  transform: rotate(-10deg);
}

.ingredient-grid {
  align-content: center;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ingredient-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ingredient-choice--hint {
  filter: drop-shadow(0 0 1rem rgb(var(--v-theme-primary) / 38%));
  transform: scale(1.025);
}

.ingredient-choice--mistake {
  filter: saturate(0.82) opacity(0.82);
}

@media (max-width: 960px) {
  .game-container {
    padding-block-start: 120px;
  }

  .recipe-steps,
  .play-area,
  .ingredient-grid {
    grid-template-columns: 1fr;
  }

  .pot-scene {
    min-block-size: 320px;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .game-container :deep(.v-card.pa-5) {
    padding: 1rem !important;
  }

  .game-container > .v-row p,
  .game-container .text-overline {
    display: none;
  }

  .recipe-strip {
    display: none;
  }

  .play-area {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .ingredient-grid {
    gap: 0.6rem;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    order: -1;
  }

  .ingredient-grid :deep(.dwell-button) {
    padding: 0.75rem !important;
  }

  .pot-card {
    padding: 0.75rem !important;
  }

  .pot-scene {
    min-block-size: 150px;
  }
}
</style>
