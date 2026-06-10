<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateShapeDanceRound, type ShapeDanceFigure, type ShapeDanceRound } from "./model";

type DancePhase = "watch" | "repeat" | "feedback";

const highlightMs = 820;
const stepGapMs = 1040;
const feedbackMs = 900;

const router = useRouter();
const phase = ref<DancePhase>("watch");
const feedbackText = ref("Смотри, как фигуры танцуют по очереди.");
const activeFigureId = ref<string>();
const activeStepIndex = ref(-1);
const hintedFigureId = ref<string>();
const selectedIds = ref<string[]>([]);
const isLocked = ref(true);
let sequenceTimers: number[] = [];
let feedbackTimer = 0;

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("shape-dance", {
  maxSteps: 8,
  dwellMs: 1250,
  sessionSeconds: 130
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame<ShapeDanceRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateShapeDanceRound(session.settings, roundIndex)
});

const expectedFigure = computed(() => round.value.sequence[selectedIds.value.length]);
const progressText = computed(() => `Шаг ${Math.min(selectedIds.value.length + 1, round.value.sequence.length)} из ${round.value.sequence.length}`);

function figureTargetId(figure: ShapeDanceFigure) {
  return `shape-dance:${round.value.roundId}:figure:${figure.id}`;
}

function clearSequenceTimers() {
  sequenceTimers.forEach((timer) => window.clearTimeout(timer));
  sequenceTimers = [];
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function queueSequenceTimer(callback: () => void, delayMs: number) {
  sequenceTimers.push(window.setTimeout(callback, delayMs));
}

function playSequence(message = "Смотри, как фигуры танцуют по очереди.") {
  clearSequenceTimers();
  clearFeedbackTimer();
  phase.value = "watch";
  isLocked.value = true;
  selectedIds.value = [];
  hintedFigureId.value = undefined;
  activeFigureId.value = undefined;
  activeStepIndex.value = -1;
  feedbackText.value = message;

  round.value.sequence.forEach((figure, index) => {
    queueSequenceTimer(() => {
      activeFigureId.value = figure.id;
      activeStepIndex.value = index;
      feedbackText.value = `Шаг ${index + 1}: ${figure.label}.`;
    }, 320 + index * stepGapMs);

    queueSequenceTimer(() => {
      if (activeStepIndex.value === index) activeFigureId.value = undefined;
    }, 320 + index * stepGapMs + highlightMs);
  });

  queueSequenceTimer(() => {
    activeFigureId.value = undefined;
    activeStepIndex.value = -1;
    phase.value = "repeat";
    isLocked.value = false;
    feedbackText.value = "Теперь повтори танец по порядку.";
  }, 560 + round.value.sequence.length * stepGapMs);
}

function resetRoundFeedback() {
  clearSequenceTimers();
  clearFeedbackTimer();
  phase.value = "watch";
  isLocked.value = true;
  activeFigureId.value = undefined;
  activeStepIndex.value = -1;
  hintedFigureId.value = undefined;
  selectedIds.value = [];
  feedbackText.value = "Смотри, как фигуры танцуют по очереди.";
}

function chooseFigure(figure: ShapeDanceFigure) {
  if (session.status !== "running" || phase.value !== "repeat" || isLocked.value) return;

  const expected = expectedFigure.value;
  if (!expected) return;

  const targetId = figureTargetId(figure);
  const expectedTargetId = figureTargetId(expected);
  clearFeedbackTimer();

  if (figure.id !== expected.id) {
    phase.value = "feedback";
    isLocked.value = true;
    activeFigureId.value = figure.id;
    hintedFigureId.value = expected.id;
    feedbackText.value = "Почти. Сейчас фигуры мягко повторят танец ещё раз.";
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: figure.id, expected: expected.label, actual: figure.label, isCorrect: false });
    recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
    feedbackTimer = window.setTimeout(() => playSequence("Посмотри ещё раз: танец начнётся спокойно."), feedbackMs);
    return;
  }

  selectedIds.value = [...selectedIds.value, figure.id];
  activeFigureId.value = figure.id;
  hintedFigureId.value = undefined;

  if (selectedIds.value.length < round.value.sequence.length) {
    feedbackText.value = "Верно. Продолжай следующий шаг.";
    feedbackTimer = window.setTimeout(() => {
      activeFigureId.value = undefined;
      feedbackText.value = "Выбери следующую фигуру.";
    }, 520);
    return;
  }

  phase.value = "feedback";
  isLocked.value = true;
  feedbackText.value = "Танец повторён. Фигуры мягко светятся вместе.";
  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: selectedIds.value.join("-"),
    expected: round.value.sequence.map((item) => item.id).join("-"),
    actual: selectedIds.value.join("-"),
    isCorrect: true
  });

  if (session.status === "running" && session.step < session.maxSteps) {
    feedbackTimer = window.setTimeout(() => nextRound(), feedbackMs);
  }
}

function figureColor(figure: ShapeDanceFigure) {
  if (activeFigureId.value === figure.id) return "primary";
  if (hintedFigureId.value === figure.id) return "warning-lighten-4";
  if (selectedIds.value.includes(figure.id)) return "green-lighten-5";
  return figure.surfaceColor;
}

function restart() {
  resetRoundFeedback();
  restartRounds();
}

watch(() => round.value.roundId, () => playSequence(), { immediate: true });

onUnmounted(() => {
  clearSequenceTimers();
  clearFeedbackTimer();
});
</script>

<template>
  <div class="shape-dance-shell">
    <GameHud title="Танец фигур" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="shape-dance-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Повтори последовательность</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">Танец фигур</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ feedbackText }}</p>

            <v-card class="dance-stage pa-4 pa-md-6 mb-5" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="dance-stage__figures" aria-label="Фигуры танца">
                <div v-for="figure in round.choices" :key="`stage-${figure.id}`" :class="['stage-figure', figure.motionClass, { 'stage-figure--active': activeFigureId === figure.id, 'stage-figure--hint': hintedFigureId === figure.id }]">
                  <v-icon class="stage-figure__icon" :color="figure.iconColor" :icon="figure.icon" />
                  <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ figure.label }}</div>
                </div>
              </div>
            </v-card>

            <div class="d-flex flex-wrap justify-center align-center ga-3 mb-5" aria-label="Прогресс повторения">
              <v-chip color="primary" size="large" variant="tonal">{{ phase === "watch" ? "Смотри" : progressText }}</v-chip>
              <v-chip v-for="(_, index) in round.sequence" :key="`${round.roundId}:dot:${index}`" :color="index < selectedIds.length ? 'success' : activeStepIndex === index ? 'primary' : 'blue-grey-lighten-2'" size="large" variant="flat">
                {{ index + 1 }}
              </v-chip>
            </div>

            <v-row dense justify="center">
              <v-col v-for="figure in round.choices" :key="figure.id" cols="12" sm="6" md="3">
                <GameDwellButton :target-id="figureTargetId(figure)" :disabled="session.status !== 'running' || phase !== 'repeat' || isLocked" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="figureColor(figure)" @select="chooseFigure(figure)">
                  <template #default>
                    <div :class="['choice-figure', figure.motionClass, { 'choice-figure--active': activeFigureId === figure.id }]">
                      <v-icon class="choice-figure__icon" :color="activeFigureId === figure.id ? 'white' : figure.iconColor" :icon="figure.icon" />
                      <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ figure.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Танец фигур" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.shape-dance-shell {
  background: linear-gradient(135deg, #eef4ff 0%, #f7f0ff 48%, #fff8e8 100%);
  min-block-size: 100vh;
}

.shape-dance-container {
  padding-block-start: 8.25rem;
}

.dance-stage {
  border: 2px solid rgb(var(--v-theme-primary) / 12%);
  overflow: hidden;
}

.dance-stage__figures {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
}

.stage-figure {
  align-items: center;
  background: rgb(255 255 255 / 72%);
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: clamp(9rem, 17vw, 13.5rem);
  padding: 1rem;
  transition: box-shadow 220ms ease, transform 220ms ease, background 220ms ease;
}

.stage-figure--active,
.stage-figure--hint {
  background: rgb(var(--v-theme-primary) / 14%);
  box-shadow: 0 0 0 0.5rem rgb(var(--v-theme-primary) / 18%), 0 1.25rem 2.5rem rgb(var(--v-theme-primary) / 20%);
  transform: translateY(-0.75rem) scale(1.05);
}

.stage-figure--hint {
  background: rgb(var(--v-theme-warning) / 20%);
  box-shadow: 0 0 0 0.5rem rgb(var(--v-theme-warning) / 24%);
}

.stage-figure__icon,
.choice-figure__icon {
  filter: drop-shadow(0 0.7rem 0.9rem rgb(69 90 100 / 18%));
  font-size: clamp(4.8rem, 11vw, 8rem);
}

.choice-figure {
  transition: transform 220ms ease;
}

.choice-figure--active {
  transform: scale(1.06);
}

.shape-dance-rise.stage-figure--active,
.shape-dance-rise.choice-figure--active {
  animation: shape-dance-rise 820ms ease-in-out;
}

.shape-dance-sway.stage-figure--active,
.shape-dance-sway.choice-figure--active {
  animation: shape-dance-sway 820ms ease-in-out;
}

.shape-dance-turn.stage-figure--active,
.shape-dance-turn.choice-figure--active {
  animation: shape-dance-turn 820ms ease-in-out;
}

@keyframes shape-dance-rise {
  50% {
    transform: translateY(-1.1rem) scale(1.08);
  }
}

@keyframes shape-dance-sway {
  35% {
    transform: translateX(-0.45rem) scale(1.04);
  }

  70% {
    transform: translateX(0.45rem) scale(1.04);
  }
}

@keyframes shape-dance-turn {
  50% {
    transform: rotate(4deg) scale(1.08);
  }
}

@media (max-width: 600px) {
  .shape-dance-container {
    padding-block-start: 9.75rem;
  }

  .dance-stage__figures {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
