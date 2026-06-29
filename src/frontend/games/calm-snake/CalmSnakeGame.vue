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
import { calmSnakeOutcome, createCalmSnakeState, setSnakeDirection, stepSnake, type CalmSnakeStepEvent, type SnakeDirection, type SnakePoint } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSessionFor("calm-snake", {
  maxSteps: 24,
  overrides: { motionSpeed: 0.65, targetScale: 1.25, sound: true },
  finishOnMaxSteps: false,
  finishOnMistakes: false
});
const soundEnabled = toRef(session.settings, "sound");
const promptAudio = useGamePromptAudio({ gameId: "calm-snake", soundEnabled, warmAssetIds: ["calm-snake.prompt", "calm-snake.correct", "calm-snake.mistake", "calm-snake.complete"] });
const feedbackAudio = useStandardGameFeedback(soundEnabled);

const boardState = ref(createCalmSnakeState());
const feedbackMessage = ref("Выбери направление. Змейка движется сама и спокойно ищет листочек.");
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
  return `calm-snake:direction:${direction}`;
}

function chooseDirection(direction: SnakeDirection) {
  if (session.status !== "running" || isSpeaking.value) return;
  const previousDirection = boardState.value.direction;
  boardState.value = setSnakeDirection(boardState.value, direction);
  feedbackMessage.value = previousDirection === boardState.value.direction && previousDirection !== direction
    ? "Разворот слишком резкий. Продолжаем мягко вперёд."
    : "Хорошо. Змейка повернёт спокойно.";
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
  if (calmSnakeOutcome(result) === "loss") {
    feedbackMessage.value = result.event === "blocked-wall"
      ? "Змейка упёрлась в край поля. Раунд завершён, можно начать заново."
      : "Змейка встретила хвостик. Раунд завершён, можно начать заново.";
    recordMistake({ event: result.event, moved: result.moved, direction: boardState.value.direction, isCorrect: false });
    isSpeaking.value = true;
    void feedbackAudio.playMistake();
    await promptAudio.playSequenceAndWait(["calm-snake.mistake", "calm-snake.complete"], 80, 170);
    finishSession("game-lost");
    isSpeaking.value = false;
    return;
  }
  await handleStepEvent(result.event, result.moved);
}

async function handleStepEvent(event: CalmSnakeStepEvent, moved: boolean) {
  if (event === "ate-food") {
    leavesEaten.value += 1;
    feedbackMessage.value = "Листочек найден. Змейка стала чуть длиннее.";
    recordSuccess({ event, leavesEaten: leavesEaten.value, snakeLength: boardState.value.snake.length });
    const willFinish = session.step >= session.maxSteps;
    isSpeaking.value = true;
    void feedbackAudio.playSuccess();
    await promptAudio.playSequenceAndWait(willFinish ? ["calm-snake.correct", "calm-snake.complete"] : ["calm-snake.correct"], 80, 170);
    if (willFinish) finishSession("game-complete");
    isSpeaking.value = false;
    return;
  }

  if (event === "moved") {
    feedbackMessage.value = "Движемся медленно. Можно выбрать новый путь.";
    recordSuccess({ event, head: boardState.value.snake[0] });
    if (session.step >= session.maxSteps) {
      isSpeaking.value = true;
      await promptAudio.playSequenceAndWait(["calm-snake.complete"], 80, 170);
      finishSession("game-complete");
      isSpeaking.value = false;
    }
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
  promptAudio.cancelPending();
  boardState.value = createCalmSnakeState();
  feedbackMessage.value = "Выбери направление. Змейка движется сама и спокойно ищет листочек.";
  leavesEaten.value = 0;
  slowUntil.value = 0;
  isSpeaking.value = false;
  lastStepAt = performance.now();
  startSession();
  promptAudio.play("calm-snake.prompt", 220);
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
  promptAudio.play("calm-snake.prompt", 420);
});

onUnmounted(() => {
  promptAudio.cancelPending();
  window.clearInterval(stepTimer);
});
</script>

<template>
  <div class="calm-snake-shell">
    <GameHud title="Змейка спокойная" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseGame" @resume="resumeGame" />

    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-6" color="surface" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Медленный маршрут</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-2">Помоги змейке найти листочки</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-4">{{ feedbackMessage }}</p>

            <v-row align="center" justify="center" class="ga-2">
              <v-col cols="12" md="7" class="order-2">
                <div class="snake-board mx-auto" role="grid" aria-label="Поле спокойной змейки">
                  <div v-for="row in rows" :key="row" class="snake-row" role="row">
                    <div v-for="column in columns" :key="column" :class="cellClasses(row, column)" role="gridcell">
                      <v-icon v-if="isFood(row, column)" icon="mdi-leaf" color="green-darken-1" size="1.75rem" />
                    </div>
                  </div>
                </div>
              </v-col>

              <v-col cols="12" md="5" class="order-1">
                <GameWasdPanel :controls="directionButtons" :disabled="session.status !== 'running' || isSpeaking" :dwell-ms="session.settings.dwellMs" aria-label="Направления змейки" @select="chooseDirectionButton" />
              </v-col>
            </v-row>

            <v-row class="mt-4" justify="center">
              <v-col cols="12" md="8">
                <v-alert color="info" rounded="xl" variant="tonal">
                  Листочки: {{ leavesEaten }}. Если рядом край или хвостик, змейка мягко замедляется и ищет свободный путь.
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
  padding-block-start: 8.25rem;
}

.snake-board {
  background: rgb(var(--v-theme-surface));
  border: 0.5rem solid rgb(var(--v-theme-primary) / 18%);
  border-radius: 1.75rem;
  box-shadow: inset 0 0 0 0.125rem rgb(var(--v-theme-secondary) / 18%);
  display: grid;
  gap: 0.375rem;
  max-inline-size: min(72vh, 38.75rem);
  padding: 0.75rem;
}

.snake-row {
  display: grid;
  gap: 0.375rem;
  grid-template-columns: repeat(9, minmax(0, 1fr));
}

.snake-cell {
  align-items: center;
  aspect-ratio: 1;
  background: #f2f8ec;
  border-radius: 0.875rem;
  display: flex;
  justify-content: center;
  transition: background-color 220ms ease, transform 220ms ease;
}

.snake-cell--body {
  background: #9bd18d;
}

.snake-cell--head {
  background: #4caf50;
  box-shadow: 0 0.375rem 1.125rem rgb(76 175 80 / 24%);
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

@media (max-height: 42.5rem) {
  .game-container {
    padding-block-start: 5rem;
  }

  .text-overline,
  h1,
  .v-card > p,
  .v-alert {
    display: none !important;
  }

  .snake-board {
    border-width: 0.35rem;
    gap: 0.25rem;
    max-inline-size: min(43vh, 24rem);
    padding: 0.45rem;
  }

  .snake-row {
    gap: 0.25rem;
  }
}
</style>
