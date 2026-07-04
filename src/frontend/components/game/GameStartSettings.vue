<script setup lang="ts">
import { ref, watch } from "vue";
import { settingsFromPreset, type DifficultyPreset, type SessionSettings } from "../../core/settings";

const props = defineProps<{ modelValue: SessionSettings }>();
const emit = defineEmits<{ "update:modelValue": [settings: SessionSettings] }>();

const preset = ref<DifficultyPreset>(props.modelValue.preset);

watch(preset, (nextPreset) => {
  emit("update:modelValue", settingsFromPreset(nextPreset));
});
</script>

<template>
  <v-card class="pa-4" rounded="xl" variant="tonal">
    <div class="text-subtitle-1 font-weight-bold mb-3">Настройки занятия</div>
    <v-btn-toggle v-model="preset" color="primary" divided mandatory rounded="lg" variant="outlined">
      <v-btn value="gentle"></v-btn>
      <v-btn value="standard">Обычно</v-btn>
      <v-btn value="challenge">Сложнее</v-btn>
    </v-btn-toggle>
  </v-card>
</template>
