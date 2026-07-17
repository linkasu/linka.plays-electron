<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GazePointerOverlay from "../../components/game/GazePointerOverlay.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { createChooseEmotionRoundGenerator, type ChooseEmotionMode, type ChooseEmotionOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("choose-emotion", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
pauseSession();
const promptAudio = useGamePromptAudio({ gameId: "choose-emotion", soundEnabled: toRef(session.settings, "sound"), volume: 0.42 });
const mode = ref<ChooseEmotionMode>("face");
const selectingMode = ref(true);
let generateRound = createChooseEmotionRoundGenerator(mode.value);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateRound(session.settings, roundIndex)
});

const lastChoiceId = ref<string>();
const successChoiceId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
let feedbackTimer = 0;

const helperText = computed(() => {
  if (successChoiceId.value) return "Ответ принят.";
  if (lastChoiceId.value) return round.value.mode === "face"
    ? "Посмотри на лицо ещё раз и выбери другой ответ."
    : "Посмотри на ситуацию ещё раз и выбери другой ответ.";
  return round.value.mode === "face" ? "Выбери лицо с таким же выражением." : "Выбери подходящее лицо.";
});

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  lastChoiceId.value = undefined;
  successChoiceId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

function choiceTargetId(choiceId: string) {
  return `choose-emotion:choice:${choiceId}`;
}

async function choose(choice: ChooseEmotionOption, index: number) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  lastChoiceId.value = choice.id;
  clearFeedbackTimer();

  if (index === round.value.correctIndex) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    isSpeaking.value = true;
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? [`choose-emotion.emotion.${choice.id}`, "choose-emotion.complete"] : [`choose-emotion.emotion.${choice.id}`], 80, 170);
    isSpeaking.value = false;
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      return;
    }
    if (session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 920);
    }
    return;
  }

  pendingSelection.value = true;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["choose-emotion.mistake"], 80);
  isSpeaking.value = false;
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
  }, 1250);
}

function restart() {
  startGame(mode.value);
}

function startGame(nextMode: ChooseEmotionMode) {
  resetFeedback();
  promptAudio.cancelPending();
  mode.value = nextMode;
  selectingMode.value = false;
  generateRound = createChooseEmotionRoundGenerator(nextMode);
  restartRoundGame();
  promptAudio.play("choose-emotion.intro", 180);
}

onMounted(() => {
  promptAudio.warm();
});

onUnmounted(() => {
  resetFeedback();
  promptAudio.cancelPending();
});
</script>

<template>
  <div class="choose-emotion-shell">
    <GameHud v-if="!selectingMode" title="Выбери эмоцию" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <GazePointerOverlay v-else />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="emotion-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div v-if="selectingMode" class="text-center">
              <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Как будем выбирать эмоцию?</h1>
              <p class="text-body-1 text-md-h6 text-medium-emphasis mb-6">Выбери один режим. Правило не изменится до конца игры.</p>
              <v-row justify="center">
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="choose-emotion:mode:face" :dwell-ms="session.settings.dwellMs" min-height="12rem" color="pink-lighten-5" @select="startGame('face')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <div class="mode-emoji emoji-glyph" aria-hidden="true">😊</div>
                        <div class="text-h5 font-weight-bold">Что чувствует лицо?</div>
                        <div class="text-body-2 text-grey-darken-3">Посмотри на выражение лица и выбери ответ</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
                <v-col cols="12" sm="6">
                  <GameDwellButton target-id="choose-emotion:mode:situation" :dwell-ms="session.settings.dwellMs" min-height="12rem" color="blue-lighten-5" @select="startGame('situation')">
                    <template #default>
                      <div class="d-flex flex-column align-center justify-center ga-3 pa-4">
                        <div class="mode-emoji emoji-glyph" aria-hidden="true">🎁</div>
                        <div class="text-h5 font-weight-bold">Что чувствует герой?</div>
                        <div class="text-body-2 text-grey-darken-3">Посмотри на ситуацию и выбери лицо</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </div>

            <template v-else>
              <div class="text-overline text-secondary text-center mb-2">{{ round.mode === "face" ? "Смотри на лицо" : "Смотри на ситуацию" }}</div>
              <div class="cue-emoji emoji-glyph text-center mb-3" aria-hidden="true">{{ round.cueEmoji }}</div>
              <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
              <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-2">{{ round.detail }}</p>
              <p class="text-body-1 text-md-h6 text-primary text-center mb-5">{{ helperText }}</p>

              <v-row class="choice-grid" justify="center" dense>
                <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="12" :sm="round.choices.length === 3 ? 4 : 3" :md="round.choices.length === 3 ? 4 : 3">
                  <GameDwellButton :class="{ 'success-choice': successChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="12.5rem" :color="successChoiceId === choice.id ? 'green-lighten-4' : 'surface'" @select="choose(choice, index)">
                    <template #default>
                      <div :class="['emotion-choice', { 'emotion-choice--last': lastChoiceId === choice.id }]">
                        <div class="choice-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                        <div class="sr-only">{{ choice.label }}</div>
                      </div>
                    </template>
                  </GameDwellButton>
                </v-col>
              </v-row>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Выбери эмоцию" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.choose-emotion-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #edf7ff 52%, #f6efff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.emotion-card {
  overflow: hidden;
}

.cue-emoji {
  font-size: clamp(4rem, min(9vw, 13vh), 7rem);
  line-height: 1;
}

.choice-grid {
  row-gap: 0.75rem;
}

.mode-emoji {
  font-size: clamp(4rem, min(9vw, 13vh), 7rem);
  line-height: 1;
}

.emotion-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 10.75rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-emoji {
  font-size: clamp(4.5rem, min(11vw, 16vh), 8.25rem);
  line-height: 1;
}

.success-choice {
  filter: drop-shadow(0 0 1.1rem rgb(var(--v-theme-success) / 28%));
  transform: scale(1.03);
}

.emotion-choice--last {
  filter: saturate(0.8) opacity(0.78);
}

.sr-only {
  block-size: 0.0625rem;
  clip: rect(0, 0, 0, 0);
  inline-size: 0.0625rem;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-height: 42rem) {
 .game-container {
    padding-block-start: 4rem;
  }

 .emotion-choice {
    min-block-size: 8.5rem;
  }

 .choice-grid :deep(.dwell-button) {
    min-block-size: 8.5rem !important;
  }
}
</style>
