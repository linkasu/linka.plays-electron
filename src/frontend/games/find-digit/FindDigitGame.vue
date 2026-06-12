<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeFindDigitAudio, playFindDigitMistakeMelody, playFindDigitSuccessMelody, warmFindDigitAudio } from "./audio";
import { generateFindDigitRound, type FindDigitOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("find-digit", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindDigitRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();
const successChoiceId = ref<string>();
const pendingSelection = ref(false);
const findDigitTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "find-digit");
let feedbackTimer = 0;
let promptTimer = 0;
let responseTimer = 0;

const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Посмотри на карточки и выбери такую же цифру.";
  return `Ничего страшного. Цифра ${round.value.target.label} мягко подсвечена.`;
});

function choiceTargetId(choiceId: string) {
  return `find-digit:choice:${choiceId}`;
}

function digitTone(choice: FindDigitOption) {
  return `digit-scene--tone-${choice.digit % 6}`;
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTimer);
  feedbackTimer = 0;
  promptTimer = 0;
  responseTimer = 0;
}

function ttsAsset(id: string) {
  return findDigitTtsAssets.find((asset) => asset.id === id);
}

function playTargetPrompt(delayMs = 0) {
  window.clearTimeout(promptTimer);
  promptTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(`find-digit.prompt.${round.value.target.id}`), 0.36);
  }, delayMs);
}

function playResponse(id: string, delayMs = 0) {
  window.clearTimeout(responseTimer);
  responseTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(id), 0.36);
  }, delayMs);
}

function resetRoundFeedback() {
  clearTimers();
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  successChoiceId.value = undefined;
  pendingSelection.value = false;
}

function answer(choice: FindDigitOption) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  clearTimers();
  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    void playFindDigitSuccessMelody(session.settings.sound);
    playResponse("find-digit.correct", 980);
    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetRoundFeedback();
        playTargetPrompt(350);
      }, 2600);
    }
    return;
  }

  pendingSelection.value = true;
  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  void playFindDigitMistakeMelody(session.settings.sound);
  playResponse("find-digit.mistake", 940);
  playTargetPrompt(2700);
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    lastMistakeId.value = undefined;
  }, 2200);
}

function restart() {
  resetRoundFeedback();
  restartRoundGame();
  playTargetPrompt(450);
}

onMounted(() => {
  warmFindDigitAudio(session.settings.sound);
  warmTtsAssets(session.settings.sound, findDigitTtsAssets);
  playTargetPrompt(450);
});

onUnmounted(() => {
  clearTimers();
  disposeFindDigitAudio();
  disposeTtsAssets(findDigitTtsAssets);
});
</script>

<template>
  <div class="find-digit-shell">
    <GameHud title="Найди цифру" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-digit-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Цифровая полянка</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-1">{{ round.prompt }}</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" :cols="round.choices.length === 4 ? 3 : 4" :sm="round.choices.length === 4 ? 3 : 4" :md="round.choices.length > 4 ? 4 : round.choices.length === 4 ? 3 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" min-height="clamp(12rem, 30vh, 18rem)" @select="answer(choice)">
                  <template #default>
                    <div :class="['digit-scene', digitTone(choice), { 'digit-scene--hinted': mistakesInRound > 0 && choice.id === round.target.id, 'digit-scene--mistake': choice.id === lastMistakeId, 'digit-scene--success': choice.id === successChoiceId }]">
                      <span class="digit-scene__number">{{ choice.label }}</span>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди цифру" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-digit-shell {
  background: linear-gradient(135deg, #f5fbff 0%, #f7f1ff 48%, #fff7df 100%);
  min-block-size: 100vh;
}

.game-container {
  align-items: center;
  display: flex;
  min-block-size: 100vh;
  padding-block: 5rem 2rem;
}

.find-digit-card {
  inline-size: 100%;
}

.choice-grid {
  row-gap: 0.75rem;
}

.digit-scene {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 88%);
  border-radius: 1.75rem;
  color: #172d4f;
  display: flex;
  justify-content: center;
  min-block-size: 8.75rem;
  outline: 0 solid transparent;
  overflow: hidden;
  padding: 1.25rem;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.digit-scene__number {
  font-size: clamp(5.8rem, min(12vw, 18vh), 10.5rem);
  font-weight: 900;
  line-height: 0.9;
}

.digit-scene--tone-0 {
  background: linear-gradient(145deg, #e2f4ff, #addcf6);
  background-color: #c7e8f8;
}

.digit-scene--tone-1 {
  background: linear-gradient(145deg, #fff1c5, #ffd27f);
  background-color: #ffe3a2;
}

.digit-scene--tone-2 {
  background: linear-gradient(145deg, #e6f8dc, #b7e39d);
  background-color: #cbecb8;
}

.digit-scene--tone-3 {
  background: linear-gradient(145deg, #f4e8ff, #d8bdf0);
  background-color: #e3cff5;
}

.digit-scene--tone-4 {
  background: linear-gradient(145deg, #ffe7df, #ffbcae);
  background-color: #ffcbbf;
}

.digit-scene--tone-5 {
  background: linear-gradient(145deg, #defbf6, #9edfd6);
  background-color: #bfede6;
}

.digit-scene--hinted {
  outline: 0.45rem solid rgb(var(--v-theme-primary));
  transform: scale(1.03);
}

.digit-scene--success {
  outline: 0.35rem solid rgb(var(--v-theme-success));
}

.digit-scene--mistake {
  filter: saturate(0.72) brightness(0.96);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block: 4.5rem 1.25rem;
  }

  .digit-scene {
    min-block-size: 7.25rem;
  }

  .digit-scene__number {
    font-size: clamp(4.4rem, min(11vw, 14vh), 7rem);
  }
}
</style>
