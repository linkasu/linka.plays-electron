<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { sandwichFeedback } from "./audio";
import { buildSandwichSteps, getSandwichRecipe, isSandwichRecipeCompleteStep, sandwichMaxSteps, shuffleSandwichChoices, type SandwichChoice, type SandwichRecipeStep } from "./model";

const recipePauseMs = 1250;

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("sandwich", {
  maxSteps: sandwichMaxSteps(),
  overrides: { dwellMs: 1300, sessionSeconds: 150, sound: true },
  finishOnMistakes: false
});

const resultVisible = ref(false);
const plateSteps = ref<SandwichRecipeStep[]>([]);
const feedbackMessage = ref("Собираем бутерброд по рецепту: хлеб, масло, начинка, овощи и верхний хлеб.");
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const visibleChoices = ref<SandwichChoice[]>(shuffleSandwichChoices());
const isSpeaking = ref(false);
const isFeedbackPlaying = ref(false);
const isRecipeResting = ref(false);
const isInputCoolingDown = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "sandwich", soundEnabled: toRef(session.settings, "sound") });
const ingredientAudio = useGamePromptAudio({
  gameId: "word-categories",
  soundEnabled: toRef(session.settings, "sound"),
  warmAssetIds: ["word-categories.item.bread", "word-categories.item.cheese", "word-categories.item.tomato"]
});
let feedbackTimer = 0;
let recipeTimer = 0;
let cooldownTimer = 0;

const steps = computed(() => buildSandwichSteps());
const visibleStepIndex = computed(() => isRecipeResting.value ? Math.max(0, session.step - 1) : Math.min(session.step, session.maxSteps - 1));
const currentStep = computed(() => steps.value[visibleStepIndex.value]);
const currentRecipe = computed(() => getSandwichRecipe(currentStep.value.recipeIndex));
const completedSandwiches = computed(() => Math.floor(session.step / currentRecipe.value.steps.length));
const plateLayers = computed(() => plateSteps.value.map((step, index) => ({ ...step, layerKey: `${step.id}:${index}` })));
const currentPrompt = computed(() => currentStep.value?.instruction ?? "Бутерброды готовы. Спасибо за сборку.");

function choiceTargetId(choice: SandwichChoice) {
  return `sandwich:choice:${choice.id}`;
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(recipeTimer);
  window.clearTimeout(cooldownTimer);
  feedbackTimer = 0;
  recipeTimer = 0;
  cooldownTimer = 0;
}

function clearTransientFeedback() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["sandwich.prompt"], delayMs);
  const ingredientAssetId = currentStep.value?.choice.ttsAssetId;
  if (ingredientAssetId) await ingredientAudio.playSequenceAndWait([ingredientAssetId], 100);
  isSpeaking.value = false;
}

async function playCurrentIngredientName(delayMs = 0) {
  const ingredientAssetId = currentStep.value?.choice.ttsAssetId;
  if (ingredientAssetId) await ingredientAudio.playSequenceAndWait([ingredientAssetId], delayMs);
}

function startInputCooldown() {
  isInputCoolingDown.value = true;
  window.clearTimeout(cooldownTimer);
  cooldownTimer = window.setTimeout(() => {
    isInputCoolingDown.value = false;
  }, 650);
}

function resetPlateForNextRecipe() {
  plateSteps.value = [];
  visibleChoices.value = shuffleSandwichChoices();
  clearTransientFeedback();
  isRecipeResting.value = false;
  feedbackMessage.value = `${currentRecipe.value.title}. ${currentRecipe.value.helper}`;
  void playPrompt(150);
  startInputCooldown();
}

function scheduleRecipeReset(completedStep: SandwichRecipeStep) {
  isRecipeResting.value = true;
  clearTransientFeedback();
  feedbackMessage.value = `${getSandwichRecipe(completedStep.recipeIndex).title} готов. Посмотри на бутерброд, потом начнём следующий.`;
  window.clearTimeout(recipeTimer);
  recipeTimer = window.setTimeout(resetPlateForNextRecipe, recipePauseMs);
}

function choiceColor(choice: SandwichChoice) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  return "surface";
}

async function chooseIngredient(choice: SandwichChoice) {
  if (session.status !== "running" || isRecipeResting.value || isInputCoolingDown.value || isSpeaking.value || isFeedbackPlaying.value) return;

  const expectedStep = steps.value[session.step];
  if (!expectedStep) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(expectedStep.choice);
  clearTransientFeedback();

  if (choice.id === expectedStep.choice.id) {
    isFeedbackPlaying.value = true;
    plateSteps.value.push(expectedStep);
    successChoiceId.value = choice.id;
    feedbackMessage.value = `${choice.shortLabel}: слой на месте.`;
    recordSuccess({ roundId: expectedStep.roundId, targetId, expectedTargetId, expected: expectedStep.choice.id, actual: choice.id, recipeId: expectedStep.recipeId, isCorrect: true });
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await sandwichFeedback.playSuccess(session.settings.sound);
    if (finishedAfterSuccess) {
      await promptAudio.playSequenceAndWait(["sandwich.correct", "sandwich.complete"], 80, 170);
      isFeedbackPlaying.value = false;
      resultVisible.value = true;
      return;
    }
    if (session.status === "running" && isSandwichRecipeCompleteStep(expectedStep)) {
      await promptAudio.playSequenceAndWait(["sandwich.correct", "sandwich.recipe-complete"], 80, 170);
      isFeedbackPlaying.value = false;
      scheduleRecipeReset(expectedStep);
    }
    else {
      await promptAudio.playSequenceAndWait(["sandwich.correct"], 80);
      await playCurrentIngredientName(100);
      isFeedbackPlaying.value = false;
      feedbackTimer = window.setTimeout(() => {
        successChoiceId.value = undefined;
      }, 650);
    }
    return;
  }

  isFeedbackPlaying.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = "Посмотри рецепт и ингредиенты ещё раз.";
  recordMistake({ roundId: expectedStep.roundId, targetId, expectedTargetId, expected: expectedStep.choice.id, actual: choice.id, recipeId: expectedStep.recipeId, isCorrect: false });
  await sandwichFeedback.playMistake(session.settings.sound);
  await promptAudio.playSequenceAndWait(["sandwich.mistake"], 80);
  isFeedbackPlaying.value = false;
  feedbackTimer = window.setTimeout(clearTransientFeedback, 1200);
}

function restart() {
  clearTimers();
  promptAudio.cancelPending();
  ingredientAudio.cancelPending();
  plateSteps.value = [];
  visibleChoices.value = shuffleSandwichChoices();
  resultVisible.value = false;
  isSpeaking.value = false;
  isFeedbackPlaying.value = false;
  isRecipeResting.value = false;
  isInputCoolingDown.value = false;
  feedbackMessage.value = "Собираем бутерброд по рецепту: хлеб, масло, начинка, овощи и верхний хлеб.";
  startSession();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  ingredientAudio.warm();
  sandwichFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearTimers();
  promptAudio.cancelPending();
  ingredientAudio.cancelPending();
  sandwichFeedback.dispose();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    if (isSpeaking.value || isFeedbackPlaying.value) return;
    clearTimers();
    feedbackTimer = window.setTimeout(() => {
      resultVisible.value = true;
    }, 900);
    return;
  }

  resultVisible.value = false;
});
</script>

<template>
  <GamePageShell class="sandwich-page" gradient="linear-gradient(135deg, #fff8e1 0%, #eef8ee 54%, #fff3e0 100%)" padding-top="4rem">
    <template #hud>
      <GameHud title="Бутерброд" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="sandwich-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="sandwich-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Последовательность действий</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-1">Собери бутерброд</h1>
            <p class="intro text-body-1 text-medium-emphasis text-center mb-3">Выбирай ингредиенты по рецепту. Готовый бутерброд немного побудет на тарелке, потом начнём следующий.</p>

            <div class="recipe-strip mb-3" :aria-label="`Рецепт: ${currentRecipe.helper}`">
              <div
                v-for="(ingredient, index) in currentRecipe.steps"
                :key="`${currentRecipe.id}:${index}`"
                :class="['recipe-step', { 'recipe-step--done': isRecipeResting || index < currentStep.stepIndex, 'recipe-step--current': !isRecipeResting && index === currentStep.stepIndex }]"
              >
                <div class="recipe-step-visual">
                  <GameWordImage v-if="ingredient.imageId" :word-id="ingredient.imageId" :word="ingredient.label" :emoji="ingredient.emoji" decorative />
                  <span v-else class="emoji-glyph" aria-hidden="true">{{ ingredient.emoji }}</span>
                  <v-icon v-if="ingredient.roleIcon" class="ingredient-role" :icon="ingredient.roleIcon" size="small" />
                </div>
                <div class="recipe-step-label text-caption font-weight-bold">{{ ingredient.label }}</div>
              </div>
            </div>

            <v-card class="prompt-card pa-3 pa-md-4 mb-3" color="green-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center ga-3">
                <div class="current-ingredient" :style="{ backgroundColor: currentStep.choice.color }">
                  <GameWordImage v-if="currentStep.choice.imageId" :word-id="currentStep.choice.imageId" :word="currentStep.choice.label" :emoji="currentStep.choice.emoji" decorative />
                  <span v-else class="emoji-glyph" aria-hidden="true">{{ currentStep.choice.emoji }}</span>
                  <v-icon v-if="currentStep.choice.roleIcon" class="ingredient-role" :icon="currentStep.choice.roleIcon" size="small" />
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">{{ currentRecipe.title }} · шаг {{ currentStep.stepIndex + 1 }} из {{ currentRecipe.steps.length }}</div>
                  <div class="text-h6 text-md-h5 font-weight-bold">{{ isRecipeResting ? `${currentRecipe.title} готов` : currentPrompt }}</div>
                  <div class="text-body-2 text-medium-emphasis">{{ feedbackMessage }}</div>
                </div>
              </div>
            </v-card>

            <div class="play-area">
              <v-card class="plate-card pa-3 pa-md-4" color="orange-lighten-5" rounded="xl" variant="flat">
                <div class="plate-stage" aria-label="Собранный бутерброд">
                  <div class="plate-shadow" />
                  <div class="plate">
                    <div v-if="plateLayers.length === 0" class="empty-plate text-body-1 text-medium-emphasis">Тарелка ждёт нижний хлеб</div>
                    <div v-for="layer in plateLayers" :key="layer.layerKey" :class="['sandwich-layer', `sandwich-layer--${layer.choice.kind}`]" :style="{ background: layer.choice.color }">
                      <GameWordImage v-if="layer.choice.imageId" class="layer-image mr-2" :word-id="layer.choice.imageId" :word="layer.choice.label" :emoji="layer.choice.emoji" decorative />
                      <span v-else class="emoji-glyph mr-2" aria-hidden="true">{{ layer.choice.emoji }}</span>
                      <span>{{ layer.choice.shortLabel }}</span>
                    </div>
                  </div>
                </div>
                <div class="d-flex flex-wrap justify-center ga-2 mt-3">
                  <v-chip color="green" variant="tonal">Готово: {{ completedSandwiches }}</v-chip>
                  <v-chip color="primary" variant="tonal">Шаг {{ Math.min(session.step + 1, session.maxSteps) }} из {{ session.maxSteps }}</v-chip>
                </div>
              </v-card>

              <div class="ingredient-grid" aria-label="Ингредиенты для бутерброда">
                <GameDwellButton v-for="choice in visibleChoices" :key="choice.id" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isRecipeResting || isInputCoolingDown || isSpeaking || isFeedbackPlaying" :dwell-ms="session.settings.dwellMs" min-height="6.5rem" :color="choiceColor(choice)" @select="chooseIngredient(choice)">
                  <template #default>
                    <div class="ingredient-content">
                      <div class="choice-visual" :style="{ backgroundColor: choice.color }">
                        <GameWordImage v-if="choice.imageId" :word-id="choice.imageId" :word="choice.label" :emoji="choice.emoji" decorative />
                        <span v-else class="emoji-glyph" aria-hidden="true">{{ choice.emoji }}</span>
                        <v-icon v-if="choice.roleIcon" class="ingredient-role" :icon="choice.roleIcon" size="small" />
                      </div>
                      <div class="text-subtitle-1 font-weight-bold mt-2">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Бутерброд" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.sandwich-page {
  min-block-size: 100vh;
  min-block-size: 100dvh;
}

.sandwich-container {
  padding-block-end: 1rem;
}

.sandwich-card {
  background: rgb(255 251 244 / 96%);
  min-block-size: min(46rem, calc(100dvh - 5rem));
}

.intro {
  max-inline-size: 58rem;
  margin-inline: auto;
}

.prompt-card {
  border: 0.125rem solid rgb(var(--v-theme-warning) / 18%);
}

.recipe-strip {
  display: grid;
  gap: clamp(0.35rem, 0.7vw, 0.7rem);
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.recipe-step {
  align-items: center;
  background: rgb(var(--v-theme-surface));
  border: 0.1875rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 1rem;
  display: flex;
  gap: clamp(0.25rem, 0.7vw, 0.65rem);
  justify-content: center;
  min-block-size: clamp(4.25rem, 9dvh, 6rem);
  opacity: 0.62;
  padding: 0.4rem;
  transition: border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease, transform 180ms ease;
}

.recipe-step--done {
  background: rgb(var(--v-theme-success) / 10%);
  opacity: 0.82;
}

.recipe-step--current {
  background: rgb(var(--v-theme-warning) / 24%);
  border-color: rgb(var(--v-theme-warning-darken-1));
  box-shadow: 0 0 0 0.25rem rgb(var(--v-theme-warning) / 24%);
  opacity: 1;
  transform: translateY(-0.125rem);
}

.recipe-step-visual,
.current-ingredient,
.choice-visual {
  align-items: center;
  border-radius: 1rem;
  display: inline-flex;
  flex: 0 0 auto;
  justify-content: center;
  position: relative;
}

.recipe-step-visual {
  font-size: clamp(2rem, 5dvh, 3.5rem);
}

.current-ingredient {
  font-size: clamp(3rem, 8dvh, 4.5rem);
  min-block-size: 4rem;
  min-inline-size: 4rem;
  padding: 0.2rem;
}

.choice-visual {
  font-size: clamp(3rem, 8dvh, 4.75rem);
  min-block-size: 4.25rem;
  min-inline-size: 4.25rem;
  padding: 0.2rem;
}

.ingredient-role {
  background: rgb(var(--v-theme-surface) / 92%);
  border-radius: 999rem;
  color: rgb(var(--v-theme-primary));
  inset-block-end: -0.15rem;
  inset-inline-end: -0.15rem;
  position: absolute;
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 1rem;
  grid-template-columns: minmax(20rem, 1.05fr) minmax(22rem, 0.95fr);
}

.plate-card {
  min-inline-size: 0;
}

.plate-stage {
  align-items: center;
  block-size: clamp(18rem, 48dvh, 28rem);
  display: flex;
  justify-content: center;
  position: relative;
}

.plate-shadow {
  background: radial-gradient(ellipse, rgb(120 70 28 / 18%), transparent 68%);
  block-size: 4.5rem;
  inline-size: 70%;
  inset-block-end: 10%;
  position: absolute;
}

.plate {
  align-items: center;
  background: radial-gradient(ellipse at center, #fff 0 55%, #d7eef4 56% 72%, #b9dce7 73% 100%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.75rem rgb(255 255 255 / 74%), 0 1.125rem 2.125rem rgb(121 85 72 / 18%);
  display: flex;
  flex-direction: column-reverse;
  inline-size: min(26rem, 96%);
  justify-content: center;
  min-block-size: clamp(13.5rem, 35dvh, 20rem);
  padding: 2.4rem 1.6rem;
  position: relative;
}

.empty-plate {
  border: 0.1875rem dashed rgb(var(--v-theme-primary) / 28%);
  border-radius: 999rem;
  padding: 1.1rem 1.5rem;
}

.sandwich-layer {
  align-items: center;
  border: 0.1875rem solid rgb(93 64 55 / 20%);
  box-shadow: 0 0.5rem 1rem rgb(93 64 55 / 13%);
  color: white;
  display: flex;
  font-size: 1rem;
  font-weight: 800;
  justify-content: center;
  margin-block-start: -0.25rem;
  min-block-size: 2.45rem;
  text-shadow: 0 0.0625rem 0.125rem rgb(0 0 0 / 18%);
  transition: transform 180ms ease;
}

.layer-image {
  font-size: 1.8rem;
}

.sandwich-layer--bread,
.sandwich-layer--top-bread {
  border-radius: 999rem 999rem 1.2rem 1.2rem;
  inline-size: min(19rem, 90%);
}

.sandwich-layer--spread {
  border-radius: 999rem;
  inline-size: min(17rem, 82%);
  min-block-size: 1.4rem;
}

.sandwich-layer--filling,
.sandwich-layer--vegetable {
  border-radius: 1.5rem;
  inline-size: min(17.5rem, 84%);
}

.ingredient-grid {
  align-self: start;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  inline-size: 100%;
}

.ingredient-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

@media (max-width: 60rem) {
 .play-area {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 48rem) {
 .recipe-strip {
   padding-inline-start: min(15rem, 30vw);
 }

 .ingredient-grid :deep(.dwell-button) {
   min-block-size: 7rem !important;
   padding: 0.5rem !important;
 }

 .choice-visual {
   font-size: 3rem;
   min-block-size: 3.25rem;
   min-inline-size: 3.25rem;
 }

 .ingredient-content .text-subtitle-1 {
   font-size: 0.875rem !important;
   margin-block-start: 0.25rem !important;
 }
}

@media (max-height: 48rem) and (min-width: 56rem) {
 .sandwich-card {
    padding-block: 0.75rem !important;
  }

 .sandwich-card .text-overline,
 .intro {
    display: none;
  }

 .play-area {
    grid-template-columns: minmax(18rem, 0.85fr) minmax(26rem, 1.15fr);
 }

 .recipe-step {
   min-block-size: 3.75rem;
 }

 .recipe-step-visual {
   font-size: 2.5rem;
 }

 .plate-stage {
    block-size: clamp(13rem, 42dvh, 18rem);
  }

 .plate {
    min-block-size: clamp(10rem, 31dvh, 14rem);
    padding: 1.4rem 1.1rem;
  }

 .ingredient-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 60rem) and (max-height: 42.5rem) {
 .sandwich-card {
    padding-block: 0.75rem !important;
  }

 .sandwich-card .text-overline,
 .intro {
    display: none;
  }

 .prompt-card {
    margin-block-end: 0.75rem !important;
    padding-block: 0.75rem !important;
 }

 .recipe-strip {
   margin-block-end: 0.65rem !important;
 }

 .recipe-step {
   min-block-size: 3.4rem;
 }

 .recipe-step-label {
   display: none;
 }

 .recipe-step-visual {
   font-size: 2.4rem;
 }

 .play-area {
    grid-template-columns: minmax(16rem, 0.85fr) minmax(20rem, 1.15fr);
  }

 .plate-stage {
    block-size: 13rem;
  }

 .plate {
    min-block-size: 10rem;
    padding: 1.2rem 1rem;
  }

 .ingredient-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 37.5rem) {
 .ingredient-grid {
    grid-template-columns: 1fr;
  }
}
</style>
