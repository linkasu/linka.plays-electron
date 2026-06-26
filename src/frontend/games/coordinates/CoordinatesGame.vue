<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useRoundGame } from "../../composables/useRoundGame";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { coordinateColumns, coordinateRows, generateCoordinatesRound, type CoordinateCell } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, startSession, finishSession } = useGameSessionFor("coordinates", {
  maxSteps: 8,
  overrides: { dwellMs: 1300, sessionSeconds: 130, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "coordinates", soundEnabled, warmAssetIds: ["coordinates.prompt", "coordinates.correct", "coordinates.mistake", "coordinates.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const hintedRoundId = ref<string>();
const lastMistakeCellId = ref<string>();
const isSpeaking = ref(false);

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateCoordinatesRound(roundIndex)
});

const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Сначала найди букву сверху, потом цифру слева.";
  return "Ничего страшного. Найди букву и цифру ещё раз, потом выбери другую клетку.";
});

function cellTargetId(cell: CoordinateCell) {
  return `coordinates:cell:${cell.coordinate}`;
}

async function answer(cell: CoordinateCell) {
  if (session.status !== "running" || isSpeaking.value) return;

  const targetId = cellTargetId(cell);
  const expectedCell = round.value.cells[round.value.correctIndex];
  const expectedTargetId = cellTargetId(expectedCell);
  if (cell.isTarget) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: cell.coordinate, expected: round.value.target, actual: cell.coordinate, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeCellId.value = undefined;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    const finishedAfterSuccess = session.step >= session.maxSteps;
    await promptAudio.playSequenceAndWait(finishedAfterSuccess ? ["coordinates.correct", "coordinates.complete"] : ["coordinates.correct"], 80, 170);
    if (finishedAfterSuccess) {
      finishSession("game-complete");
      isSpeaking.value = false;
      return;
    }
    if (session.step < session.maxSteps) nextRound();
    promptAudio.play("coordinates.prompt", 180);
    isSpeaking.value = false;
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: cell.coordinate, expected: round.value.target, actual: cell.coordinate, isCorrect: false });
  hintedRoundId.value = round.value.roundId;
  lastMistakeCellId.value = cell.id;
  isSpeaking.value = true;
  void feedbackAudio.playMistake();
  await promptAudio.playSequenceAndWait(["coordinates.mistake"], 80);
  isSpeaking.value = false;
}

function restart() {
  promptAudio.cancelPending();
  hintedRoundId.value = undefined;
  lastMistakeCellId.value = undefined;
  isSpeaking.value = false;
  restartRoundGame();
  promptAudio.play("coordinates.prompt", 220);
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("coordinates.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
});
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
                  :class="{ 'mistake-cell': lastMistakeCellId === cell.id }"
                  :target-id="cellTargetId(cell)"
                  :disabled="session.status !== 'running' || isSpeaking"
                  :dwell-ms="session.settings.dwellMs"
                  min-height="clamp(6.25rem, 16vh, 9.5rem)"
                  color="surface"
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
                Ошибка не страшна: можно спокойно попробовать ещё раз.
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
  color: #17212b;
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
  color: #17212b !important;
  font-weight: 700;
}

.mistake-cell {
  filter: saturate(0.72) opacity(0.78);
}

@media (min-width: 68.75rem) and (max-height: 58rem) {
  .game-container {
    padding-block-start: 4rem;
  }

  .coordinates-card {
    padding-block: 1rem !important;
  }

  .coordinates-card h1 {
    font-size: 3.35rem !important;
    line-height: 1.05;
  }

  .coordinates-card p {
    margin-block-end: 0.75rem !important;
  }

  .axis-label,
  .corner-label {
    min-block-size: 3.25rem;
  }

  .axis-label--row,
  .coordinate-board :deep(.dwell-button) {
    min-block-size: 7.25rem !important;
  }
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 4.75rem;
  }

  .coordinates-card {
    padding-block: 1rem !important;
  }

  .coordinates-card .text-overline,
  .coordinates-card h1,
  .coordinates-card p,
  .coordinates-card .v-alert {
    display: none;
  }

  .axis-label,
  .corner-label {
    min-block-size: 3rem;
  }

  .axis-label--row,
  .coordinate-board :deep(.dwell-button) {
    min-block-size: 4rem !important;
  }

  .coordinate-board {
    gap: 0.35rem;
  }

  .coordinate-cell__value {
    font-size: 2.6rem;
  }
}
</style>
