<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateObjectActionRound, type ObjectActionChoice, type ObjectActionRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, finishSession, startSession } = useGameSession("object-action", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 125
}, { finishOnMistakes: false, finishOnMaxSteps: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<ObjectActionRound>({
  session,
  startSession,
  generateRound: generateObjectActionRound
});

const feedback = ref("Выбери действие, которое подходит к предмету.");
const isChangingRound = ref(false);
const choiceMinHeight = computed(() => Math.round(210 * session.settings.targetScale));
let transitionTimer = 0;

function choiceTargetId(choice: ObjectActionChoice) {
  return `object-action:choice:${round.value.pair.id}:${choice.id}`;
}

function clearTransitionTimer() {
  window.clearTimeout(transitionTimer);
  transitionTimer = 0;
}

function advanceRound() {
  if (session.status !== "running") return;
  if (session.step >= session.maxSteps) {
    finishSession("max-steps");
    return;
  }

  nextRound();
  feedback.value = "Новая пара. Выбери подходящее действие.";
}

function chooseAction(choice: ObjectActionChoice) {
  if (session.status !== "running" || isChangingRound.value) return;

  const expectedChoice = round.value.correctChoice;
  const targetId = choiceTargetId(choice);
  const expectedTargetId = choiceTargetId(expectedChoice);
  const wasCorrect = choice.id === expectedChoice.id;
  isChangingRound.value = true;

  if (wasCorrect) {
    recordSuccess({
      roundId: round.value.roundId,
      targetId,
      answerId: choice.id,
      objectId: round.value.pair.id,
      expected: expectedChoice.title,
      actual: choice.title,
      isCorrect: true
    });
    feedback.value = `Верно: ${round.value.pair.phrase}.`;
  } else {
    recordMistake({
      roundId: round.value.roundId,
      targetId,
      expectedTargetId,
      answerId: choice.id,
      objectId: round.value.pair.id,
      expected: expectedChoice.title,
      actual: choice.title,
      isCorrect: false
    });
    recordHint({ roundId: round.value.roundId, text: round.value.explanation });
    session.step += 1;
    feedback.value = `Ничего страшного. ${round.value.explanation}`;
  }

  clearTransitionTimer();
  transitionTimer = window.setTimeout(() => {
    transitionTimer = 0;
    advanceRound();
    isChangingRound.value = false;
  }, wasCorrect ? 900 : 1500);
}

function restart() {
  clearTransitionTimer();
  feedback.value = "Выбери действие, которое подходит к предмету.";
  isChangingRound.value = false;
  restartRoundGame();
}

onUnmounted(() => {
  clearTransitionTimer();
});
</script>

<template>
  <div class="object-action-shell">
    <GameHud title="Предмет + действие" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">AAC: предмет и действие</div>
            <div class="text-center mb-6">
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-2">{{ round.prompt }}</h1>
              <div class="text-h6 text-md-h5 text-medium-emphasis">{{ feedback }}</div>
            </div>

            <v-card class="object-card pa-5 mb-6" color="primary" rounded="xl" variant="tonal">
              <div class="d-flex flex-column flex-md-row align-center justify-center ga-4 text-center">
                <div class="object-emoji emoji-glyph">{{ round.pair.objectEmoji }}</div>
                <div>
                  <div class="text-overline text-primary">предмет</div>
                  <div class="text-h3 text-md-h2 font-weight-bold">{{ round.pair.objectTitle }}</div>
                </div>
              </div>
            </v-card>

            <v-row>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="choiceMinHeight" color="surface" @select="chooseAction(choice)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ choice.emoji }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ choice.title }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Предмет + действие" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.object-action-shell {
  background: linear-gradient(135deg, #eef8ff 0%, #fff7e8 50%, #f1ecff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.object-emoji {
  font-size: clamp(5rem, 12vw, 8.5rem);
  line-height: 1;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 6rem);
  line-height: 1;
}

@media (max-height: 820px) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .object-card {
    display: none;
  }
}
</style>
