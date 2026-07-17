<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { wordImageSrc } from "../../core/wordImage";
import { createDayRoutineBoard, dayRoutineAudioCues, dayRoutineQuestion, findDayRoutinePeriod, type DayRoutineItem, type DayRoutinePeriod } from "./model";

const dayRoutineFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("day-routine", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});

const board = createDayRoutineBoard(session.maxSteps);
const placedItemIds = ref<string[]>([]);
const resultVisible = ref(false);
const feedbackMessage = ref<string>(dayRoutineAudioCues.prompt.text);
const wrongChoiceId = ref<string>();
const highlightedPeriodId = ref<DayRoutinePeriod["id"]>("morning");
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "day-routine", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;
let resultTimer = 0;

const currentPeriod = computed(() => board.periods.find((period) => board.items.some((item) => item.periodId === period.id && !placedItemIds.value.includes(item.id))));
const questionText = computed(() => currentPeriod.value ? dayRoutineQuestion(currentPeriod.value) : dayRoutineAudioCues.complete.text);
const remainingChoices = computed(() => board.choices.filter((item) => !placedItemIds.value.includes(item.id)));

function itemTargetId(item: DayRoutineItem) {
  return `day-routine:choice:${item.id}`;
}

function periodItems(period: DayRoutinePeriod) {
  return board.items.filter((item) => item.periodId === period.id && placedItemIds.value.includes(item.id));
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  wrongChoiceId.value = undefined;
  highlightedPeriodId.value = currentPeriod.value?.id ?? "morning";
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([dayRoutineAudioCues.prompt.id], delayMs);
  isSpeaking.value = false;
}

function showResultSoon(delayMs = 900) {
  clearResultTimer();
  resultTimer = window.setTimeout(() => {
    resultVisible.value = true;
  }, delayMs);
}

async function choose(item: DayRoutineItem) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const expectedPeriod = currentPeriod.value;
  if (!expectedPeriod) return;

  const targetId = itemTargetId(item);
  const roundId = `day-routine:period:${expectedPeriod.id}:step:${session.step + 1}`;
  resetFeedback();

  if (item.periodId === expectedPeriod.id) {
    pendingSelection.value = true;
    placedItemIds.value = [...placedItemIds.value, item.id];
    isSpeaking.value = true;
    recordSuccess({ roundId, targetId, answerId: item.id, expected: expectedPeriod.label, actual: item.label, isCorrect: true });

    const nextPeriod = currentPeriod.value;
    const finishedAfterSuccess = !nextPeriod;
    void dayRoutineFeedback.playSuccess(session.settings.sound);
    if (nextPeriod) {
      feedbackMessage.value = dayRoutineAudioCues.correct.text;
      highlightedPeriodId.value = nextPeriod.id;
    } else {
      feedbackMessage.value = dayRoutineAudioCues.complete.text;
    }
    const cue = finishedAfterSuccess ? dayRoutineAudioCues.complete : dayRoutineAudioCues.correct;
    await promptAudio.playSequenceAndWait([cue.id], 80);
    isSpeaking.value = false;
    pendingSelection.value = false;

    if (finishedAfterSuccess) showResultSoon();
    return;
  }

  const actualPeriod = findDayRoutinePeriod(item.periodId);
  pendingSelection.value = true;
  wrongChoiceId.value = item.id;
  highlightedPeriodId.value = expectedPeriod.id;
  feedbackMessage.value = dayRoutineAudioCues.mistake.text;
  recordMistake({ roundId, targetId, expectedTargetId: `day-routine:period:${expectedPeriod.id}`, answerId: item.id, expected: expectedPeriod.label, actual: actualPeriod?.label ?? item.periodId, isCorrect: false });
  void dayRoutineFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([dayRoutineAudioCues.mistake.id], 80);
  isSpeaking.value = false;
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 1000);
}

function choiceColor(item: DayRoutineItem) {
  if (wrongChoiceId.value === item.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  clearResultTimer();
  promptAudio.cancelPending();
  placedItemIds.value = [];
  resultVisible.value = false;
  feedbackMessage.value = dayRoutineAudioCues.prompt.text;
  wrongChoiceId.value = undefined;
  highlightedPeriodId.value = "morning";
  pendingSelection.value = false;
  isSpeaking.value = false;
  startSession();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  dayRoutineFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  clearResultTimer();
  promptAudio.cancelPending();
  dayRoutineFeedback.dispose();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    if (!isSpeaking.value) showResultSoon();
  } else {
    clearResultTimer();
    resultVisible.value = false;
  }
});

watch(isSpeaking, (speaking) => {
  if (!speaking && session.status === "finished" && !resultVisible.value) showResultSoon();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff8e1 0%, #e3f2fd 48%, #ede7f6 100%)" padding-top="5rem">
    <template #hud>
      <GameHud title="Утро-день-вечер" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="day-routine-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="sequence-label text-overline text-secondary text-center mb-2">Последовательность дня</div>
            <h1 class="question-title text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ questionText }}</h1>
            <p class="feedback-line text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <v-row class="period-row mb-6" align="stretch">
              <v-col v-for="period in board.periods" :key="period.id" cols="12" sm="4">
                <v-card :class="['period-card', { 'period-card--active': highlightedPeriodId === period.id }]" :color="period.color" rounded="xl" variant="flat">
                  <div class="period-heading d-flex align-center ga-3 mb-3">
                    <v-avatar class="period-avatar" color="surface" size="3.5rem"><v-icon :icon="period.icon" size="2.125rem" /></v-avatar>
                    <div>
                      <div class="text-h5 font-weight-bold">{{ period.title }}</div>
                      <div class="period-helper text-body-2 text-medium-emphasis">{{ period.helper }}</div>
                    </div>
                  </div>

                  <div class="placed-grid" :aria-label="`Картинки: ${period.title}`">
                    <v-card v-for="item in periodItems(period)" :key="item.id" class="placed-card pa-3 text-center" color="surface" rounded="lg" variant="elevated">
                      <v-img class="placed-image" :src="wordImageSrc(item.imageId)" :alt="item.label" />
                      <div class="placed-label text-subtitle-2 font-weight-bold">{{ item.label }}</div>
                    </v-card>
                    <v-card v-if="periodItems(period).length === 0" class="empty-slot d-flex align-center justify-center text-medium-emphasis" color="surface" rounded="lg" variant="tonal">
                      <span>Ждёт картинку</span>
                    </v-card>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-divider class="sequence-divider mb-5" />
            <div class="choice-title text-h6 font-weight-bold text-center mb-4">Выбери подходящую картинку</div>
            <v-row class="choice-row" justify="center">
              <v-col v-for="item in remainingChoices" :key="item.id" cols="3" sm="3">
                <GameDwellButton :target-id="itemTargetId(item)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="8rem" :color="choiceColor(item)" @select="choose(item)">
                  <template #default>
                    <v-img class="choice-image" :src="wordImageSrc(item.imageId)" :alt="item.label" />
                    <div class="choice-label text-subtitle-1 text-md-h6 font-weight-bold mt-2">{{ item.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Утро-день-вечер" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.period-card {
  block-size: 100%;
  border: 0.125rem solid transparent;
  padding: 1.125rem;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.period-card--active {
  border-color: rgb(var(--v-theme-primary) / 56%);
  box-shadow: 0 0 0 0.375rem rgb(var(--v-theme-primary) / 12%);
  transform: translateY(-0.125rem);
}

.placed-grid {
  display: grid;
  gap: 0.625rem;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
}

.empty-slot {
  min-block-size: 6.5rem;
}

.choice-image {
  block-size: clamp(3.5rem, 7vw, 5rem);
  inline-size: 100%;
}

.placed-image {
  block-size: 3rem;
  inline-size: 100%;
}

@media (max-height: 64rem) {
  .choice-row :deep(.dwell-button) {
    min-block-size: 7rem !important;
    padding: 0.75rem !important;
  }

  .choice-image {
    block-size: 4rem;
  }

  .choice-label {
    margin-block-start: 0.25rem !important;
  }
}

@media (min-height: 64.001rem) {
 .game-container {
    padding-block-end: 2rem;
  }
}

@media (max-height: 44rem) {
 .day-routine-card {
    padding-block: 0.75rem !important;
  }

  .sequence-label {
    display: none;
  }

  .question-title {
    font-size: 1.5rem !important;
    line-height: 1.15;
    margin-block-end: 0.25rem !important;
  }

  .feedback-line,
  .choice-title {
    margin-block-end: 0.5rem !important;
  }

  .period-row {
    margin-block-end: 0.75rem !important;
  }

  .period-card {
    padding: 0.375rem;
  }

  .period-heading {
    gap: 0.375rem !important;
    margin-block-end: 0.25rem !important;
  }

  .period-avatar {
    block-size: 2.25rem !important;
    inline-size: 2.25rem !important;
  }

  .period-helper {
    font-size: 0.6875rem !important;
    line-height: 1.15;
  }

  .placed-grid {
    gap: 0.25rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .placed-card {
    min-inline-size: 0;
    padding: 0.25rem !important;
  }

  .placed-image {
    block-size: 2rem;
  }

  .placed-label {
    font-size: 0.625rem !important;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .empty-slot {
    font-size: 0.6875rem;
    min-block-size: 3.25rem;
  }

  .sequence-divider {
    margin-block-end: 0.5rem !important;
  }

  .choice-row {
    margin-block: -0.25rem;
  }

  .choice-row :deep(.dwell-button) {
    min-block-size: 4.75rem !important;
    padding: 0.5rem !important;
  }

  .choice-image {
    block-size: 2.25rem;
  }

  .choice-label {
    font-size: 0.875rem !important;
    line-height: 1.1;
  }
}
</style>
