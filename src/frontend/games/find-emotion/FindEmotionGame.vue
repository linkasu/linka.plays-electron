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
import { findEmotionFeedback } from "./audio";
import { generateFindEmotionRound, type FindEmotionOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-emotion", {
  maxSteps: 8,
  overrides: { sound: true },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindEmotionRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "find-emotion", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;

const hintedChoiceId = computed(() => mistakesInRound.value > 0 ? round.value.target.id : undefined);
const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Выбери лицо с нужной эмоцией.";
  return `Посмотри на подсказку: ${round.value.target.label} подсвечена рамкой.`;
});

function choiceTargetId(choiceId: string) {
  return `find-emotion:choice:${choiceId}`;
}

function clearTimers() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = 0;
}

function promptAssetId() {
  return `find-emotion.prompt.${round.value.target.id}`;
}

async function playPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([promptAssetId()], delayMs);
  isSpeaking.value = false;
}

function resetRoundFeedback() {
  clearTimers();
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function answer(choice: FindEmotionOption) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  clearTimers();
  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    void findEmotionFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    isSpeaking.value = true;
    await promptAudio.playSequenceAndWait(["find-emotion.correct"], 80);
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
  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  void findEmotionFeedback.playMistake(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait(["find-emotion.mistake", promptAssetId()], 80, 170);
  pendingSelection.value = false;
  lastMistakeId.value = undefined;
  isSpeaking.value = false;
}

function restart() {
  resetRoundFeedback();
  restartRoundGame();
  void playPrompt(450);
}

onMounted(() => {
  promptAudio.warm();
  findEmotionFeedback.warm(session.settings.sound);
  void playPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  findEmotionFeedback.warm(enabled);
});

onUnmounted(() => {
  clearTimers();
  findEmotionFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #fff5f8 0%, #eef8ff 100%)" padding-top="6rem">
    <template #hud>
      <GameHud title="Найди эмоцию" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-emotion-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Смотри на лицо</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <GameChoiceCardGrid :choices="round.choices" :target-id="(choice) => choiceTargetId(choice.id)" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="11rem" :highlight-choice="(choice) => hintedChoiceId === choice.id" :color="(choice) => hintedChoiceId === choice.id ? 'primary' : 'surface'" :cols="4" :md="round.choices.length === 3 ? 4 : 3" @select="answer">
              <template #default="{ choice }">
                <div :class="['emotion-choice', { 'emotion-choice--mistake': choice.id === lastMistakeId }]">
                  <div class="emotion-emoji emoji-glyph" aria-hidden="true">{{ choice.emoji }}</div>
                  <div class="sr-only">{{ choice.label }}</div>
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди эмоцию" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.find-emotion-card {
  overflow: hidden;
}

.emotion-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 7.5rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.emotion-emoji {
  font-size: clamp(4.25rem, min(10vw, 15vh), 8rem);
  line-height: 1;
}

.sr-only {
  block-size: 1px;
  clip: rect(0, 0, 0, 0);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

.emotion-choice--mistake {
  filter: grayscale(0.25) opacity(0.74);
}

@media (max-height: 42rem) {
 .emotion-choice {
    min-block-size: 6.75rem;
  }
}
</style>
