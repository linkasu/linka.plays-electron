<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateWhatFirstRound, type WhatFirstAction, type WhatFirstRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("what-first", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 125, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({
  gameId: "what-first",
  soundEnabled,
  volume: 0.34,
  warmAssetIds: ["what-first.prompt.wash-eat", "what-first.prompt.shoes-walk", "what-first.prompt.brush-sleep", "what-first.mistake", "what-first.complete"]
});
const pianoFeedback = useStandardGameFeedback(soundEnabled);

const roundIndex = ref(1);
const round = ref<WhatFirstRound>(generateWhatFirstRound(roundIndex.value));
const feedback = ref("Выбери первое действие в сцене.");
const isChangingRound = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
let feedbackTimer = 0;

const resultVisible = computed(() => session.status === "finished");
const sceneEmojis = computed(() => round.value.choices.map((choice) => choice.emoji).join("  "));

function choiceTargetId(action: WhatFirstAction) {
  return `what-first:choice:${round.value.scene.id}:${action.id}`;
}

function promptAssetId() {
  return `what-first.prompt.${round.value.scene.id}`;
}

function correctAssetId() {
  return `what-first.correct.${round.value.scene.id}`;
}

function mistakeAssetId() {
  return "what-first.mistake";
}

async function playRoundPrompt(delayMs = 0) {
  isChangingRound.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isChangingRound.value = false;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetHighlights() {
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function setNextRound() {
  roundIndex.value += 1;
  round.value = generateWhatFirstRound(roundIndex.value);
  feedback.value = "Новая сцена. Что сначала?";
}

async function choose(action: WhatFirstAction) {
  if (session.status !== "running" || isChangingRound.value) return;

  clearFeedbackTimer();
  resetHighlights();

  const expectedAction = round.value.expectedAction;
  const targetId = choiceTargetId(action);
  const expectedTargetId = choiceTargetId(expectedAction);
  const wasCorrect = action.id === expectedAction.id;
  isChangingRound.value = true;

  if (wasCorrect) {
    successChoiceId.value = action.id;
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: action.id,
      expected: expectedAction.id,
      actual: action.id,
      sceneId: round.value.scene.id,
      isCorrect: true
    });
    feedback.value = `Верно: сначала ${action.phrase}.`;
    void pianoFeedback.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [correctAssetId(), "what-first.complete"] : [correctAssetId()], 80, 170);

    if (finishedAfterSuccess) {
      feedback.value = "Готово. Порядок действий стал понятнее.";
      finishSession("game-complete");
      resetHighlights();
      isChangingRound.value = false;
      return;
    }

    if (session.status === "running") {
      setNextRound();
      resetHighlights();
      await playRoundPrompt(180);
      return;
    }

    feedback.value = "Готово. Порядок действий стал понятнее.";
    resetHighlights();
    isChangingRound.value = false;
    return;
  }

  wrongChoiceId.value = action.id;
  recordMistake({
    roundId: round.value.roundId,
    targetId,
    expectedTargetId,
    answerId: action.id,
    expected: expectedAction.id,
    actual: action.id,
    sceneId: round.value.scene.id,
    isCorrect: false
  });
  feedback.value = "Посмотри на сцену ещё раз и выбери другое действие.";
  void pianoFeedback.playMistake();
  await promptAudio.playSequenceAndWait([mistakeAssetId()], 80);
  wrongChoiceId.value = undefined;
  feedback.value = "Попробуй ещё раз: что сначала?";
  isChangingRound.value = false;
}

function choiceColor(action: WhatFirstAction) {
  if (wrongChoiceId.value === action.id) return "orange-lighten-4";
  if (successChoiceId.value === action.id) return "green-lighten-4";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  promptAudio.cancelPending();
  roundIndex.value = 1;
  round.value = generateWhatFirstRound(roundIndex.value);
  feedback.value = "Выбери первое действие в сцене.";
  resetHighlights();
  isChangingRound.value = false;
  startSession();
  void playRoundPrompt(220);
}

onMounted(() => {
  promptAudio.warm();
  void playRoundPrompt(420);
});

onUnmounted(() => {
  clearFeedbackTimer();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="what-first-shell">
    <GameHud title="Что сначала?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="what-first-card pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC и порядок действий</div>
            <div class="text-center mb-6">
              <v-chip class="mb-4 text-white" color="deep-purple-darken-3" size="large" variant="flat">{{ round.scene.title }}</v-chip>
              <div class="scene-emojis emoji-glyph mb-3" aria-hidden="true">{{ sceneEmojis }}</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="scene-context text-h6 text-md-h5">{{ round.scene.context }}</div>
            </div>

            <v-alert class="mb-6" color="blue-lighten-5" rounded="xl" variant="flat">
              <div class="text-h6 text-md-h5 font-weight-bold text-center">{{ feedback }}</div>
            </v-alert>

            <v-row>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" md="6">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h3 text-md-h2 font-weight-bold mb-2">{{ choice.title }}</div>
                    <v-chip class="mb-3 text-white" color="deep-purple-darken-3" size="large" variant="flat">{{ choice.aacLabel }}</v-chip>
                    <div class="choice-phrase text-h6">{{ choice.phrase }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Что сначала?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.what-first-shell {
  background: linear-gradient(135deg, #eef7ff 0%, #fff7e8 52%, #f3ecff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.scene-emojis {
  font-size: clamp(4rem, 10vw, 7rem);
  line-height: 1;
}

.scene-context,
.choice-phrase {
  color: #263238;
}

.choice-emoji {
  font-size: clamp(4.5rem, 10vw, 7rem);
  line-height: 1;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.75rem;
  }
}

@media (max-height: 58rem) {
  .what-first-card .text-center,
  .what-first-card .v-alert {
    margin-block-end: 1rem !important;
  }

  .scene-emojis,
  .choice-emoji {
    font-size: clamp(3.5rem, 8vw, 5.5rem);
  }

  .choice-phrase {
    display: none;
  }
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 3.5rem;
  }

  .what-first-card {
    padding: 0.75rem !important;
  }

  .what-first-card > .text-overline {
    display: none;
  }

  .what-first-card h1 {
    font-size: clamp(1.8rem, 5.4vh, 2.25rem) !important;
    line-height: 1.05;
    margin-block-end: 0.25rem !important;
  }

  .what-first-card .text-center {
    margin-block-end: 0.45rem !important;
  }

  .what-first-card .v-alert {
    margin-block-end: 0.45rem !important;
    padding: 0.55rem !important;
  }

  .scene-emojis {
    display: none;
  }

  .scene-context,
  .what-first-card .v-alert .text-h6 {
    font-size: 1rem !important;
    line-height: 1.15;
  }

  .choice-emoji {
    font-size: clamp(2.5rem, 7vh, 3.75rem);
  }

  .what-first-card :deep(.dwell-button .text-h3) {
    font-size: clamp(1.55rem, 5vh, 2rem) !important;
    line-height: 1.05;
  }

  .what-first-card :deep(.dwell-button .v-chip),
  .choice-phrase {
    display: none;
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 8rem !important;
  }
}
</style>
