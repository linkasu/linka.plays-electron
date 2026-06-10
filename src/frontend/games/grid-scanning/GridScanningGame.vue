<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { useRoundGame } from "../../composables/useRoundGame";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { generateGridScanningRound, type GridScanningCell } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("grid-scanning", {
  maxSteps: 8,
  dwellMs: 1250,
  sessionSeconds: 120
}, {
  finishOnMistakes: false
});

const hintedRoundId = ref<string>();
const lastMistakeCellId = ref<string>();

const { round, resultVisible, nextRound, restart: restartRoundGame } = useRoundGame({
  session,
  startSession,
  generateRound: (roundIndex) => generateGridScanningRound(session.settings, roundIndex)
});

const hintedCellId = computed(() => hintedRoundId.value === round.value.roundId ? round.value.cells[round.value.correctIndex].id : undefined);
const gridStyle = computed(() => ({ "--grid-columns": String(round.value.dimension) }));
const cellMinHeight = computed(() => {
  if (round.value.dimension === 2) return "clamp(10rem, 25vh, 14rem)";
  if (round.value.dimension === 3) return "clamp(7.5rem, 18vh, 10rem)";
  return "clamp(5.5rem, 13vh, 7.75rem)";
});
const hintText = computed(() => {
  if (hintedRoundId.value !== round.value.roundId) return "Сканируй поле спокойно: сверху вниз или слева направо.";
  return `Цель подсвечена. Попробуй найти ${round.value.target.label} ещё раз.`;
});

function cellTargetId(cellId: string) {
  return `grid-scanning:cell:${cellId}`;
}

function answer(cell: GridScanningCell) {
  if (session.status !== "running") return;

  const targetId = cellTargetId(cell.id);
  const expectedTargetId = cellTargetId(round.value.cells[round.value.correctIndex].id);
  if (cell.isTarget) {
    recordSuccess({ roundId: round.value.roundId, targetId, answerId: cell.id, expected: round.value.target.label, actual: cell.item.label, isCorrect: true });
    hintedRoundId.value = undefined;
    lastMistakeCellId.value = undefined;
    if (session.step < session.maxSteps) nextRound();
    return;
  }

  recordMistake({ roundId: round.value.roundId, targetId, expectedTargetId, answerId: cell.id, expected: round.value.target.label, actual: cell.item.label, isCorrect: false });
  recordHint({ roundId: round.value.roundId, targetId: expectedTargetId, reason: "wrong-grid-cell" });
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
  <div class="grid-scanning-shell">
    <GameHud title="Сканирование поля" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center" no-gutters>
        <v-col cols="12" lg="10" xl="9">
          <v-card class="grid-scanning-card pa-4 pa-md-6" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Визуальный поиск по клеткам</div>
            <div class="target-card mx-auto mb-3 mb-md-4">
              <v-icon class="target-icon" :icon="round.target.icon" :color="round.target.color" />
              <div>
                <div class="text-body-1 text-medium-emphasis">Найди в поле</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold">{{ round.target.label }}</h1>
              </div>
            </div>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-4">{{ hintText }}</p>
            <div class="scan-grid" :style="gridStyle">
              <GameDwellButton
                v-for="cell in round.cells"
                :key="cell.id"
                :class="{ 'target-hint': hintedCellId === cell.id, 'mistake-cell': lastMistakeCellId === cell.id }"
                :target-id="cellTargetId(cell.id)"
                :disabled="session.status !== 'running'"
                :dwell-ms="session.settings.dwellMs"
                :min-height="cellMinHeight"
                :color="hintedCellId === cell.id ? 'primary' : 'surface'"
                @select="answer(cell)"
              >
                <template #default>
                  <v-icon class="scan-cell-icon" :icon="cell.item.icon" :color="hintedCellId === cell.id ? undefined : cell.item.color" />
                  <div class="text-body-1 text-md-h6 font-weight-bold mt-2">{{ cell.item.label }}</div>
                </template>
              </GameDwellButton>
            </div>
            <v-expand-transition>
              <v-alert v-if="hintedRoundId === round.roundId" class="mt-4 text-h6" color="primary" icon="mdi-grid" rounded="xl" variant="tonal">
                Ошибка не завершает игру. Правильная клетка мягко подсвечена.
              </v-alert>
            </v-expand-transition>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Сканирование поля" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.grid-scanning-shell {
  background: linear-gradient(135deg, #f6fbff 0%, #fff7ed 52%, #f2f0ff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 8.75rem;
}

.grid-scanning-card {
  overflow: hidden;
}

.target-card {
  align-items: center;
  background: rgb(var(--v-theme-primary) / 8%);
  border: 0.25rem solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 2rem;
  display: flex;
  gap: 1rem;
  inline-size: fit-content;
  justify-content: center;
  padding: 1rem 1.5rem;
}

.target-icon {
  font-size: clamp(3.5rem, min(8vw, 11vh), 6rem);
  line-height: 1;
}

.scan-grid {
  display: grid;
  gap: clamp(0.5rem, 1.2vw, 0.875rem);
  grid-template-columns: repeat(var(--grid-columns), minmax(0, 1fr));
}

.scan-cell-icon {
  font-size: clamp(2.6rem, min(7vw, 10vh), 5.5rem);
  line-height: 1;
  transition: filter 160ms ease, transform 160ms ease;
}

.target-hint {
  filter: drop-shadow(0 0 1.15rem rgb(var(--v-theme-primary) / 42%));
  transform: scale(1.03);
}

.mistake-cell .scan-cell-icon {
  filter: saturate(0.7) opacity(0.7);
  transform: scale(0.94);
}

@media (max-height: 44rem) {
  .game-container {
    padding-block-start: 7.5rem;
  }

  .target-card {
    padding-block: 0.75rem;
  }
}
</style>
