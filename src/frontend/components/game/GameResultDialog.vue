<script setup lang="ts">
import { computed } from "vue";

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
  timeout: "время занятия закончилось",
  "too-many-mistakes": "много сложных попыток",
  manual: "завершено вручную",
  "game-complete": "игра завершена",
  "game-lost": "партия проиграна",
  "game-draw": "ничья"
};

const finishReason = computed(() => props.metrics?.finishReason);
const resultMessage = computed(() => {
  if (finishReason.value === "game-lost") return "Партия завершена. Можно спокойно попробовать ещё раз.";
  if (finishReason.value === "game-draw") return "Партия завершилась вничью.";
  if (finishReason.value === "too-many-mistakes") return "Сессия завершена: было много сложных попыток.";
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
  restart: [];
  menu: [];
}>();
</script>

<template>
  <v-dialog :model-value="props.modelValue" max-width="560" persistent transition="fade-transition" @update:model-value="emit('update:modelValue', $event)">
    <v-card class="pa-2" rounded="xl">
      <v-card-title class="text-h4 font-weight-bold">{{ title }}</v-card-title>
      <v-card-text>
        <p class="text-h6 mb-4">{{ resultMessage }}</p>
        <v-row>
          <v-col cols="6">
            <v-card color="primary" variant="tonal" rounded="lg" class="pa-4">
              <div class="text-caption">Успешные шаги</div>
              <div class="text-h4 font-weight-bold">{{ score }}</div>
            </v-card>
          </v-col>
          <v-col cols="6">
            <v-card color="warning" variant="tonal" rounded="lg" class="pa-4">
              <div class="text-caption">Ошибки</div>
              <div class="text-h4 font-weight-bold">{{ mistakes }}</div>
            </v-card>
          </v-col>
        </v-row>
        <v-alert class="mt-4" color="info" variant="tonal">
          Длительность: {{ Math.round(durationMs / 1000) }} сек. {{ recommendation }}
        </v-alert>
        <v-card v-if="metrics" class="mt-4 pa-4" color="surface" rounded="lg" variant="tonal">
          <div class="text-subtitle-2 font-weight-bold mb-3">Наблюдения для взрослого</div>
          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Завершение</div>
              <div class="text-body-2 font-weight-bold">{{ finishReasonLabels[metrics.finishReason ?? ''] ?? '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Валидный взгляд</div>
              <div class="text-body-2 font-weight-bold">{{ percent(metrics.validGazeRatio) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="text-caption text-medium-emphasis">Средний dwell</div>
              <div class="text-body-2 font-weight-bold">{{ milliseconds(metrics.meanDwellMs) }}</div>
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
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="secondary" variant="tonal" @click="emit('menu')">В меню</v-btn>
        <v-btn color="primary" variant="flat" @click="emit('restart')">Ещё раз</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
