<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { disposePatternsAudio, playPatternsMistakeMelody, playPatternsSuccessMelody, warmPatternsAudio } from "./audio";
import { generatePatternRound, type PatternItem } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSessionFor("patterns", {
  maxSteps: 8,
  overrides: { dwellMs: 1200, sessionSeconds: 120, sound: true }
});

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generatePatternRound(session.settings, roundIndex)
});

const feedbackMessage = ref("Посмотри на ряд и выбери, что будет дальше.");
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const promptAudio = useGamePromptAudio({ gameId: "patterns", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;

function choiceTargetId(choice: PatternItem) {
  return `patterns:choice:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Посмотри на ряд и выбери, что будет дальше.";
  pendingSelection.value = false;
  isSpeaking.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["patterns.prompt"], delayMs);
  isSpeaking.value = false;
}

async function choose(index: number) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.answer);

  clearFeedbackTimer();

  if (index === round.value.correctIndex) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = "Верно. Ряд продолжается.";
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.answer.label, actual: choice.label, isCorrect: true });
    const finishedAfterSuccess = session.step >= session.maxSteps;
    void playPatternsSuccessMelody(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["patterns.correct", "patterns.complete"] : ["patterns.correct"], 80, 170);
    isSpeaking.value = false;

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 550);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = "Посмотри на повтор в ряду и попробуй ещё раз.";
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.answer.label, actual: choice.label, isCorrect: false });
  void playPatternsMistakeMelody(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["patterns.mistake"], 80);
  isSpeaking.value = false;
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 1000);
}

function choiceColor(choice: PatternItem) {
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  return "surface";
}

function restart() {
  resetFeedback();
  promptAudio.cancelPending();
  restartRounds();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  warmPatternsAudio(session.settings.sound);
  void playPrompt(450);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  disposePatternsAudio();
});
</script>

<template>
  <div class="patterns-shell">
    <GameHud title="Паттерны" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Продолжи последовательность</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Что будет дальше?</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <div class="pattern-row mb-6" aria-label="Ряд с пустой последней позицией">
              <v-card v-for="(item, index) in round.sequence" :key="`${round.roundId}:${index}`" class="pattern-slot" color="surface" rounded="xl" variant="flat">
                <v-icon class="pattern-icon" :color="item.color" :icon="item.icon" />
              </v-card>
              <v-card class="pattern-slot pattern-slot--blank" color="blue-grey-lighten-5" rounded="xl" variant="flat">
                <v-icon class="blank-icon" color="blue-grey-darken-1" icon="mdi-help" />
              </v-card>
            </div>

            <v-row justify="center">
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" :sm="round.choices.length === 3 ? 4 : 3" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="10rem" :color="choiceColor(choice)" @select="choose(index)">
                  <template #default>
                    <div class="choice-content">
                      <v-icon class="choice-icon" :color="choice.color" :icon="choice.icon" />
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Паттерны" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.patterns-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #fff4df 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.pattern-row {
  display: grid;
  gap: 0.875rem;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
}

.pattern-slot {
  align-items: center;
  display: flex;
  justify-content: center;
  min-block-size: clamp(7.25rem, 16vw, 11.125rem);
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.pattern-slot--blank {
  border: 0.25rem dashed rgb(var(--v-theme-primary) / 46%);
}

.pattern-icon,
.choice-icon {
  filter: drop-shadow(0 0.5rem 0.625rem rgb(0 0 0 / 16%));
  font-size: clamp(4.5rem, 9vw, 7.5rem);
}

.choice-content {
  align-items: center;
  block-size: 100%;
  display: flex;
  inline-size: 100%;
  justify-content: center;
}

.blank-icon {
  font-size: clamp(3.4rem, 7vw, 5.5rem);
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.75rem;
  }

  .pattern-row {
    gap: 0.625rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .pattern-row {
    margin-block-end: 1rem !important;
  }

  .pattern-slot,
  .game-container :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }
}
</style>
