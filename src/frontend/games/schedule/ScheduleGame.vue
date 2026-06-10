<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { createScheduleCards, dailyScheduleSteps, isExpectedScheduleChoice, nextScheduleStep, scheduleMaxSteps, scheduleTargetId, type ScheduleCard } from "./model";

type ScheduleCardState = ScheduleCard & {
  placed: boolean;
  placedIndex?: number;
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("schedule", {
  maxSteps: scheduleMaxSteps,
  dwellMs: 1300,
  sessionSeconds: 140,
  sound: false
}, { finishOnMistakes: false });

const cards = ref<ScheduleCardState[]>(makeCards());
const feedbackMessage = ref("Собери день по порядку. Начни с первой карточки утром.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const hintedCardId = ref(nextScheduleStep([])?.id);
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
    hintedCardId.value = nextScheduleStep(placedIds.value)?.id;
    feedbackMessage.value = nextStep.value ? `Верно: ${card.title}. Следующий шаг — ${nextStep.value.title}.` : "Расписание собрано. День получился понятным.";
    recordSuccess({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expected: expected.id, actual: card.id, isCorrect: true });
    feedbackTimer = window.setTimeout(resetSoftHighlights, 650);
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = card.id;
  hintedCardId.value = expected.id;
  feedbackMessage.value = `Почти. Сейчас следующий шаг: ${expected.title}. ${expected.hint}`;
  recordMistake({ roundId: currentRoundId.value, targetId: scheduleTargetId(card), expectedTargetId: scheduleTargetId(expected), expected: expected.id, actual: card.id, isCorrect: false });
  recordHint({ roundId: currentRoundId.value, targetId: scheduleTargetId(expected), expected: expected.id, message: expected.hint });
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 1100);
}

function choiceColor(card: ScheduleCardState) {
  if (wrongChoiceId.value === card.id) return "orange-lighten-4";
  if (successChoiceId.value === card.id) return "green-lighten-4";
  if (hintedCardId.value === card.id) return "blue-lighten-5";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  cards.value = makeCards();
  feedbackMessage.value = "Собери день по порядку. Начни с первой карточки утром.";
  hintedCardId.value = nextScheduleStep([])?.id;
  resetSoftHighlights();
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="schedule-shell">
    <GameHud title="Расписание" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC-последовательность</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Собери расписание дня</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <div class="schedule-strip mb-6" aria-label="Расписание дня по порядку">
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

            <v-alert class="mb-6" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="text-caption text-medium-emphasis mb-1">Следующая карточка</div>
              <div v-if="nextStep" class="d-flex flex-wrap align-center ga-3">
                <v-avatar :color="nextStep.color" size="58"><v-icon color="white" :icon="nextStep.icon" size="34" /></v-avatar>
                <div>
                  <div class="text-h5 font-weight-bold">{{ nextStep.title }}</div>
                  <div class="text-body-1 text-medium-emphasis">AAC: {{ nextStep.aacLabel }}</div>
                </div>
              </div>
              <div v-else class="text-h5 font-weight-bold">Все карточки на месте.</div>
            </v-alert>

            <v-row justify="center">
              <v-col v-for="card in cards" :key="card.id" cols="6" md="3">
                <GameDwellButton :target-id="scheduleTargetId(card)" :disabled="session.status !== 'running' || pendingSelection || card.placed" :dwell-ms="session.settings.dwellMs" :min-height="176" :color="choiceColor(card)" @select="choose(card)">
                  <template #default>
                    <div :class="['schedule-choice', { 'schedule-choice--placed': card.placed, 'schedule-choice--hint': hintedCardId === card.id && !card.placed }]">
                      <v-icon class="choice-icon" :color="card.color" :icon="card.icon" />
                      <div class="text-h6 font-weight-bold mt-2">{{ card.title }}</div>
                      <v-chip class="mt-3" color="primary" size="large" variant="tonal">{{ card.aacLabel }}</v-chip>
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
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.schedule-strip {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(8, minmax(0, 1fr));
}

.schedule-slot {
  align-items: center;
  border: 3px dashed rgb(var(--v-theme-primary) / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 108px;
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.schedule-slot--next {
  box-shadow: 0 0 0 5px rgb(var(--v-theme-primary) / 22%);
  transform: translateY(-2px);
}

.schedule-slot--done {
  background: rgb(var(--v-theme-surface));
  border-style: solid;
}

.slot-icon {
  font-size: clamp(2.2rem, 4vw, 3.3rem);
}

.choice-icon {
  filter: drop-shadow(0 8px 10px rgb(0 0 0 / 14%));
  font-size: clamp(3.2rem, 6vw, 5.3rem);
}

.schedule-choice {
  transition: opacity 160ms ease, transform 160ms ease;
}

.schedule-choice--hint {
  transform: scale(1.03);
}

.schedule-choice--placed {
  opacity: 0.28;
}

@media (max-width: 960px) {
  .schedule-strip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }

  .schedule-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
