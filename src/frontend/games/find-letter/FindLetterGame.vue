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
import { findLetterFeedback } from "./audio";
import { generateFindLetterRound, type FindLetterOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("find-letter", {
  maxSteps: 8,
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindLetterRound(session.settings, roundIndex)
});

const feedbackMessage = ref("Посмотри на образец и найди такую же букву.");
const hintedRoundId = ref<string>();
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
const pendingSelection = ref(false);
const isSpeaking = ref(false);
const promptAudio = useGamePromptAudio({ gameId: "find-letter", soundEnabled: toRef(session.settings, "sound") });
let feedbackTimer = 0;

const hintedChoiceId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.target.id : undefined);

function choiceTargetId(choice: FindLetterOption) {
  return `find-letter:choice:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  promptAudio.cancelPending();
  feedbackTimer = 0;
}

async function playTargetPrompt(delayMs = 0) {
  isSpeaking.value = true;
  await promptAudio.playSequenceAndWait([`find-letter.prompt.${round.value.target.id}`], delayMs);
  isSpeaking.value = false;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Посмотри на образец и найди такую же букву.";
  hintedRoundId.value = undefined;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
  pendingSelection.value = false;
  isSpeaking.value = false;
}

async function answer(choice: FindLetterOption) {
  if (session.status !== "running" || pendingSelection.value || isSpeaking.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.target);
  clearFeedbackTimer();

  if (choice.id === round.value.target.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = "Верно. Это нужная буква.";
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.letter, actual: choice.letter, isCorrect: true });
    void findLetterFeedback.playSuccess(session.settings.sound);
    await promptAudio.playSequenceAndWait(["find-letter.correct"], 80);

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
        void playTargetPrompt(180);
      }, 260);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  hintedRoundId.value = round.value.roundId;
  feedbackMessage.value = `Почти. Ищи букву ${round.value.target.letter}; она подсвечена рамкой.`;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.letter, actual: choice.letter, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake" });
  void findLetterFeedback.playMistake(session.settings.sound);
  await promptAudio.playSequenceAndWait(["find-letter.mistake", `find-letter.prompt.${round.value.target.id}`], 80, 170);
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
}

function choiceColor(choice: FindLetterOption) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  if (hintedChoiceId.value === choice.id) return "primary";
  return "surface";
}

function restart() {
  resetFeedback();
  restartRoundGame();
  playTargetPrompt(450);
}

onMounted(() => {
  findLetterFeedback.warm(session.settings.sound);
  promptAudio.warm();
  void playTargetPrompt(450);
});

watch(() => session.settings.sound, (enabled) => {
  findLetterFeedback.warm(enabled);
});

onUnmounted(() => {
  clearFeedbackTimer();
  findLetterFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #f5f7ff 0%, #fff3e8 100%)" padding-top="6.25rem">
    <template #hud>
      <GameHud title="Найди букву" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-letter-card pa-3 pa-md-5" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1">Зрительный поиск</div>
            <div class="target-letter-card mx-auto mb-2" aria-label="Буква для поиска">
              <div class="target-letter">{{ round.target.letter }}</div>
            </div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-1">{{ round.prompt }}</h1>
            <p class="text-body-1 text-md-h6 text-medium-emphasis text-center mb-3">{{ feedbackMessage }}</p>

            <GameChoiceCardGrid :choices="round.choices" :target-id="choiceTargetId" :disabled="session.status !== 'running' || pendingSelection || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="9.375rem" :color="choiceColor" :cols="round.choices.length === 4 ? 3 : 4" :sm="round.choices.length === 4 ? 3 : 4" :md="round.choices.length > 4 ? 4 : round.choices.length === 4 ? 3 : 4" @select="answer">
              <template #default="{ choice }">
                <div :class="['letter-choice', { 'letter-choice--hinted': hintedChoiceId === choice.id, 'letter-choice--mistake': wrongChoiceId === choice.id }]">
                  {{ choice.letter }}
                </div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди букву" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.find-letter-card {
  overflow: hidden;
}

.target-letter-card {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 10%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 2rem;
  display: flex;
  inline-size: min(10rem, 34vw);
  justify-content: center;
  min-block-size: min(7.5rem, 18vh);
}

.target-letter,
.letter-choice {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 700;
  line-height: 1;
}

.target-letter {
  color: rgb(var(--v-theme-primary));
  font-size: clamp(4.25rem, min(11vw, 14vh), 7rem);
}

.letter-choice {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(4rem, min(9vw, 12vh), 6.5rem);
  transition: transform 160ms ease, text-shadow 160ms ease;
}

.letter-choice--hinted {
  color: rgb(var(--v-theme-on-primary));
  text-shadow: 0 0 1rem rgb(255 255 255 / 42%);
  transform: scale(1.08);
}

.letter-choice--mistake {
  transform: scale(0.96);
}

@media (max-height: 43rem) {
 .target-letter-card {
    min-block-size: 6.25rem;
  }
}
</style>
