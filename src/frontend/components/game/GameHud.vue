<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { resolveMenuRoute } from "../../core/menuMode";
import GazePointerOverlay from "./GazePointerOverlay.vue";
import TobiiStatusBadge from "../TobiiStatusBadge.vue";

const props = defineProps<{
  title: string;
  step: number;
  maxSteps: number;
  score?: number;
  mistakes?: number;
  durationMs?: number;
  sessionSeconds?: number;
  paused?: boolean;
}>();

const emit = defineEmits<{
  pause: [];
  resume: [];
}>();

const router = useRouter();
const progress = computed(() => props.maxSteps > 0 ? Math.min(100, (props.step / props.maxSteps) * 100) : 0);
const remainingSeconds = computed(() => {
  if (props.durationMs === undefined || props.sessionSeconds === undefined) return undefined;
  return Math.max(0, Math.ceil(props.sessionSeconds - props.durationMs / 1000));
});
</script>

<template>
  <div class="game-hud d-flex flex-wrap align-center ga-2 pa-3">
    <v-btn color="surface" density="comfortable" prepend-icon="mdi-arrow-left" variant="flat" @click="router.push(resolveMenuRoute())">
      В меню
    </v-btn>
    <v-btn color="surface" density="comfortable" :prepend-icon="paused ? 'mdi-play' : 'mdi-pause'" variant="flat" @click="paused ? emit('resume') : emit('pause')">
      {{ paused ? "Продолжить" : "Пауза" }}
    </v-btn>
    <v-card class="px-3 py-1" color="surface" rounded="pill" variant="flat">
      <div class="text-caption text-medium-emphasis">{{ title }}</div>
      <div class="text-body-2 font-weight-bold">Шаг {{ step }} / {{ maxSteps }}</div>
      <v-progress-linear class="mt-1" :model-value="progress" color="primary" height="6" rounded />
    </v-card>
    <v-chip v-if="score !== undefined" color="primary" size="small" variant="flat">Успех: {{ score }}</v-chip>
    <v-chip v-if="mistakes !== undefined" color="warning" size="small" variant="tonal">Ошибки: {{ mistakes }}</v-chip>
    <v-chip v-if="remainingSeconds !== undefined" color="info" prepend-icon="mdi-timer-outline" size="small" variant="tonal">
      {{ remainingSeconds }} сек
    </v-chip>
    <TobiiStatusBadge />
  </div>
  <GazePointerOverlay />
</template>

<style scoped>
.game-hud {
  left: 0;
  pointer-events: auto;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 10;
}
</style>
