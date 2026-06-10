<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";

type HeroRouteStep = {
  id: string;
  label: string;
  cue: string;
  icon: string;
  color: string;
};

const routeSteps: HeroRouteStep[] = [
  { id: "home", label: "Домик", cue: "Герой выходит из домика.", icon: "mdi-home-heart", color: "#ffccbc" },
  { id: "bridge", label: "Мост", cue: "Сначала перейти спокойный мост.", icon: "mdi-bridge", color: "#b3e5fc" },
  { id: "forest", label: "Лес", cue: "Потом пройти по лесной тропе.", icon: "mdi-pine-tree", color: "#c8e6c9" },
  { id: "hill", label: "Холм", cue: "Дальше подняться на мягкий холм.", icon: "mdi-terrain", color: "#dcedc8" },
  { id: "river", label: "Река", cue: "После холма подойти к реке.", icon: "mdi-waves", color: "#b2ebf2" },
  { id: "camp", label: "Привал", cue: "У реки сделать тихий привал.", icon: "mdi-tent", color: "#ffe0b2" },
  { id: "flag", label: "Флажок", cue: "Затем найти флажок на дороге.", icon: "mdi-flag-variant", color: "#f8bbd0" },
  { id: "castle", label: "Замок", cue: "И прийти к доброму замку.", icon: "mdi-castle", color: "#d1c4e9" }
];

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("hero-route", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 135,
  sound: false
}, {
  finishOnMistakes: false
});

const feedbackText = ref("Выбери следующий шаг маршрута. Стрелки помогут идти по порядку.");
const pendingChoice = ref(false);
const successChoiceId = ref<string>();
const wrongChoiceId = ref<string>();
const hintedChoiceId = ref<string>();
let feedbackTimer = 0;

const currentIndex = computed(() => Math.min(session.step, routeSteps.length - 1));
const expectedStep = computed(() => routeSteps[currentIndex.value]);
const completedSteps = computed(() => routeSteps.slice(0, session.step));
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(Math.min(1, session.step / session.maxSteps) * 100));
const choiceSteps = computed(() => {
  const index = currentIndex.value;
  const expected = expectedStep.value;
  const distractors = routeSteps.filter((step) => step.id !== expected.id);
  const choices = [
    expected,
    distractors[(index + 1) % distractors.length],
    distractors[(index + 4) % distractors.length]
  ];
  const shift = index % choices.length;

  return [choices[shift], choices[(shift + 1) % choices.length], choices[(shift + 2) % choices.length]];
});

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function stepTargetId(step: HeroRouteStep) {
  return `hero-route:step:${step.id}`;
}

function isCompleted(index: number) {
  return index < session.step;
}

function isCurrent(index: number) {
  return session.status === "running" && index === currentIndex.value;
}

function markerStyle(step: HeroRouteStep) {
  return { "--route-step-color": step.color };
}

function choiceColor(step: HeroRouteStep) {
  if (successChoiceId.value === step.id) return "green-lighten-4";
  if (wrongChoiceId.value === step.id) return "orange-lighten-4";
  if (hintedChoiceId.value === step.id) return "blue-lighten-5";
  return "surface";
}

function resetChoiceState() {
  clearFeedbackTimer();
  pendingChoice.value = false;
  successChoiceId.value = undefined;
  wrongChoiceId.value = undefined;
  hintedChoiceId.value = undefined;
}

function chooseStep(step: HeroRouteStep) {
  if (session.status !== "running" || pendingChoice.value) return;

  const expected = expectedStep.value;
  const selectedTargetId = stepTargetId(step);
  const expectedTargetId = stepTargetId(expected);

  clearFeedbackTimer();

  if (step.id === expected.id) {
    pendingChoice.value = true;
    successChoiceId.value = step.id;
    feedbackText.value = session.step + 1 >= session.maxSteps
      ? "Маршрут собран. Герой спокойно дошёл до замка."
      : `Верно: ${step.label.toLowerCase()}. Стрелка открывает следующий шаг.`;
    recordSuccess({
      targetId: selectedTargetId,
      expectedTargetId,
      stepId: step.id,
      stepLabel: step.label,
      routeIndex: currentIndex.value,
      isCorrect: true
    });

    if (session.status === "running") {
      feedbackTimer = window.setTimeout(() => {
        resetChoiceState();
        feedbackText.value = `Теперь нужен шаг: ${expectedStep.value.label.toLowerCase()}.`;
      }, 700);
    }
    return;
  }

  pendingChoice.value = true;
  wrongChoiceId.value = step.id;
  hintedChoiceId.value = expected.id;
  feedbackText.value = `Это хороший ориентир, но сейчас нужен ${expected.label.toLowerCase()}. Попробуй ещё раз спокойно.`;
  recordMistake({
    targetId: selectedTargetId,
    expectedTargetId,
    stepId: step.id,
    expectedStepId: expected.id,
    actual: step.label,
    expected: expected.label,
    hintOnly: true,
    isCorrect: false
  });
  recordHint({ targetId: expectedTargetId, reason: "next-route-step", expectedStepId: expected.id, selectedStepId: step.id });

  feedbackTimer = window.setTimeout(() => {
    pendingChoice.value = false;
    wrongChoiceId.value = undefined;
  }, 1100);
}

function restart() {
  resetChoiceState();
  feedbackText.value = "Выбери следующий шаг маршрута. Стрелки помогут идти по порядку.";
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="hero-route-shell">
    <GameHud title="Маршрут героя" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="hero-route-container d-flex align-center" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="hero-route-panel pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Последовательность по картинкам и стрелкам</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">Маршрут героя</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">
              Выбирай следующий ориентир. Если ошибиться, игра только подскажет нужный шаг.
            </p>

            <v-alert class="mb-5 text-h6" :color="hintedChoiceId ? 'primary' : 'secondary'" :icon="hintedChoiceId ? 'mdi-lightbulb-on-outline' : 'mdi-map-marker-path'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-card class="route-map pa-4 pa-md-5 mb-6" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="route-strip" aria-label="Маршрут героя по шагам">
                <template v-for="(step, index) in routeSteps" :key="step.id">
                  <div :class="['route-marker', { 'route-marker--done': isCompleted(index), 'route-marker--current': isCurrent(index), 'route-marker--hint': hintedChoiceId === step.id }]" :style="markerStyle(step)">
                    <v-icon :icon="isCompleted(index) ? 'mdi-check-circle-outline' : step.icon" />
                    <span>{{ index + 1 }}</span>
                  </div>
                  <v-icon v-if="index < routeSteps.length - 1" class="route-arrow" icon="mdi-arrow-right-bold-circle-outline" aria-hidden="true" />
                </template>
              </div>

              <v-row class="mt-5" align="center">
                <v-col cols="12" md="8">
                  <div class="text-caption text-medium-emphasis mb-2">Пройденные шаги</div>
                  <div class="completed-list">
                    <v-chip v-for="step in completedSteps" :key="`done-${step.id}`" color="primary" variant="flat" size="large">
                      {{ step.label }}
                    </v-chip>
                    <span v-if="completedSteps.length === 0" class="text-body-1 text-medium-emphasis">Герой готов к первому шагу.</span>
                  </div>
                </v-col>
                <v-col cols="12" md="4">
                  <div class="text-caption text-medium-emphasis mb-2">Прогресс маршрута</div>
                  <v-progress-linear :model-value="progressPercent" color="primary" height="14" rounded />
                  <div class="text-body-2 text-medium-emphasis mt-2">{{ progressPercent }}% · цель: {{ expectedStep.label }}</div>
                </v-col>
              </v-row>
            </v-card>

            <div class="text-h5 font-weight-bold text-center mb-4">Куда герой идёт сейчас?</div>
            <v-row justify="center">
              <v-col v-for="step in choiceSteps" :key="`choice-${step.id}`" cols="12" md="4">
                <GameDwellButton :target-id="stepTargetId(step)" :disabled="session.status !== 'running' || pendingChoice" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="choiceColor(step)" @select="chooseStep(step)">
                  <template #default="{ active, progress }">
                    <div class="choice-content" :style="markerStyle(step)">
                      <v-icon class="choice-icon" :icon="step.icon" />
                      <div class="text-h5 font-weight-bold mt-3">{{ step.label }}</div>
                      <div class="text-body-2 text-medium-emphasis mt-2">{{ step.cue }}</div>
                      <v-chip v-if="hintedChoiceId === step.id" class="mt-3" color="primary" variant="flat">Подсказка: сюда</v-chip>
                      <v-chip v-else-if="active" class="mt-3" color="secondary" variant="flat">Держи взгляд {{ Math.round(progress * 100) }}%</v-chip>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Маршрут героя" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.hero-route-shell {
  background: radial-gradient(circle at 12% 14%, rgb(255 224 178 / 62%), transparent 30%), linear-gradient(135deg, #edf7f2 0%, #f5f0ff 54%, #fff7e5 100%);
  min-block-size: 100vh;
}

.hero-route-container {
  min-block-size: 100vh;
  padding-block-start: 7.75rem;
}

.hero-route-panel {
  overflow: hidden;
}

.route-map {
  border: 0.125rem solid rgb(var(--v-theme-primary) / 12%);
}

.route-strip {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.route-marker {
  align-items: center;
  background: linear-gradient(180deg, var(--route-step-color), rgb(255 255 255 / 72%));
  border: 0.25rem solid rgb(255 255 255 / 82%);
  border-radius: 1.5rem;
  box-shadow: 0 0.75rem 1.75rem rgb(78 98 124 / 16%);
  color: rgb(48 64 80);
  display: flex;
  flex-direction: column;
  inline-size: clamp(5.25rem, 8vw, 7.25rem);
  justify-content: center;
  min-block-size: clamp(5.25rem, 8vw, 7.25rem);
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.route-marker .v-icon {
  font-size: clamp(2rem, 4vw, 3.2rem);
}

.route-marker span {
  font-size: 0.95rem;
  font-weight: 800;
}

.route-marker--current,
.route-marker--hint {
  box-shadow: 0 0 0 0.45rem rgb(var(--v-theme-primary) / 26%), 0 1rem 2rem rgb(78 98 124 / 20%);
  transform: translateY(-0.25rem);
}

.route-marker--done {
  opacity: 0.74;
}

.route-arrow {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(1.8rem, 4vw, 3rem);
  opacity: 0.72;
}

.completed-list {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-block-size: 2.5rem;
}

.choice-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.choice-icon {
  background: linear-gradient(180deg, var(--route-step-color), rgb(255 255 255 / 70%));
  border-radius: 2rem;
  box-shadow: 0 1rem 2rem rgb(78 98 124 / 16%);
  color: rgb(48 64 80);
  font-size: clamp(4.5rem, 8vw, 6.5rem);
  padding: 1.25rem;
}

@media (max-width: 600px) {
  .hero-route-container {
    padding-block-start: 10rem;
  }

  .route-strip {
    gap: 0.5rem;
  }

  .route-arrow {
    transform: rotate(90deg);
  }
}
</style>
