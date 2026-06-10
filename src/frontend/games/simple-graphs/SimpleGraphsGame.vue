<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateSimpleGraphsRound, type SimpleGraphsBar, type SimpleGraphsChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("simple-graphs", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130,
  sound: false
}, { finishOnMistakes: false });

const feedback = ref("");
const lastMistakeTargetId = ref<string>();
const { round, resultVisible, nextRound, restart } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateSimpleGraphsRound(session.settings, roundIndex)
});

const maxBarValue = computed(() => Math.max(...round.value.bars.map((bar) => bar.value)));
const feedbackText = computed(() => feedback.value || round.value.helperText);

function choiceTargetId(choice: SimpleGraphsChoice) {
  return `simple-graphs:choice:${choice.choiceId}`;
}

function barStyle(bar: SimpleGraphsBar) {
  const percent = Math.max(18, Math.round((bar.value / maxBarValue.value) * 100));
  return {
    "--bar-color": bar.color,
    "--bar-height": `${percent}%`
  };
}

function resetFeedback() {
  feedback.value = "";
  lastMistakeTargetId.value = undefined;
}

function choose(choice: SimpleGraphsChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = `simple-graphs:choice:${round.value.correctChoiceId}`;

  if (choice.choiceId === round.value.correctChoiceId) {
    recordSuccess({ roundId: round.value.roundId, targetId, prompt: round.value.prompt, expected: round.value.correctChoiceId, actual: choice.choiceId, isCorrect: true });
    resetFeedback();
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  feedback.value = round.value.mistakeHint;
  lastMistakeTargetId.value = targetId;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, prompt: round.value.prompt, expected: round.value.correctChoiceId, actual: choice.choiceId, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: feedback.value });
}

function restartGame() {
  resetFeedback();
  restart();
}
</script>

<template>
  <div class="simple-graphs-shell">
    <GameHud title="Простые графики" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="simple-graphs-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Прочитай столбики</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-4 text-body-1 font-weight-bold" :color="lastMistakeTargetId ? 'secondary' : 'primary'" :icon="lastMistakeTargetId ? 'mdi-heart-outline' : 'mdi-lightbulb-outline'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-sheet class="graph-panel pa-4 pa-md-5 mb-4" color="surface" rounded="xl" border>
              <div class="graph-bars" aria-label="Столбиковый график">
                <div v-for="bar in round.bars" :key="bar.id" class="graph-item" :class="{ 'graph-item--target': round.targetBar?.id === bar.id }" :aria-label="`${bar.label}: ${bar.value}`">
                  <div class="graph-track" aria-hidden="true">
                    <div class="graph-bar" :style="barStyle(bar)">
                      <span class="graph-value">{{ bar.value }}</span>
                    </div>
                  </div>
                  <div class="graph-label">
                    <span class="emoji-glyph" aria-hidden="true">{{ bar.emoji }}</span>
                    <span>{{ bar.label }}</span>
                  </div>
                </div>
              </div>
            </v-sheet>

            <v-row class="choice-row" dense>
              <v-col v-for="choice in round.choices" :key="choice.choiceId" cols="12" :sm="round.choices.length > 3 ? 6 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="132" color="surface" @select="choose(choice)">
                  <template #default>
                    <div :class="['choice-card', { 'choice-card--mistake': lastMistakeTargetId === choiceTargetId(choice) }]">
                      <div class="choice-label font-weight-bold" :class="round.questionKind === 'count' ? 'text-h2' : 'text-h5 text-md-h4'">
                        {{ choice.label }}
                      </div>
                      <div v-if="round.questionKind !== 'count'" class="text-body-1 text-medium-emphasis mt-2">столбик</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Простые графики" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restartGame" />
  </div>
</template>

<style scoped>
.simple-graphs-shell {
  background: linear-gradient(135deg, #fff8e7 0%, #e7f6ff 54%, #edf8ef 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-end: 0;
  padding-block-start: 9.75rem;
}

.graph-panel {
  overflow: hidden;
}

.graph-bars {
  align-items: end;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-block-size: clamp(16rem, 42vh, 25rem);
}

.graph-item {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: end;
}

.graph-track {
  align-items: end;
  background: linear-gradient(180deg, rgb(var(--v-theme-primary) / 7%), rgb(var(--v-theme-primary) / 14%));
  border-radius: 1.25rem;
  display: flex;
  inline-size: min(100%, 9.5rem);
  min-block-size: clamp(11rem, 29vh, 18rem);
  padding: 0.55rem;
}

.graph-bar {
  align-items: start;
  background: linear-gradient(180deg, color-mix(in srgb, var(--bar-color) 72%, white), var(--bar-color));
  block-size: var(--bar-height);
  border-radius: 1rem;
  box-shadow: inset 0 -0.5rem 0 rgb(0 0 0 / 10%);
  display: flex;
  inline-size: 100%;
  justify-content: center;
  min-block-size: 3.5rem;
  padding-block-start: 0.65rem;
  transition: block-size 220ms ease;
}

.graph-value {
  align-items: center;
  background: rgb(255 255 255 / 88%);
  border-radius: 999px;
  color: rgb(var(--v-theme-on-surface));
  display: inline-flex;
  font-size: clamp(1.6rem, 4vw, 2.6rem);
  font-weight: 900;
  inline-size: 3.5rem;
  justify-content: center;
  min-block-size: 3.5rem;
}

.graph-label {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: clamp(1rem, 2.4vw, 1.35rem);
  font-weight: 800;
  gap: 0.2rem;
  text-align: center;
}

.graph-label .emoji-glyph {
  font-size: clamp(2.3rem, 6vw, 3.75rem);
  line-height: 1;
}

.graph-item--target .graph-track {
  outline: 0.35rem solid rgb(var(--v-theme-secondary) / 58%);
}

.choice-row {
  row-gap: 0.75rem;
}

.choice-card {
  align-items: center;
  block-size: 100%;
  border: 0.2rem solid transparent;
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 6rem;
  padding: 0.5rem;
}

.choice-card--mistake {
  border-color: rgb(var(--v-theme-secondary));
}

.choice-label {
  line-height: 1.05;
}

@media (min-width: 68.75rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }
}

@media (max-width: 37.5rem) {
  .graph-bars {
    gap: 0.45rem;
  }

  .graph-track {
    min-block-size: 10rem;
    padding: 0.35rem;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 8.75rem;
  }

  .graph-bars {
    min-block-size: 13rem;
  }

  .graph-track {
    min-block-size: 8rem;
  }
}

@media (max-height: 680px) {
  .game-container {
    padding-block-start: 104px;
  }

  .simple-graphs-card {
    display: flex;
    flex-direction: column;
    padding: 1rem !important;
  }

  .simple-graphs-card > .text-overline,
  .simple-graphs-card > .v-alert {
    display: none;
  }

  .choice-row {
    order: 1;
  }

  .graph-panel {
    margin-block-end: 0.75rem !important;
    order: 2;
    padding: 0.75rem !important;
  }

  .graph-bars {
    min-block-size: 8rem;
  }

  .graph-track {
    min-block-size: 5.5rem;
  }
}
</style>
