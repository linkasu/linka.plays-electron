<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateOddOneOutRound, type OddOneOutItem, type OddOneOutRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("odd-one-out", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

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

function choose(index: number) {
  if (session.status !== "running" || pendingSelection.value) return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(round.value.oddItem);

  clearFeedbackTimer();

  if (index === round.value.correctIndex) {
    pendingSelection.value = true;
    successChoiceId.value = choice.id;
    feedbackMessage.value = `Верно. ${choice.label} из другой группы.`;
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

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="odd-shell">
    <GameHud title="Что лишнее?" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Сравни карточки</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <v-row justify="center">
              <v-col v-for="(choice, index) in round.choices" :key="choice.id" cols="6" :md="round.choices.length === 4 ? 3 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || pendingSelection" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(index)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h6 text-md-h5 font-weight-bold mt-2">{{ choice.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Что лишнее?" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.odd-shell {
  background: linear-gradient(135deg, #f0f7ff 0%, #fff6e7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.choice-emoji {
  font-size: clamp(4rem, min(9vw, 13vh), 7rem);
  line-height: 1;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }
}
</style>
