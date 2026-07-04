<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
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
  isSpeaking.value = false;
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
  sandwichFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearTimers();
  promptAudio.cancelPending();
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

            <v-card class="prompt-card pa-3 pa-md-4 mb-3" color="green-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-wrap align-center ga-3">
                <v-avatar :color="currentStep.choice.color" size="54">
                  <v-icon color="white" :icon="currentStep.choice.icon" size="32" />
                </v-avatar>
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
                      <v-icon class="mr-2" color="white" :icon="layer.choice.icon" />
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
                      <v-avatar :color="choice.color" size="52">
                        <v-icon color="white" :icon="choice.icon" size="30" />
                      </v-avatar>
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
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
