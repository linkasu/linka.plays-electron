<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { calmSnakeOutcome, createCalmSnakeState, setSnakeDirection, stepSnake, type CalmSnakeStepEvent, type SnakeDirection, type SnakePoint } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSession("calm-snake", {
  maxSteps: 24,
  dwellMs: 1100,
  sessionSeconds: 165,
  motionSpeed: 0.65,
  targetScale: 1.25,
  sound: false
}, { finishOnMistakes: false });

const boardState = ref(createCalmSnakeState());
const feedbackMessage = ref("Выбери направление. Змейка движется сама и спокойно ищет листочек.");
const leavesEaten = ref(0);
const slowUntil = ref(0);
const resultVisible = computed(() => session.status === "finished");
let lastStepAt = performance.now();
const stepTimer = window.setInterval(tick, 180);

const directionControls: { direction: SnakeDirection; label: string; icon: string; color: string }[] = [
  { direction: "up", label: "Вверх", icon: "mdi-arrow-up-bold", color: "blue-lighten-5" },
  { direction: "left", label: "Влево", icon: "mdi-arrow-left-bold", color: "green-lighten-5" },
  { direction: "right", label: "Вправо", icon: "mdi-arrow-right-bold", color: "green-lighten-5" },
  { direction: "down", label: "Вниз", icon: "mdi-arrow-down-bold", color: "blue-lighten-5" }
];

const rows = computed(() => Array.from({ length: boardState.value.height }, (_, row) => row));
const columns = computed(() => Array.from({ length: boardState.value.width }, (_, column) => column));

function directionTargetId(direction: SnakeDirection) {
  return `calm-snake:direction:${direction}`;
}

function chooseDirection(direction: SnakeDirection) {
  if (session.status !== "running") return;
  const previousDirection = boardState.value.direction;
  boardState.value = setSnakeDirection(boardState.value, direction);
  feedbackMessage.value = previousDirection === boardState.value.direction && previousDirection !== direction
    ? "Разворот слишком резкий. Продолжаем мягко вперёд."
    : "Хорошо. Змейка повернёт спокойно.";
}

function tick() {
  if (session.status !== "running") return;

  const now = performance.now();
  const delayMs = now < slowUntil.value ? 3300 : 2350;
  if (now - lastStepAt < delayMs) return;

  lastStepAt = now;
  const result = stepSnake(boardState.value);
  boardState.value = result.state;
  if (calmSnakeOutcome(result) === "loss") {
    feedbackMessage.value = result.event === "blocked-wall"
      ? "Змейка упёрлась в край поля. Партия проиграна."
      : "Змейка столкнулась с хвостиком. Партия проиграна.";
    recordMistake({ event: result.event, moved: result.moved, direction: boardState.value.direction, isCorrect: false });
    finishSession("game-lost");
    return;
  }
  handleStepEvent(result.event, result.moved);
}

function handleStepEvent(event: CalmSnakeStepEvent, moved: boolean) {
  if (event === "ate-food") {
    leavesEaten.value += 1;
    feedbackMessage.value = "Листочек найден. Змейка стала чуть длиннее.";
    recordSuccess({ event, leavesEaten: leavesEaten.value, snakeLength: boardState.value.snake.length });
    return;
  }

  if (event === "moved") {
    feedbackMessage.value = "Движемся медленно. Можно выбрать новый путь.";
    recordSuccess({ event, head: boardState.value.snake[0] });
    return;
  }

  slowUntil.value = performance.now() + 2000;
  feedbackMessage.value = event === "blocked-wall"
    ? "Край поля рядом. Змейка замедлилась и мягко повернула."
    : "Впереди хвостик. Сделаем паузу и выберем свободный путь.";
  recordHint({ event, moved, direction: boardState.value.direction });
  recordMistake({ event, moved, direction: boardState.value.direction });
}

function cellClasses(row: number, column: number) {
  return [
    "snake-cell",
    {
      "snake-cell--head": isHead(row, column),
      "snake-cell--body": isBody(row, column),
      "snake-cell--food": isFood(row, column)
    }
  ];
}

function isHead(row: number, column: number) {
  return pointMatches(boardState.value.snake[0], row, column);
}

function isBody(row: number, column: number) {
  return boardState.value.snake.slice(1).some((part) => pointMatches(part, row, column));
}

function isFood(row: number, column: number) {
  return pointMatches(boardState.value.food, row, column);
}

function pointMatches(point: SnakePoint, row: number, column: number) {
  return point.row === row && point.column === column;
}

function restart() {
  boardState.value = createCalmSnakeState();
  feedbackMessage.value = "Выбери направление. Змейка движется сама и спокойно ищет листочек.";
  leavesEaten.value = 0;
  slowUntil.value = 0;
  lastStepAt = performance.now();
  startSession();
}

onUnmounted(() => {
  window.clearInterval(stepTimer);
});
</script>

<template>
  <div class="calm-snake-shell">
    <GameHud title="Змейка спокойная" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-6" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Медленный маршрут</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Помоги змейке найти листочки</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-4">{{ feedbackMessage }}</p>

            <v-row align="center" justify="center" class="ga-2">
              <v-col cols="12" md="3" class="order-2 order-md-1">
                <v-row dense>
                  <v-col v-for="control in directionControls.slice(0, 2)" :key="control.direction" cols="6" md="12">
                    <GameDwellButton :target-id="directionTargetId(control.direction)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="150" :color="control.color" @select="chooseDirection(control.direction)">
                      <template #default>
                        <div class="direction-content">
                          <v-icon :icon="control.icon" size="48" color="primary" />
                          <span>{{ control.label }}</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>

              <v-col cols="12" md="6" class="order-1 order-md-2">
                <div class="snake-board mx-auto" role="grid" aria-label="Поле спокойной змейки">
                  <div v-for="row in rows" :key="row" class="snake-row" role="row">
                    <div v-for="column in columns" :key="column" :class="cellClasses(row, column)" role="gridcell">
                      <v-icon v-if="isFood(row, column)" icon="mdi-leaf" color="green-darken-1" size="28" />
                    </div>
                  </div>
                </div>
              </v-col>

              <v-col cols="12" md="3" class="order-3">
                <v-row dense>
                  <v-col v-for="control in directionControls.slice(2)" :key="control.direction" cols="6" md="12">
                    <GameDwellButton :target-id="directionTargetId(control.direction)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="150" :color="control.color" @select="chooseDirection(control.direction)">
                      <template #default>
                        <div class="direction-content">
                          <v-icon :icon="control.icon" size="48" color="primary" />
                          <span>{{ control.label }}</span>
                        </div>
                      </template>
                    </GameDwellButton>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>

            <v-row class="mt-4" justify="center">
              <v-col cols="12" md="8">
                <v-alert color="info" rounded="xl" variant="tonal">
                  Листочки: {{ leavesEaten }}. Если путь упирается в край или хвостик, партия завершается.
                </v-alert>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Змейка спокойная" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.calm-snake-shell {
  background: linear-gradient(135deg, #eaf7ef 0%, #edf6ff 52%, #fff8e6 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.snake-board {
  background: rgb(var(--v-theme-surface));
  border: 8px solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 28px;
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-secondary) / 18%);
  display: grid;
  gap: 6px;
  max-inline-size: min(72vh, 620px);
  padding: 12px;
}

.snake-row {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(9, minmax(0, 1fr));
}

.snake-cell {
  align-items: center;
  aspect-ratio: 1;
  background: #f2f8ec;
  border-radius: 14px;
  display: flex;
  justify-content: center;
  transition: background-color 220ms ease, transform 220ms ease;
}

.snake-cell--body {
  background: #9bd18d;
}

.snake-cell--head {
  background: #4caf50;
  box-shadow: 0 6px 18px rgb(76 175 80 / 24%);
  transform: scale(1.04);
}

.snake-cell--food {
  background: #fff6d7;
}

.direction-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 1.1rem;
  font-weight: 700;
  gap: 10px;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 172px;
  }

  .snake-board,
  .snake-row {
    gap: 4px;
  }

  .snake-cell {
    border-radius: 10px;
  }
}
</style>
