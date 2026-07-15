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
import { shadowMatchFeedback } from "./audio";
import { generateShadowMatchRound, type ShadowMatchChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("shadow-match", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "shadow-match", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateShadowMatchRound(session.settings, roundIndex)
});

const hintedChoiceId = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return undefined;
  return round.value.choices[round.value.correctIndex].id;
});
const hintText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return `Почти получилось. Подсказка: ${round.value.target.hint}.`;
  return "Посмотри на предмет, затем выбери его тень.";
});

function choiceTargetId(choiceId: string) {
  return `shadow-match:choice:${choiceId}`;
}

function promptAssetId() {
  return "shadow-match.prompt";
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = 0;
}

async function playTargetPrompt(delayMs = 0) {
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

async function answer(choice: ShadowMatchChoice) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const correctChoice = round.value.choices[round.value.correctIndex];
  const expectedTargetId = choiceTargetId(correctChoice.id);
  clearTimers();
  if (choice.id === correctChoice.id) {
    pendingSelection.value = true;
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.id, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    void shadowMatchFeedback.playSuccess(session.settings.sound);
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["shadow-match.correct"], 80);
    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetRoundFeedback();
        void playTargetPrompt(180);
      }, 260);
    } else {
      pendingSelection.value = false;
      isSpeaking.value = false;
    }
    return;
  }

  pendingSelection.value = true;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.id, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "shadow-mismatch" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  void shadowMatchFeedback.playMistake(session.settings.sound);
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["shadow-match.mistake", promptAssetId()], 80, 170);
  pendingSelection.value = false;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
}

function restart() {
  resetRoundFeedback();
  restartRoundGame();
  void playTargetPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  shadowMatchFeedback.warm(session.settings.sound);
  void playTargetPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  shadowMatchFeedback.warm(enabled);
});

onUnmounted(() => {
  clearTimers();
  shadowMatchFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #eef6ff 0%, #f6f0ff 48%, #fff7ed 100%)" padding-top="5rem">
    <template #hud>
      <GameHud title="Найди тень" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="shadow-match-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Сравни предмет и силуэт</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-1">{{ round.prompt }}</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ hintText }}</p>

            <v-card class="object-sample mx-auto mb-3 mb-md-4" rounded="xl" variant="outlined" color="blue-grey-lighten-2">
              <img class="object-image" :src="round.target.imageSrc" :alt="round.target.label" draggable="false">
            </v-card>

            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="clamp(6rem, 18vh, 11rem)" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" :cols="round.choices.length === 4 ? 3 : 4" :sm="round.choices.length === 4 ? 3 : 4" :md="round.choices.length === 3 ? 4 : 3" @select="answer">
              <template #default="{ choice }">
                <div class="choice-card">
                  <img :class="['choice-image', { 'choice-image--mistake': choice.id === lastMistakeId }]" :src="choice.imageSrc" alt="Вариант тени" draggable="false">
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди тень" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.game-container {
  align-items: center;
  display: flex;
  padding-block-end: 2rem;
}

.shadow-match-card {
  inline-size: 100%;
  overflow: hidden;
}

.object-sample {
  align-items: center;
  display: flex;
  inline-size: min(11rem, 40vw);
  justify-content: center;
  overflow: hidden;
}

.object-image {
  aspect-ratio: 1;
  display: block;
  inline-size: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.choice-card {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.choice-image {
  aspect-ratio: 1;
  block-size: auto;
  inline-size: min(100%, clamp(7rem, 18vh, 11rem));
  object-fit: contain;
  pointer-events: none;
  transition: filter 160ms ease, transform 160ms ease;
  user-select: none;
}

.choice-image--mistake {
  filter: grayscale(0.35) opacity(0.7);
  transform: scale(0.96);
}

@media (max-height: 44rem) {
 .game-container {
    padding-block-end: 1.25rem;
  }

  .object-sample {
    inline-size: min(8rem, 32vw);
  }
}
</style>
