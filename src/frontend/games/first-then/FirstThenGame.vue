<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { createFirstThenPairOrder, generateFirstThenRound, type FirstThenAction, type FirstThenPhase, type FirstThenRound } from "./model";

const firstThenFeedback = createStandardGameFeedback();

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, finishSession, startSession } = useGameSessionFor("first-then", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false,
  finishOnMaxSteps: false
});
const promptAudio = useGamePromptAudio({ gameId: "first-then", soundEnabled: toRef(session.settings, "sound") });

const pairOrder = ref(createFirstThenPairOrder());
const choiceOrdersByPairIndex = ref<Record<number, string[]>>({});
const pairIndex = ref(1);
const phase = ref<FirstThenPhase>("first");
const round = ref<FirstThenRound>(generateFirstThenRound(pairIndex.value, phase.value, { pairOrder: pairOrder.value, choiceOrder: ensureChoiceOrder(pairIndex.value) }));
const resultVisible = computed(() => session.status === "finished");
const feedback = ref("Выбери карточку. Сначала одно действие, потом другое.");
const isChangingRound = ref(false);
let transitionTimer = 0;

const phaseLabel = computed(() => phase.value === "first" ? "Сначала" : "Потом");
const timelineItems = computed(() => [
  { label: "Сначала", action: round.value.pair.first, active: phase.value === "first" },
  { label: "Потом", action: round.value.pair.then, active: phase.value === "then" }
]);

function choiceTargetId(action: FirstThenAction) {
  return `first-then:choice:${round.value.pair.id}:${phase.value}:${action.id}`;
}

function setRound(nextPairIndex: number, nextPhase: FirstThenPhase) {
  pairIndex.value = nextPairIndex;
  phase.value = nextPhase;
  round.value = generateFirstThenRound(nextPairIndex, nextPhase, { pairOrder: pairOrder.value, choiceOrder: ensureChoiceOrder(nextPairIndex) });
}

function ensureChoiceOrder(nextPairIndex: number) {
  choiceOrdersByPairIndex.value[nextPairIndex] ??= generateFirstThenRound(nextPairIndex, "first", { pairOrder: pairOrder.value }).choices.map((choice) => choice.id);
  return choiceOrdersByPairIndex.value[nextPairIndex];
}

function playPhasePrompt(delayMs = 0) {
  promptAudio.cancelPending();
  promptAudio.play(`first-then.prompt.${round.value.pair.id}.${phase.value}`, delayMs);
}

function clearTransitionTimer() {
  window.clearTimeout(transitionTimer);
  transitionTimer = 0;
}

function advanceRound() {
  if (session.status !== "running") return;
  if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    return;
  }

  if (phase.value === "first") {
    setRound(pairIndex.value, "then");
    feedback.value = "Теперь выбери, что будет потом.";
    playPhasePrompt(300);
  } else {
    setRound(pairIndex.value + 1, "first");
    feedback.value = "Новая пара. Что сначала?";
    playPhasePrompt(300);
  }
}

function chooseAction(action: FirstThenAction) {
  if (session.status !== "running" || isChangingRound.value) return;

  const expectedAction = round.value.expectedAction;
  const targetId = choiceTargetId(action);
  const expectedTargetId = choiceTargetId(expectedAction);
  const wasCorrect = action.id === expectedAction.id;
  isChangingRound.value = true;

  if (wasCorrect) {
    void firstThenFeedback.playSuccess(session.settings.sound);
    promptAudio.play(`first-then.correct.${phase.value}`);
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: action.id,
      expected: expectedAction.id,
      actual: action.id,
      phase: phase.value,
      isCorrect: true
    });
    feedback.value = phase.value === "first" ? "Верно: это сначала." : "Верно: это потом.";
  } else {
    void firstThenFeedback.playMistake(session.settings.sound);
    promptAudio.play(`first-then.mistake.${round.value.pair.id}`);
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      answerId: action.id,
      expected: expectedAction.id,
      actual: action.id,
      phase: phase.value,
      isCorrect: false
    });
    recordHint({ roundId: round.value.roundId, text: round.value.explanation });
    session.step += 1;
    feedback.value = `Ничего страшного. ${round.value.explanation}`;
  }

  clearTransitionTimer();
  transitionTimer = window.setTimeout(() => {
    transitionTimer = 0;
    advanceRound();
    isChangingRound.value = false;
  }, wasCorrect ? 850 : 1500);
}

function restart() {
  clearTransitionTimer();
  promptAudio.cancelPending();
  pairOrder.value = createFirstThenPairOrder();
  choiceOrdersByPairIndex.value = {};
  feedback.value = "Выбери карточку. Сначала одно действие, потом другое.";
  isChangingRound.value = false;
  setRound(1, "first");
  startSession();
  playPhasePrompt(450);
}

onMounted(() => {
  firstThenFeedback.warm(session.settings.sound);
  promptAudio.warm();
  playPhasePrompt(450);
});

onUnmounted(() => {
  clearTransitionTimer();
  promptAudio.cancelPending();
  firstThenFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #f1f7ff 0%, #fff6e8 52%, #f3ecff 100%)" padding-top="8.25rem">
    <template #hud>
      <GameHud title="Сначала-потом" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="first-then-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Порядок действий</div>
            <div class="first-then-heading text-center mb-6">
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-card class="timeline-card pa-4 pa-md-5 mb-6" color="indigo-lighten-5" rounded="xl" variant="flat">
              <div class="d-flex flex-column flex-md-row align-stretch ga-4">
                <div v-for="item in timelineItems" :key="item.label" class="timeline-step flex-grow-1 pa-4 rounded-xl" :class="{ 'timeline-step--active': item.active }">
                  <div class="text-overline text-primary mb-1">{{ item.label }}</div>
                  <div class="d-flex align-center ga-3">
                    <div class="timeline-emoji emoji-glyph">{{ item.action.emoji }}</div>
                    <div class="text-h6 text-md-h5 font-weight-bold">{{ item.action.title }}</div>
                  </div>
                </div>
              </div>
            </v-card>

            <v-chip class="phase-chip mb-4" color="primary" size="large" variant="tonal">Выбираем: {{ phaseLabel }}</v-chip>
            <GameChoiceCardGrid :choices="round.choices" :target-id="choiceTargetId" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="170" :cols="12" :md="6" @select="chooseAction">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h4 text-md-h3 font-weight-bold mb-2">{{ choice.title }}</div>
                <div class="choice-phrase text-body-1 text-md-h6 font-weight-medium">{{ choice.phrase }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сначала-потом" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.timeline-step {
  background: rgb(var(--v-theme-surface) / 72%);
  border: 2px solid rgb(var(--v-theme-primary) / 12%);
}

.timeline-step--active {
  background: rgb(var(--v-theme-primary) / 12%);
  border-color: rgb(var(--v-theme-primary) / 34%);
}

.timeline-emoji {
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.75rem, 8vw, 6rem);
  line-height: 1;
}

.choice-phrase {
  color: rgb(var(--v-theme-on-surface));
}

@media (max-height: 820px) {
  .timeline-card {
    display: none;
  }
}

@media (max-height: 44rem) {
  .first-then-card {
    padding-block: 0.875rem !important;
  }

  .first-then-heading {
    margin-block-end: 0.875rem !important;
  }

  .first-then-heading h1 {
    font-size: 2rem !important;
    line-height: 1.08;
  }

  .phase-chip {
    margin-block-end: 0.75rem !important;
  }

  .choice-emoji {
    font-size: clamp(2.75rem, 6vw, 3.75rem);
  }

  .choice-phrase {
    display: none;
  }

  .first-then-card :deep(.dwell-button) {
    min-block-size: 7.5rem !important;
  }
}
</style>
