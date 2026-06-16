<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateMiniDialogRound, getMiniDialogChoice, type MiniDialogRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, finishSession, startSession } = useGameSessionFor("mini-dialog", {
  maxSteps: 7,
  overrides: { dwellMs: 1350, sessionSeconds: 135 },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<MiniDialogRound>({
  session,
  startSession,
  generateRound: generateMiniDialogRound
});

const feedback = ref("Выбери реплику взглядом. Любой ответ подходит.");
const isChangingRound = ref(false);

function choiceTargetId(choiceId: string) {
  return `mini-dialog:choice:${choiceId}`;
}

function choose(choiceId: string) {
  if (session.status !== "running" || isChangingRound.value) return;

  const choice = getMiniDialogChoice(round.value, choiceId);
  const targetId = choiceTargetId(choice.id);
  isChangingRound.value = true;
  feedback.value = choice.confirmation;

  recordSuccess({
    roundId: round.value.roundId,
    targetId,
    answerId: choice.id,
    scenario: round.value.scenario,
    expected: "any-soft-reply",
    actual: choice.text,
    isCorrect: true,
    noFail: true
  });

  window.setTimeout(() => {
    if (session.status !== "running") {
      feedback.value = "Спасибо за спокойный диалог.";
      isChangingRound.value = false;
      return;
    }

    if (session.step >= session.maxSteps) {
      finishSession("max-steps");
      feedback.value = "Спасибо за спокойный диалог.";
    } else {
      nextRound();
      feedback.value = "Теперь ответим на следующую реплику.";
    }
    isChangingRound.value = false;
  }, 950);
}

function restart() {
  feedback.value = "Выбери реплику взглядом. Любой ответ подходит.";
  isChangingRound.value = false;
  restartRoundGame();
}
</script>

<template>
  <div class="mini-dialog-shell">
    <GameHud title="Мини-диалог" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-3">Спокойный AAC-диалог</div>
            <v-card class="partner-card pa-5 pa-md-7 mb-5" color="surface-variant" rounded="xl" variant="tonal">
              <div class="text-body-1 text-medium-emphasis mb-2">Партнёр говорит:</div>
              <h1 class="text-h3 text-md-h2 font-weight-bold mb-3">{{ round.partnerLine }}</h1>
              <div class="text-h6 text-medium-emphasis">{{ round.prompt }}</div>
            </v-card>
            <div class="text-h6 text-center text-medium-emphasis mb-5">{{ feedback }}</div>
            <v-row justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" :sm="round.choices.length === 2 ? 6 : 4" :md="round.choices.length === 2 ? 6 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running' || isChangingRound" :dwell-ms="session.settings.dwellMs" :min-height="200" color="surface" @select="choose(choice.id)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph mb-3">{{ choice.emoji }}</div>
                    <div class="text-h4 text-md-h3 font-weight-bold">{{ choice.text }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Мини-диалог" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.mini-dialog-shell {
  background: linear-gradient(135deg, #eef8f4 0%, #f9f1ff 52%, #fff8e7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.partner-card {
  text-align: center;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 6.5rem);
  line-height: 1;
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 56px;
  }

  .partner-card {
    margin-block-end: 1rem !important;
    padding: 1rem !important;
  }

  .partner-card h1 {
    font-size: 2.5rem !important;
    line-height: 1.05;
  }

  .game-container :deep(.dwell-button) {
    min-block-size: 9rem !important;
  }
}
</style>
