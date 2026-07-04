<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { answerLabel, generateScalesRound, scalesAnswers, type ScalesAnswer, type ScalesSide } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("scales", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "scales", soundEnabled, warmAssetIds: ["scales.prompt", "scales.correct", "scales.mistake", "scales.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const feedback = ref("Посмотри на весы и выбери ответ.");
const lastMistakeAnswer = ref<ScalesAnswer>();
const isSpeaking = ref(false);
const answerMinHeight = "clamp(6.25rem, 11vh, 9rem)";
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateScalesRound(session.settings, roundIndex)
});

const frameStyle = computed(() => ({
  "--scale-tilt": `${round.value.tiltDeg}deg`,
  "--left-pan-y": panOffset("left"),
  "--right-pan-y": panOffset("right")
}));

function answerTargetId(answer: ScalesAnswer) {
  return `scales:choice:${answer}`;
}

function panOffset(side: ScalesSide) {
  const diff = round.value.left.weight - round.value.right.weight;
  if (diff === 0) return "0rem";
  const down = side === "left" ? diff > 0 : diff < 0;
  return down ? "0.9rem" : "-0.7rem";
}

async function choose(answer: ScalesAnswer) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = answerTargetId(answer);
  const expectedTargetId = answerTargetId(round.value.correctAnswer);
  if (answer === round.value.correctAnswer) {
    feedback.value = "Верно.";
    lastMistakeAnswer.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.correctAnswer, actual: answer, leftWeight: round.value.left.weight, rightWeight: round.value.right.weight, isCorrect: true });
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["scales.correct", "scales.complete"] : ["scales.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    feedback.value = "Посмотри на весы и выбери ответ.";
    promptAudio.play("scales.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  feedback.value = "Посмотри на весы ещё раз и выбери другой ответ.";
  lastMistakeAnswer.value = answer;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.correctAnswer, actual: answer, leftWeight: round.value.left.weight, rightWeight: round.value.right.weight, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["scales.mistake"], 80);
  isSpeaking.value = false;
}

function restartGame() {
  promptAudio.cancelPending();
  feedback.value = "Посмотри на весы и выбери ответ.";
  lastMistakeAnswer.value = undefined;
  isSpeaking.value = false;
  restart();
  promptAudio.play("scales.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("scales.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="scales-shell">
    <GameHud title="Весы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="scales-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сравни весы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-heart-outline" rounded="xl" variant="tonal">
              {{ feedback }}
            </v-alert>

            <v-sheet class="scale-stage pa-4 pa-md-6 mb-4" color="blue-lighten-5" rounded="xl">
              <div :key="round.roundId" class="scale-frame" :style="frameStyle" aria-hidden="true">
                <div class="scale-top">
                  <v-icon icon="mdi-scale-balance" size="46" color="primary" />
                </div>
                <div class="scale-beam" />
                <div class="scale-pan-wrap scale-pan-wrap--left">
                  <div class="scale-cord" />
                  <div class="scale-pan scale-pan--left">
                    <span v-for="(item, index) in round.left.items" :key="`left-${index}`" class="pan-item emoji-glyph">{{ item }}</span>
                  </div>
                </div>
                <div class="scale-pivot" />
                <div class="scale-pan-wrap scale-pan-wrap--right">
                  <div class="scale-cord" />
                  <div class="scale-pan scale-pan--right">
                    <span v-for="(item, index) in round.right.items" :key="`right-${index}`" class="pan-item emoji-glyph">{{ item }}</span>
                  </div>
                </div>
                <div class="scale-stand" />
                <div class="scale-base" />
              </div>
              <div class="sr-only">
                Левая чаша: {{ round.left.weight }}. Правая чаша: {{ round.right.weight }}.
              </div>
            </v-sheet>

            <v-row class="answer-row" dense>
              <v-col v-for="answer in scalesAnswers" :key="answer" class="scales-answer-col" cols="12" md="4">
                <GameDwellButton :target-id="answerTargetId(answer)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="answerMinHeight" :color="lastMistakeAnswer === answer ? 'secondary' : 'surface'" @select="choose(answer)">
                  <template #default>
                    <div class="d-flex align-center justify-center ga-3 text-h5 text-md-h4 font-weight-bold">
                      <v-icon v-if="answer === 'equal'" icon="mdi-equal" size="38" />
                      <v-icon v-else-if="answer === round.correctAnswer && session.status === 'finished'" icon="mdi-check" size="38" />
                      {{ answerLabel(answer, round.question) }}
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Весы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.scales-shell {
  background: linear-gradient(135deg, #fff8df 0%, #e6f5ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: clamp(3rem, 8vh, 9.75rem);
}

.scales-card {
  padding: clamp(0.875rem, 2.2vh, 1.5rem) !important;
}

.scale-stage {
  margin-block-end: clamp(0.75rem, 1.6vh, 1rem) !important;
  overflow: hidden;
  padding: clamp(0.75rem, 2vh, 1.5rem) !important;
}

.scale-frame {
  block-size: clamp(14.5rem, 38vh, 22rem);
  margin-inline: auto;
  max-inline-size: 58rem;
  position: relative;
}

.scale-top {
  inset-block-start: 0;
  inset-inline: 0;
  position: absolute;
  text-align: center;
}

.scale-beam {
  background: rgb(var(--v-theme-primary));
  block-size: 0.55rem;
  border-radius: 999px;
  inline-size: min(82%, 48rem);
  inset-block-start: clamp(4.1rem, 10vh, 5.5rem);
  inset-inline-start: 50%;
  position: absolute;
  transform-origin: 50% 50%;
  transform: translateX(-50%) rotate(var(--scale-tilt));
  animation: scale-beam-settle 760ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.scale-pivot {
  background: rgb(var(--v-theme-primary));
  block-size: clamp(4rem, 11vh, 6rem);
  border-radius: 999px 999px 0 0;
  inline-size: clamp(2.3rem, 5vw, 3.1rem);
  inset-block-start: clamp(4.25rem, 10vh, 5.75rem);
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
  z-index: 1;
}

.scale-pan-wrap {
  inline-size: min(39%, 20.5rem);
  position: absolute;
  z-index: 2;
}

.scale-pan-wrap--left {
  --pan-y: var(--left-pan-y);

  inset-block-start: clamp(5rem, 12vh, 7rem);
  inset-inline-start: 2%;
  transform: translateY(var(--pan-y));
  animation: scale-pan-settle 760ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.scale-pan-wrap--right {
  --pan-y: var(--right-pan-y);

  inset-block-start: clamp(5rem, 12vh, 7rem);
  inset-inline-end: 2%;
  transform: translateY(var(--pan-y));
  animation: scale-pan-settle 760ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.scale-cord {
  background: rgb(var(--v-theme-primary) / 72%);
  block-size: clamp(1.25rem, 3.2vh, 2.25rem);
  border-radius: 999rem;
  inline-size: 0.3rem;
  margin-inline: auto;
}

.scale-pan {
  align-content: center;
  background: #ffffff;
  border: 0.3rem solid rgb(var(--v-theme-primary));
  border-radius: 2rem;
  box-shadow: 0 0.75rem 1.5rem rgb(75 106 145 / 15%);
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
  min-block-size: clamp(6rem, 15vh, 10rem);
  padding: 0.75rem;
  z-index: 1;
}

.scale-pan--left {
  border-start-end-radius: 0.85rem;
}

.scale-pan--right {
  border-start-start-radius: 0.85rem;
}

.pan-item {
  animation: pan-item-pop 520ms ease both;
  font-size: clamp(1.8rem, min(4.8vw, 5.5vh), 3.4rem);
  line-height: 1;
}

.scale-stand {
  background: rgb(var(--v-theme-primary));
  block-size: 56%;
  border-radius: 999px;
  inline-size: 1.3rem;
  inset-block-end: 1.55rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.scale-base {
  background: rgb(var(--v-theme-primary));
  block-size: 1.3rem;
  border-radius: 999px;
  inline-size: min(22rem, 52%);
  inset-block-end: 0.8rem;
  inset-inline-start: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.answer-row {
  row-gap: clamp(0.5rem, 1.4vh, 0.75rem);
}

@keyframes scale-beam-settle {
  0% {
    transform: translateX(-50%) rotate(calc(var(--scale-tilt) * -0.35));
  }

  62% {
    transform: translateX(-50%) rotate(calc(var(--scale-tilt) * 1.14));
  }

  100% {
    transform: translateX(-50%) rotate(var(--scale-tilt));
  }
}

@keyframes scale-pan-settle {
  0% {
    transform: translateY(0);
  }

  62% {
    transform: translateY(calc(var(--pan-y) * 1.14));
  }

  100% {
    transform: translateY(var(--pan-y));
  }
}

@keyframes pan-item-pop {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.sr-only {
  block-size: 0.0625rem;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 0.0625rem;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-height: 42rem) {
 .game-container .text-overline,
 .game-container h1,
 .game-container .v-alert {
    display: none;
  }

 .scales-answer-col {
    flex: 0 0 33.3333% !important;
    max-inline-size: 33.3333% !important;
  }
}

@media (prefers-reduced-motion: reduce) {
 .scale-beam,
 .scale-pan-wrap,
 .pan-item {
    animation: none;
  }
}
</style>
