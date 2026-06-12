<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import GameWasdPanel, { type GameWasdControl } from "../../components/game/GameWasdPanel.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { tanksNoShootingChoiceOutcome } from "./model";

type Direction = "up" | "down" | "left" | "right";

type RoutePoint = {
  row: number;
  column: number;
};

type TankRouteStep = {
  direction: Direction;
  label: string;
  cue: string;
};

type DirectionControl = {
  direction: Direction;
  key: "w" | "a" | "s" | "d";
  label: string;
  icon: string;
  color: string;
};

const gridSize = 5;
const routePoints: RoutePoint[] = [
  { row: 2, column: 0 },
  { row: 2, column: 1 },
  { row: 2, column: 2 },
  { row: 1, column: 2 },
  { row: 1, column: 3 },
  { row: 2, column: 3 },
  { row: 3, column: 3 },
  { row: 3, column: 2 },
  { row: 4, column: 2 },
  { row: 4, column: 3 },
  { row: 4, column: 4 }
];

const routeSteps: TankRouteStep[] = [
  { direction: "right", label: "Вправо", cue: "к первой зелёной плитке" },
  { direction: "right", label: "Вправо", cue: "по широкой дорожке" },
  { direction: "up", label: "Вверх", cue: "к спокойному повороту" },
  { direction: "right", label: "Вправо", cue: "мимо мягкого холма" },
  { direction: "down", label: "Вниз", cue: "на ровную дорожку" },
  { direction: "down", label: "Вниз", cue: "к тихой поляне" },
  { direction: "left", label: "Влево", cue: "обойти узкое место" },
  { direction: "down", label: "Вниз", cue: "к нижней дороге" },
  { direction: "right", label: "Вправо", cue: "к финишной дорожке" },
  { direction: "right", label: "Вправо", cue: "в спокойный гараж" }
];

const directionControls: DirectionControl[] = [
  { direction: "up", key: "w", label: "Вверх", icon: "mdi-arrow-up-bold", color: "blue-lighten-5" },
  { direction: "left", key: "a", label: "Влево", icon: "mdi-arrow-left-bold", color: "green-lighten-5" },
  { direction: "down", key: "s", label: "Вниз", icon: "mdi-arrow-down-bold", color: "blue-lighten-5" },
  { direction: "right", key: "d", label: "Вправо", icon: "mdi-arrow-right-bold", color: "green-lighten-5" }
];

const directionDegrees: Record<Direction, number> = {
  up: -90,
  down: 90,
  left: 180,
  right: 0
};

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession, finishSession } = useGameSession("tanks-no-shooting", {
  maxSteps: 10,
  dwellMs: 1300,
  sessionSeconds: 180,
  sound: false
}, { finishOnMistakes: false });

const feedbackText = ref("Выбери безопасное направление. Танк едет спокойно, без стрельбы и взрывов.");
const pendingChoice = ref(false);
const successDirection = ref<Direction>();
const wrongDirection = ref<Direction>();
const hintedDirection = ref<Direction>();
let feedbackTimer = 0;

const rows = computed(() => Array.from({ length: gridSize }, (_, row) => row));
const columns = computed(() => Array.from({ length: gridSize }, (_, column) => column));
const currentIndex = computed(() => Math.min(session.step, routePoints.length - 1));
const currentPoint = computed(() => routePoints[currentIndex.value]);
const nextPoint = computed(() => routePoints[Math.min(session.step + 1, routePoints.length - 1)]);
const expectedStep = computed(() => routeSteps[Math.min(session.step, routeSteps.length - 1)]);
const resultVisible = computed(() => session.status === "finished");
const progressPercent = computed(() => Math.round(Math.min(1, session.step / session.maxSteps) * 100));
const tankDirection = computed<Direction>(() => session.step === 0 ? "right" : routeSteps[Math.min(session.step - 1, routeSteps.length - 1)].direction);
const tankStyle = computed(() => ({ transform: `rotate(${directionDegrees[tankDirection.value]}deg)` }));
const directionButtons = computed<GameWasdControl[]>(() => directionControls.map((control) => ({
  id: control.direction,
  key: control.key,
  label: control.label,
  icon: control.icon,
  targetId: directionTargetId(control.direction),
  color: directionButtonColor(control),
  chipText: hintedDirection.value === control.direction ? "Сюда безопасно" : undefined,
  chipColor: "primary"
})));

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function directionTargetId(direction: Direction) {
  return `tanks-no-shooting:direction:${direction}`;
}

function pointMatches(point: RoutePoint | undefined, row: number, column: number) {
  return point?.row === row && point.column === column;
}

function isRouteCell(row: number, column: number) {
  return routePoints.some((point) => pointMatches(point, row, column));
}

function isVisitedCell(row: number, column: number) {
  return routePoints.slice(0, currentIndex.value + 1).some((point) => pointMatches(point, row, column));
}

function isNextCell(row: number, column: number) {
  return session.status === "running" && pointMatches(nextPoint.value, row, column) && !pointMatches(currentPoint.value, row, column);
}

function isCurrentCell(row: number, column: number) {
  return pointMatches(currentPoint.value, row, column);
}

function isStartCell(row: number, column: number) {
  return pointMatches(routePoints[0], row, column);
}

function isFinishCell(row: number, column: number) {
  return pointMatches(routePoints[routePoints.length - 1], row, column);
}

function cellClasses(row: number, column: number) {
  return [
    "tank-cell",
    {
      "tank-cell--route": isRouteCell(row, column),
      "tank-cell--visited": isVisitedCell(row, column),
      "tank-cell--next": isNextCell(row, column),
      "tank-cell--current": isCurrentCell(row, column),
      "tank-cell--finish": isFinishCell(row, column)
    }
  ];
}

function directionButtonColor(control: DirectionControl) {
  if (successDirection.value === control.direction) return "green-lighten-4";
  if (wrongDirection.value === control.direction) return "orange-lighten-4";
  if (hintedDirection.value === control.direction || control.direction === expectedStep.value.direction) return "teal-lighten-5";
  return control.color;
}

function resetChoiceState() {
  clearFeedbackTimer();
  pendingChoice.value = false;
  successDirection.value = undefined;
  wrongDirection.value = undefined;
  hintedDirection.value = undefined;
}

function chooseDirection(control: DirectionControl) {
  if (session.status !== "running" || pendingChoice.value) return;

  const expected = expectedStep.value;
  const targetId = directionTargetId(control.direction);
  const expectedTargetId = directionTargetId(expected.direction);
  clearFeedbackTimer();

  if (control.direction === expected.direction) {
    const willFinish = session.step + 1 >= session.maxSteps;
    pendingChoice.value = true;
    successDirection.value = control.direction;
    feedbackText.value = willFinish
      ? "Маршрут пройден. Танк спокойно заехал в гараж."
      : `Верно: ${control.label.toLowerCase()}. Танк едет ${expected.cue}.`;
    recordSuccess({
      targetId,
      expectedTargetId,
      direction: control.direction,
      routeIndex: session.step,
      isCorrect: true
    });

    if (session.status === "running") {
      feedbackTimer = window.setTimeout(() => {
        resetChoiceState();
        feedbackText.value = `Следующий безопасный ход: ${expectedStep.value.label.toLowerCase()}.`;
      }, 700);
    }
    return;
  }

  const outcome = tanksNoShootingChoiceOutcome(control.direction, expected.direction, session.mistakes + 1);
  pendingChoice.value = true;
  wrongDirection.value = control.direction;
  hintedDirection.value = expected.direction;
  feedbackText.value = outcome === "loss"
    ? "Третье неверное направление: танк съехал с маршрута, партия проиграна."
    : `Это направление сейчас не самое спокойное. Мягкая подсказка: выбери ${expected.label.toLowerCase()}.`;
  recordMistake({
    targetId,
    expectedTargetId,
    actual: control.direction,
    expected: expected.direction,
    routeIndex: session.step,
    outcome,
    isCorrect: false
  });
  if (outcome === "loss") {
    finishSession("game-lost");
    return;
  }
  recordHint({ targetId: expectedTargetId, reason: "safe-tank-route", expectedDirection: expected.direction, selectedDirection: control.direction });

  feedbackTimer = window.setTimeout(() => {
    pendingChoice.value = false;
    wrongDirection.value = undefined;
  }, 1000);
}

function chooseDirectionButton(control: GameWasdControl) {
  const directionControl = directionControls.find((item) => item.direction === control.id);
  if (directionControl) chooseDirection(directionControl);
}

function restart() {
  resetChoiceState();
  feedbackText.value = "Выбери безопасное направление. Танк едет спокойно, без стрельбы и взрывов.";
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
});
</script>

<template>
  <div class="tanks-shell">
    <GameHud title="Танчики без стрельбы" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />

    <v-container class="tanks-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-4 pa-md-7" rounded="xl" elevation="8">
            <div class="text-overline text-primary text-center mb-2">Стратегия: безопасный маршрут</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Проведи танк по тихой дороге</h1>
            <p class="text-h6 text-md-h5 text-medium-emphasis text-center mb-5">
              Выбирай направление по одному шагу. Третья ошибка завершает маршрут.
            </p>

            <v-alert class="compact-feedback mb-5 text-h6" :color="hintedDirection ? 'primary' : 'teal'" :icon="hintedDirection ? 'mdi-lightbulb-on-outline' : 'mdi-shield-check-outline'" rounded="xl" variant="tonal">
              {{ feedbackText }}
            </v-alert>

            <v-row align="stretch" justify="center">
              <v-col cols="12" lg="7" class="order-2 order-lg-1">
                <v-card class="tank-map-card pa-4 pa-md-5" color="green-lighten-5" rounded="xl" variant="flat">
                  <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
                    <v-chip color="primary" size="large" variant="flat">Шаг {{ session.step }} из {{ session.maxSteps }}</v-chip>
                    <v-chip color="teal" size="large" variant="tonal">Финиш: тихий гараж</v-chip>
                  </div>

                  <div class="tank-grid mx-auto" role="grid" aria-label="Безопасный маршрут танка">
                    <div v-for="row in rows" :key="row" class="tank-row" role="row">
                      <div v-for="column in columns" :key="column" :class="cellClasses(row, column)" role="gridcell">
                        <v-icon v-if="isCurrentCell(row, column)" class="tank-icon" icon="mdi-tank" color="blue-grey-darken-3" size="44" :style="tankStyle" />
                        <v-icon v-else-if="isFinishCell(row, column)" icon="mdi-garage" color="teal-darken-2" size="34" />
                        <v-icon v-else-if="isStartCell(row, column)" icon="mdi-flag-outline" color="primary" size="30" />
                        <v-icon v-else-if="isNextCell(row, column)" icon="mdi-map-marker-check-outline" color="teal-darken-2" size="32" />
                      </div>
                    </div>
                  </div>

                  <v-progress-linear class="mt-5" :model-value="progressPercent" color="teal" height="14" rounded />
                  <div class="text-body-2 text-medium-emphasis mt-2 text-center">{{ progressPercent }}% маршрута · следующий ход: {{ expectedStep.label }}</div>
                </v-card>
              </v-col>

              <v-col cols="12" lg="5" class="order-1 order-lg-2">
                <div class="text-h5 font-weight-bold text-center mb-4">Куда повернуть?</div>
                <GameWasdPanel :controls="directionButtons" :disabled="session.status !== 'running' || pendingChoice" :dwell-ms="session.settings.dwellMs" aria-label="Направления танка" @select="chooseDirectionButton">
                  <template #control="{ control, active, progress }">
                    <div class="direction-card">
                      <span class="direction-key">{{ control.key.toUpperCase() }}</span>
                      <v-icon :icon="control.icon" color="primary" size="48" />
                      <div class="text-h6 text-md-h5 font-weight-bold mt-1">{{ control.label }}</div>
                      <v-chip v-if="control.chipText" class="mt-2" color="primary" variant="flat">{{ control.chipText }}</v-chip>
                      <v-chip v-else-if="active" class="mt-2" color="secondary" variant="flat">Держи взгляд {{ Math.round(progress * 100) }}%</v-chip>
                    </div>
                  </template>
                </GameWasdPanel>

                <v-alert class="mt-4" color="info" icon="mdi-hand-heart-outline" rounded="xl" variant="tonal">
                  Здесь нет стрельбы, взрывов и проигрыша от ошибки: танк просто ждёт новый выбор.
                </v-alert>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <GameResultDialog :model-value="resultVisible" title="Танчики без стрельбы" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.tanks-shell {
  background: linear-gradient(135deg, #e8f5e9 0%, #eef7ff 52%, #fff8e1 100%);
  min-block-size: 100vh;
}

.tanks-container {
  padding-block-start: 8.25rem;
}

.tank-map-card {
  border: 0.125rem solid rgb(var(--v-theme-primary) / 18%);
}

.tank-grid {
  background: rgb(var(--v-theme-surface));
  border: 0.5rem solid rgb(var(--v-theme-primary) / 14%);
  border-radius: 1.75rem;
  display: grid;
  gap: 0.45rem;
  max-inline-size: min(70vh, 34rem);
  padding: 0.75rem;
}

.tank-row {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(5, 1fr);
}

.tank-cell {
  align-items: center;
  aspect-ratio: 1;
  background: linear-gradient(135deg, #dcedc8, #c8e6c9);
  border-radius: 1.1rem;
  display: flex;
  justify-content: center;
  min-inline-size: 0;
}

.tank-cell--route {
  background: linear-gradient(135deg, #fffde7, #fff8e1);
  box-shadow: inset 0 0 0 0.18rem rgb(var(--v-theme-primary) / 16%);
}

.tank-cell--visited {
  background: linear-gradient(135deg, #b2dfdb, #dcedc8);
}

.tank-cell--next {
  box-shadow: inset 0 0 0 0.22rem rgb(var(--v-theme-primary) / 46%);
}

.tank-cell--current {
  background: linear-gradient(135deg, #bbdefb, #b2dfdb);
  box-shadow: 0 0 0 0.25rem rgb(var(--v-theme-primary) / 20%);
}

.tank-cell--finish {
  background: linear-gradient(135deg, #b2dfdb, #e0f2f1);
}

.tank-icon {
  transition: transform 180ms ease;
}

.direction-card {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-block-size: 8.5rem;
  text-align: center;
}

.direction-key {
  border: 0.1em solid rgb(var(--v-theme-primary) / 28%);
  border-radius: 0.65em;
  color: rgb(var(--v-theme-primary));
  font-size: 0.78em;
  line-height: 1;
  min-inline-size: 1.9em;
  padding: 0.32em 0.5em;
}

@media (max-width: 600px) {
  .tanks-container {
    padding-block-start: 7.5rem;
  }

  .tank-grid {
    border-width: 0.35rem;
    gap: 0.3rem;
    padding: 0.45rem;
  }

  .tank-row {
    gap: 0.3rem;
  }

  .tank-cell {
    border-radius: 0.8rem;
  }
}

@media (max-height: 680px) {
  .compact-feedback {
    display: none;
  }
}
</style>
