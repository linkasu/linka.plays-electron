<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { calm2048Outcome, canMove, createInitialBoard, highestTile, moveBoard, spawnTile, type Calm2048Board, type Calm2048Direction } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordEvent, recordMistake, recordSuccess, startSession, finishSession } = useGameSession("calm-2048", {
  preset: "gentle",
  maxSteps: 32,
  dwellMs: 1100,
  sessionSeconds: 180,
  targetScale: 1.15,
  sound: false
}, { finishOnMistakes: false });

const directions = [
  { direction: "up", label: "Вверх", icon: "mdi-arrow-up-bold" },
  { direction: "left", label: "Влево", icon: "mdi-arrow-left-bold" },
  { direction: "right", label: "Вправо", icon: "mdi-arrow-right-bold" },
  { direction: "down", label: "Вниз", icon: "mdi-arrow-down-bold" }
] as const;

const board = ref<Calm2048Board>(createInitialBoard());
const previousBoard = ref<Calm2048Board>();
const feedbackMessage = ref("Собирай одинаковые плитки без спешки. Каждый удачный сдвиг засчитывается.");
const lastSpawnedIndex = ref<number>();

const resultVisible = computed(() => session.status === "finished");
const hasMoves = computed(() => canMove(board.value));
const canUndo = computed(() => Boolean(previousBoard.value) && session.status === "running");
const maxTile = computed(() => highestTile(board.value));

function directionTargetId(direction: Calm2048Direction) {
  return `calm-2048:direction:${direction}`;
}

function actionTargetId(action: string) {
  return `calm-2048:action:${action}`;
}

function chooseDirection(direction: Calm2048Direction) {
  if (session.status !== "running" || !hasMoves.value) return;

  const beforeMove = [...board.value];
  const move = moveBoard(board.value, direction);
  const targetId = directionTargetId(direction);

  if (!move.moved) {
    feedbackMessage.value = "В эту сторону плитки уже спокойно стоят. Попробуй другое направление.";
    recordMistake({ targetId, direction, reason: "blocked", isCorrect: false });
    return;
  }

  previousBoard.value = beforeMove;
  const spawn = spawnTile(move.board);
  board.value = spawn.board;
  lastSpawnedIndex.value = spawn.spawnedIndex;
  recordSuccess({ targetId, direction, merged: move.merged, scoreGain: move.scoreGain, highestTile: highestTile(board.value), isCorrect: true });

  if (calm2048Outcome(board.value) === "loss") {
    feedbackMessage.value = "Ходов больше нет. Партия 2048 проиграна, можно начать новую доску.";
    recordMistake({ targetId, direction, reason: "no-legal-moves", highestTile: highestTile(board.value), isCorrect: false });
    finishSession("game-lost");
  } else if (move.merged) {
    feedbackMessage.value = `Есть слияние: +${move.scoreGain}. Продолжаем спокойно.`;
  } else {
    feedbackMessage.value = "Плитки мягко сдвинулись. Можно искать следующее слияние.";
  }
}

function undoMove() {
  if (!previousBoard.value || session.status !== "running") return;
  board.value = previousBoard.value;
  previousBoard.value = undefined;
  lastSpawnedIndex.value = undefined;
  feedbackMessage.value = "Вернули предыдущую доску. Можно выбрать другой спокойный ход.";
  recordEvent("hint", { kind: "undo" });
}

function restart() {
  board.value = createInitialBoard();
  previousBoard.value = undefined;
  lastSpawnedIndex.value = undefined;
  feedbackMessage.value = "Новая доска готова. Сдвигай плитки и собирай мягкие слияния.";
  startSession();
}

function tileColor(value: number) {
  if (value >= 1024) return "deep-purple-lighten-3";
  if (value >= 512) return "indigo-lighten-3";
  if (value >= 256) return "blue-lighten-3";
  if (value >= 128) return "cyan-lighten-4";
  if (value >= 64) return "teal-lighten-4";
  if (value >= 32) return "green-lighten-4";
  if (value >= 16) return "lime-lighten-4";
  if (value >= 8) return "amber-lighten-4";
  if (value >= 4) return "orange-lighten-4";
  if (value >= 2) return "blue-grey-lighten-5";
  return "surface-variant";
}
</script>

<template>
  <div class="calm-2048-shell">
    <GameHud title="2048 мягкий" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" lg="11" xl="10">
          <v-card class="pa-4 pa-md-6" color="rgba(255, 255, 255, 0.92)" rounded="xl" elevation="8">
            <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between ga-4 mb-5">
              <div>
                <div class="text-overline text-secondary mb-1">Спокойная стратегия</div>
                <h1 class="text-h4 text-md-h3 font-weight-bold mb-2">Собирай одинаковые плитки</h1>
                <p class="text-body-1 text-medium-emphasis mb-0">Двигай всё поле одной крупной кнопкой. Если ходов не останется, партия завершится.</p>
              </div>
              <div class="d-flex flex-wrap ga-2">
                <v-chip color="primary" size="large" variant="tonal">Лучшая плитка: {{ maxTile || 0 }}</v-chip>
                <v-chip color="secondary" size="large" variant="tonal">Ходов: {{ session.step }} / {{ session.maxSteps }}</v-chip>
              </div>
            </div>

            <v-alert class="mb-5 text-body-1 font-weight-medium" :color="hasMoves ? 'primary' : 'secondary'" icon="mdi-leaf" rounded="xl" variant="tonal">
              {{ feedbackMessage }}
            </v-alert>

            <v-row class="align-center" dense>
              <v-col cols="12" md="7" class="order-2 order-md-1">
                <div class="board-grid mx-auto" role="grid" aria-label="Поле 2048 четыре на четыре">
                  <v-card v-for="(value, index) in board" :key="index" :class="['tile-card', { 'tile-card--new': lastSpawnedIndex === index }]" :color="tileColor(value)" rounded="xl" variant="flat">
                    <div class="tile-value">{{ value || "" }}</div>
                  </v-card>
                </div>
              </v-col>

              <v-col cols="12" md="5" class="order-1 order-md-2">
                <v-row dense>
                  <v-col v-for="item in directions" :key="item.direction" cols="6">
                    <GameDwellButton :target-id="directionTargetId(item.direction)" :disabled="session.status !== 'running' || !hasMoves" :dwell-ms="session.settings.dwellMs" :min-height="132" :color="canMove(board, item.direction) ? 'surface' : 'blue-grey-lighten-5'" @select="chooseDirection(item.direction)">
                      <template #default>
                        <div class="direction-button-content">
                          <v-icon :icon="item.icon" size="44" />
                          <span>{{ item.label }}</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>

                <v-divider class="my-4" />

                <v-row dense>
                  <v-col cols="6">
                    <GameDwellButton :target-id="actionTargetId('undo')" :disabled="!canUndo" :dwell-ms="session.settings.dwellMs" :min-height="112" color="secondary" @select="undoMove">
                      <template #default>
                        <div class="direction-button-content">
                          <v-icon icon="mdi-undo" size="36" />
                          <span>Отменить</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                  <v-col cols="6">
                    <GameDwellButton :target-id="actionTargetId('new-board')" :dwell-ms="session.settings.dwellMs" :min-height="112" color="primary" @select="restart">
                      <template #default>
                        <div class="direction-button-content">
                          <v-icon icon="mdi-refresh" size="36" />
                          <span>Новая доска</span>
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

    <GameResultDialog :model-value="resultVisible" title="2048 мягкий" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calm-2048-shell {
  background:
    radial-gradient(circle at 18% 18%, rgb(200 230 201 / 64%), transparent 30%),
    radial-gradient(circle at 84% 20%, rgb(187 222 251 / 58%), transparent 28%),
    linear-gradient(135deg, #f7fbf1 0%, #eef8ff 54%, #fff7e8 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 112px;
}

.board-grid {
  display: grid;
  gap: clamp(8px, 1.5vw, 14px);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  max-inline-size: min(92vw, 560px);
}

.tile-card {
  align-items: center;
  aspect-ratio: 1;
  display: flex;
  justify-content: center;
  transition: box-shadow 180ms ease, transform 180ms ease;
}

.tile-card--new {
  box-shadow: 0 0 0 5px rgb(var(--v-theme-primary) / 20%);
  transform: scale(1.02);
}

.tile-value {
  color: rgb(var(--v-theme-on-surface));
  font-size: clamp(1.7rem, 5.4vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
}

.direction-button-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 1.05rem;
  font-weight: 800;
  gap: 0.5rem;
  justify-content: center;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 140px;
  }
}
</style>
