<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { createStandardGameFeedback } from "../../core/gameFeedbackAudio";
import { resolveMenuRoute } from "../../core/menuMode";
import { playSoftPianoMelody, warmSoftPiano } from "../../core/softPiano";
import { generateShapeDanceRound, type ShapeDanceFigure, type ShapeDanceRound } from "./model";

type DancePhase = "watch" | "repeat" | "feedback";

const highlightMs = 820;
const stepGapMs = 1040;
const feedbackMs = 900;
const roundPauseMs = 1800;
const danceFeedback = createStandardGameFeedback();
const danceNoteByFigureId: Record<string, { note: number; frequency: number }> = {
  circle: { note: 60, frequency: 261.63 },
  square: { note: 64, frequency: 329.63 },
  triangle: { note: 67, frequency: 392 },
  diamond: { note: 72, frequency: 523.25 },
  star: { note: 63, frequency: 311.13 },
  hexagon: { note: 55, frequency: 196 }
};

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

const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("shape-dance", {
  maxSteps: 8,
  overrides: { sound: true },
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

function playDanceNote(figure: ShapeDanceFigure) {
  const note = danceNoteByFigureId[figure.id];
  if (!note) return;
  void playSoftPianoMelody(session.settings.sound, {
    notesToLoad: [55, 60, 63, 64, 67, 72],
    sampled: [{ note: note.note, at: 0, duration: 0.48, velocity: 30 }],
    fallback: [{ frequency: note.frequency, at: 0, duration: 0.44, peak: 0.034 }],
    lengthSeconds: 0.5
  });
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
      playDanceNote(figure);
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
    void danceFeedback.playMistake(session.settings.sound);
    recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: figure.id, expected: expected.label, actual: figure.label, isCorrect: false });
    recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
    feedbackTimer = window.setTimeout(() => playSequence("Посмотри ещё раз: танец начнётся спокойно."), feedbackMs);
    return;
  }

  selectedIds.value = [...selectedIds.value, figure.id];
  activeFigureId.value = figure.id;
  hintedFigureId.value = undefined;

  if (selectedIds.value.length < round.value.sequence.length) {
    playDanceNote(figure);
    feedbackText.value = "Верно. Продолжай следующий шаг.";
    feedbackTimer = window.setTimeout(() => {
      activeFigureId.value = undefined;
      feedbackText.value = "Выбери следующую фигуру.";
    }, 520);
    return;
  }

  phase.value = "feedback";
  isLocked.value = true;
  feedbackText.value = "Танец повторён. Спокойная пауза перед новым уровнем.";
  void danceFeedback.playSuccess(session.settings.sound);
  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: selectedIds.value.join("-"),
    expected: round.value.sequence.map((item) => item.id).join("-"),
    actual: selectedIds.value.join("-"),
    isCorrect: true
  });

  if (session.status === "running" && session.step < session.maxSteps) {
    feedbackTimer = window.setTimeout(() => nextRound(), roundPauseMs);
  }
}

function figureColor(figure: ShapeDanceFigure) {
  if (activeFigureId.value === figure.id) return "blue-grey-darken-4";
  if (hintedFigureId.value === figure.id) return "warning-lighten-4";
  if (selectedIds.value.includes(figure.id)) return "green-lighten-5";
  return figure.surfaceColor;
}

function restart() {
  resetRoundFeedback();
  restartRounds();
}

watch(() => round.value.roundId, () => playSequence(), { immediate: true });

onMounted(() => {
  warmSoftPiano(session.settings.sound, [55, 60, 63, 64, 67, 72]);
  danceFeedback.warm(session.settings.sound);
});

onUnmounted(() => {
  clearSequenceTimers();
  clearFeedbackTimer();
  danceFeedback.dispose();
});
</script>

<template>
  <div class="shape-dance-shell">
    <GameHud title="Танец фигур" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="shape-dance-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="shape-dance-card pa-4 pa-md-7" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Повтори последовательность</div>
            <h1 class="shape-dance-title text-h3 text-md-h2 font-weight-bold text-center mb-2">Танец фигур</h1>
            <p class="shape-dance-feedback text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ feedbackText }}</p>

            <v-card class="dance-stage pa-4 pa-md-6 mb-5" color="blue-grey-lighten-5" rounded="xl" variant="flat">
              <div class="dance-stage__figures" aria-label="Фигуры танца">
                <GameDwellButton v-for="figure in round.choices" :key="figure.id" class="shape-dance-target" :target-id="figureTargetId(figure)" :disabled="session.status !== 'running' || phase !== 'repeat' || isLocked" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="figureColor(figure)" @select="chooseFigure(figure)">
                  <template #default>
                    <div :class="['dance-figure', figure.motionClass, { 'dance-figure--active': activeFigureId === figure.id, 'dance-figure--hint': hintedFigureId === figure.id }]">
                      <v-icon class="dance-figure__icon" :color="activeFigureId === figure.id ? 'white' : figure.iconColor" :icon="figure.icon" />
                      <div class="figure-label text-h5 text-md-h4 font-weight-bold mt-3">{{ figure.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </div>
            </v-card>

            <div class="d-flex flex-wrap justify-center align-center ga-3 mb-5" aria-label="Прогресс повторения">
              <v-chip color="primary" size="large" variant="tonal">{{ phase === "watch" ? "Смотри" : progressText }}</v-chip>
              <v-chip v-for="(_, index) in round.sequence" :key="`${round.roundId}:dot:${index}`" :color="index < selectedIds.length ? 'success' : activeStepIndex === index ? 'primary' : 'blue-grey-lighten-2'" size="large" variant="flat">
                {{ index + 1 }}
              </v-chip>
            </div>

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
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.dance-stage__figures :deep(.dwell-button) {
  padding: 1rem !important;
}

.dance-figure {
  align-items: center;
  border-radius: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: box-shadow 220ms ease, transform 220ms ease, background 220ms ease;
}

.dance-figure--active,
.dance-figure--hint {
  transform: translateY(-0.75rem) scale(1.05);
}

.dance-figure--hint .figure-label {
  color: #5f3700 !important;
}

.dance-figure__icon {
  filter: drop-shadow(0 0.7rem 0.9rem rgb(69 90 100 / 18%));
  font-size: clamp(4.8rem, 11vw, 8rem);
}

.figure-label {
  color: #1f2a27 !important;
}

.dance-figure--active .figure-label {
  color: #ffffff !important;
}

@media (max-height: 920px) {
  .shape-dance-container {
    padding-block-start: 5.75rem;
  }

  .shape-dance-card {
    padding-block: 0.9rem !important;
  }

  .shape-dance-title {
    font-size: 2rem !important;
    line-height: 1.05;
  }

  .shape-dance-feedback {
    font-size: 1.15rem !important;
    margin-block-end: 0.75rem !important;
  }

  .dance-stage {
    margin-block-end: 1rem !important;
    padding-block: 0.9rem !important;
  }

  .dance-stage__figures :deep(.dwell-button) {
    min-block-size: 9.5rem !important;
  }

  .dance-figure__icon {
    font-size: clamp(3.2rem, 8vw, 5rem);
  }

  .figure-label {
    font-size: 1.2rem !important;
  }
}

.shape-dance-rise.dance-figure--active {
  animation: shape-dance-rise 820ms ease-in-out;
}

.shape-dance-sway.dance-figure--active {
  animation: shape-dance-sway 820ms ease-in-out;
}

.shape-dance-turn.dance-figure--active {
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
