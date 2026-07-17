<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { wordImageSrc } from "../../core/wordImage";
import { findAnimalFeedback } from "./audio";
import { createFindAnimalRoundGenerator, type FindAnimalChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-animal", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});

const promptAudio = useGamePromptAudio({ gameId: "find-animal", soundEnabled: toRef(session.settings, "sound") });
let generateRound = createFindAnimalRoundGenerator();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const failedImageRoundId = ref<string>();
let feedbackTimer = 0;

function choiceTargetId(choiceId: string) {
  return `find-animal:choice:${choiceId}`;
}

function choiceMinHeight(choiceCount: number) {
  if (choiceCount <= 3) return "clamp(11.25rem, 28vh, 18.75rem)";
  return "clamp(10.5rem, 25vh, 16.25rem)";
}

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);
const showRoundImages = computed(() => round.value.assetMode === "image" && failedImageRoundId.value !== round.value.roundId);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на названного зверька и удержи взгляд.";
  return "Почти получилось. Верный зверёк подсвечен.";
});

function disableRoundImages() {
  failedImageRoundId.value = round.value.roundId;
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = 0;
}

function promptAssetId() {
  return `find-animal.prompt.${round.value.target.id}`;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function resetRoundFeedback() {
  clearTimers();
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function answer(choice: FindAnimalChoice) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  clearTimers();
  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    void findAnimalFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["find-animal.correct"], 80);

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetRoundFeedback();
        void playPrompt(180);
      }, 260);
    } else {
      pendingSelection.value = false;
      isSpeaking.value = false;
    }
    return;
  }

  pendingSelection.value = true;
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  void findAnimalFeedback.playMistake(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.word, actual: choice.word, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-animal-selected" });
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["find-animal.mistake", promptAssetId()], 80, 170);
  pendingSelection.value = false;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
}

function restart() {
  resetRoundFeedback();
  generateRound = createFindAnimalRoundGenerator();
  restartRoundGame();
  void playPrompt(450);
}

onMounted(() => {
  findAnimalFeedback.warm(session.settings.sound);
  promptAudio.warm();
  void playPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  findAnimalFeedback.warm(enabled);
});

onUnmounted(() => {
  clearTimers();
  findAnimalFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="forest" padding-top="0" full-height>
    <template #hud>
      <GameHud title="Найди животное" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row class="game-row" justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="find-animal-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1 mb-md-2">Лесная поляна</div>
            <h1 class="text-h4 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="hint-line text-body-1 text-md-h5 text-medium-emphasis text-center mb-3 mb-md-5">{{ hintText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight(round.choices.length)" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" @select="answer">
              <template #default="{ choice, active, progress }">
                <img v-if="showRoundImages" :class="['animal-emoji', 'animal-image', { 'animal-emoji--mistake': choice.id === lastMistakeId }]" :src="wordImageSrc(choice.id)" :alt="choice.word" draggable="false" @error="disableRoundImages">
                <span v-else :class="['animal-emoji', 'emoji-glyph', { 'animal-emoji--mistake': choice.id === lastMistakeId }]" :aria-label="choice.word">{{ choice.emoji }}</span>
                <div class="animal-label text-h6 text-md-h4 font-weight-bold mt-2">{{ hintedChoiceId === choice.id && active && progress > 0.78 ? `Вот ${choice.word}` : choice.word }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди животное" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.game-container {
  block-size: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-block: clamp(5.5rem, 11vh, 8rem) clamp(1rem, 4vh, 3rem);
}

.find-animal-card {
  max-block-size: calc(100vh - 6.75rem);
  overflow: hidden;
}

.game-row {
  align-items: center;
  flex: 1 1 auto;
}

.animal-emoji {
  font-size: clamp(3.1rem, min(8vw, 12vh), 7rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.animal-image {
  block-size: 1em;
  inline-size: 1em;
  object-fit: contain;
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

@media (max-height: 44rem) {
 .game-container {
    justify-content: flex-start;
    padding-block-start: 5.25rem;
  }

 .game-row {
    align-items: flex-start;
  }
}
</style>
