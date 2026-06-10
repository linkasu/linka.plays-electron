<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateLogicPairsRound, type LogicPairCard, type LogicPairsRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("logic-pairs", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, {
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<LogicPairsRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateLogicPairsRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const relationLabel = computed(() => {
  if (round.value.relation === "meaning") return "Смысловая пара";
  if (round.value.relation === "shape") return "Пара по форме";
  return "Пара по числу";
});

const helperText = computed(() => {
  if (hintedRoundId.value === round.value.roundId) return `Почти. ${round.value.explanation} Правильная карточка мягко подсвечена.`;
  return round.value.instruction;
});

function choiceTargetId(choiceId: string) {
  return `logic-pairs:choice:${choiceId}`;
}

function choose(choice: LogicPairCard) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.pair.id);
  if (choice.id === round.value.pair.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, expected: round.value.pair.label, actual: choice.label, relation: round.value.relation, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, expected: round.value.pair.label, actual: choice.label, relation: round.value.relation, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: round.value.explanation, reason: "wrong-pair-selected" });
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="logic-pairs-shell">
    <GameHud title="Логические пары" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="11" xl="10">
          <v-card class="logic-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">{{ relationLabel }}</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-3">{{ round.prompt }}</h1>
            <v-alert class="mb-5 text-body-1 text-md-h6 font-weight-bold" :color="hintedRoundId === round.roundId ? 'secondary' : 'primary'" :icon="hintedRoundId === round.roundId ? 'mdi-heart-outline' : 'mdi-link-variant'" rounded="xl" variant="tonal">
              {{ helperText }}
            </v-alert>

            <v-row class="pair-layout" dense align="stretch">
              <v-col cols="12" md="4">
                <v-sheet class="target-card pa-4" color="primary" rounded="xl">
                  <div class="text-overline text-white text-center mb-2">Найди пару для</div>
                  <div class="target-card__visual text-white">{{ round.target.visual }}</div>
                  <div class="text-h5 text-md-h4 font-weight-bold text-white text-center mt-3">{{ round.target.label }}</div>
                </v-sheet>
              </v-col>

              <v-col cols="12" md="8">
                <v-row class="choice-grid" dense>
                  <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6">
                    <GameDwellButton :class="{ 'target-hint': hintedRoundId === round.roundId && choice.id === round.pair.id }" :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="210" :color="hintedRoundId === round.roundId && choice.id === round.pair.id ? 'primary' : 'surface'" @select="choose(choice)">
                      <template #default>
                        <div :class="['choice-card', { 'choice-card--mistake': choice.id === lastMistakeId }]">
                          <div class="choice-card__visual">{{ choice.visual }}</div>
                          <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Логические пары" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.logic-pairs-shell {
  background: linear-gradient(135deg, #f4f7ff 0%, #fff7e8 54%, #eefbf4 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.logic-card {
  overflow: hidden;
}

.pair-layout,
.choice-grid {
  row-gap: 1rem;
}

.target-card {
  align-items: center;
  block-size: 100%;
  box-shadow: inset 0 -0.5rem 2rem rgb(255 255 255 / 18%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 18rem;
}

.target-card__visual,
.choice-card__visual {
  font-size: clamp(4.5rem, min(12vw, 15vh), 8rem);
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.choice-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: filter 160ms ease, transform 160ms ease;
}

.choice-card--mistake {
  filter: saturate(0.75) opacity(0.72);
  transform: scale(0.97);
}

.target-hint {
  filter: drop-shadow(0 0 1.25rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .target-card {
    min-block-size: 13rem;
  }
}
</style>
