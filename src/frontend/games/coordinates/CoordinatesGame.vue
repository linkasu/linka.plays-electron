<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { coordinateColumns, coordinateRows, generateCoordinatesRound, type CoordinateCell } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("coordinates", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeCellId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCoordinatesRound(roundIndex)
});

const hintedCellId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.cells[round.value.correctIndex].id : undefined);
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Сначала найди букву сверху, потом цифру слева.";
  return `Ничего страшного. Клетка ${round.value.target} мягко подсвечена.`;
});

function cellTargetId(cell: CoordinateCell) {
  return `coordinates:cell:${cell.coordinate}`;
}

function answer(cell: CoordinateCell) {
  if (session.status !== "running") return;

  const targetId = cellTargetId(cell);
  const expectedCell = round.value.cells[round.value.correctIndex];
  const expectedTargetId = cellTargetId(expectedCell);
  if (cell.isTarget) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: cell.coordinate, expected: round.value.target, actual: cell.coordinate, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeCellId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: cell.coordinate, expected: round.value.target, actual: cell.coordinate, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-coordinate" });
  hintedRoundId.value = round.value.roundId;
  lastMistakeCellId.value = cell.id;
}

function restart() {
  hintedRoundId.value = undefined;
  lastMistakeCellId.value = undefined;
  restartRoundGame();
}
</script>

<template>
  <div class="coordinates-shell">
    <GameHud title="Координаты" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="8">
          <v-card class="coordinates-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Координаты на поле 3×3</div>
            <h1 class="text-h3 text-md-h2 font-weight-bold text-center mb-2">{{ round.prompt }}</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ hintText }}</p>
            <div class="coordinate-board" role="group" :aria-label="`Поле координат, цель ${round.target}`">
              <div class="corner-label" aria-hidden="true"></div>
              <div v-for="column in coordinateColumns" :key="column" class="axis-label axis-label--column text-h4 text-md-h3 font-weight-bold">
                {{ column }}
              </div>
              <template v-for="row in coordinateRows" :key="row">
                <div class="axis-label axis-label--row text-h4 text-md-h3 font-weight-bold">
                  {{ row }}
                </div>
                <GameDwellButton
                  v-for="cell in round.cells.filter((item) => item.row === row)"
                  :key="cell.id"
                  :class="{ 'target-hint': hintedCellId === cell.id, 'mistake-cell': lastMistakeCellId === cell.id }"
                  :target-id="cellTargetId(cell)"
                  :disabled="session.status !== 'running'"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(6.25rem, 16vh, 9.5rem)"
                  :color="hintedCellId === cell.id ? 'primary' : 'surface'"
                  @select="answer(cell)"
                >
                  <template #default>
                    <div class="coordinate-cell">
                      <div class="coordinate-cell__value">{{ cell.coordinate }}</div>
                      <div class="coordinate-cell__hint text-body-1 text-medium-emphasis">{{ cell.column }} + {{ cell.row }}</div>
                    </div>
                  </template>
                </GameDwellButton>
              </template>
            </div>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-4 text-h6" color="primary" icon="mdi-grid-large" rounded="xl" variant="tonal">
                Ошибка не страшна: правильная координата подсвечена, можно попробовать ещё раз.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Координаты" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.coordinates-shell {
  background: linear-gradient(135deg, #f3fbff 0%, #fff8e8 52%, #f4f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.coordinates-card {
  overflow: hidden;
}

.coordinate-board {
  display: grid;
  gap: clamp(0.45rem, 1vw, 0.8rem);
  grid-template-columns: minmax(3.25rem, 0.38fr) repeat(3, minmax(0, 1fr));
}

.axis-label,
.corner-label {
  align-items: center;
  border-radius: 1.25rem;
  display: flex;
  justify-content: center;
  min-block-size: clamp(3.5rem, 8vh, 5rem);
}

.axis-label {
  background: rgb(var(--v-theme-primary) / 10%);
  color: rgb(var(--v-theme-primary));
}

.axis-label--row {
  min-block-size: clamp(6.25rem, 16vh, 9.5rem);
}

.coordinate-cell {
  align-items: center;
  display: grid;
  gap: 0.35rem;
  justify-items: center;
}

.coordinate-cell__value {
  font-size: clamp(2.8rem, min(8vw, 10vh), 5.25rem);
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 0.95;
}

.coordinate-cell__hint {
  font-weight: 700;
}

.target-hint {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.mistake-cell {
  filter: saturate(0.72) opacity(0.78);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .axis-label,
  .corner-label {
    min-block-size: 3rem;
  }
}
</style>
