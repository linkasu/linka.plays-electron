<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { applyBattleshipLightShot, coordinateLabel, countShots, createBattleshipLightBoard, totalShipCells, type BattleshipLightCell, type BattleshipLightShots } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSession("battleship-light", {
  maxSteps: 10,
  dwellMs: 1300,
  sessionSeconds: 180,
  targetScale: 1.3,
  sound: false
}, { finishOnMistakes: false });

const board = createBattleshipLightBoard();
const shots = ref<BattleshipLightShots>({});
const feedbackMessage = ref("Выбери любую крупную клетку моря. Попадание покажет лодочку, вода даст мягкую волну.");
const lastShotIndex = ref<number>();

const resultVisible = computed(() => session.status === "finished");
const shotCount = computed(() => countShots(shots.value));
const hitCount = computed(() => countShots(shots.value, "hit"));
const waterCount = computed(() => countShots(shots.value, "water"));
const shipCellCount = totalShipCells(board);
const remainingShipCells = computed(() => Math.max(0, shipCellCount - hitCount.value));
const hudStep = computed(() => Math.min(session.maxSteps, shotCount.value));

const statusText = computed(() => {
  if (session.status === "paused") return "Пауза";
  if (session.status === "finished" && remainingShipCells.value === 0) return "Все кораблики найдены";
  if (session.status === "finished") return "Раунд завершён спокойно";
  if (lastShotIndex.value === undefined) return "Выбери клетку";
  return shots.value[lastShotIndex.value] === "hit" ? "Мягкое попадание" : "Вода, продолжаем";
});

function cellTargetId(index: number) {
  return `battleship-light:cell:${index}`;
}

function cellClasses(cell: BattleshipLightCell) {
  const shot = shots.value[cell.index];
  return [
    "sea-cell",
    {
      "sea-cell--hit": shot === "hit",
      "sea-cell--water": shot === "water",
      "sea-cell--last": lastShotIndex.value === cell.index
    }
  ];
}

function chooseCell(index: number) {
  if (session.status !== "running" || shots.value[index]) return;

  const targetId = cellTargetId(index);
  const coordinate = coordinateLabel(index);
  const shot = applyBattleshipLightShot(board, shots.value, index);
  shots.value = shot.shots;
  lastShotIndex.value = index;
  recordEvent("target-click", { targetId, coordinate, result: shot.result });

  if (shot.result === "hit") {
    feedbackMessage.value = `Попадание на ${coordinate}. Кораблик спокойно подсветился.`;
    recordSuccess({ targetId, coordinate, result: "hit", isCorrect: true });
  } else {
    feedbackMessage.value = `На ${coordinate} вода. Это не поражение: можно искать дальше.`;
    recordMistake({ targetId, coordinate, result: "water", isCorrect: false });
  }

  if (shot.allShipsFound) finishSession("game-complete");
  else if (shot.shotCount >= session.maxSteps) finishSession("max-steps");
}

function restart() {
  shots.value = {};
  lastShotIndex.value = undefined;
  feedbackMessage.value = "Новое спокойное море готово. Выбери любую крупную клетку.";
  startSession();
}
</script>

<template>
  <div class="battleship-shell">
    <GameHud title="Морской бой light" :step="hudStep" :max-steps="session.maxSteps" :score="hitCount" :mistakes="waterCount" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="9">
          <v-card class="game-card pa-4 pa-md-6" color="rgba(255, 255, 255, 0.94)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Спокойная стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Морской бой light</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Смотри на крупную клетку моря. Попадание и вода появляются мягко, без резких эффектов и поражения.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal" prepend-icon="mdi-radar">{{ statusText }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Корабликов: {{ remainingShipCells }}</v-chip>
                <v-chip color="info" size="large" variant="tonal">Ходы: {{ hudStep }} / {{ session.maxSteps }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" color="primary" icon="mdi-water" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <div class="sea-grid mx-auto" role="grid" aria-label="Поле Морской бой light пять на пять">
              <GameDwellButton
                v-for="cell in board"
                :key="cell.index"
                :target-id="cellTargetId(cell.index)"
                :disabled="session.status !== 'running' || Boolean(shots[cell.index])"
                :dwell-ms="session.settings.dwellMs"
                :min-height="112"
                :color="shots[cell.index] === 'hit' ? 'primary' : shots[cell.index] === 'water' ? 'info' : 'surface'"
                @select="chooseCell(cell.index)"
              >
                <template #default>
                  <div :class="cellClasses(cell)">
                    <v-icon v-if="shots[cell.index] === 'hit'" icon="mdi-ferry" size="40" />
                    <v-icon v-else-if="shots[cell.index] === 'water'" icon="mdi-water" size="38" />
                    <span v-else class="coordinate-label">{{ coordinateLabel(cell.index) }}</span>
                  </div>
                </template>
              </GameDwellButton>
            </div>

            <div class="text-body-1 text-medium-emphasis text-center mt-5">Можно выбирать любые клетки. Вода только подсказывает, где кораблика нет.</div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Морской бой light" :score="hitCount" :mistakes="waterCount" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.battleship-shell {
  background:
    radial-gradient(circle at 14% 18%, rgb(187 222 251 / 68%), transparent 30%),
    radial-gradient(circle at 82% 20%, rgb(178 235 242 / 58%), transparent 32%),
    linear-gradient(135deg, #f3fbff 0%, #eaf7fb 48%, #f6fbff 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.game-card {
  backdrop-filter: blur(10px);
}

.sea-grid {
  display: grid;
  gap: clamp(8px, 1.4vw, 16px);
  grid-template-columns: repeat(5, minmax(62px, 1fr));
  max-inline-size: min(94vw, 720px);
}

.sea-cell {
  align-items: center;
  border-radius: 24px;
  display: flex;
  font-weight: 900;
  inline-size: 100%;
  justify-content: center;
  min-block-size: clamp(72px, 12vw, 116px);
  transition: background-color 220ms ease, box-shadow 220ms ease, transform 220ms ease;
}

.sea-cell--hit {
  background: linear-gradient(145deg, rgb(var(--v-theme-primary) / 24%), rgb(var(--v-theme-secondary) / 16%));
  box-shadow: inset 0 0 0 5px rgb(var(--v-theme-primary) / 24%);
}

.sea-cell--water {
  background: linear-gradient(145deg, rgb(var(--v-theme-info) / 18%), rgb(255 255 255 / 42%));
  box-shadow: inset 0 0 0 4px rgb(var(--v-theme-info) / 18%);
}

.sea-cell--last {
  transform: scale(1.015);
}

.coordinate-label {
  color: rgb(var(--v-theme-on-surface) / 72%);
  font-size: clamp(1rem, 2vw, 1.35rem);
  letter-spacing: 0.08em;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 176px;
  }

  .sea-grid {
    gap: 7px;
  }
}
</style>
