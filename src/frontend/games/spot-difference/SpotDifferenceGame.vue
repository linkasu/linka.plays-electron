<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateSpotDifferenceRound, type SpotDifferenceChoice } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("spot-difference", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateSpotDifferenceRound(session.settings, roundIndex)
});

const hintText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return "Почти. Посмотри на карточку, где маленький знак другой.";
  return `Сравни ${round.value.groupLabel} и выбери ту, которая отличается.`;
});

function choiceTargetId(choiceId: string) {
  return `spot-difference:choice:${choiceId}`;
}

function choiceStyle(choice: SpotDifferenceChoice) {
  return {
    "--spot-object-color": choice.color,
    "--spot-detail-color": choice.detailColor
  };
}

function answer(choice: SpotDifferenceChoice) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);
  if (choice.isDifferent) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: "отличие", actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "same-card-selected" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="spot-shell">
    <GameHud title="Найди отличие" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="spot-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Спокойное сравнение</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">{{ hintText }}</p>
            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length === 4 ? 3 : round.choices.length === 3 ? 4 : 6">
                <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && choice.isDifferent }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="250" :color="hintedRoundId === round.roundId && choice.isDifferent ? 'primary' : 'surface'" @select="answer(choice)">
                  <template #default>
                    <div :class="['choice-card', { 'choice-card--mistake': choice.id === lastMistakeId }]" :style="choiceStyle(choice)">
                      <v-icon class="object-icon" :icon="choice.icon" />
                      <v-avatar class="detail-badge" size="74">
                        <v-icon class="detail-icon" :icon="choice.detailIcon" />
                      </v-avatar>
                      <div class="text-h6 text-md-h5 font-weight-bold mt-3">{{ hintedRoundId === round.roundId && choice.isDifferent ? choice.label : 'карточка' }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-compare" rounded="xl" variant="tonal">
                Ошибка не страшна. Отличие мягко подсвечено.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Найди отличие" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.spot-shell {
  background: linear-gradient(135deg, #f5f0ff 0%, #edf8ff 48%, #fff7ec 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.spot-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.choice-card {
  align-items: center;
  block-size: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 12rem;
  transition: filter 160ms ease, transform 160ms ease;
}

.object-icon {
  color: var(--spot-object-color);
  font-size: clamp(6rem, min(13vw, 18vh), 9rem);
  line-height: 1;
}

.detail-badge {
  background: rgb(255 255 255 / 88%);
  border: 0.25rem solid var(--spot-detail-color);
  box-shadow: 0 0.5rem 1.4rem rgb(0 0 0 / 12%);
  margin-block-start: -1.8rem;
}

.detail-icon {
  color: var(--spot-detail-color);
  font-size: 2.6rem;
}

.choice-card--mistake {
  filter: saturate(0.7) opacity(0.76);
  transform: scale(0.96);
}

.target-hint {
  filter: drop-shadow(0 0 1.2rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .choice-card {
    min-block-size: 9rem;
  }
}
</style>
