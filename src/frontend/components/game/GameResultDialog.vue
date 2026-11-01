<script setup lang="ts">
import { computed, inject, onUnmounted, watch } from "vue";
import { useDwellSettings } from "../../core/dwellSettings";
import { mountGameAfresh } from "../../core/gameEndMode";
import { resolveMenuMode } from "../../core/menuMode";
import { gameSessionRunKey } from "../../core/session";
import GameDwellButton from "./GameDwellButton.vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  score: number;
  mistakes: number;
  durationMs: number;
  recommendation: string;
  metrics?: {
    finishReason?: string;
    validGazeRatio?: number;
    meanDwellMs?: number;
    targetCancels?: number;
    gazeLostCount?: number;
    hintsUsed?: number;
  };
}>();

const finishReasonLabels: Record<string, string> = {
  "max-steps": "все шаги выполнены",
  "timeout": "время занятия закончилось",
  "too-many-mistakes": "много сложных попыток",
  "manual": "завершено вручную",
  "game-complete": "игра завершена",
  "game-lost": "раунд остановлен",
  "game-draw": "ничья",
};

const finishReason = computed(() => props.metrics?.finishReason);
const runContext = inject(gameSessionRunKey, undefined);
const continuesRun = computed(() => props.modelValue && runContext?.willContinue() === true);
// Games open this dialog from their own endings, and the time limit can stop them
// before any of those: mid-speech, or in a game that never expected a timeout.
const timeRanOut = computed(() => runContext?.timeRanOut() === true);
const isRun = computed(() => (runContext?.run.mode ?? "successes") !== "successes");
const totalScore = computed(() =>
  isRun.value ? (runContext?.totalSuccesses() ?? props.score) : props.score,
);
const totalMistakes = computed(() =>
  isRun.value ? (runContext?.totalMistakes() ?? props.mistakes) : props.mistakes,
);
const totalDurationMs = computed(() => props.durationMs + (runContext?.run.activeMsBefore ?? 0));
const { dwellMs } = useDwellSettings();
const isSelfMode = computed(() => resolveMenuMode() === "self");
const resultMessage = computed(() => {
  if (finishReason.value === "game-lost") return "Партия завершена. Можно попробовать ещё раз.";
  if (finishReason.value === "game-draw") return "Партия завершилась вничью.";
  if (finishReason.value === "too-many-mistakes")
    return "Сессия завершена: было много сложных попыток.";
  return "Хорошая работа. Сессия завершена.";
});

function percent(value?: number) {
  if (value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function milliseconds(value?: number) {
  if (value === undefined) return "—";
  return `${Math.round(value)} мс`;
}

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  "restart": [];
  "menu": [];
}>();

// Long enough for the final phrase, which the next round would cut off.
const NEXT_ROUND_DELAY_MS = 1500;
let nextRoundTimer: number | undefined;

function clearNextRoundTimer() {
  if (nextRoundTimer !== undefined) window.clearTimeout(nextRoundTimer);
  nextRoundTimer = undefined;
}

watch(
  continuesRun,
  (continues) => {
    clearNextRoundTimer();
    if (!continues) return;
    nextRoundTimer = window.setTimeout(() => {
      nextRoundTimer = undefined;
      runContext?.continueRun();
      if (runContext?.keepsInstanceBetweenRounds) emit("restart");
      else mountGameAfresh();
    }, NEXT_ROUND_DELAY_MS);
  },
  { immediate: true },
);

// A finished game can still be waiting on its speech, with more to do once it stops.
// A new mount leaves that code holding the finished session and the old round.
function restart() {
  if (timeRanOut.value) mountGameAfresh();
  else emit("restart");
}

onUnmounted(clearNextRoundTimer);
</script>

<template>
  <v-dialog
    :model-value="(props.modelValue && !continuesRun) || timeRanOut"
    max-width="56rem"
    persistent
    transition="fade-transition"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="game-result-card pa-4 pa-md-6" rounded="xl">
      <v-card-title class="text-h4 text-md-h3 font-weight-bold text-center pb-2">{{
        title
      }}</v-card-title>
      <v-card-text>
        <p class="text-h5 text-center mb-6">{{ resultMessage }}</p>
        <v-row>
          <v-col cols="6">
            <v-card color="primary" variant="tonal" rounded="lg" class="pa-4">
              <div class="text-caption">Успешные шаги</div>
              <div class="text-h4 font-weight-bold">{{ totalScore }}</div>
            </v-card>
          </v-col>
          <v-col cols="6">
            <v-card color="warning" variant="tonal" rounded="lg" class="pa-4">
              <div class="text-caption">Ошибки</div>
              <div class="text-h4 font-weight-bold">{{ totalMistakes }}</div>
            </v-card>
          </v-col>
        </v-row>
        <v-alert class="mt-4" color="info" variant="tonal">
          Длительность: {{ Math.round(totalDurationMs / 1000) }} сек. {{ recommendation }}
        </v-alert>
        <v-card
          v-if="metrics && !isSelfMode"
          class="mt-4 pa-4"
          color="surface"
          rounded="lg"
          variant="tonal"
        >
          <div class="text-subtitle-2 font-weight-bold mb-3">Наблюдения для взрослого</div>
          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Завершение</div>
              <div class="text-body-2 font-weight-bold">
                {{ finishReasonLabels[metrics.finishReason ?? ""] ?? "—" }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Валидный взгляд</div>
              <div class="text-body-2 font-weight-bold">{{ percent(metrics.validGazeRatio) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Средний dwell</div>
              <div class="text-body-2 font-weight-bold">
                {{ milliseconds(metrics.meanDwellMs) }}
              </div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Отмены выбора</div>
              <div class="text-body-2 font-weight-bold">{{ metrics.targetCancels ?? 0 }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Потери взгляда</div>
              <div class="text-body-2 font-weight-bold">{{ metrics.gazeLostCount ?? 0 }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Подсказки</div>
              <div class="text-body-2 font-weight-bold">{{ metrics.hintsUsed ?? 0 }}</div>
            </v-col>
          </v-row>
        </v-card>
        <v-row class="mt-6 result-actions" align="stretch" dense>
          <v-col cols="12" sm="6">
            <GameDwellButton
              target-id="result-restart"
              :dwell-ms="dwellMs"
              min-height="clamp(8rem, 18vh, 12rem)"
              color="primary"
              @select="restart"
            >
              <template #default>
                <div class="d-flex flex-column align-center justify-center ga-3 text-white">
                  <v-icon icon="mdi-refresh" size="56" />
                  <div class="text-h4 font-weight-bold">Ещё раз</div>
                  <div class="text-body-1">Повторить эту игру</div>
                </div>
              </template>
            </GameDwellButton>
          </v-col>
          <v-col cols="12" sm="6">
            <GameDwellButton
              target-id="result-menu"
              :dwell-ms="dwellMs"
              min-height="clamp(8rem, 18vh, 12rem)"
              color="secondary"
              @select="emit('menu')"
            >
              <template #default>
                <div class="d-flex flex-column align-center justify-center ga-3 text-white">
                  <v-icon icon="mdi-view-grid-outline" size="56" />
                  <div class="text-h4 font-weight-bold">В меню</div>
                  <div class="text-body-1">Выбрать другую игру</div>
                </div>
              </template>
            </GameDwellButton>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.result-actions :deep(.dwell-hitbox) {
  block-size: 100%;
}
</style>
