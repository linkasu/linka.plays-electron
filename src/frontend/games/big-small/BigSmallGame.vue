<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateBigSmallRound, type BigSmallChoice, type BigSmallRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("big-small", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120,
  sound: false
}, { finishOnMistakes: false });

const hint = ref("");
const mistakenChoiceId = ref<string>();
const { round, resultVisible, nextRound, restart } = useRoundGame<BigSmallRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateBigSmallRound(session.settings, roundIndex)
});

function choiceTargetId(choice: BigSmallChoice) {
  return `big-small:choice:${choice.choiceId}`;
}

function choose(index: number) {
  if (session.status !== "running") return;

  const choice = round.value.choices[index];
  const targetId = choiceTargetId(choice);
  const expectedChoice = round.value.choices[round.value.correctIndex];
  const expectedTargetId = choiceTargetId(expectedChoice);

  if (index === round.value.correctIndex) {
    hint.value = "";
    mistakenChoiceId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, objectId: choice.id, expected: round.value.targetSize, actual: choice.size, isCorrect: true });
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  mistakenChoiceId.value = choice.choiceId;
  hint.value = round.value.mistakeHint;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, objectId: choice.id, expected: round.value.targetSize, actual: choice.size, isCorrect: false });
  recordHint({ roundId: round.value.roundId, text: hint.value });
}

function restartGame() {
  hint.value = "";
  mistakenChoiceId.value = undefined;
  restart();
}
</script>

<template>
  <div class="big-small-shell">
    <GameHud title="Большой / маленький" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Размер и слово</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert v-if="hint" class="mb-5 text-body-1 font-weight-bold" color="warning" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ hint }} Посмотри ещё раз спокойно.
            </v-alert>
            <v-row class="choice-row" dense>
              <v-col v-for="(choice, index) in round.choices" :key="choice.choiceId" cols="12" md="6">
                <GameDwellButton :class="{ 'choice--mistake': mistakenChoiceId === choice.choiceId }" :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="260" color="surface" @select="choose(index)">
                  <template #default>
                    <div class="text-overline text-medium-emphasis mb-3">{{ choice.sizeLabel }}</div>
                    <div :class="['choice-emoji', 'emoji-glyph', `choice-emoji--${choice.size}`]" aria-hidden="true">{{ choice.emoji }}</div>
                    <div class="text-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                    <div class="sr-only">Размер: {{ choice.sizeLabel }}. Объект: {{ choice.label }}.</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Большой / маленький" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.big-small-shell {
  background: linear-gradient(135deg, #fff5e6 0%, #e9f7ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.25rem;
}

.choice-row {
  row-gap: 1rem;
}

.choice-emoji {
  line-height: 1;
}

.choice-emoji--big {
  font-size: clamp(6.5rem, min(16vw, 20vh), 11rem);
}

.choice-emoji--small {
  font-size: clamp(3rem, min(8vw, 10vh), 5rem);
}

.choice--mistake :deep(.dwell-button) {
  box-shadow: 0 0 0 0.375rem rgb(var(--v-theme-warning) / 34%);
}

.sr-only {
  block-size: 1px;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  inline-size: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 9.25rem;
  }
}
</style>
