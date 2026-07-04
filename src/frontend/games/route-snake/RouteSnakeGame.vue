<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWasdPanel, { type GameWasdControl } from "../../components/game/GameWasdPanel.vue";
import { useGamePromptAudio } from "../../composables/useGamePromptAudio";
import { useGameSessionFor } from "../../composables/useGameSessionFor";
import { useStandardGameFeedback } from "../../composables/useStandardGameFeedback";
import { resolveMenuRoute } from "../../core/menuMode";
import { routeSnakeOutcome, createRouteSnakeState, setSnakeDirection, stepSnake, type RouteSnakeStepEvent, type SnakeDirection, type SnakePoint } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("route-snake", {
  maxSteps: 24,
  overrides: { motionSpeed: 0.65, targetScale: 1.25, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false,
  finishOnTimeout: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "route-snake", soundEnabled, warmAssetIds: ["route-snake.prompt", "route-snake.correct", "route-snake.mistake", "route-snake.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const boardState = ref(createRouteSnakeState());
const feedbackMessage = ref("Выбери направление. Змейка движется сама и ищет листочек.");
const leavesEaten = ref(0);
const slowUntil = ref(0);
const resultVisible = computed(() => session.status === "finished");
const isSpeaking = ref(false);
let lastStepAt = performance.now();
const stepTimer = window.setInterval(tick, 180);

const directionControls: { direction: SnakeDirection; key: "w" | "a" | "s" | "d"; label: string; icon: string; color: string }[] = [
  { direction: "up", key: "w", label: "Вверх", icon: "mdi-arrow-up-bold", color: "surface" },
  { direction: "left", key: "a", label: "Влево", icon: "mdi-arrow-left-bold", color: "surface" },
  { direction: "down", key: "s", label: "Вниз", icon: "mdi-arrow-down-bold", color: "surface" },
  { direction: "right", key: "d", label: "Вправо", icon: "mdi-arrow-right-bold", color: "surface" }
];

const rows = computed(() => Array.from({ length: boardState.value.height }, (_, row) => row));
const columns = computed(() => Array.from({ length: boardState.value.width }, (_, column) => column));
const directionButtons = computed<GameWasdControl[]>(() => directionControls.map((control) => ({
  id: control.direction,
  key: control.key,
  label: control.label,
  icon: control.icon,
  targetId: directionTargetId(control.direction),
  color: control.color
})));

function directionTargetId(direction: SnakeDirection) {
  return `route-snake:direction:${direction}`;
}

function chooseDirection(direction: SnakeDirection) {
  if (session.status !== "running" || isSpeaking.value) return;
  const previousDirection = boardState.value.direction;
  boardState.value = setSnakeDirection(boardState.value, direction);
  feedbackMessage.value = previousDirection === boardState.value.direction && previousDirection !== direction
    ? "Разворот слишком резкий. Продолжаем вперёд."
    : "Хорошо. Змейка повернёт.";
}

function chooseDirectionButton(control: GameWasdControl) {
  chooseDirection(control.id as SnakeDirection);
}

async function tick() {
  if (session.status !== "running" || isSpeaking.value) return;

  const now = performance.now();
  const delayMs = now < slowUntil.value ? 3300 : 2350;
  if (now - lastStepAt < delayMs) return;

  lastStepAt = now;
  const result = stepSnake(boardState.value);
  boardState.value = result.state;
  if (routeSnakeOutcome(result) === "loss") {
    feedbackMessage.value = result.event === "blocked-wall"
      ? "Змейка упёрлась в край поля. Раунд завершён, можно начать заново."
      : "Змейка встретила хвостик. Раунд завершён, можно начать заново.";
    recordMistake({ event: result.event, moved: result.moved, direction: boardState.value.direction, isCorrect: false });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["route-snake.mistake", "route-snake.complete"], 80, 170);
    finishSession("game-lost");
    isSpeaking.value = false;
    return;
  }
  await handleStepEvent(result.event, result.moved);
}

async function handleStepEvent(event: RouteSnakeStepEvent, moved: boolean) {
  if (event === "ate-food") {
    leavesEaten.value += 1;
    feedbackMessage.value = "Листочек найден. Змейка стала чуть длиннее.";
    recordSuccess({ event, leavesEaten: leavesEaten.value, snakeLength: boardState.value.snake.length });
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(["route-snake.correct"], 80, 170);
    isSpeaking.value = false;
    return;
  }

  if (event === "moved") {
    feedbackMessage.value = "Движемся постепенно. Можно выбрать новый путь.";
    recordSuccess({ event, head: boardState.value.snake[0] });
    return;
  }

  slowUntil.value = performance.now() + 2000;
  feedbackMessage.value = event === "blocked-wall"
    ? "Край поля рядом. Змейка замедлилась и повернула."
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
  promptAudio.cancelPending();
  boardState.value = createRouteSnakeState();
  feedbackMessage.value = "Выбери направление. Змейка движется сама и ищет листочек.";
  leavesEaten.value = 0;
  slowUntil.value = 0;
  isSpeaking.value = false;
  lastStepAt = performance.now();
  startSession();
  promptAudio.play("route-snake.prompt", 220);
}

function pauseGame() {
  pauseSession();
}

function resumeGame() {
  lastStepAt = performance.now();
  resumeSession();
}

onMounted(() => {
  promptAudio.warm();
  promptAudio.play("route-snake.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  window.clearInterval(stepTimer);
});
</script>

<template>
  <div class="route-snake-shell">
    <GameHud title="Змейка" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :paused="session.status === 'paused'" :show-progress="false" :show-timer="false" @pause="pauseGame" @resume="resumeGame" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="snake-card pa-4 pa-md-6" rounded="xl" elevation="10">
            <div class="text-overline text-success-darken-3 text-center mb-2"> маршрут без таймера</div>
            <h1 class="snake-title text-h4 text-md-h3 font-weight-bold text-center mb-2">Помоги змейке найти листочки</h1>
            <p class="snake-message text-body-1 text-center mb-4">{{ feedbackMessage }}</p>

            <div class="snake-layout">
              <div class="snake-board" role="grid" aria-label="Поле змейки">
                <div v-for="row in rows" :key="row" class="snake-row" role="row">
                  <div v-for="column in columns" :key="column" :class="cellClasses(row, column)" role="gridcell">
                    <v-icon v-if="isFood(row, column)" icon="mdi-leaf" color="green-darken-1" size="clamp(1.1rem, 3dvh, 1.75rem)" />
                  </div>
                </div>
              </div>

              <div class="snake-controls-panel">
                <div class="text-subtitle-1 font-weight-bold text-center mb-3">Поверни змейку</div>
                <GameWasdPanel class="snake-controls" :controls="directionButtons" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" min-height="clamp(4.2rem, 12dvh, 7rem)" aria-label="Направления змейки" :show-key-caps="false" @select="chooseDirectionButton" />
                <div class="snake-status mt-3">
                  <v-icon icon="mdi-leaf" size="1.25rem" />
                  <span>Листочки: {{ leavesEaten }}</span>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Змейка" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.route-snake-shell {
  background:
    radial-gradient(circle at 12% 18%, rgb(255 246 198 / 84%) 0 12rem, transparent 20rem),
    radial-gradient(circle at 88% 12%, rgb(125 210 157 / 46%) 0 10rem, transparent 18rem),
    linear-gradient(135deg, #d8f0dd 0%, #e8f4ff 52%, #fff2c7 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: clamp(4.5rem, 7.5dvh, 5.5rem);
}

.snake-layout {
  align-items: center;
  display: grid;
  gap: clamp(1rem, 2.8vw, 2rem);
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.72fr);
  justify-items: center;
}

.snake-card {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 95%), rgb(236 248 232 / 95%)),
    rgb(var(--v-theme-surface));
  border: 0.12rem solid rgb(21 94 60 / 24%);
  box-shadow: 0 1.2rem 3rem rgb(23 85 50 / 20%);
}

.snake-title {
  color: #113f2a;
  letter-spacing: -0.025em;
}

.snake-message {
  color: #234336;
  font-weight: 650;
}

.snake-controls-panel {
  background: linear-gradient(180deg, rgb(255 255 255 / 86%), rgb(217 239 216 / 92%));
  border: 0.12rem solid rgb(21 94 60 / 20%);
  border-radius: clamp(1rem, 2.8dvh, 1.6rem);
  box-shadow: 0 0.85rem 1.7rem rgb(36 86 54 / 14%);
  color: #153d2a;
  inline-size: min(100%, 32rem, 56dvh);
  padding: clamp(0.7rem, 1.8dvh, 1.1rem);
}

.snake-status {
  align-items: center;
  background: #1f6f43;
  border-radius: 999rem;
  color: #ffffff;
  display: flex;
  font-weight: 800;
  gap: 0.45rem;
  justify-content: center;
  letter-spacing: 0.01em;
  padding-block: 0.5rem;
  padding-inline: 0.9rem;
}

.snake-controls {
  inline-size: min(100%, 29rem, 50dvh);
}

.snake-controls :deep(.dwell-button) {
  background: linear-gradient(160deg, #ffffff 0%, #dff5df 100%) !important;
  border: 0.12rem solid rgb(23 99 57 / 34%);
  box-shadow: 0 0.55rem 1rem rgb(29 84 50 / 16%);
}

.snake-controls :deep(.dwell-button--active) {
  background: linear-gradient(160deg, #2f8d4c 0%, #145b35 100%) !important;
  border-color: rgb(255 255 255 / 82%);
}

.snake-controls :deep(.dwell-button--active.wasd-panel__content),
.snake-controls :deep(.dwell-button--active.wasd-panel__content span),
.snake-controls :deep(.dwell-button--active.wasd-panel__icon) {
  color: #ffffff !important;
}

.snake-board {
  background:
    linear-gradient(135deg, rgb(17 83 52 / 96%), rgb(36 123 68 / 92%)),
    rgb(var(--v-theme-surface));
  border: clamp(0.28rem, 0.9dvh, 0.5rem) solid #ffffff;
  border-radius: clamp(0.9rem, 2.8dvh, 1.75rem);
  box-shadow: 0 1rem 2.4rem rgb(19 79 45 / 25%), inset 0 0 0 0.125rem rgb(255 255 255 / 35%);
  display: grid;
  gap: clamp(0.16rem, 0.55dvh, 0.375rem);
  inline-size: min(100%, 72dvh, 39rem);
  padding: clamp(0.32rem, 1.1dvh, 0.75rem);
}

.snake-row {
  display: grid;
  gap: clamp(0.16rem, 0.55dvh, 0.375rem);
  grid-template-columns: repeat(9, minmax(0, 1fr));
}

.snake-cell {
  align-items: center;
  aspect-ratio: 1;
  background: linear-gradient(145deg, #f8fff0 0%, #dcedc8 100%);
  border-radius: clamp(0.38rem, 1.4dvh, 0.875rem);
  display: flex;
  justify-content: center;
  position: relative;
  transition: background-color 220ms ease, transform 220ms ease;
}

.snake-cell--body {
  background: linear-gradient(145deg, #75c96e 0%, #2f9148 100%);
  box-shadow: inset 0 0 0 0.12rem rgb(255 255 255 / 34%);
}

.snake-cell--head {
  background: linear-gradient(145deg, #38b957 0%, #11652f 100%);
  box-shadow: 0 0.45rem 1.25rem rgb(17 101 47 / 34%), inset 0 0 0 0.16rem rgb(255 255 255 / 42%);
  transform: scale(1.04);
}

.snake-cell--head::after {
  background: radial-gradient(circle, #ffffff 0 18%, transparent 20% 100%), radial-gradient(circle, #ffffff 0 18%, transparent 20% 100%);
  background-position: 34% 38%, 66% 38%;
  background-repeat: no-repeat;
  background-size: 32% 32%;
  content: "";
  inset: 0;
  position: absolute;
}

.snake-cell--food {
  background: linear-gradient(145deg, #fff3b0 0%, #ffcc4d 100%);
  box-shadow: inset 0 0 0 0.14rem rgb(121 83 0 / 20%);
}

.direction-content {
  align-items: center;
  display: flex;
  flex-direction: column;
  font-size: 1.1rem;
  font-weight: 700;
  gap: 0.625rem;
}

@media (max-width: 37.5rem) {
 .game-container {
    padding-block-start: 10.75rem;
  }

 .snake-board,
 .snake-row {
    gap: 0.25rem;
  }

 .snake-cell {
    border-radius: 0.625rem;
  }
}

@media (max-width: 50rem) {
 .snake-layout {
    gap: clamp(0.75rem, 2dvh, 1.25rem);
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.85fr);
  }

 .snake-controls {
    inline-size: min(100%, 26rem, 45dvh);
  }
}

@media (max-height: 42.5rem) {
 .game-container {
    padding-block-start: 4.75rem;
  }

 .text-overline,
  h1,
 .v-card > p {
    display: none !important;
  }

 .snake-board {
    inline-size: min(100%, 72dvh, 31rem);
  }

 .snake-controls {
    inline-size: min(100%, 30rem, 48dvh);
  }

 .snake-layout {
    gap: clamp(0.75rem, 2vw, 1.25rem);
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.72fr);
  }
}
</style>
