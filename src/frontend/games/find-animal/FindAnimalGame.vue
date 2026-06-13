<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { disposeTtsAssets, playTtsAsset, warmTtsAssets, type TtsAsset } from "../../core/ttsAudio";
import ttsAssets from "../../data/ttsAssets.json";
import { disposeFindAnimalAudio, playFindAnimalMistakeMelody, playFindAnimalSuccessMelody, warmFindAnimalAudio } from "./audio";
import { generateFindAnimalRound, type FindAnimalChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("find-animal", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();
const pendingSelection = ref(false);
const findAnimalTtsAssets = (ttsAssets as TtsAsset[]).filter((asset) => asset.game === "find-animal");
let feedbackTimer = 0;
let promptTimer = 0;
let responseTimer = 0;

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindAnimalRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на названного зверька и удержи взгляд.";
  return `Почти получилось. Верный зверёк подсвечен: ${round.value.target.word}.`;
});

function choiceTargetId(choiceId: string) {
  return `find-animal:choice:${choiceId}`;
}

function mdCols(choiceCount: number) {
  if (choiceCount <= 2) return 5;
  if (choiceCount === 3) return 4;
  return 3;
}

function lgCols(choiceCount: number) {
  return choiceCount === 5 ? 2 : mdCols(choiceCount);
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(promptTimer);
  window.clearTimeout(responseTimer);
  feedbackTimer = 0;
  promptTimer = 0;
  responseTimer = 0;
}

function ttsAsset(id: string) {
  return findAnimalTtsAssets.find((asset) => asset.id === id);
}

function playTargetPrompt(delayMs = 0) {
  window.clearTimeout(promptTimer);
  promptTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(`find-animal.prompt.${round.value.target.id}`), 0.36);
  }, delayMs);
}

function playResponse(id: string, delayMs = 0) {
  window.clearTimeout(responseTimer);
  responseTimer = window.setTimeout(() => {
    playTtsAsset(session.settings.sound, ttsAsset(id), 0.36);
  }, delayMs);
}

function answer(choice: FindAnimalChoice) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  clearFeedbackTimer();
  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    void playFindAnimalSuccessMelody(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    playResponse("find-animal.correct", 980);
    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        pendingSelection.value = false;
        playTargetPrompt(350);
      }, 2600);
    }
    return;
  }

  pendingSelection.value = true;
  void playFindAnimalMistakeMelody(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-animal-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  playResponse("find-animal.mistake", 940);
  playTargetPrompt(2700);
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    lastMistakeId.value = undefined;
  }, 2200);
}

function restart() {
  clearFeedbackTimer();
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  pendingSelection.value = false;
  restartRoundGame();
  playTargetPrompt(450);
}

onMounted(() => {
  warmFindAnimalAudio(session.settings.sound);
  warmTtsAssets(session.settings.sound, findAnimalTtsAssets);
  playTargetPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  warmFindAnimalAudio(enabled);
  warmTtsAssets(enabled, findAnimalTtsAssets);
});

onUnmounted(() => {
  clearFeedbackTimer();
  disposeFindAnimalAudio();
  disposeTtsAssets(findAnimalTtsAssets);
});
</script>

<template>
  <div class="find-animal-shell">
    <GameHud title="Найди животное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="find-animal-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1 mb-md-2">Лесная поляна</div>
            <h1 class="text-h4 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="hint-line text-body-1 text-md-h5 text-medium-emphasis text-center mb-3 mb-md-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="3" :md="mdCols(round.choices.length)" :lg="lgCols(round.choices.length)">
                <GameDwellButton :class="{ 'target-hint': hintedChoiceId === choice.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="156" :color="hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer(choice)">
                  <template #default="{ active, progress }">
                    <div :class="['animal-emoji', 'emoji-glyph', { 'animal-emoji--mistake': choice.id === lastMistakeId }]">{{ choice.emoji }}</div>
                    <div class="animal-label text-h6 text-md-h4 font-weight-bold mt-2">{{ hintedChoiceId === choice.id && active && progress > 0.78 ? `Вот ${choice.word}` : choice.word }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди животное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-animal-shell {
  background: linear-gradient(135deg, #fff8ed 0%, #edf7f0 54%, #eef4ff 100%);
  block-size: 100vh;
  overflow: hidden;
}

.game-container {
  block-size: 100vh;
  padding-block-start: 6rem;
}

.find-animal-card {
  max-block-size: calc(100vh - 6.75rem);
  overflow: hidden;
}

.choice-grid {
  margin: -6px;
}

.choice-grid :deep(.v-col) {
  padding: 6px;
}

.animal-emoji {
  font-size: clamp(3.1rem, min(8vw, 12vh), 7rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.animal-label {
  overflow-wrap: anywhere;
}

.hint-line {
  min-block-size: 1.5rem;
}

.animal-emoji--mistake {
  filter: saturate(0.75) opacity(0.72);
  transform: scale(0.96);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 5.25rem;
  }
}
</style>
