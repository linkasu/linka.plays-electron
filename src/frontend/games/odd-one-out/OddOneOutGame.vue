<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameChoiceCardGrid from "../../components/game/GameChoiceCardGrid.vue";
import GameHud from "../../components/game/GameHud.vue";
import GamePageShell from "../../components/game/GamePageShell.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { oddOneOutFeedback } from "./audio";
import { generateOddOneOutRound, type OddOneOutItem, type OddOneOutRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("odd-one-out", { maxSteps: 8, finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRounds } = useRoundGame<OddOneOutRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateOddOneOutRound(session.settings, roundIndex)
});

const feedbackMessage = ref("Найди карточку, которая не подходит к остальным.");
const pendingSelection = ref(false);
const wrongChoiceId = ref<string>();
const successChoiceId = ref<string>();
let feedbackTimer = 0;

function choiceTargetId(choice: OddOneOutItem) {
  return `odd-one-out:choice:${choice.id}`;
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  feedbackMessage.value = "Найди карточку, которая не подходит к остальным.";
  pendingSelection.value = false;
  wrongChoiceId.value = undefined;
  successChoiceId.value = undefined;
}

function choose(choice: OddOneOutItem) {
  if (session.status !== "running" || pendingSelection.value) return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.oddItem);

  clearFeedbackTimer();

  if (choice.id === round.value.oddItem.id) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = `Верно. ${choice.label} из другой группы.`;
    void oddOneOutFeedback.playSuccess(session.settings.sound);
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.oddItem.label, actual: choice.label, isCorrect: true });

    if (session.status === "running" && session.step < session.maxSteps) {
      feedbackTimer = window.setTimeout(() => {
        nextRound();
        resetFeedback();
      }, 650);
    }
    return;
  }

  pendingSelection.value = true;
  wrongChoiceId.value = choice.id;
  feedbackMessage.value = round.value.mistakeHint;
  void oddOneOutFeedback.playMistake(session.settings.sound);
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.oddItem.label, actual: choice.label, isCorrect: false, commonCategory: round.value.commonCategory.id });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "mistake", category: round.value.commonCategory.id });
  feedbackTimer = window.setTimeout(() => {
    pendingSelection.value = false;
    wrongChoiceId.value = undefined;
  }, 1200);
}

function choiceColor(choice: OddOneOutItem) {
  if (successChoiceId.value === choice.id) return "green-lighten-4";
  if (wrongChoiceId.value === choice.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  resetFeedback();
  restartRounds();
}

onMounted(() => {
  oddOneOutFeedback.warm(session.settings.sound);
});

watch(() => session.settings.sound, (enabled) => {
  oddOneOutFeedback.warm(enabled);
});

onUnmounted(() => {
  clearFeedbackTimer();
  oddOneOutFeedback.dispose();
});
</script>

<template>
  <GamePageShell gradient="linear-gradient(135deg, #f0f7ff 0%, #fff6e7 100%)" padding-top="5.125rem">
    <template #hud>
      <GameHud title="Что лишнее?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    </template>
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="odd-card pa-4 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-1 mb-md-2">Сравни карточки</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2 mb-md-3">{{ round.prompt }}</h1>
            <p class="odd-feedback text-body-1 text-medium-emphasis text-center mb-3 mb-md-6">{{ feedbackMessage }}</p>

            <GameChoiceCardGrid :choices="round.choices" :target-id="choiceTargetId" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="156" :color="choiceColor" :cols="6" :md="round.choices.length === 4 ? 3 : 4" @select="choose">
              <template #default="{ choice }">
                <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.label }}</div>
              </template>
            </GameChoiceCardGrid>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Что лишнее?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </GamePageShell>
</template>

<style scoped>
.odd-card {
  max-block-size: calc(100vh - 98px);
}

.odd-feedback {
  min-block-size: 1.5rem;
}

.choice-emoji {
  font-size: clamp(3.2rem, min(8vw, 11vh), 6.5rem);
  line-height: 1;
}

</style>
