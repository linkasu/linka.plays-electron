<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateNumberLineRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("number-line", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "number-line", soundEnabled, warmAssetIds: ["number-line.prompt", "number-line.correct", "number-line.mistake", "number-line.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateNumberLineRound(session.settings, roundIndex)
});

const lastMistakeNumber = ref<number>();
const isSpeaking = ref(false);

const feedbackText = computed(() => {
  if (lastMistakeNumber.value === undefined) return round.value.helperText;
  return "Попробуй ещё раз и выбери другое число.";
});

function numberTargetId(number: number) {
  return `number-line:choice:${number}`;
}

async function choose(number: number) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = numberTargetId(number);
  const expectedTargetId = numberTargetId(round.value.targetNumber);
  if (number === round.value.targetNumber) {
    lastMistakeNumber.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.targetNumber, actual: number, isCorrect: true });
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["number-line.correct", "number-line.complete"] : ["number-line.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    promptAudio.play("number-line.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  lastMistakeNumber.value = number;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.targetNumber, actual: number, isCorrect: false });
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["number-line.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  lastMistakeNumber.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("number-line.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("number-line.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="number-line-shell">
    <GameHud title="Числовая дорожка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="11">
          <v-card class="number-line-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Считай слева направо</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-6">{{ feedbackText }}</p>

            <div class="number-road" aria-label="Числовая дорожка от 1 до 10">
              <div class="number-road__track" aria-hidden="true" />
              <GameDwellButton v-for="number in round.numbers" :key="number" :target-id="numberTargetId(number)" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="150" color="surface" @select="choose(number)">
                <template #default>
                  <div :class="['number-step', { 'number-step--current': number === round.currentNumber, 'number-step--mistake': number === lastMistakeNumber }]">
                    <span class="number-step__label">{{ number }}</span>
                  </div>
                </template>
              </GameDwellButton>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Числовая дорожка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.number-line-shell {
  background: linear-gradient(135deg, #f2fbff 0%, #fff2d8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 9.25rem;
}

.number-line-card {
  overflow: hidden;
}

.number-road {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(10, minmax(5.75rem, 1fr));
  position: relative;
}

.number-road__track {
  background: linear-gradient(90deg, rgb(var(--v-theme-primary) / 20%), rgb(var(--v-theme-secondary) / 26%));
  block-size: 1.1rem;
  border-radius: 999px;
  inset-block-start: 50%;
  inset-inline: 3.75rem;
  position: absolute;
  transform: translateY(-50%);
}

.number-step {
  align-items: center;
  background: linear-gradient(145deg, #fffdf7, #dff4ff);
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 90%);
  border-radius: 1.6rem;
  color: #17324d;
  display: flex;
  justify-content: center;
  min-block-size: 8.75rem;
  outline: 0 solid transparent;
  position: relative;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.number-step__label {
  font-size: clamp(3.6rem, min(7.4vw, 13vh), 6.6rem);
  font-weight: 900;
  line-height: 0.9;
}

.number-step__check {
  inset-block-start: 0.8rem;
  inset-inline-end: 0.8rem;
  position: absolute;
}

.number-step--current {
  background: linear-gradient(145deg, #fff0c2, #ffd789);
  box-shadow: inset 0 -0.45rem 0 rgb(173 113 15 / 14%);
}

.number-step--mistake {
  filter: saturate(0.68) brightness(0.96);
  outline: 0.35rem solid rgb(var(--v-theme-warning) / 48%);
}

@media (max-width: 75rem) {
  .number-road {
    grid-template-columns: repeat(5, minmax(6rem, 1fr));
  }

  .number-road__track {
    display: none;
  }
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 11rem;
  }

  .number-road {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 43rem) and (min-width: 75.0625rem) {
  .game-container {
    padding-block-start: 7.4rem;
  }

  .number-step {
    min-block-size: 6.8rem;
  }
}

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .number-line-card {
    padding: 1rem !important;
  }

  .number-line-card .text-overline {
    display: none;
  }

  .number-line-card h1 {
    font-size: 2.6rem !important;
    line-height: 1.05;
    margin-block-end: 0.35rem !important;
  }

  .number-line-card p {
    font-size: 1.1rem !important;
    margin-block-end: 0.75rem !important;
  }

  .number-road {
    gap: 0.5rem;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .number-road :deep(.dwell-button) {
    min-block-size: 6.6rem !important;
    padding: 0.4rem !important;
  }

  .number-step {
    border-radius: 1.2rem;
    min-block-size: 5.75rem;
  }

  .number-step__label {
    font-size: 3.2rem;
  }
}
</style>
