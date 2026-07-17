<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWordImage from "../../components/game/GameWordImage.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { createScheduleCandidates, createScheduleCards, dailyScheduleSteps, isExpectedScheduleChoice, nextScheduleStep, scheduleMaxSteps, schedulePromptAssetId, scheduleTargetId, type ScheduleCard } from "./model";

type ScheduleCardState = ScheduleCard & {
  placed: boolean;
  placedIndex?: number;
};

const router = useRouter();
const { height, smAndDown } = useDisplay();
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
const isSpeaking = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const resultVisible = ref(false);

const placedCards = computed(() => cards.value.filter((card) => card.placed).sort((a, b) => (a.placedIndex ?? 0) - (b.placedIndex ?? 0)));
const placedIds = computed(() => placedCards.value.map((card) => card.id));
const nextStep = computed(() => nextScheduleStep(placedIds.value));
const currentRoundId = computed(() => `schedule:step:${session.step + 1}`);
const compactChoices = computed(() => smAndDown.value || height.value <= 700);
const visibleCards = computed(() => createScheduleCandidates(cards.value, placedIds.value, compactChoices.value ? 4 : cards.value.length));

function makeCards(): ScheduleCardState[] {
  return createScheduleCards().map((card) => ({ ...card, placed: false }));
}

function isPlaced(stepId: string) {
  return placedIds.value.includes(stepId);
}

function resetSoftHighlights() {
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

async function playIntroPrompt(delayMs = 0) {
  promptAudio.cancelPending();
  isSpeaking.value = true;
  const firstStep = nextStep.value;
  const sequence = firstStep ? ["schedule.intro", schedulePromptAssetId(firstStep)] : ["schedule.intro"];
  await promptAudio.playSequenceAndWait(sequence, delayMs, 180);
  isSpeaking.value = false;
}

async function choose(card: ScheduleCardState) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value || card.placed) return;

  const expected = nextStep.value;
  if (!expected) return;

  if (isExpectedScheduleChoice(card.id, placedIds.value)) {
    const placedIndex = placedCards.value.length + 1;
    card.placed = true;
    card.placedIndex = placedIndex;
    pendingSelection.value = true;
    isSpeaking.value = true;
    successChoiceId.value = card.id;
    feedbackMessage.value = nextStep.value ? "Верно. Теперь выбери следующий шаг дня." : "Расписание собрано. День получился понятным.";
    recordSuccess({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expected: expected.id, actual: card.id, isCorrect: true });
    void scheduleFeedback.playSuccess(session.settings.sound);
    promptAudio.cancelPending();
    const upcomingStep = nextStep.value;
    const sequence = upcomingStep
      ? ["schedule.correct", schedulePromptAssetId(upcomingStep)]
      : ["schedule.correct", "schedule.complete"];
    await promptAudio.playSequenceAndWait(sequence, 120, 180);
    resetSoftHighlights();
    if (!upcomingStep) resultVisible.value = true;
    return;
  }

  pendingSelection.value = true;
  isSpeaking.value = true;
  wrongChoiceId.value = card.id;
  feedbackMessage.value = "Посмотри на порядок дня и попробуй выбрать другую карточку.";
  recordMistake({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expectedTargetId: scheduleTargetId(expected), expected: expected.id, actual: card.id, isCorrect: false });
  void scheduleFeedback.playMistake(session.settings.sound);
  promptAudio.cancelPending();
  await promptAudio.playSequenceAndWait(["schedule.mistake"], 120);
  resetSoftHighlights();
}

function choiceColor(card: ScheduleCardState) {
  if (wrongChoiceId.value === card.id) return "orange-lighten-4";
  if (successChoiceId.value === card.id) return "green-lighten-4";
  return "surface";
}

function restart() {
  cards.value = makeCards();
  feedbackMessage.value = "Собери день по порядку. Начни с первой карточки утром.";
  resetSoftHighlights();
  resultVisible.value = false;
  promptAudio.cancelPending();
  startSession();
  void playIntroPrompt(450);
}

onMounted(() => {
  scheduleFeedback.warm(session.settings.sound);
  promptAudio.warm();
  void playIntroPrompt(450);
});

onUnmounted(() => {
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

            <v-card v-if="nextStep" class="current-step-card pa-2" color="amber-lighten-5" rounded="xl" variant="flat">
              <div class="current-step-image">
                <GameWordImage :word-id="nextStep.imageId" :word="nextStep.title" :emoji="nextStep.emoji" />
              </div>
              <div class="current-step-copy">
                <div class="text-caption text-medium-emphasis">Сейчас</div>
                <div class="text-subtitle-1 font-weight-bold">{{ nextStep.title }}</div>
              </div>
            </v-card>

            <div class="schedule-strip-title text-caption text-medium-emphasis">Сюда собирается расписание</div>
            <div class="schedule-strip" aria-label="Собранное расписание дня по порядку">
              <v-card v-for="(step, index) in dailyScheduleSteps" :key="step.id" :class="['schedule-slot', { 'schedule-slot--next': nextStep?.id === step.id, 'schedule-slot--done': isPlaced(step.id) }]" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <template v-if="isPlaced(step.id)">
                  <GameWordImage class="slot-image" :word-id="step.imageId" :word="step.title" :emoji="step.emoji" decorative />
                  <div class="text-caption font-weight-bold mt-1">{{ step.title }}</div>
                </template>
                <template v-else>
                  <div class="text-h5 font-weight-bold text-medium-emphasis">{{ index + 1 }}</div>
                </template>
              </v-card>
            </div>

            <v-row class="choice-row" justify="center" no-gutters>
              <v-col v-for="card in visibleCards" :key="card.id" class="schedule-choice-col pa-2" cols="6" sm="3">
                <GameDwellButton :target-id="scheduleTargetId(card)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking || card.placed" :dwell-ms="session.settings.dwellMs" min-height="11rem" :color="choiceColor(card)" @select="choose(card)">
                  <template #default>
                    <div :class="['schedule-choice', { 'schedule-choice--placed': card.placed }]">
                      <div class="choice-image" :style="{ backgroundColor: card.color }">
                        <GameWordImage :word-id="card.imageId" :word="card.title" :emoji="card.emoji" />
                      </div>
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
    <GameResultDialog :model-value="resultVisible" title="Расписание" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
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

.current-step-card {
  align-items: center;
  align-self: center;
  border: 0.125rem solid rgb(var(--v-theme-warning-darken-1) / 34%);
  display: flex;
  flex: 0 0 auto;
  gap: 0.65rem;
  justify-content: center;
  min-inline-size: min(20rem, 100%);
}

.current-step-image {
  font-size: clamp(2.75rem, 7.5dvh, 4.5rem);
}

.current-step-copy {
  text-align: start;
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

.slot-image {
  font-size: clamp(1.7rem, 4.8vh, 3.25rem);
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

.choice-image {
  align-items: center;
  border-radius: 1.25rem;
  display: inline-flex;
  filter: drop-shadow(0 0.5rem 0.625rem rgb(0 0 0 / 14%));
  font-size: clamp(2.65rem, 7.2vh, 5.4rem);
  justify-content: center;
  min-block-size: clamp(4rem, 10dvh, 6rem);
  min-inline-size: clamp(4rem, 10dvh, 6rem);
  padding: 0.25rem;
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

  .choice-image {
    font-size: clamp(2.35rem, 7vh, 3rem);
    min-block-size: 3.5rem;
    min-inline-size: 3.5rem;
  }
}
</style>
