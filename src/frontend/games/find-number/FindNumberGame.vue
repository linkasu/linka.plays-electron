<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindNumberRound, type FindNumberOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("find-number", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindNumberRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();

const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Выбери такую же крупную цифру.";
  return `Ищи цифру ${round.value.target.label}. Она ждёт с мягкой рамкой.`;
});

function choiceTargetId(choiceId: string) {
  return `find-number:choice:${choiceId}`;
}

function digitTone(choice: FindNumberOption) {
  return `digit-card--tone-${choice.digit % 6}`;
}

function answer(choice: FindNumberOption) {
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
  <div class="find-number-shell">
    <GameHud title="Найди число" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="find-number-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Смотри спокойно</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length <= 3 ? 4 : round.choices.length === 4 ? 3 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="210" @select="answer(choice)">
                  <template #default>
                    <div :class="['digit-card', digitTone(choice), { 'digit-card--hinted': mistakesInRound > 0 && choice.id === round.target.id, 'digit-card--mistake': choice.id === lastMistakeId }]">
                      <span class="digit-card__number">{{ choice.label }}</span>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди число" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-number-shell {
  background: linear-gradient(135deg, #f5fbff 0%, #fff4df 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.find-number-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.digit-card {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 86%);
  border-radius: 1.5rem;
  color: #17324d;
  display: flex;
  justify-content: center;
  min-block-size: 10rem;
  outline: 0 solid transparent;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.digit-card__number {
  font-size: clamp(5.25rem, min(17vw, 19vh), 10rem);
  font-weight: 900;
  line-height: 0.9;
}

.digit-card--tone-0 {
  background: linear-gradient(145deg, #e2f4ff, #b9def7);
}

.digit-card--tone-1 {
  background: linear-gradient(145deg, #fff2c8, #ffd98e);
}

.digit-card--tone-2 {
  background: linear-gradient(145deg, #e8f8db, #bfe7a3);
}

.digit-card--tone-3 {
  background: linear-gradient(145deg, #f7e9ff, #ddc1f2);
}

.digit-card--tone-4 {
  background: linear-gradient(145deg, #ffe4dd, #ffc2b4);
}

.digit-card--tone-5 {
  background: linear-gradient(145deg, #e0fbf6, #aee2d9);
}

.digit-card--hinted {
  outline: 0.45rem solid rgb(var(--v-theme-primary));
  transform: scale(1.03);
}

.digit-card--mistake {
  filter: saturate(0.72) brightness(0.96);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .digit-card {
    min-block-size: 8.25rem;
  }
}
</style>
