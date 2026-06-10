<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFirstThenRound, type FirstThenAction, type FirstThenPhase, type FirstThenRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, finishSession, startSession } = useGameSession("first-then", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false, finishOnMaxSteps: false });

const pairIndex = ref(1);
const phase = ref<FirstThenPhase>("first");
const round = ref<FirstThenRound>(generateFirstThenRound(pairIndex.value, phase.value));
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
  round.value = generateFirstThenRound(nextPairIndex, nextPhase);
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
  } else {
    setRound(pairIndex.value + 1, "first");
    feedback.value = "Новая пара. Что сначала?";
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
  feedback.value = "Выбери карточку. Сначала одно действие, потом другое.";
  isChangingRound.value = false;
  setRound(1, "first");
  startSession();
}

onUnmounted(() => {
  clearTransitionTimer();
});
</script>

<template>
  <div class="first-then-shell">
    <GameHud title="Сначала-потом" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Порядок действий</div>
            <div class="text-center mb-6">
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-card class="pa-4 pa-md-5 mb-6" color="indigo-lighten-5" rounded="xl" variant="flat">
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

            <v-chip class="mb-4" color="primary" size="large" variant="tonal">Выбираем: {{ phaseLabel }}</v-chip>
            <v-row>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" md="6">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="230" color="surface" @select="chooseAction(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h3 text-md-h2 font-weight-bold mb-2">{{ choice.title }}</div>
                    <div class="text-h6 text-medium-emphasis">{{ choice.phrase }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сначала-потом" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.first-then-shell {
  background: linear-gradient(135deg, #f1f7ff 0%, #fff6e8 52%, #f3ecff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

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
  font-size: clamp(4.5rem, 10vw, 7rem);
  line-height: 1;
}
</style>
