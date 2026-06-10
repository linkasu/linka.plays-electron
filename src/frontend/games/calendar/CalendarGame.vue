<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateCalendarRound, type CalendarChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("calendar", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCalendarRound(session.settings, roundIndex)
});

const mistakeChoiceId = ref<string>();

const feedbackText = computed(() => {
  if (!mistakeChoiceId.value) return round.value.helperText;
  return `Почти. ${round.value.correctionText} Попробуй ещё раз спокойно.`;
});

function choiceTargetId(choice: CalendarChoice) {
  return `calendar:choice:${choice.id}`;
}

function choiceColor(choice: CalendarChoice) {
  if (mistakeChoiceId.value === choice.id) return "orange-lighten-4";
  if (mistakeChoiceId.value && choice.id === round.value.correctChoiceId) return "green-lighten-4";
  return choice.color;
}

function choose(choice: CalendarChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice);
  const expectedTargetId = `calendar:choice:${round.value.correctChoiceId}`;

  if (choice.id === round.value.correctChoiceId) {
    mistakeChoiceId.value = undefined;
    recordSuccess({ roundId: round.value.roundId, targetId, expected: round.value.correctChoiceId, actual: choice.id, isCorrect: true });
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  mistakeChoiceId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, expected: round.value.correctChoiceId, actual: choice.id, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId, text: feedbackText.value });
}

function restart() {
  mistakeChoiceId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="calendar-shell">
    <GameHud title="Календарь" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="d-flex justify-center mb-3">
              <v-chip color="primary" prepend-icon="mdi-calendar-today" size="large" variant="tonal">
                {{ round.contextText }}
              </v-chip>
            </div>
            <div class="text-overline text-secondary text-center mb-2">Дни недели и время</div>
            <h1 class="text-h4 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-row class="choice-row" justify="center">
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 3 ? 4 : 3">
                <GameDwellButton :target-id="choiceTargetId(choice)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="190" :color="choiceColor(choice)" @select="choose(choice)">
                  <template #default>
                    <div class="calendar-choice">
                      <v-icon v-if="mistakeChoiceId && choice.id === round.correctChoiceId" class="calendar-choice__check" icon="mdi-check-circle" size="34" />
                      <v-icon :icon="choice.icon" class="mb-3" size="48" />
                      <div class="calendar-choice__label font-weight-black">{{ choice.label }}</div>
                      <div class="text-h6 text-md-h5 text-medium-emphasis font-weight-bold mt-2">{{ choice.sublabel }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Календарь" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calendar-shell {
  background: linear-gradient(135deg, #f2fbff 0%, #fff7df 48%, #eef7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 9.25rem;
}

.choice-row {
  row-gap: 0.75rem;
}

.calendar-choice {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  text-align: center;
}

.calendar-choice__label {
  font-size: clamp(2.2rem, 5.5vw, 4.3rem);
  line-height: 0.98;
}

.calendar-choice__check {
  inset-block-start: 0.25rem;
  inset-inline-end: 0.25rem;
  position: absolute;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 11rem;
  }
}

@media (max-height: 42rem) and (min-width: 60rem) {
  .game-container {
    padding-block-start: 7.4rem;
  }
}
</style>
