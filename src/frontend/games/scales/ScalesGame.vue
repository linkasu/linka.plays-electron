<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { answerLabel, generateScalesRound, scalesAnswers, type ScalesAnswer, type ScalesSide } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("scales", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: false },
  finishOnMistakes: false
});

const feedback = ref("");
const lastMistakeAnswer = ref<ScalesAnswer>();
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateScalesRound(session.settings, roundIndex)
});

const beamStyle = computed(() => ({ transform: `rotate(${round.value.tiltDeg}deg)` }));

function answerTargetId(answer: ScalesAnswer) {
  return `scales:choice:${answer}`;
}

function panOffsetStyle(side: ScalesSide) {
  const diff = round.value.left.weight - round.value.right.weight;
  if (diff === 0) return { transform: "translateY(0)" };
  const down = side === "left" ? diff > 0 : diff < 0;
  return { transform: down ? "translateY(1.1rem)" : "translateY(-0.8rem)" };
}

function buildHint() {
  const correct = answerLabel(round.value.correctAnswer, round.value.question).toLowerCase();
  if (round.value.correctAnswer === "equal") return "Весы стоят ровно: стороны равны.";
  return round.value.question === "heavier"
    ? `Посмотри на чашу ниже: ${correct}.`
    : `Посмотри на чашу выше: ${correct}.`;
}

function choose(answer: ScalesAnswer) {
  if (session.status !== "running") return;

  const targetId = answerTargetId(answer);
  const expectedTargetId = answerTargetId(round.value.correctAnswer);
  if (answer === round.value.correctAnswer) {
    feedback.value = "";
    lastMistakeAnswer.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.correctAnswer, actual: answer, leftWeight: round.value.left.weight, rightWeight: round.value.right.weight, isCorrect: true });
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  feedback.value = buildHint();
  lastMistakeAnswer.value = answer;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.correctAnswer, actual: answer, leftWeight: round.value.left.weight, rightWeight: round.value.right.weight, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId, text: feedback.value });
}

function restartGame() {
  feedback.value = "";
  lastMistakeAnswer.value = undefined;
  restart();
}
</script>

<template>
  <div class="scales-shell">
    <GameHud title="Весы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сравни весы</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert v-if="feedback" class="mb-4 text-body-1 font-weight-bold" color="primary" icon="mdi-heart-outline" rounded="xl" variant="tonal">
              {{ feedback }}
            </v-alert>

            <v-sheet class="scale-stage pa-4 pa-md-6 mb-4" color="blue-lighten-5" rounded="xl">
              <div class="scale-frame" aria-hidden="true">
                <div class="scale-top">
                  <v-icon icon="mdi-scale-balance" size="46" color="primary" />
                </div>
                <div class="scale-beam" :style="beamStyle">
                  <div class="scale-pan scale-pan--left" :style="panOffsetStyle('left')">
                    <span v-for="(item, index) in round.left.items" :key="`left-${index}`" class="pan-item emoji-glyph">{{ item }}</span>
                  </div>
                  <div class="scale-pivot" />
                  <div class="scale-pan scale-pan--right" :style="panOffsetStyle('right')">
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
                <GameDwellButton :target-id="answerTargetId(answer)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="158" :color="lastMistakeAnswer === answer ? 'secondary' : 'surface'" @select="choose(answer)">
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
  padding-block-start: 9.75rem;
}

.scale-stage {
  overflow: hidden;
}

.scale-frame {
  block-size: clamp(17rem, 42vh, 25rem);
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
  align-items: flex-start;
  display: grid;
  gap: clamp(0.5rem, 2vw, 1.25rem);
  grid-template-columns: 1fr 2.8rem 1fr;
  inset-block-start: 3.75rem;
  inset-inline: 3%;
  position: absolute;
  transform-origin: 50% 50%;
  transition: transform 260ms ease;
}

.scale-beam::before {
  background: rgb(var(--v-theme-primary));
  block-size: 0.55rem;
  border-radius: 999px;
  content: "";
  inset-block-start: 2.25rem;
  inset-inline: 0;
  position: absolute;
}

.scale-pivot {
  background: rgb(var(--v-theme-primary));
  block-size: 5rem;
  border-radius: 999px 999px 0 0;
  inline-size: 2.8rem;
  justify-self: center;
  z-index: 1;
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
  min-block-size: clamp(8.5rem, 20vh, 12rem);
  padding: 0.75rem;
  transition: transform 260ms ease;
  z-index: 1;
}

.scale-pan--left {
  transform-origin: 90% 0;
}

.scale-pan--right {
  transform-origin: 10% 0;
}

.pan-item {
  font-size: clamp(2rem, min(5vw, 6vh), 3.6rem);
  line-height: 1;
}

.scale-stand {
  background: rgb(var(--v-theme-primary));
  block-size: 58%;
  border-radius: 999px;
  inline-size: 1.3rem;
  inset-block-end: 1.8rem;
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
  row-gap: 0.75rem;
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .game-container :deep(.v-card) {
    padding-block: 1rem !important;
  }

  .game-container .text-overline,
  .game-container h1,
  .game-container .v-alert {
    display: none;
  }

  .scale-stage {
    margin-block-end: 0.75rem !important;
    padding: 0.75rem !important;
  }

  .scale-frame {
    block-size: 13rem;
  }

  .scale-pan {
    min-block-size: 6.5rem;
  }

  .scales-answer-col {
    flex: 0 0 33.3333% !important;
    max-inline-size: 33.3333% !important;
  }

  .answer-row :deep(.dwell-button) {
    min-block-size: 6.25rem !important;
    padding: 0.5rem !important;
  }
}
</style>
