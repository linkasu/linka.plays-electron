<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindColorRound, type FindColorOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("find-color", {
  maxSteps: 8,
  dwellMs: 1200,
  sessionSeconds: 120
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindColorRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();

const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Выбери карточку нужного цвета.";
  return `Ищи ${round.value.target.label} круг. Он подсвечен мягкой рамкой.`;
});

function choiceTargetId(choiceId: string) {
  return `find-color:choice:${choiceId}`;
}

function choiceStyle(choice: FindColorOption) {
  return {
    "--find-color-bg": choice.hex,
    "--find-color-text": choice.textColor
  };
}

function answer(choice: FindColorOption) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    mistakesInRound.value = 0;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  mistakesInRound.value += 1;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
}

function restart() {
  mistakesInRound.value = 0;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="find-color-shell">
    <GameHud title="Найди цвет" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-color-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Смотри и выбирай</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="220" @select="answer(choice)">
                  <template #default>
                    <div :class="['color-choice', { 'color-choice--hinted': mistakesInRound > 0 && choice.id === round.target.id, 'color-choice--mistake': choice.id === lastMistakeId }]" :style="choiceStyle(choice)">
                      <div class="color-dot" aria-hidden="true" />
                      <div class="text-h4 text-md-h3 font-weight-bold color-label">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди цвет" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-color-shell {
  background: linear-gradient(135deg, #fff7ed 0%, #eef8ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-color-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.color-choice {
  align-items: center;
  background: var(--find-color-bg);
  border: 0.25rem solid rgb(255 255 255 / 82%);
  border-radius: 1.5rem;
  block-size: 100%;
  color: var(--find-color-text);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
  min-block-size: 10.5rem;
  outline: 0 solid transparent;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.color-dot {
  background: currentColor;
  border-radius: 999px;
  block-size: clamp(4.5rem, 12vw, 7.5rem);
  box-shadow: 0 0 0 0.875rem rgb(255 255 255 / 26%);
  inline-size: clamp(4.5rem, 12vw, 7.5rem);
  opacity: 0.95;
}

.color-label {
  text-shadow: 0 0.125rem 0.375rem rgb(0 0 0 / 28%);
}

.color-choice--hinted {
  outline: 0.45rem solid rgb(var(--v-theme-primary));
  transform: scale(1.03);
}

.color-choice--mistake {
  filter: saturate(0.7) brightness(0.95);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .color-choice {
    min-block-size: 8.5rem;
  }
}
</style>
