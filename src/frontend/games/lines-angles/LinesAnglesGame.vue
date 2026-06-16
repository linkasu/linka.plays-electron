<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { resolveMenuRoute } from "../../core/menuMode";
import { generateLinesAnglesRound, type LinesAnglesOption, type LinesAnglesRound } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSessionFor("lines-angles", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 120 },
  finishOnMistakes: false
});

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame<LinesAnglesRound>({
  session,
  startSession,
  generateRound: (roundIndex) => generateLinesAnglesRound(session.settings, roundIndex)
});

const hintedRoundId = ref<string>();
const lastMistakeId = ref<string>();

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Посмотри на линии и выбери подходящую карточку.";
  return `Почти. ${round.value.hint} Правильная карточка мягко подсвечена.`;
});

function choiceTargetId(choiceId: string) {
  return `lines-angles:choice:${choiceId}`;
}

function isTargetHint(choice: LinesAnglesOption) {
  return hintedRoundId.value === round.value.roundId && choice.id === round.value.target.id;
}

function isMistake(choice: LinesAnglesOption) {
  return hintedRoundId.value === round.value.roundId && choice.id === lastMistakeId.value;
}

function answer(choice: LinesAnglesOption) {
  if (session.status !== "running") return;

  const targetId = choiceTargetId(choice.id);
  const expectedTargetId = choiceTargetId(round.value.target.id);

  if (choice.id === round.value.target.id) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: choice.id, task: round.value.task.id, expected: round.value.target.label, actual: choice.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  hintedRoundId.value = round.value.roundId;
  lastMistakeId.value = choice.id;
  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: choice.id, task: round.value.task.id, expected: round.value.target.label, actual: choice.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, text: round.value.hint });
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="lines-angles-shell">
    <GameHud title="Линии и углы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="lines-angles-card pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Геометрия взглядом</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5" role="status">{{ hintText }}</p>

            <v-row class="choice-grid" justify="center" dense>
              <v-col v-for="choice in round.choices" :key="choice.id" cols="12" sm="6" :md="round.choices.length <= 3 ? 4 : round.choices.length === 4 ? 3 : 4">
                <GameDwellButton :target-id="choiceTargetId(choice.id)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="225" @select="answer(choice)">
                  <template #default>
                    <div :class="['geometry-card', { 'geometry-card--hinted': isTargetHint(choice), 'geometry-card--mistake': isMistake(choice) }]">
                      <svg class="geometry-svg" viewBox="0 0 160 120" aria-hidden="true" focusable="false">
                        <line v-if="choice.id === 'straight-vertical'" x1="80" y1="16" x2="80" y2="104" />
                        <line v-else-if="choice.id === 'straight-horizontal'" x1="24" y1="60" x2="136" y2="60" />
                        <line v-else-if="choice.id === 'straight-diagonal'" x1="34" y1="94" x2="126" y2="26" />
                        <path v-else-if="choice.id === 'curved-vertical'" d="M88 14 C44 34 116 58 72 106" />
                        <path v-else-if="choice.id === 'curved-horizontal'" d="M22 68 C48 20 106 104 138 52" />
                        <path v-else-if="choice.id === 'smooth-wave'" d="M18 62 C42 28 62 96 84 62 S124 28 144 62" />
                        <path v-else-if="choice.id === 'soft-arc'" d="M42 90 C50 28 112 28 120 90" />
                        <path v-else-if="choice.id === 'right-angle'" d="M50 24 L50 82 L116 82" />
                        <path v-else-if="choice.id === 'open-angle'" d="M40 92 L80 28 L122 92" />
                        <path v-else-if="choice.id === 'wide-angle'" d="M24 82 L80 40 L136 82" />
                        <path v-else d="M22 38 L58 82 L94 38 L138 82" />
                      </svg>
                      <div class="text-h5 text-md-h4 font-weight-bold mt-3">{{ choice.label }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>

            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-5 text-h6" color="primary" icon="mdi-lightbulb-outline" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Правильная линия подсвечена, можно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Линии и углы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.lines-angles-shell {
  background: linear-gradient(135deg, #f3fbff 0%, #fff7ed 52%, #f4f1ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.lines-angles-card {
  overflow: hidden;
}

.choice-grid {
  row-gap: 0.75rem;
}

.geometry-card {
  align-items: center;
  block-size: 100%;
  border: 0.25rem solid rgb(var(--v-theme-outline-variant));
  border-radius: 1.75rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 1rem;
  transition: border-color 160ms ease, filter 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.geometry-card--hinted {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 0.35rem rgb(var(--v-theme-primary) / 16%);
  transform: scale(1.03);
}

.geometry-card--mistake {
  filter: saturate(0.72) opacity(0.74);
}

.geometry-svg {
  block-size: clamp(7rem, min(20vw, 24vh), 11rem);
  inline-size: min(100%, 16rem);
}

.geometry-svg :deep(line),
.geometry-svg :deep(path) {
  fill: none;
  stroke: rgb(var(--v-theme-primary));
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 12;
}

@media (max-width: 37.5rem) {
  .game-container {
    padding-block-start: 7.75rem;
  }

  .geometry-svg {
    block-size: 6.5rem;
  }
}

@media (max-height: 40rem) {
  .game-container {
    padding-block-start: 7.25rem;
  }

  .geometry-svg {
    block-size: 5.75rem;
  }
}
</style>
