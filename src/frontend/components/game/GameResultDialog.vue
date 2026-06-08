<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
  title: string;
  score: number;
  mistakes: number;
  durationMs: number;
  recommendation: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  restart: [];
  menu: [];
}>();
</script>

<template>
  <v-dialog :model-value="props.modelValue" max-width="560" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-card class="pa-2" rounded="xl">
      <v-card-title class="text-h4 font-weight-bold">{{ title }}</v-card-title>
      <v-card-text>
        <p class="text-h6 mb-4">Хорошая работа. Сессия завершена.</p>
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
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="secondary" variant="tonal" @click="emit('menu')">В меню</v-btn>
        <v-btn color="primary" variant="flat" @click="emit('restart')">Ещё раз</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
