<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { buildSandwichSteps, sandwichChoices, type SandwichChoice, type SandwichStep } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("sandwich", {
  maxSteps: 6,
  overrides: { sound: false },
  finishOnMistakes: false
});

const resultVisible = ref(false);
const chosenSteps = ref<SandwichStep[]>([]);
const feedbackMessage = ref("Собираем бутерброд спокойно: хлеб, начинка, верхний хлеб.");
const hintedStepId = ref<string>();
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const pendingFeedback = ref(false);
let feedbackTimer = 0;

const steps = computed(() => buildSandwichSteps(session.maxSteps));
const currentStep = computed(() => steps.value[session.step]);
const completedSandwiches = computed(() => Math.floor(chosenSteps.value.length / 3));
const sandwichLayers = computed(() => chosenSteps.value.map((step, index) => ({ ...step, layerKey: `${step.id}:${index}` })));
const currentPrompt = computed(() => currentStep.value?.instruction ?? "Бутерброды готовы. Спасибо за спокойную сборку.");

function choiceTargetId(choice: SandwichChoice) {
  return `sandwich:choice:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearTransientFeedback() {
  clearFeedbackTimer();
  pendingFeedback.value = false;
  hintedStepId.value = undefined;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function choiceColor(choice: SandwichChoice) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (hintedStepId.value === currentStep.value?.id && currentStep.value.choice.id === choice.id) return "amber-lighten-4";
  if (currentStep.value?.choice.id === choice.id) return "green-lighten-5";
  return "surface";
}

function chooseIngredient(choice: SandwichChoice) {
  if (session.status !== "running" || pendingFeedback.value) return;

  const expectedStep = currentStep.value;
  if (!expectedStep) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(expectedStep.choice);
  clearFeedbackTimer();

  if (choice.id === expectedStep.choice.id) {
    chosenSteps.value.push(expectedStep);
    successChoiceId.value = choice.id;
    hintedStepId.value = undefined;
    wrongChoiceId.value = undefined;
    feedbackMessage.value = `Верно: ${choice.shortLabel}. Продолжаем без спешки.`;
    recordSuccess({ roundId: expectedStep.roundId, targetId, expectedTargetId, expected: expectedStep.choice.id, actual: choice.id, isCorrect: true });
    feedbackTimer = window.setTimeout(() => {
      successChoiceId.value = undefined;
    }, 650);
    return;
  }

  pendingFeedback.value = true;
  hintedStepId.value = expectedStep.id;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = `Почти. Сейчас нужен шаг: ${expectedStep.choice.shortLabel}. Попробуй ещё раз.`;
  recordMistake({ roundId: expectedStep.roundId, targetId, expectedTargetId, expected: expectedStep.choice.id, actual: choice.id, isCorrect: false });
  recordHint({ roundId: expectedStep.roundId, targetId: expectedTargetId, reason: "wrong-sandwich-step" });
  feedbackTimer = window.setTimeout(() => {
    pendingFeedback.value = false;
    hintedStepId.value = undefined;
    wrongChoiceId.value = undefined;
  }, 1200);
}

function restart() {
  clearTransientFeedback();
  chosenSteps.value = [];
  resultVisible.value = false;
  feedbackMessage.value = "Собираем бутерброд спокойно: хлеб, начинка, верхний хлеб.";
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    clearFeedbackTimer();
    feedbackTimer = window.setTimeout(() => {
      resultVisible.value = true;
    }, 900);
    return;
  }

  resultVisible.value = false;
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff8e1 0%, #eef8ee 54%, #fff3e0 100%)" padding-top="4rem">
    <template #hud>
      <GameHud title="Бутерброд" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность действий</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери бутерброд</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">Выбирай ингредиенты по порядку. Если выбрать не тот, игра мягко покажет нужный шаг.</p>

            <v-card class="prompt-card pa-4 pa-md-5 mb-6" :color="hintedStepId === currentStep?.id ? 'amber-lighten-5' : 'green-lighten-5'" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-1">Следующий шаг</div>
              <div class="d-flex flex-wrap align-center ga-3">
                <v-avatar :color="currentStep?.choice.color ?? '#a5d6a7'" size="58">
                  <v-icon color="white" :icon="currentStep?.choice.icon ?? 'mdi-check'" size="34" />
                </v-avatar>
                <div>
                  <div class="text-h5 font-weight-bold">{{ currentPrompt }}</div>
                  <div class="text-body-1 text-medium-emphasis">{{ feedbackMessage }}</div>
                </div>
              </div>
            </v-card>

            <div class="play-area">
              <v-card class="plate-card pa-5 pa-md-6" color="orange-lighten-5" rounded="xl" variant="flat">
                <div class="plate-stage" aria-label="Собранный бутерброд">
                  <div class="plate">
                    <div v-if="sandwichLayers.length === 0" class="empty-plate text-body-1 text-medium-emphasis">Тарелка ждёт первый хлеб</div>
                    <div v-for="layer in sandwichLayers" :key="layer.layerKey" :class="['sandwich-layer', `sandwich-layer--${layer.kind}`]" :style="{ background: layer.choice.color }">
                      <v-icon class="mr-2" color="white" :icon="layer.choice.icon" />
                      <span>{{ layer.choice.shortLabel }}</span>
                    </div>
                  </div>
                </div>
                <div class="d-flex flex-wrap justify-center ga-2 mt-4">
                  <v-chip color="green" variant="tonal">Готово бутербродов: {{ completedSandwiches }}</v-chip>
                  <v-chip color="primary" variant="tonal">Шаг {{ Math.min(session.step + 1, session.maxSteps) }} из {{ session.maxSteps }}</v-chip>
                </div>
              </v-card>

              <div class="ingredient-grid" aria-label="Ингредиенты для бутерброда">
                <GameDwellButton v-for="choice in sandwichChoices" :key="choice.id" :class="{ 'needed-choice': hintedStepId === currentStep?.id && currentStep?.choice.id === choice.id }" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingFeedback" :dwell-ms="session.settings.dwellMs" :min-height="110" :color="choiceColor(choice)" @select="chooseIngredient(choice)">
                  <template #default>
                    <div class="ingredient-content">
                      <v-avatar :color="choice.color" size="58">
                        <v-icon color="white" :icon="choice.icon" size="34" />
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
.prompt-card {
  border: 2px solid rgb(var(--v-theme-warning) / 18%);
}

.play-area {
  align-items: stretch;
  display: grid;
  gap: 28px;
  grid-template-columns: minmax(320px, 1.1fr) minmax(360px, 1fr);
}

.plate-card {
  min-inline-size: 0;
}

.plate-stage {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: 440px;
}

.plate {
  align-items: center;
  background: radial-gradient(ellipse at center, #fff 0 55%, #d7eef4 56% 72%, #b9dce7 73% 100%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 12px rgb(255 255 255 / 74%), 0 18px 34px rgb(121 85 72 / 18%);
  display: flex;
  flex-direction: column-reverse;
  inline-size: min(420px, 96%);
  justify-content: center;
  min-block-size: 320px;
  padding: 44px 32px;
}

.empty-plate {
  border: 3px dashed rgb(var(--v-theme-primary) / 28%);
  border-radius: 999px;
  padding: 20px 28px;
}

.sandwich-layer {
  align-items: center;
  border: 3px solid rgb(93 64 55 / 20%);
  box-shadow: 0 8px 16px rgb(93 64 55 / 13%);
  color: white;
  display: flex;
  font-size: 1.05rem;
  font-weight: 700;
  justify-content: center;
  margin-block-start: -4px;
  min-block-size: 44px;
  text-shadow: 0 1px 2px rgb(0 0 0 / 18%);
}

.sandwich-layer--bread,
.sandwich-layer--top-bread {
  border-radius: 999px 999px 20px 20px;
  inline-size: min(310px, 90%);
}

.sandwich-layer--filling {
  border-radius: 24px;
  inline-size: min(280px, 82%);
}

.ingredient-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ingredient-grid > :last-child {
  grid-column: 1 / -1;
}

.ingredient-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.needed-choice {
  box-shadow: 0 0 0 6px rgb(var(--v-theme-warning) / 34%);
}

@media (max-width: 960px) {
  .play-area {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 700px) and (max-height: 820px) {
  .play-area {
    gap: 1rem;
    grid-template-columns: 1fr;
  }

  .plate-card {
    display: none;
  }

  .plate-stage {
    min-block-size: 240px;
  }

  .plate {
    min-block-size: 190px;
    padding: 24px 20px;
  }

  .ingredient-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .ingredient-grid > :last-child {
    grid-column: auto;
  }
}

@media (max-width: 600px) {
  .plate-stage {
    min-block-size: 340px;
  }

  .ingredient-grid {
    grid-template-columns: 1fr;
  }

  .ingredient-grid > :last-child {
    grid-column: auto;
  }
}
</style>
