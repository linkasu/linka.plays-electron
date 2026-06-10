<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateFindDigitRound, type FindDigitOption } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession } = useGameSession("find-digit", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, { finishOnMistakes: false });

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateFindDigitRound(session.settings, roundIndex)
});

const mistakesInRound = ref(0);
const lastMistakeId = ref<string>();

const hintText = computed(() => {
  if (mistakesInRound.value <= 0) return "Посмотри на карточки и выбери такую же цифру.";
  return `Ничего страшного. Цифра ${round.value.target.label} мягко подсвечена.`;
});

function choiceTargetId(choiceId: string) {
  return `find-digit:choice:${choiceId}`;
}

function digitTone(choice: FindDigitOption) {
  return `digit-scene--tone-${choice.digit % 6}`;
}

function answer(choice: FindDigitOption) {
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
  <div class="find-digit-shell">
    <GameHud title="Найди цифру" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Цифровая полянка</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length <= 3 ? 4 : round.choices.length === 4 ? 3 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" min-height="220" @select="answer(choice)">
                  <template #default>
                    <div :class="['digit-scene', digitTone(choice), { 'digit-scene--hinted': mistakesInRound > 0 && choice.id === round.target.id, 'digit-scene--mistake': choice.id === lastMistakeId }]">
                      <div class="digit-scene__label text-caption text-medium-emphasis">{{ choice.sceneLabel }}</div>
                      <span class="digit-scene__number">{{ choice.label }}</span>
                      <div class="digit-scene__echo" aria-hidden="true">{{ choice.label }} {{ choice.label }} {{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди цифру" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.find-digit-shell {
  background: linear-gradient(135deg, #f5fbff 0%, #f7f1ff 48%, #fff7df 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.choice-grid {
  row-gap: 0.75rem;
}

.digit-scene {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(255 255 255 / 88%);
  border-radius: 1.75rem;
  color: #172d4f;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-block-size: 11rem;
  outline: 0 solid transparent;
  overflow: hidden;
  padding: 1rem;
  transition: filter 160ms ease, outline 160ms ease, transform 160ms ease;
}

.digit-scene__label {
  justify-self: end;
}

.digit-scene__number {
  align-self: center;
  font-size: clamp(5.5rem, min(17vw, 19vh), 10.5rem);
  font-weight: 900;
  justify-self: center;
  line-height: 0.9;
}

.digit-scene__echo {
  color: rgb(23 45 79 / 46%);
  font-size: clamp(1.3rem, 4vw, 2.1rem);
  font-weight: 800;
  justify-self: start;
  letter-spacing: 0.2em;
}

.digit-scene--tone-0 {
  background: radial-gradient(circle at 24% 22%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #e2f4ff, #addcf6);
}

.digit-scene--tone-1 {
  background: radial-gradient(circle at 74% 22%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #fff1c5, #ffd27f);
}

.digit-scene--tone-2 {
  background: radial-gradient(circle at 25% 76%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #e6f8dc, #b7e39d);
}

.digit-scene--tone-3 {
  background: radial-gradient(circle at 76% 74%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #f4e8ff, #d8bdf0);
}

.digit-scene--tone-4 {
  background: radial-gradient(circle at 28% 30%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #ffe7df, #ffbcae);
}

.digit-scene--tone-5 {
  background: radial-gradient(circle at 72% 68%, #ffffff 0 12%, transparent 13%), linear-gradient(145deg, #defbf6, #9edfd6);
}

.digit-scene--hinted {
  outline: 0.45rem solid rgb(var(--v-theme-primary));
  transform: scale(1.03);
}

.digit-scene--mistake {
  filter: saturate(0.72) brightness(0.96);
}

@media (max-height: 42rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .digit-scene {
    min-block-size: 8.75rem;
  }
}
</style>
