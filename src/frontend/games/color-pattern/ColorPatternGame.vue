<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateColorPatternRound, type ColorPatternColor } from "./model";

const colorPatternFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("color-pattern", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateColorPatternRound(session.settings, roundIndex)
});

const feedbackText = ref("Посмотри на цветовой ряд и выбери следующую карточку.");
const highlightPattern = ref(false);
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
let feedbackTimer = 0;

const patternHintText = computed(() => {
  if (!highlightPattern.value) return "";
  return `Закономерность ${round.value.patternKind}: цвета повторяются в таком порядке.`;
});

const patternGridStyle = computed(() => ({
  "--pattern-slot-count": String(round.value.sequence.length + 1)
}));

function choiceTargetId(choice: ColorPatternColor) {
  return `color-pattern:choice:${round.value.roundId}:${choice.id}`;
}

function colorStyle(color: ColorPatternColor) {
  return {
    "--color-pattern-bg": color.hex,
    "--color-pattern-text": color.textColor
  };
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackText.value = "Посмотри на цветовой ряд и выбери следующую карточку.";
  highlightPattern.value = false;
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function choose(choice: ColorPatternColor) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.answer);
  clearFeedbackTimer();

  if (choice.id === round.value.answer.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackText.value = "Верно. Цветовой ряд продолжается.";
    void colorPatternFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.answer.label, actual: choice.label, patternKind: round.value.patternKind, isCorrect: true });

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
  highlightPattern.value = true;
  feedbackText.value = "Почти. Ряд мягко подсвечен: посмотри, как цвета повторяются.";
  void colorPatternFeedback.playMistake(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.answer.label, actual: choice.label, patternKind: round.value.patternKind, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, patternKind: round.value.patternKind, message: "Подсвечена закономерность цветового ряда." });

  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
    highlightPattern.value = false;
  }, 1200);
}

function choiceColor(choice: ColorPatternColor) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  return "surface";
}

function restart() {
  resetFeedback();
  restartRoundGame();
}

onMounted(() => {
  colorPatternFeedback.warm(session.settings.sound);
});

onUnmounted(() => {
  clearFeedbackTimer();
  colorPatternFeedback.dispose();
});
</script>

<template>
  <div class="color-pattern-shell">
    <GameHud title="Цветовой узор" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Продолжи ряд</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">Какая карточка следующая?</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ feedbackText }}</p>
            <v-chip v-if="patternHintText" class="d-flex mx-auto mb-5" color="warning" size="large" variant="tonal">{{ patternHintText }}</v-chip>
            <div v-else class="mb-5" />

            <div :class="['pattern-row', { 'pattern-row--hint': highlightPattern }]" :style="patternGridStyle" role="group" aria-label="Цветовой ряд с пустой последней карточкой">
              <v-card v-for="(color, index) in round.sequence" :key="`${round.roundId}:${index}`" :class="['pattern-slot', { 'pattern-slot--hint': highlightPattern }]" rounded="xl" variant="flat" :style="colorStyle(color)">
                <span class="text-h6 text-md-h5 font-weight-bold color-label">{{ color.label }}</span>
              </v-card>
              <v-card :class="['pattern-slot', 'pattern-slot--blank', { 'pattern-slot--hint': highlightPattern }]" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <v-icon class="blank-icon" color="blue-grey-darken-1" icon="mdi-help" />
              </v-card>
            </div>

            <v-divider class="my-5 my-md-6" />

            <v-row class="choice-row" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="6" :sm="round.choices.length === 3 ? 4 : 3" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="choice-card" :style="colorStyle(choice)">
                      <span class="text-h4 text-md-h3 font-weight-bold color-label">{{ choice.label }}</span>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Цветовой узор" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.color-pattern-shell {
  background: radial-gradient(circle at 20% 10%, #fff4d9 0%, #eef8ff 46%, #f6edff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.pattern-row {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(var(--pattern-slot-count), minmax(0, 1fr));
}

.pattern-row--hint {
  border-radius: 1.5rem;
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-warning) / 28%);
  padding: 0.35rem;
}

.pattern-slot,
.choice-card {
  align-items: center;
  background: var(--color-pattern-bg);
  color: var(--color-pattern-text);
  display: flex;
  justify-content: center;
  text-align: center;
}

.pattern-slot {
  border: 0.25rem solid rgb(255 255 255 / 82%);
  min-block-size: clamp(6.25rem, 13vw, 10.5rem);
  padding: 0.75rem;
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.pattern-slot--blank {
  background: rgb(var(--v-theme-surface));
  border: 0.25rem dashed rgb(var(--v-theme-primary) / 44%);
}

.pattern-slot--hint {
  box-shadow: 0 0.75rem 1.5rem rgb(var(--v-theme-warning) / 22%);
  transform: translateY(-0.125rem);
}

.choice-row {
  row-gap: 0.75rem;
}

.choice-card {
  border-radius: 1.5rem;
  block-size: 100%;
  min-block-size: 11rem;
  padding: 1rem;
}

.color-label {
  text-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 22%);
}

.blank-icon {
  font-size: clamp(3rem, 7vw, 5rem);
}

@media (max-width: 700px) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .pattern-row {
    gap: 0.5rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pattern-slot {
    min-block-size: 5.75rem;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .pattern-row {
    gap: 0.5rem;
  }

  .pattern-slot,
  .choice-card,
  .choice-row :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }

  .choice-card .color-label {
    font-size: 1.25rem !important;
    line-height: 1.05;
  }

  .pattern-slot .color-label {
    font-size: 1.5rem !important;
    line-height: 1.1;
  }
}
</style>
