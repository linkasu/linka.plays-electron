<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import GameDwellButton from "../../components/game/GameDwellButton.vue";
import GameHud from "../../components/game/GameHud.vue";
import GameResultDialog from "../../components/game/GameResultDialog.vue";
import { resolveMenuRoute } from "../../core/menuMode";
import { useGameSession } from "../../core/session";
import { createDayRoutineBoard, findDayRoutinePeriod, type DayRoutineItem, type DayRoutinePeriod } from "./model";

const router = useRouter();
const { session, durationMs, metrics, recommendation, pauseSession, resumeSession, recordSuccess, recordMistake, recordHint, startSession } = useGameSession("day-routine", {
  maxSteps: 8,
  dwellMs: 1300,
  sessionSeconds: 130,
  sound: false
}, {
  finishOnMistakes: false
});

const board = createDayRoutineBoard(session.maxSteps);
const placedItemIds = ref<string[]>([]);
const resultVisible = ref(false);
const feedbackMessage = ref("Начинаем с утра. Выбери картинку, которая бывает утром.");
const wrongChoiceId = ref<string>();
const highlightedPeriodId = ref<DayRoutinePeriod["id"]>("morning");
let feedbackTimer = 0;
let resultTimer = 0;

const currentPeriod = computed(() => board.periods.find((period) => board.items.some((item) => item.periodId === period.id && !placedItemIds.value.includes(item.id))));
const remainingChoices = computed(() => board.choices.filter((item) => !placedItemIds.value.includes(item.id)));

function itemTargetId(item: DayRoutineItem) {
  return `day-routine:choice:${item.id}`;
}

function periodItems(period: DayRoutinePeriod) {
  return board.items.filter((item) => item.periodId === period.id && placedItemIds.value.includes(item.id));
}

function clearFeedbackTimer() {
  window.clearTimeout(feedbackTimer);
  feedbackTimer = 0;
}

function clearResultTimer() {
  window.clearTimeout(resultTimer);
  resultTimer = 0;
}

function resetFeedback() {
  clearFeedbackTimer();
  wrongChoiceId.value = undefined;
  highlightedPeriodId.value = currentPeriod.value?.id ?? "morning";
}

function choose(item: DayRoutineItem) {
  if (session.status !== "running") return;

  const expectedPeriod = currentPeriod.value;
  if (!expectedPeriod) return;

  const targetId = itemTargetId(item);
  const roundId = `day-routine:period:${expectedPeriod.id}:step:${session.step + 1}`;
  resetFeedback();

  if (item.periodId === expectedPeriod.id) {
    placedItemIds.value = [...placedItemIds.value, item.id];
    recordSuccess({ roundId, targetId, answerId: item.id, expected: expectedPeriod.label, actual: item.label, isCorrect: true });

    const nextPeriod = currentPeriod.value;
    if (session.status === "running" && nextPeriod) {
      feedbackMessage.value = `Верно. Теперь ищем картинки: ${nextPeriod.label}.`;
      highlightedPeriodId.value = nextPeriod.id;
    } else {
      feedbackMessage.value = "Вся последовательность дня собрана: утро, день, вечер.";
    }
    return;
  }

  const actualPeriod = findDayRoutinePeriod(item.periodId);
  wrongChoiceId.value = item.id;
  highlightedPeriodId.value = expectedPeriod.id;
  feedbackMessage.value = `Почти. ${item.hint} Сейчас нужна картинка про ${expectedPeriod.label}.`;
  recordMistake({ roundId, targetId, expectedTargetId: `day-routine:period:${expectedPeriod.id}`, answerId: item.id, expected: expectedPeriod.label, actual: actualPeriod?.label ?? item.periodId, isCorrect: false });
  recordHint({ roundId, targetId, hint: feedbackMessage.value });
  feedbackTimer = window.setTimeout(() => {
    wrongChoiceId.value = undefined;
  }, 1400);
}

function choiceColor(item: DayRoutineItem) {
  if (wrongChoiceId.value === item.id) return "orange-lighten-4";
  return "surface";
}

function restart() {
  clearFeedbackTimer();
  clearResultTimer();
  placedItemIds.value = [];
  resultVisible.value = false;
  feedbackMessage.value = "Начинаем с утра. Выбери картинку, которая бывает утром.";
  wrongChoiceId.value = undefined;
  highlightedPeriodId.value = "morning";
  startSession();
}

onUnmounted(() => {
  clearFeedbackTimer();
  clearResultTimer();
});

watch(() => session.status, (status) => {
  if (status === "finished") {
    clearResultTimer();
    resultTimer = window.setTimeout(() => {
      resultVisible.value = true;
    }, 900);
  } else {
    clearResultTimer();
    resultVisible.value = false;
  }
});
</script>

<template>
  <div class="day-routine-shell">
    <GameHud title="Утро-день-вечер" :step="session.step" :max-steps="session.maxSteps" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :session-seconds="session.settings.sessionSeconds" :paused="session.status === 'paused'" @pause="pauseSession" @resume="resumeSession" />
    <v-container class="game-container" fluid>
      <v-row justify="center">
        <v-col cols="12" xl="10">
          <v-card class="pa-5 pa-md-8" rounded="xl" elevation="8">
            <div class="text-overline text-secondary text-center mb-2">Последовательность дня</div>
            <h1 class="text-h4 text-md-h3 font-weight-bold text-center mb-3">Что бывает {{ currentPeriod?.label ?? "дальше" }}?</h1>
            <p class="text-body-1 text-medium-emphasis text-center mb-6">{{ feedbackMessage }}</p>

            <v-row class="mb-6" align="stretch">
              <v-col v-for="period in board.periods" :key="period.id" cols="12" md="4">
                <v-card :class="['period-card', { 'period-card--active': highlightedPeriodId === period.id }]" :color="period.color" rounded="xl" variant="flat">
                  <div class="d-flex align-center ga-3 mb-3">
                    <v-avatar color="surface" size="56"><v-icon :icon="period.icon" size="34" /></v-avatar>
                    <div>
                      <div class="text-h5 font-weight-bold">{{ period.title }}</div>
                      <div class="text-body-2 text-medium-emphasis">{{ period.helper }}</div>
                    </div>
                  </div>

                  <div class="placed-grid" :aria-label="`Картинки: ${period.title}`">
                    <v-card v-for="item in periodItems(period)" :key="item.id" class="pa-3 text-center" color="surface" rounded="lg" variant="elevated">
                      <div class="placed-emoji emoji-glyph">{{ item.emoji }}</div>
                      <div class="text-subtitle-2 font-weight-bold">{{ item.label }}</div>
                    </v-card>
                    <v-card v-if="periodItems(period).length === 0" class="empty-slot d-flex align-center justify-center text-medium-emphasis" color="surface" rounded="lg" variant="tonal">
                      <span>Ждёт картинку</span>
                    </v-card>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-divider class="mb-5" />
            <div class="text-h6 font-weight-bold text-center mb-4">Выбери подходящую картинку</div>
            <v-row justify="center">
              <v-col v-for="item in remainingChoices" :key="item.id" cols="6" sm="4" lg="3">
                <GameDwellButton :target-id="itemTargetId(item)" :disabled="session.status !== 'running'" :dwell-ms="session.settings.dwellMs" :min-height="168" :color="choiceColor(item)" @select="choose(item)">
                  <template #default>
                    <div class="choice-emoji emoji-glyph">{{ item.emoji }}</div>
                    <div class="text-subtitle-1 text-md-h6 font-weight-bold mt-2">{{ item.label }}</div>
                  </template>
                </GameDwellButton>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
    <GameResultDialog :model-value="resultVisible" title="Утро-день-вечер" :score="session.score" :mistakes="session.mistakes" :duration-ms="durationMs" :metrics="metrics" :recommendation="recommendation" @menu="router.push(resolveMenuRoute())" @restart="restart" />
  </div>
</template>

<style scoped>
.day-routine-shell {
  background: linear-gradient(135deg, #fff8e1 0%, #e3f2fd 48%, #ede7f6 100%);
  min-block-size: 100vh;
}

.game-container {
  padding-block-start: 132px;
}

.period-card {
  block-size: 100%;
  border: 2px solid transparent;
  padding: 18px;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.period-card--active {
  border-color: rgb(var(--v-theme-primary) / 56%);
  box-shadow: 0 0 0 6px rgb(var(--v-theme-primary) / 12%);
  transform: translateY(-2px);
}

.placed-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
}

.empty-slot {
  min-block-size: 104px;
}

.choice-emoji {
  font-size: clamp(3.8rem, 8vw, 6.4rem);
  line-height: 1;
}

.placed-emoji {
  font-size: 2.5rem;
  line-height: 1;
}

@media (max-width: 600px) {
  .game-container {
    padding-block-start: 156px;
  }
}
</style>
