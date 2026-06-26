<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { createScheduleCards, dailyScheduleSteps, isExpectedScheduleChoice, nextScheduleStep, scheduleMaxSteps, scheduleTargetId, type ScheduleCard } from "./model";

type ScheduleCardState = ScheduleCard & {
  placed: boolean;
  placedIndex?: number;
};

const router = useRouter();
const scheduleFeedback = createStandardGameFeedback();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("schedule", {
  maxSteps: scheduleMaxSteps,
  overrides: { sound: true },
  finishOnMistakes: false,
  finishOnTimeout: false
});
const promptAudio = useGamePromptAudio({ gameId: "schedule", soundEnabled: toRef(session.settings, "sound") });

const cards = ref<ScheduleCardState[]>(makeCards());
const feedbackMessage = ref("Собери день по порядку. Начни с первой карточки утром.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
let feedbackTimer = 0;

const placedCards = computed(() => cards.value.filter((card) => card.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0)));
const placedIds = computed(() => placedCards.value.map((card) => card.id));
const nextStep = computed(() => nextScheduleStep(placedIds.value));
const currentRoundId = computed(() => `schedule:step:${session.step + 1}`);

function makeCards(): ScheduleCardState[] {
  return createScheduleCards().map((card) => ({ ...card, placed: false }));
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function isPlaced(stepId: string) {
  return placedIds.value.includes(stepId);
}

function resetSoftHighlights() {
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function playStepPrompt(step: ScheduleCard | undefined, delayMs = 0) {
  if (!step) {
    promptAudio.play("schedule.complete", delayMs);
    return;
  }
  promptAudio.play("schedule.next", delayMs);
}

function playIntroPrompt(delayMs = 0) {
  promptAudio.cancelPending();
  promptAudio.play("schedule.intro", delayMs);
  playStepPrompt(nextStep.value, delayMs + 1200);
}

function choose(card: ScheduleCardState) {
  if (session.status !== "running" || pendingSelection.value || card.placed) return;

  const expected = nextStep.value;
  if (!expected) return;

  clearFeedbackTimer();

  if (isExpectedScheduleChoice(card.id, placedIds.value)) {
    card.placed = true;
    card.placedIndex = placedCards.value.length + 1;
    pendingSelection.value = true;
    successChoiceId.value = card.id;
    feedbackMessage.value = nextStep.value ? "Верно. Теперь выбери следующий шаг дня." : "Расписание собрано. День получился понятным.";
    recordSuccess({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expected: expected.id, actual: card.id, isCorrect: true });
    void scheduleFeedback.playSuccess(session.settings.sound);
    promptAudio.cancelPending();
    promptAudio.play("schedule.correct", 120);
    playStepPrompt(nextStep.value, 1200);
    feedbackTimer = window.setTimeout(resetSoftHighlights, 650);
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = card.id;
  feedbackMessage.value = "Посмотри на порядок дня и попробуй выбрать другую карточку.";
  recordMistake({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expectedTargetId: scheduleTargetId(expected), expected: expected.id, actual: card.id, isCorrect: false });
  void scheduleFeedback.playMistake(session.settings.sound);
  promptAudio.cancelPending();
  promptAudio.play("schedule.mistake", 120);
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 1100);
}

function choiceColor(card: ScheduleCardState) {
  if (wrongChoiceId.value === card.id) return "orange-lighten-4";
  if (successChoiceId.value === card.id) return "green-lighten-4";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  cards.value = makeCards();
  feedbackMessage.value = "Собери день по порядку. Начни с первой карточки утром.";
  resetSoftHighlights();
  promptAudio.cancelPending();
  startSession();
  playIntroPrompt(450);
}

onMounted(() => {
  scheduleFeedback.warm(session.settings.sound);
  promptAudio.warm();
  playIntroPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  scheduleFeedback.dispose();
});
</script>

<template>
  <div class="schedule-shell">
    <GameHud title="Расписание" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="schedule-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="schedule-header text-center">
              <div class="text-overline text-secondary mb-1">AAC-последовательность</div>
              <h1 class="schedule-title text-h4 text-md-h3 font-weight-bold">Собери расписание дня</h1>
              <p class="schedule-prompt text-body-1 text-medium-emphasis">{{ feedbackMessage }}</p>
            </div>

            <div class="schedule-strip-title text-caption text-medium-emphasis">Сюда собирается расписание</div>
            <div class="schedule-strip" aria-label="Собранное расписание дня по порядку">
              <v-card v-for="(step, index) in dailyScheduleSteps" :key="step.id" :class="['schedule-slot', { 'schedule-slot--next': nextStep?.id === step.id, 'schedule-slot--done': isPlaced(step.id) }]" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <template v-if="isPlaced(step.id)">
                  <v-icon class="slot-icon" :color="step.color" :icon="step.icon" />
                  <div class="text-caption font-weight-bold mt-1">{{ step.title }}</div>
                </template>
                <template v-else>
                  <div class="text-h5 font-weight-bold text-medium-emphasis">{{ index + 1 }}</div>
                </template>
              </v-card>
            </div>

            <v-row class="choice-row" justify="center" no-gutters>
              <v-col v-for="card in cards" :key="card.id" class="schedule-choice-col pa-2" cols="6" sm="3">
                <GameDwellButton :target-id="scheduleTargetId(card)" :disabled="session.status !== 'running' || pendingSelection || card.placed" :dwell-ms="session.settings.dwellMs" min-height="11rem" :color="choiceColor(card)" @select="choose(card)">
                  <template #default>
                    <div :class="['schedule-choice', { 'schedule-choice--placed': card.placed }]">
                      <v-icon class="choice-icon" :color="card.color" :icon="card.icon" />
                      <div class="schedule-choice-title text-h6 font-weight-bold mt-2">{{ card.title }}</div>
                      <v-chip class="schedule-choice-chip mt-3" color="primary" size="large" variant="tonal">{{ card.aacLabel }}</v-chip>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="session.status === 'finished'" title="Расписание" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.schedule-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #fff7e6 100%);
  min-block-size: 100dvh;
  overflow: hidden;
}

.game-container {
  align-items: center;
  display: flex;
  min-block-size: 100dvh;
  padding: clamp(4.75rem, 9vh, 7rem) clamp(0.75rem, 2vw, 2rem) clamp(0.75rem, 2vh, 1.5rem);
}

.schedule-card {
  display: flex;
  flex-direction: column;
  gap: clamp(0.55rem, 1.2vh, 0.95rem);
  inline-size: 100%;
  margin-inline: auto;
  max-block-size: calc(100dvh - clamp(5.5rem, 10vh, 8.5rem));
  overflow: hidden;
}

.schedule-header {
  flex: 0 0 auto;
}

.schedule-title {
  line-height: 1.05;
  margin-block-end: clamp(0.25rem, 0.8vh, 0.55rem);
}

.schedule-prompt {
  margin-block-end: 0;
}

.schedule-strip {
  display: grid;
  flex: 0 0 auto;
  gap: clamp(0.35rem, 0.9vw, 0.8rem);
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.schedule-strip-title {
  flex: 0 0 auto;
  margin-block-end: calc(-1 * clamp(0.25rem, 0.7vh, 0.45rem));
}

.schedule-slot {
  align-items: center;
  border: 0.1875rem dashed rgb(var(--v-theme-primary) / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(3.4rem, 7.7vh, 6.75rem);
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.schedule-slot--next {
  box-shadow: 0 0 0 0.3125rem rgb(var(--v-theme-primary) / 22%);
  transform: translateY(-0.125rem);
}

.schedule-slot--done {
  background: rgb(var(--v-theme-surface));
  border-style: solid;
}

.slot-icon {
  font-size: clamp(1.7rem, 3.6vh, 3.25rem);
}

.choice-row {
  flex: 1 1 auto;
  margin: -0.5rem;
  min-block-size: 0;
}

.schedule-choice-col {
  display: flex;
}

.schedule-choice-col :deep(.dwell-hitbox) {
  display: flex;
  inline-size: 100%;
}

.choice-icon {
  filter: drop-shadow(0 0.5rem 0.625rem rgb(0 0 0 / 14%));
  font-size: clamp(2.65rem, 7.2vh, 5.4rem);
}

.schedule-choice {
  color: #17212b;
  transition: opacity 160ms ease, transform 160ms ease;
}

.schedule-choice-title,
.schedule-choice-chip {
  color: #17212b !important;
}

.schedule-choice--placed {
  opacity: 0.28;
}

.choice-row :deep(.dwell-button),
.choice-row :deep(.dwell-hitbox) {
  min-block-size: clamp(8.75rem, 22.5vh, 15.5rem) !important;
}

@media (max-width: 37.5rem) {
  .game-container {
    align-items: flex-start;
    overflow: auto;
    padding-block-start: 6.25rem;
  }

  .schedule-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 40.625rem) {
  .game-container {
    padding-block-start: 4.25rem;
  }

  .schedule-card {
    gap: 0.45rem;
    padding: 0.85rem 1rem 1rem !important;
  }

  .schedule-header .text-overline,
  .schedule-prompt {
    display: none;
  }

  .schedule-title {
    font-size: clamp(1.65rem, 5vh, 2.1rem) !important;
    margin-block-end: 0;
  }

  .schedule-slot {
    min-block-size: clamp(3rem, 8vh, 3.4rem);
  }

  .choice-row :deep(.dwell-button),
  .choice-row :deep(.dwell-hitbox) {
    min-block-size: clamp(8rem, 22vh, 8.5rem) !important;
  }

  .choice-icon {
    font-size: clamp(2.35rem, 7vh, 3rem);
  }
}
</style>
